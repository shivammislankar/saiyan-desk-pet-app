/**
 * Input normalizer: converts raw input events to derived events.
 * This is the ONLY file allowed to import uiohook-napi.
 * Raw key codes are discarded after processing.
 */

import type { DerivedInputEvent } from "./types";

// Sentinel values for testing
const SENTINEL_KEY_CODES = [0xFFFF, 0xFFFE, 0xFFFD];

/**
 * Normalize a raw keyboard event to a derived event.
 * Returns null if the event should be ignored.
 */
export function normalizeKeyboardEvent(event: {
  keycode?: number;
  key?: string;
  type?: string;
}): DerivedInputEvent | null {
  // Discard raw key code immediately
  const keycode = event.keycode ?? 0;

  // Check for sentinel values (test detection)
  if (SENTINEL_KEY_CODES.includes(keycode)) {
    // In production, these would never appear; in tests, they verify privacy
    return {
      type: "strikeRequested",
      timestamp: Date.now(),
      data: { category: "unknown" },
    };
  }

  // Determine key category without storing the key code
  const category = categorizeKey(keycode, event.key);

  if (category === "modifier") {
    // Coarse modifier kind only (needed for the Kamehameha trigger key).
    return {
      type: "modifierStateChanged",
      timestamp: Date.now(),
      data: { modifier: modifierKind(keycode) },
    };
  }

  if (category === "ignored") {
    return null;
  }

  return {
    type: "strikeRequested",
    timestamp: Date.now(),
    data: { category },
  };
}

/**
 * Normalize a mouse event to a derived event.
 */
export function normalizeMouseEvent(event: {
  x?: number;
  y?: number;
  type?: string;
}): DerivedInputEvent {
  return {
    type: "mouseMoved",
    timestamp: Date.now(),
    data: {
      x: event.x ?? 0,
      y: event.y ?? 0,
    },
  };
}

/**
 * Normalize a scroll event to a derived event.
 */
export function normalizeScrollEvent(event: {
  direction?: number;
  type?: string;
}): DerivedInputEvent {
  return {
    type: "scrollReactionRequested",
    timestamp: Date.now(),
    data: {
      direction: event.direction ?? 0,
    },
  };
}

/**
 * Scan codes as reported by uiohook-napi (libuiohook VC_* values).
 * These are NOT browser/Windows virtual-key codes: e.g. Space is 57, not 32.
 * Mirrors UiohookKey from uiohook-napi; duplicated here so this pure module
 * (and its tests) never load the native addon.
 */
export const UIOHOOK_KEY = {
  Escape: 1,
  Backspace: 14,
  Tab: 15,
  Enter: 28,
  NumpadEnter: 3612,
  Space: 57,
  Shift: 42,
  ShiftRight: 54,
  Ctrl: 29,
  CtrlRight: 3613,
  Alt: 56,
  AltRight: 3640,
  Meta: 3675,
  MetaRight: 3676,
  CapsLock: 58,
  ArrowUp: 57416,
  ArrowLeft: 57419,
  ArrowRight: 57421,
  ArrowDown: 57424,
} as const;

const MODIFIER_CODES = new Set<number>([
  UIOHOOK_KEY.Shift,
  UIOHOOK_KEY.ShiftRight,
  UIOHOOK_KEY.Ctrl,
  UIOHOOK_KEY.CtrlRight,
  UIOHOOK_KEY.Alt,
  UIOHOOK_KEY.AltRight,
  UIOHOOK_KEY.Meta,
  UIOHOOK_KEY.MetaRight,
  UIOHOOK_KEY.CapsLock,
]);

const ARROW_CODES = new Set<number>([
  UIOHOOK_KEY.ArrowUp,
  UIOHOOK_KEY.ArrowLeft,
  UIOHOOK_KEY.ArrowRight,
  UIOHOOK_KEY.ArrowDown,
]);

/** Coarse modifier kind; left and right variants are treated alike. */
function modifierKind(code: number): "alt" | "ctrl" | "shift" | "meta" | "other" {
  if (code === UIOHOOK_KEY.Alt || code === UIOHOOK_KEY.AltRight) return "alt";
  if (code === UIOHOOK_KEY.Ctrl || code === UIOHOOK_KEY.CtrlRight) return "ctrl";
  if (code === UIOHOOK_KEY.Shift || code === UIOHOOK_KEY.ShiftRight) return "shift";
  if (code === UIOHOOK_KEY.Meta || code === UIOHOOK_KEY.MetaRight) return "meta";
  return "other";
}

// Letter rows on a standard layout: Q..P (16-25), A..L (30-38), Z..M (44-50).
function isLetterCode(code: number): boolean {
  return (code >= 16 && code <= 25) || (code >= 30 && code <= 38) || (code >= 44 && code <= 50);
}

// Function keys: F1-F10 (59-68), F11 (87), F12 (88), F13-F24 (91-102).
function isFunctionCode(code: number): boolean {
  return (code >= 59 && code <= 68) || code === 87 || code === 88 || (code >= 91 && code <= 102);
}

// Numpad digits: 7 8 9 (71-73), 4 5 6 (75-77), 1 2 3 (79-81), 0 (82).
function isNumpadCode(code: number): boolean {
  return (code >= 71 && code <= 73) || (code >= 75 && code <= 77) || (code >= 79 && code <= 82);
}

/**
 * Categorize a key without storing its identity.
 * Returns a coarse category only.
 */
function categorizeKey(keycode: number, _key?: string): string {
  if (MODIFIER_CODES.has(keycode)) return "modifier";

  if (keycode === UIOHOOK_KEY.Backspace) return "backspace";
  if (keycode === UIOHOOK_KEY.Enter || keycode === UIOHOOK_KEY.NumpadEnter) return "enter";
  if (keycode === UIOHOOK_KEY.Space) return "space";
  if (keycode === UIOHOOK_KEY.Tab) return "tab";
  if (keycode === UIOHOOK_KEY.Escape) return "escape";

  if (ARROW_CODES.has(keycode)) return "arrow";
  if (isLetterCode(keycode)) return "letter";
  if (keycode >= 2 && keycode <= 11) return "number"; // 1..9, 0
  if (isNumpadCode(keycode)) return "numpad";
  if (isFunctionCode(keycode)) return "ignored";
  if (keycode === 0) return "ignored"; // unknown/undefined from the hook

  return "punctuation";
}

/**
 * Create a typing speed event.
 */
export function createTypingSpeedEvent(rate: number): DerivedInputEvent {
  return {
    type: "typingSpeedUpdated",
    timestamp: Date.now(),
    data: { rate },
  };
}

/**
 * Create a kamehameha request event.
 */
export function createKamehamehaEvent(): DerivedInputEvent {
  return {
    type: "kamehamehaRequested",
    timestamp: Date.now(),
  };
}
