import { formatLhm, type LhmSensor, type LhmState } from "./lhm.ts";
import { sortDevices } from "./devices.ts";
import type { QuadroStatus } from "./status.ts";

/** One entry of a property-inspector list (sdpi-components "datasource" item). */
export type CatalogItem = { value: string; label: string; disabled: boolean };
/** Option group of a dropdown (sdpi-components renders it as <optgroup>). */
export type CatalogGroup = { label: string; children: CatalogItem[] };
export type CatalogEntry = CatalogItem | CatalogGroup;

/** What the property inspectors need to know about LibreHardwareMonitor. */
export interface PcSource {
  state: LhmState;
  error: string;
  sensors: LhmSensor[];
}

/** Event names the property inspectors request (see `datasource="..."` in ui/*.html). */
export const DATASOURCE = {
  values: "getValues",
  sensors: "getSensors",
  fans: "getFans",
  /** connected Quadros (device dropdown) */
  devices: "getDevices",
  /** PC sensors grouped by hardware (dropdown) */
  pcSensors: "getPcSensors",
  /** PC sensors as flat list (checkbox list of the rotation) */
  pcSensorList: "getPcSensorList",
} as const;

/** Fans below this speed without any current draw are most likely not connected (tacho noise). */
const IDLE_RPM = 200;

const fmtT = (t: number) => `${t.toFixed(1)} °C`;
const item = (value: string, label: string, disabled = false): CatalogItem => ({ value, label, disabled });
const n = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

function fanHint(st: QuadroStatus | undefined, i: number): string {
  const f = st?.fans[i];
  return f && f.rpm < IDLE_RPM && f.currentA === 0 ? " (probably unconnected)" : "";
}

/**
 * Temperature sensors: value "1".."4" (Quadro) or "v1".."v16" (virtual).
 * Without a status all sensors are listed; with a status, unused virtual sensors are hidden
 * and unconnected Quadro sensors are greyed out. Labels carry the live reading.
 */
export function temperatureSensors(st?: QuadroStatus): CatalogItem[] {
  const out: CatalogItem[] = [];
  for (const i of n(4)) {
    const t = st?.temps[i - 1];
    out.push(item(String(i), st ? (t == null ? `Temp ${i} – not connected` : `Temp ${i} – ${fmtT(t)}`) : `Temp ${i}`, st ? t == null : false));
  }
  for (const i of n(16)) {
    const t = st?.virtualTemps[i - 1];
    if (st && t == null) continue;
    out.push(item(`v${i}`, st && t != null ? `Virtual ${i} – ${fmtT(t)}` : `Virtual ${i}`));
  }
  return out;
}

/** Fan channels 1-4 with the current speed. */
export function fanChannels(st?: QuadroStatus): CatalogItem[] {
  return n(4).map((i) => item(String(i), st ? `Fan ${i} – ${st.fans[i - 1].rpm} rpm${fanHint(st, i - 1)}` : `Fan ${i}`));
}

/**
 * Every readable value (tokens as used by the rotation: temp1-4, virt1-16, fan/pwm/power1-4,
 * flow, volt), built from the latest report so the list reflects what the device delivers now.
 */
export function valueCatalog(st?: QuadroStatus): CatalogItem[] {
  const out: CatalogItem[] = [];
  for (const i of n(4)) {
    const t = st?.temps[i - 1];
    out.push(item(`temp${i}`, st ? (t == null ? `Temp ${i} – not connected` : `Temp ${i} – ${fmtT(t)}`) : `Temp ${i}`, st ? t == null : false));
  }
  for (const i of n(16)) {
    const t = st?.virtualTemps[i - 1];
    if (st && t == null) continue;
    out.push(item(`virt${i}`, st && t != null ? `Virtual ${i} – ${fmtT(t)}` : `Virtual ${i}`));
  }
  for (const i of n(4)) {
    const f = st?.fans[i - 1];
    out.push(item(`fan${i}`, f ? `Fan ${i} RPM – ${f.rpm}${fanHint(st, i - 1)}` : `Fan ${i} – RPM`));
  }
  for (const i of n(4)) {
    const f = st?.fans[i - 1];
    out.push(item(`pwm${i}`, f ? `Fan ${i} output – ${f.pwmPercent.toFixed(1)} %` : `Fan ${i} – Output %`));
  }
  for (const i of n(4)) {
    const f = st?.fans[i - 1];
    out.push(item(`power${i}`, f ? `Fan ${i} power – ${f.powerW.toFixed(2)} W` : `Fan ${i} – Power W`));
  }
  out.push(item("flow", st ? `Flow – ${st.flowLPerH.toFixed(1)} l/h` : "Flow"));
  out.push(item("volt", st ? `Input voltage – ${st.inputVoltageV.toFixed(2)} V` : "Input voltage"));
  return out;
}

const pcValue = (s: LhmSensor) => (s.value === null ? "no reading" : `${formatLhm(s)} ${s.unit}`.trim());

/** Placeholder entry while LibreHardwareMonitor is off or unreachable, otherwise undefined. */
function pcStatusItem(pc: PcSource | undefined): CatalogItem | undefined {
  if (!pc || pc.state === "off") return item("", "LibreHardwareMonitor is switched off (option below)", true);
  if (pc.state === "connecting") return item("", "Connecting to LibreHardwareMonitor ...", true);
  if (pc.state === "error") return item("", `LibreHardwareMonitor not reachable (${pc.error})`, true);
  return undefined;
}

/** PC sensors grouped by hardware, e.g. "AMD Ryzen 7 5800X" -> "Temperature: CPU Package – 45.3 °C". */
export function pcSensorGroups(pc?: PcSource): CatalogEntry[] {
  const status = pcStatusItem(pc);
  if (status) return [status];
  const groups = new Map<string, CatalogItem[]>();
  for (const s of pc!.sensors) {
    let g = groups.get(s.hardware);
    if (!g) groups.set(s.hardware, (g = []));
    g.push(item(s.id, `${s.type}: ${s.name} – ${pcValue(s)}`));
  }
  return [...groups].map(([label, children]) => ({ label: label || "Other", children }));
}

/** PC sensors as one flat list, e.g. "AMD Ryzen 7 5800X › Temperature: CPU Package – 45.3 °C". */
export function pcSensorList(pc?: PcSource): CatalogItem[] {
  const status = pcStatusItem(pc);
  if (status) return [status];
  return pc!.sensors.map((s) => item(s.id, `${s.hardware} › ${s.type}: ${s.name} – ${pcValue(s)}`));
}

/**
 * Device dropdown: "Automatic" (= lowest serial number) plus every connected Quadro with a few live
 * values to tell them apart. A configured but missing device stays selectable ("not connected").
 */
export function deviceCatalog(online: QuadroStatus[], current?: string): CatalogItem[] {
  const sorted = sortDevices(online);
  const out = [item("", sorted[0] ? `Automatic – Quadro ${sorted[0].serial}` : "Automatic (first Quadro found)")];
  for (const st of sorted) {
    const t = st.temps.find((x) => x !== null);
    const hint = [t != null ? fmtT(t) : "", `${st.flowLPerH.toFixed(0)} l/h`].filter(Boolean).join(", ");
    out.push(item(st.serial, `Quadro ${st.serial} – ${hint}`));
  }
  const wanted = (current ?? "").trim();
  if (wanted && !sorted.some((s) => s.serial === wanted)) out.push(item(wanted, `Quadro ${wanted} – not connected`));
  return out;
}

/** Items for a property-inspector request, or undefined if the event is not ours. */
export function catalogFor(
  event: string,
  st?: QuadroStatus,
  pc?: PcSource,
  devices?: { online: QuadroStatus[]; current?: string },
): CatalogEntry[] | undefined {
  switch (event) {
    case DATASOURCE.values:
      return valueCatalog(st);
    case DATASOURCE.sensors:
      return temperatureSensors(st);
    case DATASOURCE.fans:
      return fanChannels(st);
    case DATASOURCE.devices:
      return deviceCatalog(devices?.online ?? (st ? [st] : []), devices?.current);
    case DATASOURCE.pcSensors:
      return pcSensorGroups(pc);
    case DATASOURCE.pcSensorList:
      return pcSensorList(pc);
    default:
      return undefined;
  }
}
