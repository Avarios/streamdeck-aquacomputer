import streamDeck from "@elgato/streamdeck";
import { FanAction } from "./actions/fan.ts";
import { FlowAction } from "./actions/flow.ts";
import { PcSensorAction } from "./actions/pc-sensor.ts";
import { RotateAction } from "./actions/rotate.ts";
import { TemperatureAction } from "./actions/temperature.ts";
import { DATASOURCE, catalogFor, type PcSource } from "./catalog.ts";
import { history, recordLhm, recordStatus } from "./history.ts";
import { lhm } from "./lhm.ts";
import { quadro } from "./quadro.ts";

/** Plugin-wide settings, written by the property inspectors (`global` attribute). */
type GlobalSettings = {
  /** read PC sensors from LibreHardwareMonitor's web server (opt-in) */
  lhmEnabled?: boolean;
  /** address of LHM's data.json, default http://localhost:8085/data.json */
  lhmUrl?: string;
};

const actions = [new TemperatureAction(), new FanAction(), new FlowAction(), new RotateAction(), new PcSensorAction()];
actions.forEach((a) => streamDeck.actions.registerAction(a));

const refresh = () => void Promise.all(actions.map((a) => a.refreshAll()));
const pcSource = (): PcSource => ({ state: lhm.state, error: lhm.error, sensors: lhm.sensors });

// record first, so the graph already contains the newest sample when the keys redraw
quadro.on("status", (st) => {
  recordStatus(history, st);
  refresh();
});
quadro.on("state", (state: string) => {
  streamDeck.logger.info(`Quadro state: ${state}${quadro.error ? ` (${quadro.error})` : ""}`);
  refresh();
});

// --- LibreHardwareMonitor (optional PC sensors) ---
let lastSensorCount = -1;
/** Pushes fresh PC sensor lists to an open property inspector (state change / sensors appeared). */
const pushPcLists = () => {
  if (!streamDeck.ui.action) return;
  for (const event of [DATASOURCE.pcSensors, DATASOURCE.pcSensorList]) {
    void streamDeck.ui.sendToPropertyInspector({ event, items: catalogFor(event, undefined, pcSource()) ?? [] });
  }
};
lhm.on("update", () => {
  recordLhm(history, lhm.sensors);
  if (lhm.sensors.length !== lastSensorCount) {
    lastSensorCount = lhm.sensors.length;
    pushPcLists();
  }
  refresh();
});
lhm.on("state", (state: string) => {
  streamDeck.logger.info(`LibreHardwareMonitor state: ${state} (${lhm.url})${lhm.error ? ` ${lhm.error}` : ""}`);
  if (state !== "ok") lastSensorCount = -1;
  pushPcLists();
  refresh();
});

const applyGlobals = (g: GlobalSettings) => lhm.configure(g.lhmEnabled === true, typeof g.lhmUrl === "string" ? g.lhmUrl : undefined);
streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => applyGlobals(ev.settings));

// Property inspectors ask for their lists (datasource) -> answer from the latest device report / LHM poll
streamDeck.ui.onSendToPlugin((ev) => {
  const payload = ev.payload;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return;
  const event = payload.event;
  if (typeof event !== "string") return;
  const items = catalogFor(event, quadro.state === "ok" ? quadro.status : undefined, pcSource());
  if (items) void streamDeck.ui.sendToPropertyInspector({ event, items });
});

streamDeck.logger.info("Aquars plugin starting");
quadro.start();

void streamDeck.connect().then(async () => {
  try {
    applyGlobals(await streamDeck.settings.getGlobalSettings<GlobalSettings>());
  } catch (e) {
    streamDeck.logger.warn(`Could not read global settings: ${String(e)}`);
  }
});
