import { action } from "@elgato/streamdeck";
import { graphSeries, type GraphSettings } from "../graph.ts";
import { seriesKey } from "../history.ts";
import { lhm } from "../lhm.ts";
import { COLORS, num, offlineView, type KeyView } from "../render.ts";
import { pcSensorView } from "../rotation.ts";
import type { QuadroStatus } from "../status.ts";
import { LiveAction } from "./live-action.ts";

type Settings = GraphSettings & {
  /** LibreHardwareMonitor sensor id */
  sensor?: string;
  label?: string;
  /** turns red at or above this value */
  warn?: string;
  /** turns red at or below this value */
  low?: string;
};

/** One sensor of LibreHardwareMonitor (CPU, GPU, mainboard, drives ...). Independent of the Quadro. */
@action({ UUID: "com.avarios.aquars.pcsensor" })
export class PcSensorAction extends LiveAction<Settings> {
  protected defaultLabel(s: Settings): string {
    return s.label || lhm.get(s.sensor)?.name || "PC Sensor";
  }

  protected override current(s: Settings): KeyView {
    const label = this.defaultLabel(s);
    if (lhm.state === "off") return { label, value: "off", sub: "enable LHM", color: COLORS.idle };
    if (lhm.state !== "ok") return offlineView(label, lhm.error || "connecting");
    if (!s.sensor) return { label, value: "--", sub: "pick a sensor", color: COLORS.idle };

    const sensor = lhm.get(s.sensor);
    if (!sensor) {
      // keep the graph of a sensor that is temporarily missing (e.g. GPU in power saving)
      return { label, value: "--", sub: "not found", color: COLORS.idle, series: graphSeries(seriesKey.lhm(s.sensor), s) };
    }
    const view = pcSensorView(sensor, s, s.label);
    const warn = num(s.warn);
    const low = num(s.low);
    const v = sensor.value;
    if (v !== null && ((warn !== undefined && v >= warn) || (low !== undefined && v <= low))) view.color = COLORS.warn;
    return view;
  }

  /** not used: `current` is overridden */
  protected view(_s: Settings, _st: QuadroStatus | undefined): KeyView {
    return { label: "", value: "" };
  }
}
