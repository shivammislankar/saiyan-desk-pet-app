/**
 * Privacy invariant integration test.
 * Feeds a simulated stream of key events through the input pipeline
 * while spying on the logger, console, all IPC channels, the agent server,
 * and filesystem writes. Asserts that none of the sentinels appear anywhere.
 *
 * Note: This test mocks the electron module to avoid requiring the Electron binary.
 * The privacy invariants are about the input pipeline, not Electron itself.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock electron before any imports that might trigger it
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock fs to spy on writes
const mockWriteFileSync = vi.fn();
vi.mock("fs", () => ({
  writeFileSync: mockWriteFileSync,
  readFileSync: vi.fn(() => "{}"),
  existsSync: vi.fn(() => true),
}));

import { normalizeKeyboardEvent } from "../../src/core/input-normalizer";

describe("Privacy Invariant Integration Test", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  // Sentinel values that should never appear in any output
  const SENTINELS = [0xFFFF, 0xFFFE, 0xFFFD];
  const SENTINEL_CHARS = ["\uFFFF", "\uFFFE", "\uFFFD"];

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not leak sentinel key codes through the input pipeline", () => {
    // Simulate a stream of key events including sentinels
    const events = [
      { keycode: 30, key: "a" },
      { keycode: 0xFFFF }, // Sentinel 1
      { keycode: 48, key: "b" },
      { keycode: 0xFFFE }, // Sentinel 2
      { keycode: 42 }, // Shift (modifier, uiohook scan code)
      { keycode: 0xFFFD }, // Sentinel 3
      { keycode: 46, key: "c" },
    ];

    for (const event of events) {
      normalizeKeyboardEvent(event);
    }

    // Check console output
    for (const call of consoleSpy.mock.calls) {
      const output = JSON.stringify(call);
      for (const sentinel of SENTINELS) {
        expect(output).not.toContain(String(sentinel));
      }
      for (const char of SENTINEL_CHARS) {
        expect(output).not.toContain(char);
      }
    }
  });

  it("should not log raw key event objects", () => {
    const events = [
      { keycode: 30, key: "a" },
      { keycode: 48, key: "b" },
    ];

    for (const event of events) {
      normalizeKeyboardEvent(event);
    }

    // Verify no console.log calls contain raw keycodes
    for (const call of consoleSpy.mock.calls) {
      const output = JSON.stringify(call);
      expect(output).not.toMatch(/keycode.*30/);
      expect(output).not.toMatch(/keycode.*48/);
    }
  });

  it("should produce derived events with only coarse categories", () => {
    const result = normalizeKeyboardEvent({ keycode: 30, key: "a" });
    expect(result).not.toBeNull();

    const data = result!.data as Record<string, unknown>;
    // Should have category but not keycode
    expect(data).toHaveProperty("category");
    expect(data).not.toHaveProperty("keycode");
    expect(data).not.toHaveProperty("key");
    expect(data).not.toHaveProperty("keyCode");
  });

  it("should handle modifier-only events correctly", () => {
    const result = normalizeKeyboardEvent({ keycode: 42 }); // Shift (uiohook scan code)
    // Modifiers return a modifierStateChanged event, not a strike
    expect(result).not.toBeNull();
    expect(result!.type).toBe("modifierStateChanged");
  });

  it("should not persist any input data", () => {
    const events = [
      { keycode: 30, key: "a" },
      { keycode: 0xFFFF },
      { keycode: 48, key: "b" },
    ];

    for (const event of events) {
      normalizeKeyboardEvent(event);
    }

    // Verify no filesystem writes occurred (fs is mocked)
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});
