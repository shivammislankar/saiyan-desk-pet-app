/**
 * Unit tests for the physics engine.
 */

import { describe, it, expect } from "vitest";
import { PhysicsEngine } from "../../src/core/physics";

describe("PhysicsEngine", () => {
  let physics: PhysicsEngine;

  beforeEach(() => {
    physics = new PhysicsEngine();
  });

  describe("clampDeltaTime", () => {
    it("should clamp negative delta to 0", () => {
      expect(physics.clampDeltaTime(-100)).toBe(0);
    });

    it("should clamp large delta to max", () => {
      expect(physics.clampDeltaTime(500)).toBe(100);
    });

    it("should pass through valid delta", () => {
      expect(physics.clampDeltaTime(16)).toBe(16);
    });
  });

  describe("applyFriction", () => {
    it("should reduce velocity over time", () => {
      const velocity = { x: 100, y: 100 };
      const result = physics.applyFriction(velocity, 1000);
      expect(result.x).toBeLessThan(100);
      expect(result.y).toBeLessThan(100);
    });

    it("should be frame-rate independent", () => {
      const velocity = { x: 100, y: 100 };
      const result1 = physics.applyFriction(velocity, 500);
      const result2 = physics.applyFriction(result1, 500);
      const resultSingle = physics.applyFriction(velocity, 1000);
      expect(result2.x).toBeCloseTo(resultSingle.x, 5);
    });
  });

  describe("integrate", () => {
    it("should update position based on velocity", () => {
      const position = { x: 0, y: 0 };
      const velocity = { x: 100, y: 50 };
      // deltaMs is clamped to maxDeltaTime (100ms), so 1000ms becomes 100ms
      const result = physics.integrate(position, velocity, 100);
      expect(result.x).toBe(10);
      expect(result.y).toBe(5);
    });
  });

  describe("applyGravity", () => {
    it("should not apply gravity when disabled", () => {
      const velocity = { x: 0, y: 0 };
      const result = physics.applyGravity(velocity, 1000);
      expect(result.y).toBe(0);
    });

    it("should apply gravity when enabled", () => {
      physics.updateConfig({ gravity: 800 });
      const velocity = { x: 0, y: 0 };
      // deltaMs is clamped to maxDeltaTime (100ms), so 1000ms becomes 100ms
      const result = physics.applyGravity(velocity, 100);
      expect(result.y).toBe(80);
    });
  });

  describe("clampVelocity", () => {
    it("should clamp velocity to maximum", () => {
      const velocity = { x: 3000, y: 0 };
      const result = physics.clampVelocity(velocity);
      expect(result.x).toBeLessThanOrEqual(2000);
    });

    it("should not modify velocity below maximum", () => {
      const velocity = { x: 100, y: 100 };
      const result = physics.clampVelocity(velocity);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });
  });

  describe("applyEdgeBounce", () => {
    it("should bounce off left edge", () => {
      const bounds = { x: 0, y: 0, width: 100, height: 100 };
      const position = { x: -5, y: 50 };
      const velocity = { x: -100, y: 0 };
      const result = physics.applyEdgeBounce(position, velocity, bounds, 10);
      expect(result.hitEdge).toBe(true);
      expect(result.velocity.x).toBeGreaterThan(0);
    });

    it("should bounce off right edge", () => {
      const bounds = { x: 0, y: 0, width: 100, height: 100 };
      const position = { x: 105, y: 50 };
      const velocity = { x: 100, y: 0 };
      const result = physics.applyEdgeBounce(position, velocity, bounds, 10);
      expect(result.hitEdge).toBe(true);
      expect(result.velocity.x).toBeLessThan(0);
    });

    it("should not bounce when inside bounds", () => {
      const bounds = { x: 0, y: 0, width: 100, height: 100 };
      const position = { x: 50, y: 50 };
      const velocity = { x: 10, y: 10 };
      const result = physics.applyEdgeBounce(position, velocity, bounds, 10);
      expect(result.hitEdge).toBe(false);
    });
  });

  describe("calculateBobOffset", () => {
    it("should return sine wave values", () => {
      const offset1 = physics.calculateBobOffset(0);
      const offset2 = physics.calculateBobOffset(0.25);
      const offset3 = physics.calculateBobOffset(0.5);
      expect(offset1).toBeCloseTo(0, 5);
      expect(offset2).toBeGreaterThan(0);
      // At phase 0.5 with frequency 1.5, sine is at minimum (-1)
      expect(offset3).toBeCloseTo(-4, 5);
    });
  });

  describe("estimateVelocity", () => {
    it("should estimate velocity from position history", () => {
      const history = [
        { x: 0, y: 0, time: 0 },
        { x: 100, y: 50, time: 1000 },
      ];
      const velocity = physics.estimateVelocity(history);
      expect(velocity.x).toBe(100);
      expect(velocity.y).toBe(50);
    });

    it("should return zero for insufficient history", () => {
      const velocity = physics.estimateVelocity([{ x: 0, y: 0, time: 0 }]);
      expect(velocity.x).toBe(0);
      expect(velocity.y).toBe(0);
    });
  });

  describe("smoothApproach", () => {
    it("should smoothly approach target", () => {
      const current = { x: 0, y: 0 };
      const target = { x: 100, y: 100 };
      const result = physics.smoothApproach(current, target, 1000, 200, 3);
      expect(result.x).toBeGreaterThan(0);
      expect(result.x).toBeLessThan(100);
    });
  });
});
