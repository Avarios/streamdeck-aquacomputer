import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalogFor, deviceCatalog } from "../src/catalog.ts";
import { deviceScope, pickDevice } from "../src/devices.ts";
import { parseStatus } from "../src/status.ts";

const hex = readFileSync(new URL("./fixtures/status.hex", import.meta.url), "utf8");
const raw = Uint8Array.from(Buffer.from(hex.replace(/\s+/g, ""), "hex"));
const a = parseStatus(raw); // serial 00001-00002
// second Quadro: other serial (bytes 0x03..0x06) and other flow (0x6e)
const rawB = raw.slice();
rawB.set([0x00, 0x00, 0x00, 0x07], 3);
rawB.set([0x01, 0x00], 0x6e);
const b = parseStatus(rawB); // serial 00000-00007, flow 25.6 l/h

test("automatic picks the lowest serial number, independent of enumeration order", () => {
  assert.equal(b.serial, "00000-00007");
  assert.equal(pickDevice([a, b], "", "x").status?.serial, "00000-00007");
  assert.equal(pickDevice([b, a], undefined, "x").status?.serial, "00000-00007");
});

test("a configured serial selects that device or reports it missing", () => {
  assert.equal(pickDevice([a, b], "00001-00002", "x").status, a);
  assert.deepEqual(pickDevice([a], "00000-00007", "offline"), { error: "00000-00007 not found" });
  // nothing online at all: the general error (e.g. "Quadro not found") is more helpful
  assert.deepEqual(pickDevice([], "00000-00007", "Quadro not found"), { error: "Quadro not found" });
  assert.deepEqual(pickDevice([], "", "Quadro not found"), { error: "Quadro not found" });
});

test("graphs of two devices use separate history keys", () => {
  assert.notEqual(deviceScope(a), deviceScope(b));
});

test("device dropdown lists automatic, every Quadro and a missing configured one", () => {
  const items = deviceCatalog([a, b], "12345-00000");
  assert.deepEqual(items.map((i) => i.value), ["", "00000-00007", "00001-00002", "12345-00000"]);
  assert.equal(items[0].label, "Automatic – Quadro 00000-00007");
  assert.equal(items[1].label, "Quadro 00000-00007 – 26.4 °C, 26 l/h");
  assert.equal(items[3].label, "Quadro 12345-00000 – not connected");
  assert.equal(deviceCatalog([])[0].label, "Automatic (first Quadro found)");
  assert.ok(catalogFor("getDevices", undefined, undefined, { online: [a] }));
});
