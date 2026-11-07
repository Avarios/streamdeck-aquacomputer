import type { LhmSensor } from "./lhm.ts";
import type { QuadroStatus } from "./status.ts";

/** Ring buffers of recent samples per series (one sample per status report, ~1/s). */
export class History {
  private readonly data = new Map<string, number[]>();

  /** @param max samples kept per series (default 1800 = 30 min at 1/s) */
  private readonly max: number;

  constructor(max = 1800) {
    this.max = max;
  }

  push(key: string, value: number): void {
    let a = this.data.get(key);
    if (!a) this.data.set(key, (a = []));
    a.push(value);
    if (a.length > this.max) a.splice(0, a.length - this.max);
  }

  /** Last `count` samples, oldest first. */
  get(key: string, count: number): number[] {
    const a = this.data.get(key);
    return a ? a.slice(-count) : [];
  }
}

/** Series keys used by the actions. */
export const seriesKey = {
  temp: (sensor: number) => `temp:${sensor}`,
  fan: (fan: number, kind: "rpm" | "percent" | "power") => `fan:${fan}:${kind}`,
  virt: (n: number) => `virt:${n}`,
  flow: "flow",
  voltage: "voltage",
  /** PC sensor from LibreHardwareMonitor, by its id */
  lhm: (id: string) => `lhm:${id}`,
} as const;

export function recordStatus(h: History, st: QuadroStatus): void {
  st.temps.forEach((t, i) => {
    if (t !== null) h.push(seriesKey.temp(i + 1), t);
  });
  st.virtualTemps.forEach((t, i) => {
    if (t !== null) h.push(seriesKey.virt(i + 1), t);
  });
  st.fans.forEach((f, i) => {
    h.push(seriesKey.fan(i + 1, "rpm"), f.rpm);
    h.push(seriesKey.fan(i + 1, "percent"), f.pwmPercent);
    h.push(seriesKey.fan(i + 1, "power"), f.powerW);
  });
  h.push(seriesKey.flow, st.flowLPerH);
  h.push(seriesKey.voltage, st.inputVoltageV);
}

/** One sample per LibreHardwareMonitor poll (~1/s) for every sensor with a reading. */
export function recordLhm(h: History, sensors: LhmSensor[]): void {
  for (const s of sensors) if (s.value !== null) h.push(seriesKey.lhm(s.id), s.value);
}

export const history = new History();
