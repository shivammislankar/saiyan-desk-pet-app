import { describe, it, expect, beforeEach } from "vitest";
import { KamehamehaTrigger, type KeyKind } from "../../src/core/kamehameha-trigger";

type Step = ["down" | "up", KeyKind, number];

function run(t: KamehamehaTrigger, steps: Step[]): number[] {
  const fired: number[] = [];
  for (const [edge, kind, at] of steps) {
    if (edge === "down") t.keyDown(kind, at);
    else if (t.keyUp(kind, at)) fired.push(at);
  }
  return fired;
}

const tap = (kind: KeyKind, at: number, hold = 50): Step[] => [
  ["down", kind, at],
  ["up", kind, at + hold],
];

describe("KamehamehaTrigger", () => {
  let t: KamehamehaTrigger;

  beforeEach(() => {
    t = new KamehamehaTrigger({ trigger: "alt", windowMs: 400, cooldownMs: 3000 });
  });

  it("fires on a quick double-tap, on the second release", () => {
    expect(run(t, [...tap("alt", 0), ...tap("alt", 200)])).toEqual([250]);
  });

  it("does not fire on a single tap", () => {
    expect(run(t, tap("alt", 0))).toEqual([]);
  });

  it("does not fire when the second tap is too late", () => {
    expect(run(t, [...tap("alt", 0), ...tap("alt", 500)])).toEqual([]);
  });

  it("a late second tap starts a new sequence", () => {
    expect(run(t, [...tap("alt", 0), ...tap("alt", 500), ...tap("alt", 700)])).toEqual([750]);
  });

  it("ignores OS key-repeat while held", () => {
    const steps: Step[] = [
      ["down", "alt", 0],
      ["down", "alt", 30],
      ["down", "alt", 60],
      ["up", "alt", 90],
    ];
    expect(run(t, steps)).toEqual([]);
    expect(run(t, tap("alt", 200))).toEqual([250]);
  });

  it("requires a release between taps", () => {
    // Holding Alt down for a long time is never a double-tap.
    const steps: Step[] = [["down", "alt", 0]];
    for (let at = 30; at < 1200; at += 30) steps.push(["down", "alt", at]);
    steps.push(["up", "alt", 1200]);
    expect(run(t, steps)).toEqual([]);
  });

  it("is cancelled by any other key between taps", () => {
    expect(run(t, [...tap("alt", 0), ...tap("key", 100), ...tap("alt", 200)])).toEqual([]);
  });

  it("never fires for Alt+Tab or Alt+letter combos", () => {
    const altTab: Step[] = [
      ...tap("alt", 0),
      ["down", "alt", 200],
      ["down", "key", 230],
      ["up", "key", 260],
      ["up", "alt", 280],
    ];
    expect(run(t, altTab)).toEqual([]);
  });

  it("never fires for Alt+Shift", () => {
    const altShift: Step[] = [
      ...tap("alt", 0),
      ["down", "alt", 200],
      ["down", "shift", 220],
      ["up", "shift", 240],
      ["up", "alt", 260],
    ];
    expect(run(t, altShift)).toEqual([]);
  });

  it("does not fire if the second press is held instead of tapped", () => {
    expect(run(t, [...tap("alt", 0), ["down", "alt", 200], ["up", "alt", 900]])).toEqual([]);
  });

  it("respects the cooldown", () => {
    expect(run(t, [...tap("alt", 0), ...tap("alt", 200)])).toEqual([250]);
    expect(run(t, [...tap("alt", 1000), ...tap("alt", 1200)])).toEqual([]);
    expect(run(t, [...tap("alt", 3400), ...tap("alt", 3600)])).toEqual([3650]);
  });

  it("only listens to the configured trigger key", () => {
    t.configure({ trigger: "ctrl" });
    expect(run(t, [...tap("alt", 0), ...tap("alt", 200)])).toEqual([]);
    expect(run(t, [...tap("ctrl", 1000), ...tap("ctrl", 1200)])).toEqual([1250]);
  });

  it("recovers if a key-up was missed", () => {
    // Key-up of the first tap never arrives; a later press must still work.
    const steps: Step[] = [["down", "alt", 0], ...tap("alt", 2000), ...tap("alt", 2200)];
    expect(run(t, steps)).toEqual([2250]);
  });
});
