import streamDeck, { SingletonAction, type DialAction, type KeyAction } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import type { DeviceSettings } from "../devices.ts";
import { quadro } from "../quadro.ts";
import { offlineView, renderDial, renderKey, type KeyView } from "../render.ts";
import type { QuadroStatus } from "../status.ts";

interface Instance<S extends JsonObject> {
  /** a key (144x144 image) or a dial segment of the touch strip (200x100 canvas) */
  action: KeyAction<S> | DialAction<S>;
  isDial: boolean;
  settings: S;
}

type AppearEvent<S> = { action: { id: string; isKey(): boolean; isDial(): boolean }; payload: { settings: S } };

/**
 * Base class: tracks the visible keys / dials of one action type and redraws them whenever
 * a new status report arrives. Key press, dial press, touch tap and dial rotation all call
 * `advance()`, which subclasses can override (e.g. to switch the displayed value).
 */
export abstract class LiveAction<S extends JsonObject> extends SingletonAction<S> {
  protected readonly instances = new Map<string, Instance<S>>();

  /** Build the view for one key. `status` is undefined while the device is offline. */
  protected abstract view(settings: S, status: QuadroStatus | undefined, id: string): KeyView;
  protected abstract defaultLabel(settings: S): string;

  /** @param delta +1 = next (press / clockwise), -1 = previous (counter-clockwise) */
  protected async advance(_id: string, _delta: number): Promise<void> {}

  override async onWillAppear(ev: AppearEvent<S>): Promise<void> {
    const isDial = ev.action.isDial();
    if (!isDial && !ev.action.isKey()) return;
    streamDeck.logger.info(`appear ${this.manifestId}: ${isDial ? "dial" : "key"} ${ev.action.id}`);
    this.instances.set(ev.action.id, {
      action: ev.action as unknown as KeyAction<S> | DialAction<S>,
      isDial,
      settings: ev.payload.settings,
    });
    await this.draw(ev.action.id);
  }

  override async onDidReceiveSettings(ev: { action: { id: string }; payload: { settings: S } }): Promise<void> {
    const inst = this.instances.get(ev.action.id);
    if (!inst) return;
    inst.settings = ev.payload.settings;
    await this.draw(ev.action.id);
  }

  override onWillDisappear(ev: { action: { id: string } }): void {
    this.instances.delete(ev.action.id);
    this.onRemove(ev.action.id);
  }

  override async onKeyDown(ev: { action: { id: string } }): Promise<void> {
    await this.advance(ev.action.id, 1);
  }

  override async onDialDown(ev: { action: { id: string } }): Promise<void> {
    await this.advance(ev.action.id, 1);
  }

  override async onTouchTap(ev: { action: { id: string } }): Promise<void> {
    await this.advance(ev.action.id, 1);
  }

  override async onDialRotate(ev: { action: { id: string }; payload: { ticks: number } }): Promise<void> {
    await this.advance(ev.action.id, ev.payload.ticks >= 0 ? 1 : -1);
  }

  /**
   * The view to draw right now. Default: the Quadro chosen in the settings ("device"), offline view while it is not connected.
   * Actions with other data sources (PC sensors) override this.
   */
  protected current(settings: S, id: string): KeyView {
    const { status, error } = quadro.resolve((settings as DeviceSettings).device);
    return status ? this.view(settings, status, id) : offlineView(this.defaultLabel(settings), error);
  }

  /** Hook for subclasses to drop per-key state. */
  protected onRemove(_id: string): void {}

  async refreshAll(): Promise<void> {
    await Promise.all([...this.instances.keys()].map((id) => this.draw(id)));
  }

  protected async draw(id: string): Promise<void> {
    const inst = this.instances.get(id);
    if (!inst) return;
    try {
      const view = this.current(inst.settings, id);
      if (inst.isDial) {
        await (inst.action as DialAction<S>).setFeedback({ canvas: renderDial(view) });
      } else {
        await (inst.action as KeyAction<S>).setImage(renderKey(view));
      }
    } catch (e) {
      streamDeck.logger.error(`draw failed for ${this.manifestId} (${inst.isDial ? "dial" : "key"}): ${String(e)}`);
    }
  }
}
