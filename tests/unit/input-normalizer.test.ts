/**
 * Unit tests for the input normalizer.
 * Verifies that raw key codes are discarded and derived events contain no key identity.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeKeyboardEvent,
  normalizeMouseEvent,
  normalizeScrollEvent,
  createTypingSpeedEvent,
  createKamehamehaEvent,
  UIOHOOK_KEY,
} from "../../src/core/input-normalizer";

describe("InputNormalizer", () => {
  describe("normalizeKeyboardEvent", () => {
    it("should return null for modifier keys", () => {
      const result = normalizeKeyboardEvent({ keycode: UIOHOOK_KEY.Shift });
      // Modifiers return a modifierStateChanged event, not a strike
      expect(result).not.toBeNull();
      expect(result!.type).toBe("modifierStateChanged");
    });

    it("should return a strike event for letter keys", () => {
      const result = normalizeKeyboardEvent({ keycode: 30, key: "a" });
      expect(result).not.toBeNull();
      expect(result!.type).toBe("strikeRequested");
    });

    it("should not include raw keycode in the event", () => {
      const result = normalizeKeyboardEvent({ keycode: 30, key: "a" });
      expect(result).not.toBeNull();
      const data = result!.data as Record<string, unknown>;
      expect(data).not.toHaveProperty("keycode");
      expect(data).not.toHaveProperty("key");
      expect(data).not.toHaveProperty("keyCode");
    });

    it("should categorize keys correctly", () => {
      const letter = normalizeKeyboardEvent({ keycode: 30 }); // A
      expect(letter!.data?.category).toBe("letter");

      const number = normalizeKeyboardEvent({ keycode: 11 }); // 0
      expect(number!.data?.category).toBe("number");

      const space = normalizeKeyboardEvent({ keycode: UIOHOOK_KEY.Space });
      expect(space!.data?.category).toBe("space");

      const enter = normalizeKeyboardEvent({ keycode: UIOHOOK_KEY.Enter });
      expect(enter!.data?.category).toBe("enter");

      const backspace = normalizeKeyboardEvent({ keycode: UIOHOOK_KEY.Backspace });
      expect(backspace!.data?.category).toBe("backspace");
    });

    it("should report only a coarse modifier kind", () => {
      expect(normalizeKeyboardEvent({ keycode: UIOHOOK_KEY.Alt })!.data).toEqual({ modifier: "alt" });
      expect(normalizeKeyboardEvent({ keycode: UIOHOOK_KEY.AltRight })!.data).toEqual({ modifier: "alt" });
      expect(normalizeKeyboardEvent({ keycode: UIOHOOK_KEY.CtrlRight })!.data).toEqual({ modifier: "ctrl" });
      expect(normalizeKeyboardEvent({ keycode: UIOHOOK_KEY.CapsLock })!.data).toEqual({ modifier: "other" });
    });

    it("should use uiohook scan codes, not browser key codes", () => {
      // Browser codes 32/13/8 must not be mistaken for Space/Enter/Backspace.
      expect(normalizeKeyboardEvent({ keycode: 32 })!.data?.category).toBe("letter"); // D
      for (const code of [UIOHOOK_KEY.Ctrl, UIOHOOK_KEY.Alt, UIOHOOK_KEY.Meta]) {
        expect(normalizeKeyboardEvent({ keycode: code })!.type).toBe("modifierStateChanged");
      }
      expect(normalizeKeyboardEvent({ keycode: 59 })).toBeNull(); // F1
      expect(normalizeKeyboardEvent({ keycode: UIOHOOK_KEY.ArrowLeft })!.data?.category).toBe("arrow");
    });

    it("should handle sentinel key codes", () => {
      const result = normalizeKeyboardEvent({ keycode: 0xFFFF });
      expect(result).not.toBeNull();
      expect(result!.type).toBe("strikeRequested");
      // Sentinel should not appear in data
      const data = result!.data as Record<string, unknown>;
      expect(data).not.toHaveProperty("keycode");
    });
  });

  describe("normalizeMouseEvent", () => {
    it("should create a mouse moved event", () => {
      const result = normalizeMouseEvent({ x: 100, y: 200, type: "mousemove" });
      expect(result.type).toBe("mouseMoved");
      expect(result.data?.x).toBe(100);
      expect(result.data?.y).toBe(200);
    });
  });

  describe("normalizeScrollEvent", () => {
    it("should create a scroll reaction event", () => {
      const result = normalizeScrollEvent({ direction: 1, type: "wheel" });
      expect(result.type).toBe("scrollReactionRequested");
      expect(result.data?.direction).toBe(1);
    });
  });

  describe("createTypingSpeedEvent", () => {
    it("should create a typing speed event", () => {
      const result = createTypingSpeedEvent(120);
      expect(result.type).toBe("typingSpeedUpdated");
      expect(result.data?.rate).toBe(120);
    });
  });

  describe("createKamehamehaEvent", () => {
    it("should create a kamehameha event", () => {
      const result = createKamehamehaEvent();
      expect(result.type).toBe("kamehamehaRequested");
    });
  });

  describe("privacy invariant", () => {
    it("should not leak sentinel values through any event type", () => {
      const sentinels = [0xFFFF, 0xFFFE, 0xFFFD];

      for (const sentinel of sentinels) {
        const result = normalizeKeyboardEvent({ keycode: sentinel });
        if (result) {
          const str = JSON.stringify(result);
          expect(str).not.toContain("65535");
          expect(str).not.toContain("65534");
          expect(str).not.toContain("65533");
        }
      }
    });
  });
});
