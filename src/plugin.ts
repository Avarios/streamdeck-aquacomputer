import streamDeck from "@elgato/streamdeck";
import { FanAction } from "./actions/fan.ts";
import { FlowAction } from "./actions/flow.ts";
import { RotateAction } from "./actions/rotate.ts";
import { TemperatureAction } from "./actions/temperature.ts";
import { catalogFor } from "./catalog.ts";
import { history, recordStatus } from "./history.ts";
import { quadro } from "./quadro.ts";

const actions = [new TemperatureAction(), new FanAction(), new FlowAction(), new RotateAction()];
actions.forEach((a) => streamDeck.actions.registerAction(a));

const refresh = () => void Promise.all(actions.map((a) => a.refreshAll()));
// record first, so the graph already contains the newest sample when the keys redraw
quadro.on("status", (st) => {
  recordStatus(history, st);
  refresh();
});
quadro.on("state", (state: string) => {
  streamDeck.logger.info(`Quadro state: ${state}${quadro.error ? ` (${quadro.error})` : ""}`);
  refresh();
});
// Property inspectors ask for their lists (datasource) -> answer from the latest device report
streamDeck.ui.onSendToPlugin((ev) => {
  const payload = ev.payload;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return;
  const event = payload.event;
  if (typeof event !== "string") return;
  const items = catalogFor(event, quadro.state === "ok" ? quadro.status : undefined);
  if (items) void streamDeck.ui.sendToPropertyInspector({ event, items });
});

streamDeck.logger.info("Aquars plugin starting");
quadro.start();

streamDeck.connect();
