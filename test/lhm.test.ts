import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pcSensorGroups, pcSensorList } from "../src/catalog.ts";
import { DEFAULT_LHM_URL, formatLhm, normalizeLhmUrl, parseLhm, parseLhmValue } from "../src/lhm.ts";
import { buildItems } from "../src/rotation.ts";
import { parseStatus } from "../src/status.ts";

// Hand-made sample in the structure of LibreHardwareMonitor's data.json (German and English number formats).
const sensors = parseLhm(JSON.parse(readFileSync(new URL("./fixtures/lhm.json", import.meta.url), "utf8")));
const byName = Object.fromEntries(sensors.map((s) => [s.name, s]));

test("parseLhmValue handles decimal comma, dot, units and missing values", () => {
  assert.deepEqual(parseLhmValue("45,3 °C"), { value: 45.3, unit: "°C", decimals: 1 });
  assert.deepEqual(parseLhmValue("52.0 °C"), { value: 52, unit: "°C", decimals: 1 });
  assert.deepEqual(parseLhmValue("4549,7 MHz"), { value: 4549.7, unit: "MHz", decimals: 1 });
  assert.deepEqual(parseLhmValue("1.344 V"), { value: 1.344, unit: "V", decimals: 3 });
  assert.deepEqual(parseLhmValue("1.234,5 MB"), { value: 1234.5, unit: "MB", decimals: 1 });
  assert.deepEqual(parseLhmValue("-12,5 °C"), { value: -12.5, unit: "°C", decimals: 1 });
  assert.equal(parseLhmValue("-").value, null);
  assert.equal(parseLhmValue("").value, null);
});

test("parseLhm flattens the tree with hardware, type and id", () => {
  assert.equal(sensors.length, 7);
  assert.deepEqual(byName["Core (Tctl/Tdie)"], {
    id: "/amdcpu/0/temperature/2",
    name: "Core (Tctl/Tdie)",
    hardware: "AMD Ryzen 7 5800X",
    type: "Temperature",
    value: 45.3,
    unit: "°C",
    decimals: 1,
  });
  assert.equal(byName["CCD1 (Tdie)"].value, null);
  assert.equal(byName["GPU Package"].hardware, "NVIDIA GeForce RTX 4080");
  // older LHM without SensorId/Type: name path as id, type from the group
  assert.equal(byName.Vcore.id, "Nuvoton NCT6798D/Voltages/Vcore");
  assert.equal(byName.Vcore.type, "Voltage");
  assert.equal(byName.Vcore.hardware, "Nuvoton NCT6798D");
});

test("formatLhm keeps values short", () => {
  assert.equal(formatLhm(byName["Core (Tctl/Tdie)"]), "45.3");
  assert.equal(formatLhm(byName["Core #1"]), "4550");
  assert.equal(formatLhm(byName.Vcore), "1.34");
  assert.equal(formatLhm(byName["CCD1 (Tdie)"]), "--");
});

test("normalizeLhmUrl", () => {
  assert.equal(normalizeLhmUrl(""), DEFAULT_LHM_URL);
  assert.equal(normalizeLhmUrl("localhost:8086"), "http://localhost:8086/data.json");
  assert.equal(normalizeLhmUrl("http://192.168.1.5:8085/"), "http://192.168.1.5:8085/data.json");
  assert.equal(normalizeLhmUrl("file:///c:/x"), DEFAULT_LHM_URL);
});

test("PC sensor lists for the property inspector", () => {
  assert.equal(pcSensorList({ state: "off", error: "", sensors: [] })[0].disabled, true);
  assert.match(pcSensorList({ state: "error", error: "LHM not running", sensors: [] })[0].label, /not reachable \(LHM not running\)/);
  const groups = pcSensorGroups({ state: "ok", error: "", sensors });
  assert.deepEqual(groups.map((g) => g.label), ["AMD Ryzen 7 5800X", "NVIDIA GeForce RTX 4080", "Nuvoton NCT6798D"]);
  const flat = pcSensorList({ state: "ok", error: "", sensors });
  assert.equal(flat[0].label, "AMD Ryzen 7 5800X › Temperature: Core (Tctl/Tdie) – 45.3 °C");
  assert.equal(flat[1].label, "AMD Ryzen 7 5800X › Temperature: CCD1 (Tdie) – no reading");
});

test("rotation appends picked PC sensors and works without the Quadro", () => {
  const hex = readFileSync(new URL("./fixtures/status.hex", import.meta.url), "utf8");
  const st = parseStatus(Uint8Array.from(Buffer.from(hex.replace(/\s+/g, ""), "hex")));
  const pcPick = ["/gpu-nvidia/0/temperature/0", "/amdcpu/0/temperature/3", "/amdcpu/0/load/0"];

  // only PC sensors picked -> the legacy "everything" default does not kick in
  const onlyPc = buildItems({ pcPick }, st, sensors);
  assert.deepEqual(onlyPc.map((i) => i.label), ["GPU Core", "CPU Total"]); // CCD1 has no reading
  assert.equal(onlyPc[0].unit, "°C");

  const mixed = buildItems({ values: "flow", pcPick }, st, sensors);
  assert.deepEqual(mixed.map((i) => i.label), ["Flow", "GPU Core", "CPU Total"]);

  // Quadro offline: PC sensors still rotate
  assert.deepEqual(buildItems({ values: "flow", pcPick }, undefined, sensors).map((i) => i.label), ["GPU Core", "CPU Total"]);
  // LHM off: Quadro values only, unchanged behaviour
  assert.deepEqual(buildItems({ values: "flow", pcPick }, st, undefined).map((i) => i.label), ["Flow"]);
});
