/**
 * Optional source for PC sensors (CPU, GPU, mainboard, drives ...): the "Remote Web Server" of
 * LibreHardwareMonitor (https://github.com/LibreHardwareMonitor/LibreHardwareMonitor), which serves
 * the whole sensor tree as JSON under http://localhost:8085/data.json.
 *
 * The parser is pure (unit-tested); `LhmClient` polls the server while the option is switched on.
 */
import { EventEmitter } from "node:events";

export const DEFAULT_LHM_URL = "http://localhost:8085/data.json";

const POLL_MS = 1000;
const RETRY_MS = 5000;
const TIMEOUT_MS = 2000;

/** Node of LibreHardwareMonitor's data.json (only the fields we use). */
interface LhmNode {
  Text?: string;
  Value?: string;
  RawValue?: string;
  SensorId?: string;
  Type?: string;
  ImageURL?: string;
  Children?: LhmNode[];
}

export interface LhmSensor {
  /** stable key: LHM's SensorId (e.g. "/amdcpu/0/temperature/2"), or a name path for older versions */
  id: string;
  /** sensor name, e.g. "CPU Package" */
  name: string;
  /** hardware the sensor belongs to, e.g. "AMD Ryzen 7 5800X" */
  hardware: string;
  /** sensor type, e.g. "Temperature", "Load", "Clock", "Power", "Fan" */
  type: string;
  /** null = no reading ("-") */
  value: number | null;
  /** unit as shown by LHM, e.g. "°C", "%", "MHz", "W" */
  unit: string;
  /** decimals LHM uses for this sensor */
  decimals: number;
}

/**
 * Parses a value as formatted by LHM, e.g. "45.3 °C", "45,3 °C" (German locale), "4500 MHz", "-".
 * LHM uses fixed-point formats without thousands separators, so a lone comma is a decimal comma.
 */
export function parseLhmValue(text: string | undefined): { value: number | null; unit: string; decimals: number } {
  const m = /^\s*(-?\d[\d.,\s\u00a0\u202f]*)\s*(.*?)\s*$/.exec(text ?? "");
  if (!m) return { value: null, unit: (text ?? "").replace(/^[\s-]+/, "").trim(), decimals: 0 };
  let num = m[1].replace(/[\s\u00a0\u202f]/g, "");
  const lastComma = num.lastIndexOf(",");
  const lastDot = num.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // both present: the last one is the decimal separator, the other groups thousands
    const dec = lastComma > lastDot ? "," : ".";
    num = num.split(dec === "," ? "." : ",").join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    num = num.replace(",", ".");
  }
  const value = Number(num);
  if (!Number.isFinite(value)) return { value: null, unit: m[2], decimals: 0 };
  const dot = num.indexOf(".");
  return { value, unit: m[2], decimals: dot >= 0 ? num.length - dot - 1 : 0 };
}

/** "Temperatures" -> "Temperature" (fallback for LHM versions without the "Type" field). */
const singular = (group: string) => (group.endsWith("ies") ? `${group.slice(0, -3)}y` : group.replace(/s$/, ""));

const isSensor = (n: LhmNode) =>
  typeof n.SensorId === "string" || n.ImageURL === "images/transparent.png" || (!n.Children?.length && !!n.Value);

/**
 * Flattens LHM's tree (root -> computer -> hardware [-> sub-hardware] -> type group -> sensor)
 * into a list of sensors, in tree order.
 */
export function parseLhm(json: unknown): LhmSensor[] {
  const out: LhmSensor[] = [];
  const seen = new Set<string>();
  const walk = (node: LhmNode, path: LhmNode[]) => {
    if (path.length > 0 && isSensor(node)) {
      const group = path.at(-1)?.Text ?? "";
      const hardware = path.at(-2)?.Text ?? "";
      const name = node.Text ?? "";
      let parsed = parseLhmValue(node.Value);
      if (parsed.value === null && node.RawValue) {
        const raw = parseLhmValue(node.RawValue);
        if (raw.value !== null) parsed = { ...raw, unit: parsed.unit || raw.unit };
      }
      let id = node.SensorId || `${hardware}/${group}/${name}`;
      if (seen.has(id)) id = `${id}#${out.length}`;
      seen.add(id);
      out.push({ id, name, hardware, type: node.Type || singular(group), ...parsed });
      return;
    }
    for (const child of node.Children ?? []) walk(child, [...path, node]);
  };
  if (json && typeof json === "object") walk(json as LhmNode, []);
  return out;
}

/** Accepts "localhost:8085", "http://host:port" or a full URL; empty -> default. Only http(s). */
export function normalizeLhmUrl(input: string | undefined): string {
  let s = (input ?? "").trim();
  if (!s) return DEFAULT_LHM_URL;
  if (!/^[a-z]+:\/\//i.test(s)) s = `http://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return DEFAULT_LHM_URL;
    if (u.pathname === "" || u.pathname === "/") u.pathname = "/data.json";
    return u.toString();
  } catch {
    return DEFAULT_LHM_URL;
  }
}

/** Value text for a key: LHM's own decimals, reduced so the number stays short. */
export function formatLhm(s: LhmSensor): string {
  if (s.value === null) return "--";
  let d = Math.min(s.decimals, 2);
  let text = s.value.toFixed(d);
  while (d > 0 && text.length > 5) text = s.value.toFixed(--d);
  return text;
}

/** Minimum graph range per sensor type, so small fluctuations don't look dramatic. */
export function minSpanFor(type: string): number {
  switch (type) {
    case "Temperature":
      return 2;
    case "Load":
    case "Control":
    case "Level":
      return 10;
    case "Clock":
    case "Fan":
    case "Frequency":
      return 200;
    case "Power":
      return 5;
    case "Voltage":
      return 0.2;
    default:
      return 1;
  }
}

export type LhmState = "off" | "connecting" | "ok" | "error";

/**
 * Polls LibreHardwareMonitor while enabled. Events: "update" (new sensor list), "state" (LhmState).
 */
export class LhmClient extends EventEmitter {
  state: LhmState = "off";
  error = "";
  sensors: LhmSensor[] = [];
  url = DEFAULT_LHM_URL;

  private byId = new Map<string, LhmSensor>();
  private timer?: NodeJS.Timeout;
  /** bumped on every (re)configuration, so a poll still in flight is discarded */
  private generation = 0;

  configure(enabled: boolean, url?: string): void {
    const next = normalizeLhmUrl(url);
    const running = this.state !== "off";
    if (enabled === running && next === this.url) return;
    this.url = next;
    this.generation++;
    clearTimeout(this.timer);
    this.setSensors([]);
    if (!enabled) {
      this.error = "";
      this.setState("off");
      return;
    }
    this.setState("connecting");
    void this.poll(this.generation);
  }

  get(id: string | undefined): LhmSensor | undefined {
    return id ? this.byId.get(id) : undefined;
  }

  private async poll(gen: number): Promise<void> {
    let delay = POLL_MS;
    try {
      const res = await fetch(this.url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const sensors = parseLhm(await res.json());
      if (gen !== this.generation) return;
      if (sensors.length === 0) throw new Error("no sensors in data.json");
      this.error = "";
      this.setSensors(sensors);
      this.setState("ok");
      this.emit("update", sensors);
    } catch (e) {
      if (gen !== this.generation) return;
      const err = e as Error & { cause?: { code?: string } };
      this.error =
        err.name === "TimeoutError" ? "LHM timeout" : err.cause?.code === "ECONNREFUSED" ? "LHM not running" : `LHM: ${err.message}`;
      this.setSensors([]);
      this.setState("error");
      delay = RETRY_MS;
    } finally {
      if (gen === this.generation) this.timer = setTimeout(() => void this.poll(gen), delay);
    }
  }

  private setSensors(sensors: LhmSensor[]): void {
    this.sensors = sensors;
    this.byId = new Map(sensors.map((s) => [s.id, s]));
  }

  private setState(state: LhmState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit("state", state);
  }
}

export const lhm = new LhmClient();
