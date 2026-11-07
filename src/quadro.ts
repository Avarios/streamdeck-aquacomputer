import { EventEmitter } from "node:events";
import { HID, devices } from "node-hid";
import { normalizeReport, parseStatus, type QuadroStatus } from "./status.ts";

export const VID = 0x0c70;
export const PID = 0xf00d;

const RETRY_MS = 5000;
const STALE_MS = 5000; // the device pushes ~1 report/s

export type ConnectionState = "connecting" | "ok" | "error";

/**
 * Keeps one HID connection to the Quadro open, parses incoming status reports and
 * reconnects automatically (device unplugged, PC resumed from sleep, ...).
 * Events: "status" (QuadroStatus), "state" (ConnectionState)
 */
export class QuadroReader extends EventEmitter {
  status?: QuadroStatus;
  state: ConnectionState = "connecting";
  error = "";

  private dev?: HID;
  private lastData = 0;
  private retry?: NodeJS.Timeout;
  private watchdog?: NodeJS.Timeout;

  start(): void {
    this.connect();
    this.watchdog = setInterval(() => {
      if (this.dev && Date.now() - this.lastData > STALE_MS) this.fail("No data from the Quadro");
    }, 2000);
  }

  stop(): void {
    clearTimeout(this.retry);
    clearInterval(this.watchdog);
    this.close();
  }

  private connect(): void {
    this.setState("connecting");
    try {
      const info = devices(VID, PID)[0];
      if (!info?.path) return this.fail("Quadro not found (is it plugged in?)");

      const dev = new HID(info.path);
      this.dev = dev;
      this.lastData = Date.now();
      dev.on("data", (data: Buffer) => this.onData(data));
      dev.on("error", (err: Error) => this.fail(`HID error: ${err.message}`));
    } catch (e) {
      this.fail(`Could not open the Quadro: ${(e as Error).message}`);
    }
  }

  private onData(data: Buffer): void {
    const report = normalizeReport(data);
    if (!report) return; // other report types are ignored
    this.lastData = Date.now();
    try {
      this.status = parseStatus(report);
    } catch {
      return;
    }
    if (this.state !== "ok") this.setState("ok");
    this.emit("status", this.status);
  }

  private fail(message: string): void {
    this.error = message;
    this.close();
    this.setState("error");
    clearTimeout(this.retry);
    this.retry = setTimeout(() => this.connect(), RETRY_MS);
  }

  private close(): void {
    try {
      this.dev?.removeAllListeners();
      this.dev?.close();
    } catch {
      /* ignore */
    }
    this.dev = undefined;
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit("state", state);
  }
}

export const quadro = new QuadroReader();
