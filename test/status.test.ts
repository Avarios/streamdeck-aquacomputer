import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeReport, parseStatus } from "../src/status.ts";

// Real capture from a Quadro (serial number anonymised).
const hex = readFileSync(new URL("./fixtures/status.hex", import.meta.url), "utf8");
const buf = Uint8Array.from(Buffer.from(hex.replace(/\s+/g, ""), "hex"));

test("fixture has the expected length", () => {
  assert.equal(buf.length, 220);
});

test("parses device info", () => {
  const s = parseStatus(buf);
  assert.equal(s.serial, "00001-00002");
  assert.equal(s.firmware, 1033);
  assert.equal(s.uptimeS, 14454);
  assert.equal(s.inputVoltageV, 12.08);
});

test("parses temperatures and flow", () => {
  const s = parseStatus(buf);
  assert.deepEqual(s.temps, [26.45, 24.26, 24.93, null]);
  assert.ok(s.virtualTemps.every((t) => t === null));
  assert.equal(s.flowLPerH, 108.2);
});

test("parses fans", () => {
  const s = parseStatus(buf);
  assert.deepEqual(s.fans.map((f) => f.rpm), [2423, 327, 619, 146]);
  assert.equal(s.fans[1].pwmPercent, 30.2);
  assert.equal(s.fans[2].currentA, 0.033);
  assert.equal(s.fans[2].powerW, 0.39);
});

test("normalizeReport re-adds a stripped report ID", () => {
  assert.deepEqual(normalizeReport(buf.subarray(1)), buf);
  assert.equal(normalizeReport(new Uint8Array(10)), undefined);
});
