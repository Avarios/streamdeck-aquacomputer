import { action } from "@elgato/streamdeck";
import { COLORS, num, type KeyView } from "../render.ts";
import type { QuadroStatus } from "../status.ts";
import { graphSeries, type GraphSettings } from "../graph.ts";
import { seriesKey } from "../history.ts";
import { LiveAction } from "./live-action.ts";

type Settings = GraphSettings & { label?: string; minFlow?: string };

@action({ UUID: "com.avarios.aquars.flow" })
export class FlowAction extends LiveAction<Settings> {
  protected defaultLabel(s: Settings): string {
    return s.label || "Flow";
  }

  protected view(s: Settings, st: QuadroStatus | undefined): KeyView {
    const flow = st?.flowLPerH ?? 0;
    const min = num(s.minFlow);
    return {
      series: graphSeries(seriesKey.flow, s),
      minSpan: 10,
      label: this.defaultLabel(s),
      value: flow.toFixed(1),
      unit: "l/h",
      color: min !== undefined && flow < min ? COLORS.warn : COLORS.ok,
    };
  }
}
