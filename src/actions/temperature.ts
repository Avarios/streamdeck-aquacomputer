import { action } from "@elgato/streamdeck";
import { COLORS, num, type KeyView } from "../render.ts";
import type { QuadroStatus } from "../status.ts";
import { graphSeries, type GraphSettings } from "../graph.ts";
import { seriesKey } from "../history.ts";
import { LiveAction } from "./live-action.ts";

type Settings = GraphSettings & { sensor?: string; label?: string; warn?: string; fahrenheit?: boolean };

@action({ UUID: "com.avarios.aquars.temperature" })
export class TemperatureAction extends LiveAction<Settings> {
  /** sensor setting: "1".."4" = Quadro sensor, "v1".."v16" = virtual sensor */
  private sensorOf(s: Settings): { virtual: boolean; n: number } {
    const m = /^v(\d+)$/i.exec((s.sensor ?? "").trim());
    return m ? { virtual: true, n: Number(m[1]) } : { virtual: false, n: num(s.sensor, 1) ?? 1 };
  }

  protected defaultLabel(s: Settings): string {
    const { virtual, n } = this.sensorOf(s);
    return s.label || (virtual ? `Virtual ${n}` : `Temp ${n}`);
  }

  protected view(s: Settings, st: QuadroStatus | undefined): KeyView {
    const { virtual, n } = this.sensorOf(s);
    const c = (virtual ? st?.virtualTemps : st?.temps)?.[n - 1] ?? null;
    const label = this.defaultLabel(s);
    if (c === null) return { label, value: "--", sub: "no sensor", color: COLORS.idle };

    const warn = num(s.warn);
    const value = s.fahrenheit ? c * 1.8 + 32 : c;
    const f = (v: number) => (s.fahrenheit ? v * 1.8 + 32 : v);
    return {
      series: graphSeries(virtual ? seriesKey.virt(n) : seriesKey.temp(n), s)?.map(f),
      minSpan: s.fahrenheit ? 3.6 : 2,
      label,
      value: value.toFixed(1),
      unit: s.fahrenheit ? "°F" : "°C",
      color: warn !== undefined && c >= warn ? COLORS.warn : COLORS.ok,
    };
  }
}
