import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalogFor, fanChannels, temperatureSensors, valueCatalog } from "../src/catalog.ts";
import { ALL_TOKENS } from "../src/rotation.ts";
import { parseStatus } from "../src/status.ts";

const hex = readFileSync(new URL("./fixtures/status.hex", import.meta.url), "utf8");
const st = parseStatus(Uint8Array.from(Buffer.from(hex.replace(/\s+/g, ""), "hex")));

test("offline catalog lists every known value without disabling anything", () => {
  const items = valueCatalog(undefined);
  assert.deepEqual(items.map((i) => i.value), ALL_TOKENS);
  assert.ok(items.every((i) => !i.disabled));
});

test("online catalog reflects what the device delivers", () => {
  const items = valueCatalog(st);
  const byValue = Object.fromEntries(items.map((i) => [i.value, i]));
  assert.match(byValue.temp1.label, /^Temp 1 – 26\.[45] °C$/);
  assert.equal(byValue.temp4.disabled, true); // 0x7fff = not connected
  assert.ok(!("virt1" in byValue)); // unused virtual sensors are hidden
  assert.match(byValue.fan4.label, /probably unconnected/); // 146 rpm, 0 mA
  assert.ok(!/unconnected/.test(byValue.fan1.label)); // pump: 0 mA but 2423 rpm
  assert.equal(byValue.flow.label, "Flow – 108.2 l/h");
  assert.equal(byValue.volt.label, "Input voltage – 12.08 V");
  // all online values are still valid rotation tokens
  assert.ok(items.every((i) => ALL_TOKENS.includes(i.value)));
});

test("sensor and fan lists", () => {
  assert.deepEqual(temperatureSensors(st).map((i) => i.value), ["1", "2", "3", "4"]);
  assert.equal(temperatureSensors(undefined).length, 20);
  assert.equal(fanChannels(st)[1].label, "Fan 2 – 327 rpm");
});

test("catalogFor routes known events only", () => {
  assert.ok(catalogFor("getValues", st));
  assert.ok(catalogFor("getSensors", st));
  assert.ok(catalogFor("getFans", st));
  assert.equal(catalogFor("other", st), undefined);
});
