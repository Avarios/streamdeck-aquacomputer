import { graphSeries, type GraphSettings } from "./graph.ts";
import { seriesKey } from "./history.ts";
import { COLORS, num, type KeyView } from "./render.ts";
import type { QuadroStatus } from "./status.ts";

export type RotateSettings = GraphSettings & {
  /** seconds per value (default 5) */
  interval?: string;
  noTemps?: boolean;
  noFans?: boolean;
  noFlow?: boolean;
  noVoltage?: boolean;
  /** fan channels to include, e.g. "1,2,3" or "*" (default all) */
  fans?: string;
  /**
   * Explicit value list, overrides the checkboxes. "*" = everything. Tokens (comma separated):
   * temp1-4, virt1-16, fan1-4 (rpm), pwm1-4 (output %), power1-4 (W), flow, volt.
   * A trailing * works as wildcard: "temp*", "fan*".
   */
  values?: string;
  /** values ticked in the checkbox list (token array, see `values`) */
  pick?: string[];
  /** blacklist, same syntax as `values` (wildcards allowed); applied last */
  exclude?: string;
  /** blacklist ticked in the checkbox list */
  skip?: string[];
  /** comma separated names in channel order, e.g. "Loop out, Before CPU, After CPU" */
  tempLabels?: string;
  fanLabels?: string;
};

const list = (v: string | undefined): string[] => (v ?? "").split(",").map((x) => x.trim());

const range = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
/** Every available value, in display order. */
export const ALL_TOKENS = [
  ...range("temp", 4),
  ...range("virt", 16),
  ...range("fan", 4),
  ...range("pwm", 4),
  ...range("power", 4),
  "flow",
  "volt",
];

/** Expands "*" and "prefix*" wildcards of the values field into concrete tokens. */
export function expandTokens(values: string): string[] {
  const out: string[] = [];
  for (const raw of list(values)) {
    const t = raw.toLowerCase();
    if (!t) continue;
    if (t === "*" || t === "all") out.push(...ALL_TOKENS);
    else if (t.endsWith("*")) out.push(...ALL_TOKENS.filter((x) => x.startsWith(t.slice(0, -1))));
    else out.push(t);
  }
  return out.filter((t, i) => out.indexOf(t) === i);
}

/** Text field + checkbox list -> concrete tokens. Ticked boxes follow the canonical order. */
export function tokensFrom(text: string | undefined, picked: string[] | undefined): string[] {
  const fromText = text?.trim() ? expandTokens(text) : [];
  const fromList = ALL_TOKENS.filter((t) => (picked ?? []).includes(t));
  return [...fromText, ...fromList].filter((t, i, a) => a.indexOf(t) === i);
}

/** Tokens selected by the legacy checkboxes + fan channel field. */
function legacyTokens(s: RotateSettings): string[] {
  const tokens: string[] = [];
  if (!s.noTemps) tokens.push(...range("temp", 4));
  if (!s.noFans) {
    const f = s.fans?.trim();
    const wanted = !f || f === "*" ? [1, 2, 3, 4] : list(f).map(Number).filter((n) => n >= 1 && n <= 4);
    tokens.push(...wanted.map((n) => `fan${n}`));
  }
  if (!s.noFlow) tokens.push("flow");
  if (!s.noVoltage) tokens.push("volt");
  return tokens;
}

/** All values to cycle through, in the configured order. Disconnected sensors are skipped. */
export function buildItems(s: RotateSettings, st: QuadroStatus): KeyView[] {
  const tempLabels = list(s.tempLabels);
  const fanLabels = list(s.fanLabels);
  const selected = tokensFrom(s.values, s.pick);
  const excluded = new Set(tokensFrom(s.exclude, s.skip));
  const tokens = (selected.length > 0 ? selected : legacyTokens(s)).filter((t) => !excluded.has(t));
  const items: KeyView[] = [];

  for (const token of tokens) {
    const m = /^(temp|virt|fan|pwm|power)(\d+)$/.exec(token);
    const n = m ? Number(m[2]) : 0;
    const fanName = fanLabels[n - 1] || `Fan ${n}`;

    switch (m?.[1] ?? token) {
      case "temp":
      case "virt": {
        const isTemp = m![1] === "temp";
        const t = (isTemp ? st.temps : st.virtualTemps)[n - 1];
        if (t === null || t === undefined) break; // not connected / unknown
        items.push({
          label: isTemp ? tempLabels[n - 1] || `Temp ${n}` : `Virtual ${n}`,
          value: t.toFixed(1),
          unit: "°C",
          series: graphSeries(isTemp ? seriesKey.temp(n) : seriesKey.virt(n), s),
          minSpan: 2,
        });
        break;
      }
      case "fan":
      case "pwm":
      case "power": {
        const f = st.fans[n - 1];
        if (!f) break;
        const kind = m![1];
        items.push(
          kind === "fan"
            ? { label: fanName, value: String(f.rpm), unit: "rpm", sub: `${f.pwmPercent.toFixed(0)} %`, series: graphSeries(seriesKey.fan(n, "rpm"), s), minSpan: 200 }
            : kind === "pwm"
              ? { label: `${fanName} %`, value: f.pwmPercent.toFixed(1), unit: "%", sub: `${f.rpm} rpm`, series: graphSeries(seriesKey.fan(n, "percent"), s), minSpan: 10 }
              : { label: `${fanName} W`, value: f.powerW.toFixed(2), unit: "W", sub: `${Math.round(f.currentA * 1000)} mA`, series: graphSeries(seriesKey.fan(n, "power"), s), minSpan: 0.5 },
        );
        break;
      }
      case "flow":
        items.push({ label: "Flow", value: st.flowLPerH.toFixed(1), unit: "l/h", series: graphSeries(seriesKey.flow, s), minSpan: 10 });
        break;
      case "volt":
        items.push({ label: "Input", value: st.inputVoltageV.toFixed(2), unit: "V", series: graphSeries(seriesKey.voltage, s), minSpan: 0.5, color: COLORS.ok });
        break;
    }
  }
  return items;
}

/** Which item is shown: advances every `intervalS` seconds; `offset` is added by key presses. */
export function pickIndex(nowMs: number, startMs: number, offset: number, intervalS: number, count: number): number {
  if (count <= 0) return 0;
  const steps = Math.floor(Math.max(0, nowMs - startMs) / (intervalS * 1000));
  return (((steps + offset) % count) + count) % count;
}

export const intervalOf = (s: RotateSettings): number => Math.max(1, num(s.interval, 5) ?? 5);
