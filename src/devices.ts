/**
 * Pure helpers for choosing one of several connected Quadros (unit-tested, no node-hid import).
 */
import type { QuadroStatus } from "./status.ts";

/** Setting shared by all Quadro actions: serial number of the device to show, "" / missing = automatic. */
export type DeviceSettings = { device?: string };

/** Online devices in a stable order (by serial number), so "automatic" always means the same Quadro. */
export function sortDevices(list: QuadroStatus[]): QuadroStatus[] {
  return [...list].sort((a, b) => a.serial.localeCompare(b.serial));
}

/**
 * Picks the device for an action. `serial` empty -> first device (lowest serial number).
 * Returns the status, or an error text for the key when the wanted device is not there.
 */
export function pickDevice(
  online: QuadroStatus[],
  serial: string | undefined,
  offlineError: string,
): { status?: QuadroStatus; error: string } {
  const wanted = (serial ?? "").trim();
  const sorted = sortDevices(online);
  if (!wanted) return sorted[0] ? { status: sorted[0], error: "" } : { error: offlineError };
  const hit = sorted.find((s) => s.serial === wanted);
  if (hit) return { status: hit, error: "" };
  return { error: sorted.length > 0 || !offlineError ? `${wanted} not found` : offlineError };
}

/** Prefix for history series of one device, so graphs of two Quadros don't mix. */
export const deviceScope = (st: { serial: string }) => `q:${st.serial}/`;
