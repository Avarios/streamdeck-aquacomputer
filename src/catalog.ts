import type { QuadroStatus } from "./status.ts";

/** One entry of a property-inspector list (sdpi-components "datasource" item). */
export type CatalogItem = { value: string; label: string; disabled: boolean };

/** Event names the property inspectors request (see `datasource="..."` in ui/*.html). */
export const DATASOURCE = { values: "getValues", sensors: "getSensors", fans: "getFans" } as const;

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

/** Items for a property-inspector request, or undefined if the event is not ours. */
export function catalogFor(event: string, st?: QuadroStatus): CatalogItem[] | undefined {
  switch (event) {
    case DATASOURCE.values:
      return valueCatalog(st);
    case DATASOURCE.sensors:
      return temperatureSensors(st);
    case DATASOURCE.fans:
      return fanChannels(st);
    default:
      return undefined;
  }
}
