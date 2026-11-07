import { EventEmitter } from "node:events";
import { HID, devices } from "node-hid";
import { pickDevice, sortDevices } from "./devices.ts";
import { normalizeReport, parseStatus, type QuadroStatus } from "./status.ts";

export const VID = 0x0c70;
export const PID = 0xf00d;

const SCAN_MS = 5000;
const STALE_MS = 5000; // the device pushes ~1 report/s
/** HID paths that could not be opened or never sent a status report are retried after this time */
const IGNORE_MS = 60_000;

export type ConnectionState = "connecting" | "ok" | "error";

/** One open HID connection (one Quadro, or another HID interface of it that sends no status). */
class Connection {
  status?: QuadroStatus;
  lastData = Date.now();
  readonly opened = Date.now();

  constructor(
    readonly path: string,
    private readonly dev: HID,
    onStatus: (c: Connection) => void,
    onError: (c: Connection, message: string) => void,
  ) {
    dev.on("data", (data: Buffer) => {
      const report = normalizeReport(data);
      if (!report) return; // other report types are ignored
      try {
        this.status = parseStatus(report);
      } catch {
        return;
      }
      this.lastData = Date.now();
      onStatus(this);
    });
    dev.on("error", (err: Error) => onError(this, `HID error: ${err.message}`));
  }

  close(): void {
    try {
      this.dev.removeAllListeners();
      this.dev.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Finds every connected Quadro (by VID/PID, on any USB port), keeps one HID connection per device open,
 * parses the status reports and reconnects automatically (unplugged, PC resumed from sleep, ...).
 * Events: "status" (QuadroStatus of one device), "state" (ConnectionState: "ok" = at least one device delivers data)
 */
export class QuadroHub extends EventEmitter {
  state: ConnectionState = "connecting";
  /** why no device is online (shown on the keys) */
  error = "";

  private readonly conns = new Map<string, Connection>();
  /** path -> time until which it is not opened again */
  private readonly ignored = new Map<string, number>();
  private scanTimer?: NodeJS.Timeout;
  private watchdog?: NodeJS.Timeout;

  start(): void {
    this.scan();
    this.scanTimer = setInterval(() => this.scan(), SCAN_MS);
    this.watchdog = setInterval(() => this.checkStale(), 2000);
  }

  stop(): void {
    clearInterval(this.scanTimer);
    clearInterval(this.watchdog);
    for (const c of this.conns.values()) c.close();
    this.conns.clear();
  }

  /** Status of every device that currently delivers data, sorted by serial number. */
  online(): QuadroStatus[] {
    return sortDevices([...this.conns.values()].flatMap((c) => (c.status && this.fresh(c) ? [c.status] : [])));
  }

  /** Device for an action: `serial` = serial number from the settings, empty = first device. */
  resolve(serial?: string): { status?: QuadroStatus; error: string } {
    return pickDevice(this.online(), serial, this.error || "connecting");
  }

  /** First device (lowest serial number), for code that does not care about multiple Quadros. */
  get status(): QuadroStatus | undefined {
    return this.online()[0];
  }

  private fresh(c: Connection): boolean {
    return Date.now() - c.lastData <= STALE_MS;
  }

  private scan(): void {
    let found: string[];
    try {
      found = [...new Set(devices(VID, PID).flatMap((d) => (d.path ? [d.path] : [])))];
    } catch (e) {
      return this.updateState(`HID enumeration failed: ${(e as Error).message}`);
    }
    const now = Date.now();
    for (const [path, until] of this.ignored) if (!found.includes(path) || until < now) this.ignored.delete(path);

    let lastError = "";
    for (const path of found) {
      if (this.conns.has(path) || this.ignored.has(path)) continue;
      try {
        const conn = new Connection(path, new HID(path), (c) => this.onStatus(c), (c, msg) => this.drop(c, msg));
        this.conns.set(path, conn);
      } catch (e) {
        lastError = `Could not open the Quadro: ${(e as Error).message}`;
        this.ignored.set(path, now + IGNORE_MS);
      }
    }
    this.updateState(found.length === 0 ? "Quadro not found (is it plugged in?)" : lastError || this.error);
  }

  private onStatus(c: Connection): void {
    this.updateState("");
    this.emit("status", c.status);
  }

  /** Closes connections without data; interfaces that never sent a status report are ignored for a while. */
  private checkStale(): void {
    for (const c of [...this.conns.values()]) {
      if (this.fresh(c)) continue;
      if (!c.status) this.ignored.set(c.path, Date.now() + IGNORE_MS); // not a status interface
      this.drop(c, "No data from the Quadro");
    }
  }

  private drop(c: Connection, message: string): void {
    c.close();
    this.conns.delete(c.path);
    this.updateState(message);
  }

  private updateState(error: string): void {
    const ok = this.online().length > 0;
    if (!ok && error) this.error = error;
    const state: ConnectionState = ok ? "ok" : this.error ? "error" : "connecting";
    if (ok) this.error = "";
    if (state === this.state) return;
    this.state = state;
    this.emit("state", state);
  }
}

export const quadro = new QuadroHub();
