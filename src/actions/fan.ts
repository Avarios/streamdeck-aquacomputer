import { action } from "@elgato/streamdeck";
import { COLORS, num, type KeyView } from "../render.ts";
import type { QuadroStatus } from "../status.ts";
import { graphSeries, type GraphSettings } from "../graph.ts";
import { seriesKey } from "../history.ts";
import { LiveAction } from "./live-action.ts";

type Mode = "rpm" | "percent" | "power";
type Settings = GraphSettings & { fan?: string; mode?: Mode; label?: string; minRpm?: string };

const MODES: Mode[] = ["rpm", "percent", "power"];

@action({ UUID: "com.avarios.aquars.fan" })
export class FanAction extends LiveAction<Settings> {
  /** Key press / dial turn cycles the display mode (not persisted). */
  private readonly override = new Map<string, Mode>();

  protected defaultLabel(s: Settings): string {
    return s.label || `Fan ${num(s.fan, 1)}`;
  }

  protected override async advance(id: string, delta: number): Promise<void> {
    const inst = this.instances.get(id);
    const current = this.override.get(id) ?? inst?.settings.mode ?? "rpm";
    this.override.set(id, MODES[(MODES.indexOf(current) + delta + MODES.length) % MODES.length]);
    await this.draw(id);
  }

  protected override onRemove(id: string): void {
    this.override.delete(id);
  }

  protected view(s: Settings, st: QuadroStatus | undefined, id: string): KeyView {
    const idx = (num(s.fan, 1) ?? 1) - 1;
    const fan = st?.fans[idx];
    const label = this.defaultLabel(s);
    if (!fan) return { label, value: "--", color: COLORS.idle };

    const mode = this.override.get(id) ?? s.mode ?? "rpm";
    const minRpm = num(s.minRpm);
    const stalled = minRpm !== undefined && fan.rpm < minRpm;
    const color = stalled ? COLORS.warn : COLORS.ok;

    const series = graphSeries(seriesKey.fan(idx + 1, mode), s);
    switch (mode) {
      case "percent":
        return { series, minSpan: 10, label, value: fan.pwmPercent.toFixed(1), unit: "%", sub: `${fan.rpm} rpm`, color };
      case "power":
        return { series, minSpan: 0.5, label, value: fan.powerW.toFixed(2), unit: "W", sub: `${Math.round(fan.currentA * 1000)} mA`, color };
      default:
        return { series, minSpan: 200, label, value: String(fan.rpm), unit: "rpm", sub: `${fan.pwmPercent.toFixed(0)} %`, color };
    }
  }
}
