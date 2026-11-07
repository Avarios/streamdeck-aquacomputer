import { test } from "node:test";
import assert from "node:assert/strict";
import { History, recordStatus, seriesKey } from "../src/history.ts";
import { renderKey } from "../src/render.ts";
import { parseStatus } from "../src/status.ts";
import { readFileSync } from "node:fs";

test("History keeps only the newest samples", () => {
  const h = new History(5);
  for (let i = 1; i <= 8; i++) h.push("x", i);
  assert.deepEqual(h.get("x", 100), [4, 5, 6, 7, 8]);
  assert.deepEqual(h.get("x", 2), [7, 8]);
  assert.deepEqual(h.get("missing", 2), []);
});

test("recordStatus skips disconnected sensors", () => {
  const hex = readFileSync(new URL("./fixtures/status.hex", import.meta.url), "utf8");
  const st = parseStatus(Uint8Array.from(Buffer.from(hex.replace(/\s+/g, ""), "hex")));
  const h = new History();
  recordStatus(h, st);
  assert.deepEqual(h.get(seriesKey.temp(1), 9), [26.45]);
  assert.deepEqual(h.get(seriesKey.temp(4), 9), []);
  assert.deepEqual(h.get(seriesKey.fan(1, "rpm"), 9), [2423]);
  assert.deepEqual(h.get(seriesKey.flow, 9), [108.2]);
});

test("renderKey draws the graph only with at least 2 samples", () => {
  const base = { label: "t", value: "1" };
  const decode = (u: string) => decodeURIComponent(u.split(",").slice(1).join(","));
  assert.ok(!decode(renderKey({ ...base, series: [1] })).includes("fill-opacity"));
  assert.ok(decode(renderKey({ ...base, series: [1, 2, 3] })).includes("fill-opacity"));
  // long series are downsampled, flat series don't divide by zero
  const flat = decode(renderKey({ ...base, series: Array(1800).fill(5), minSpan: 2 }));
  assert.ok(!flat.includes("NaN") && !flat.includes("Infinity"));
});
