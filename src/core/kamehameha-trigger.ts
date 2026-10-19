/**
 * Kamehameha double-tap detector (SPEC section 12.1).
 *
 * Pure state machine: fed derived key edges with timestamps, it reports when
 * the attack should fire. It never sees raw key codes; keys arrive only as a
 * coarse kind ("alt", "ctrl", "shift", "meta" or "key" for anything else).
 *
 *   idle --trigger down--> firstDown --trigger up--> waitSecond
 *   waitSecond --trigger down (within window)--> secondDown
 *   secondDown --trigger up--> FIRE (then cooldown)
 *
 * Any other key or modifier pressed at any point cancels the sequence, so
 * Alt+Tab, Alt+Shift or Alt+letter never fire. OS key-repeat (repeated
 * key-down without a key-up) is ignored. The attack fires on the second
 * release, which is what keeps Alt+Tab pressed as the second tap from firing.
 */

export type TriggerKey = "alt" | "ctrl" | "shift";
export type KeyKind = "alt" | "ctrl" | "shift" | "meta" | "key";

export interface KamehamehaTriggerOptions {
  trigger: TriggerKey;
  /** Max time from the first press to the second press (ms). */
  windowMs: number;
  /** Time after firing before another attack can start (ms). */
  cooldownMs: number;
}

type State = "idle" | "firstDown" | "waitSecond" | "secondDown";

// A trigger key-down arriving this long after the previous one while we still
// think the key is held means its key-up was missed (e.g. lost focus).
const MISSED_KEYUP_MS = 500;

export class KamehamehaTrigger {
  private opts: KamehamehaTriggerOptions;
  private state: State = "idle";
  private firstPressAt = 0;
  private secondPressAt = 0;
  private triggerHeld = false;
  private lastTriggerDownEvent = 0;
  private cooldownUntil = 0;

  constructor(opts: KamehamehaTriggerOptions) {
    this.opts = { ...opts };
  }

  configure(opts: Partial<KamehamehaTriggerOptions>): void {
    if (opts.trigger && opts.trigger !== this.opts.trigger) this.reset();
    this.opts = { ...this.opts, ...opts };
  }

  reset(): void {
    this.state = "idle";
    this.triggerHeld = false;
  }

  /** Feed a key-down edge. Never fires by itself. */
  keyDown(kind: KeyKind, now: number): void {
    if (kind !== this.opts.trigger) {
      // Another key or modifier: cancels any pending sequence (Alt+Tab etc.).
      this.state = "idle";
      return;
    }

    const isRepeat = this.triggerHeld && now - this.lastTriggerDownEvent < MISSED_KEYUP_MS;
    this.lastTriggerDownEvent = now;
    if (isRepeat) return;
    this.triggerHeld = true;

    if (this.state === "waitSecond" && now - this.firstPressAt <= this.opts.windowMs) {
      this.state = "secondDown";
      this.secondPressAt = now;
      return;
    }
    if (now < this.cooldownUntil) {
      this.state = "idle";
      return;
    }
    this.state = "firstDown";
    this.firstPressAt = now;
  }

  /** Feed a key-up edge. Returns true when the Kamehameha should fire. */
  keyUp(kind: KeyKind, now: number): boolean {
    if (kind !== this.opts.trigger) return false;
    this.triggerHeld = false;

    if (this.state === "firstDown") {
      this.state = now - this.firstPressAt <= this.opts.windowMs ? "waitSecond" : "idle";
      return false;
    }
    if (this.state === "secondDown") {
      this.state = "idle";
      // A tap, not a long hold of the second press.
      if (now - this.secondPressAt <= this.opts.windowMs) {
        this.cooldownUntil = now + this.opts.cooldownMs;
        return true;
      }
    }
    return false;
  }
}
