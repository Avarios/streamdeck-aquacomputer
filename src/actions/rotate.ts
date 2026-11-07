import { action } from "@elgato/streamdeck";
import { lhm } from "../lhm.ts";
import { quadro } from "../quadro.ts";
import { COLORS, offlineView, type KeyView } from "../render.ts";
import { buildItems, intervalOf, pickIndex, type RotateSettings } from "../rotation.ts";
import type { QuadroStatus } from "../status.ts";
import { LiveAction } from "./live-action.ts";

interface Cursor {
  start: number;
  offset: number;
}

@action({ UUID: "com.avarios.aquars.rotate" })
export class RotateAction extends LiveAction<RotateSettings> {
  private readonly cursors = new Map<string, Cursor>();

  protected defaultLabel(): string {
    return "Quadro";
  }

  /** Key press / dial turn jumps to the next / previous value and restarts the timer. */
  protected override async advance(id: string, delta: number): Promise<void> {
    const settings = this.instances.get(id)?.settings ?? {};
    const count = this.items(settings).length;
    const c = this.cursor(id);
    const now = Date.now();
    c.offset = pickIndex(now, c.start, c.offset, intervalOf(settings), count) + delta;
    c.start = now;
    await this.draw(id);
  }

  protected override onRemove(id: string): void {
    this.cursors.delete(id);
  }

  private cursor(id: string): Cursor {
    let c = this.cursors.get(id);
    if (!c) this.cursors.set(id, (c = { start: Date.now(), offset: 0 }));
    return c;
  }

  /** Quadro values (while connected) followed by the selected PC sensors (while LHM is reachable). */
  private items(s: RotateSettings): KeyView[] {
    const st = quadro.state === "ok" ? quadro.status : undefined;
    const pc = lhm.state === "ok" ? lhm.sensors : undefined;
    return buildItems(s, st, pc);
  }

  protected override current(s: RotateSettings, id: string): KeyView {
    const items = this.items(s);
    if (items.length === 0) {
      if (quadro.state !== "ok") return offlineView("Quadro", quadro.error || "connecting");
      return { label: "Quadro", value: "--", sub: "nothing selected", color: COLORS.idle };
    }
    const c = this.cursor(id);
    return items[pickIndex(Date.now(), c.start, c.offset, intervalOf(s), items.length)];
  }

  /** not used: `current` is overridden */
  protected view(_s: RotateSettings, _st: QuadroStatus | undefined): KeyView {
    return { label: "", value: "" };
  }
}
