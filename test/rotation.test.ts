import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildItems, expandTokens, pickIndex, tokensFrom } from "../src/rotation.ts";
import { parseStatus } from "../src/status.ts";

const hex = readFileSync(new URL("./fixtures/status.hex", import.meta.url), "utf8");
const st = parseStatus(Uint8Array.from(Buffer.from(hex.replace(/\s+/g, ""), "hex")));

test("buildItems lists connected temps, all fans, flow and voltage", () => {
  const items = buildItems({}, st);
  assert.deepEqual(items.map((i) => i.label), ["Temp 1", "Temp 2", "Temp 3", "Fan 1", "Fan 2", "Fan 3", "Fan 4", "Flow", "Input"]);
  assert.equal(items[0].value, "26.4"); // 26.45 -> toFixed(1)
  assert.equal(items.at(-1)?.value, "12.08");
});

test("buildItems honors filters and custom names", () => {
  const items = buildItems({ fans: "1, 3", fanLabels: "Pump, MORA, Front", tempLabels: "Out", noFlow: true, noVoltage: true }, st);
  assert.deepEqual(items.map((i) => i.label), ["Out", "Temp 2", "Temp 3", "Pump", "Front"]);
  assert.deepEqual(buildItems({ noTemps: true, noFans: true, noFlow: true, noVoltage: true }, st), []);
});

test("pickIndex advances every interval and wraps", () => {
  assert.equal(pickIndex(0, 0, 0, 5, 4), 0);
  assert.equal(pickIndex(4999, 0, 0, 5, 4), 0);
  assert.equal(pickIndex(5000, 0, 0, 5, 4), 1);
  assert.equal(pickIndex(20000, 0, 0, 5, 4), 0);
  assert.equal(pickIndex(5000, 0, 2, 5, 4), 3);
  assert.equal(pickIndex(0, 0, 0, 5, 0), 0);
});

test('"*" shows every connected value', () => {
  const items = buildItems({ values: "*" }, st);
  // 3 temps (4th + all virtual sensors are disconnected) + 4 rpm + 4 % + 4 W + flow + voltage
  assert.equal(items.length, 3 + 4 + 4 + 4 + 2);
  assert.ok(items.some((i) => i.label === "Fan 1 %" && i.unit === "%"));
  assert.ok(items.some((i) => i.label === "Fan 3 W" && i.unit === "W"));
});

test("wildcards and explicit lists in the values field", () => {
  assert.deepEqual(expandTokens("fan*, flow"), ["fan1", "fan2", "fan3", "fan4", "flow"]);
  assert.deepEqual(expandTokens("temp1,temp1,volt"), ["temp1", "volt"]);
  const items = buildItems({ values: "flow, temp2, pwm1", fanLabels: "Pump" }, st);
  assert.deepEqual(items.map((i) => i.label), ["Flow", "Temp 2", "Pump %"]);
});

test('"*" in the fan channel field means all four', () => {
  const items = buildItems({ fans: "*", noTemps: true, noFlow: true, noVoltage: true }, st);
  assert.equal(items.length, 4);
});

test("excludes act as a blacklist with wildcards", () => {
  const labels = (o: object) => buildItems(o, st).map((i) => i.label);
  assert.equal(labels({ values: "*", exclude: "pwm*,power*,fan4" }).length, 3 + 3 + 2);
  assert.ok(!labels({ values: "*", exclude: "fan4" }).includes("Fan 4"));
  // excludes also apply to the checkbox-based legacy mode
  assert.ok(!labels({ exclude: "flow,volt" }).includes("Flow"));
});

test("checkbox lists combine with text and follow canonical order", () => {
  assert.deepEqual(tokensFrom("flow", ["fan2", "temp1"]), ["flow", "temp1", "fan2"]);
  assert.deepEqual(tokensFrom(undefined, ["volt", "temp3", "bogus"]), ["temp3", "volt"]);
  const items = buildItems({ pick: ["pwm1", "temp2"], skip: ["temp2"] }, st);
  assert.deepEqual(items.map((i) => i.label), ["Fan 1 %"]);
});
