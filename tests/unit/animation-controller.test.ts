/**
 * Unit tests for the animation controller.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AnimationController } from "../../src/core/animation-controller";

describe("AnimationController", () => {
  let controller: AnimationController;

  beforeEach(() => {
    controller = new AnimationController();
  });

  describe("request", () => {
    it("should accept a new animation request", () => {
      const result = controller.request({
        action: "punch_1",
        priority: 60,
        loop: false,
        interruptible: true,
        allowMovement: true,
        allowFacialOverride: false,
      });
      expect(result).toBe(true);
    });

    it("should reject lower priority interruptions", () => {
      // Start a high-priority animation
      controller.request({
        action: "kamehameha_charge",
        priority: 90,
        loop: false,
        interruptible: false,
        allowMovement: false,
        allowFacialOverride: false,
      });

      // Try to interrupt with lower priority
      const result = controller.request({
        action: "punch_1",
        priority: 60,
        loop: false,
        interruptible: true,
        allowMovement: true,
        allowFacialOverride: false,
      });
      expect(result).toBe(false);
    });

    it("should allow higher priority interruptions", () => {
      // Start a low-priority animation
      controller.request({
        action: "idle",
        priority: 10,
        loop: true,
        interruptible: true,
        allowMovement: true,
        allowFacialOverride: false,
      });

      // Interrupt with higher priority
      const result = controller.request({
        action: "punch_1",
        priority: 60,
        loop: false,
        interruptible: true,
        allowMovement: true,
        allowFacialOverride: false,
      });
      expect(result).toBe(true);
    });
  });

  describe("update", () => {
    it("should update animation state", () => {
      controller.request({
        action: "punch_1",
        priority: 60,
        loop: false,
        interruptible: true,
        allowMovement: true,
        allowFacialOverride: false,
        duration: 100,
      });

      controller.update(50);
      const state = controller.getLayerState("action");
      expect(state).not.toBeNull();
      expect(state!.elapsed).toBe(50);
    });

    it("should complete animation after duration", () => {
      controller.request({
        action: "punch_1",
        priority: 60,
        loop: false,
        interruptible: true,
        allowMovement: true,
        allowFacialOverride: false,
        duration: 100,
      });

      controller.update(150);
      const state = controller.getLayerState("action");
      expect(state!.currentAction).toBe("idle");
    });
  });

  describe("getEffectiveAnimation", () => {
    it("should return idle by default", () => {
      const state = controller.getEffectiveAnimation();
      expect(state.currentAction).toBe("idle");
    });

    it("should return body layer animation when active", () => {
      controller.request({
        action: "fly",
        priority: 10,
        loop: true,
        interruptible: true,
        allowMovement: true,
        allowFacialOverride: false,
      });
      const state = controller.getEffectiveAnimation();
      expect(state.currentAction).toBe("fly");
    });
  });

  describe("isActionActive", () => {
    it("should return true for active action", () => {
      controller.request({
        action: "punch_1",
        priority: 60,
        loop: false,
        interruptible: true,
        allowMovement: true,
        allowFacialOverride: false,
      });
      expect(controller.isActionActive("punch_1")).toBe(true);
    });

    it("should return false for inactive action", () => {
      expect(controller.isActionActive("punch_1")).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset all layers to idle", () => {
      controller.request({
        action: "punch_1",
        priority: 60,
        loop: false,
        interruptible: true,
        allowMovement: true,
        allowFacialOverride: false,
      });
      controller.reset();
      expect(controller.isActionActive("punch_1")).toBe(false);
    });
  });
});
