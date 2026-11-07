import streamDeck from "@elgato/streamdeck";
import { FanAction } from "./actions/fan.ts";
import { FlowAction } from "./actions/flow.ts";
import { PcSensorAction } from "./actions/pc-sensor.ts";
import { RotateAction } from "./actions/rotate.ts";
import { TemperatureAction } from "./actions/temperature.ts";
import { DATASOURCE, catalogFor, type PcSource } from "./catalog.ts";
import type { DeviceSettings } from "./devices.ts";
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
  const online = quadro.online().map((s) => s.serial).join(", ");
  streamDeck.logger.info(`Quadro state: ${state}${online ? ` [${online}]` : ""}${quadro.error ? ` (${quadro.error})` : ""}`);
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

// --- Property inspectors ---
/** Lists that depend on the chosen Quadro (re-sent when the device setting of the open key changes). */
const QUADRO_LISTS = [DATASOURCE.values, DATASOURCE.sensors, DATASOURCE.fans, DATASOURCE.devices];

const answer = (event: string, settings: DeviceSettings) => {
  const { status } = quadro.resolve(settings.device);
  return catalogFor(event, status, pcSource(), { online: quadro.online(), current: settings.device });
};

// Property inspectors ask for their lists (datasource) -> answer from the latest report of the chosen device / LHM poll
streamDeck.ui.onSendToPlugin(async (ev) => {
  const payload = ev.payload;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return;
  const event = payload.event;
  if (typeof event !== "string") return;
  let settings: DeviceSettings = {};
  try {
    settings = await ev.action.getSettings<DeviceSettings>();
  } catch {
    /* use automatic device */
  }
  const items = answer(event, settings);
  if (items) void streamDeck.ui.sendToPropertyInspector({ event, items });
});

// Another Quadro picked in the open property inspector -> refresh its sensor / fan / value lists
const lastDevice = new Map<string, string>();
streamDeck.settings.onDidReceiveSettings<DeviceSettings>((ev) => {
  const device = typeof ev.payload.settings.device === "string" ? ev.payload.settings.device : "";
  const before = lastDevice.get(ev.action.id);
  lastDevice.set(ev.action.id, device);
  if (before === undefined || before === device || streamDeck.ui.action?.id !== ev.action.id) return;
  for (const event of QUADRO_LISTS) {
    void streamDeck.ui.sendToPropertyInspector({ event, items: answer(event, ev.payload.settings) ?? [] });
  }
});
streamDeck.ui.onDidAppear<DeviceSettings>(async (ev) => {
  try {
    const s = await ev.action.getSettings<DeviceSettings>();
    lastDevice.set(ev.action.id, typeof s.device === "string" ? s.device : "");
  } catch {
    /* ignore */
  }
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
