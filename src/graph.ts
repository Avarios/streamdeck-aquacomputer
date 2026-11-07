import { history } from "./history.ts";
import { num } from "./render.ts";

/** Common graph-related settings of all actions. */
export type GraphSettings = { noGraph?: boolean; window?: string };

/**
 * Samples for the background graph (1 sample/s), or undefined if the graph is switched off.
 * `scope` = device prefix (see `deviceScope`) for Quadro values, empty for PC sensors.
 */
export function graphSeries(key: string, s: GraphSettings, scope = ""): number[] | undefined {
  if (s.noGraph) return undefined;
  const minutes = num(s.window, 5) ?? 5;
  return history.get(scope + key, Math.max(10, Math.round(minutes * 60)));
}
