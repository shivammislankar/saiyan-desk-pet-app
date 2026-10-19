/**
 * Unit tests for the movement controller.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MovementController } from "../../src/core/movement-controller";
import { PhysicsEngine } from "../../src/core/physics";

describe("MovementController", () => {
  let physics: PhysicsEngine;
  let movement: MovementController;

  beforeEach(() => {
    physics = new PhysicsEngine();
    movement = new MovementController(physics);
    movement.setBounds({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  describe("startHover", () => {
    it("should set mode to hover", () => {
      movement.startHover({ x: 100, y: 100 });
      expect(movement.getMode()).toBe("hover");
    });
  });

  describe("startWander", () => {
    it("should set mode to wander", () => {
      movement.startWander({ x: 100, y: 100 });
      expect(movement.getMode()).toBe("wander");
    });
  });

  describe("startDrag", () => {
    it("should set mode to drag", () => {
      movement.startDrag({ x: 100, y: 100 });
      expect(movement.getMode()).toBe("drag");
    });
  });

  describe("endDrag", () => {
    it("should set mode to throw when velocity provided", () => {
      movement.startDrag({ x: 100, y: 100 });
      movement.endDrag({ x: 500, y: 0 });
      expect(movement.getMode()).toBe("throw");
    });

    it("should set mode to hover when no velocity", () => {
      movement.startDrag({ x: 100, y: 100 });
      movement.endDrag();
      expect(movement.getMode()).toBe("hover");
    });
  });

  describe("update", () => {
    it("should update position in hover mode", () => {
      movement.startHover({ x: 100, y: 100 });
      const result = movement.update({ x: 100, y: 100 }, { x: 0, y: 0 }, 16, 0);
      expect(result.position.x).toBe(100);
      expect(result.position.y).toBe(100);
    });

    it("should update position in throw mode", () => {
      movement.startDrag({ x: 100, y: 100 });
      movement.endDrag({ x: 500, y: 0 });
      const result = movement.update({ x: 100, y: 100 }, { x: 500, y: 0 }, 16, 0);
      expect(result.position.x).toBeGreaterThan(100);
    });

    it("should settle into hover when velocity is low", () => {
      movement.startDrag({ x: 100, y: 100 });
      movement.endDrag({ x: 1, y: 0 });
      // Update multiple times to let friction reduce velocity
      let pos = { x: 100, y: 100 };
      let vel = { x: 1, y: 0 };
      for (let i = 0; i < 100; i++) {
        const result = movement.update(pos, vel, 16, 0);
        pos = result.position;
        vel = result.velocity;
      }
      expect(movement.getMode()).toBe("hover");
    });
  });

  describe("setGravity", () => {
    it("should enable gravity", () => {
      movement.setGravity(true);
      // Gravity is applied in throw mode
      movement.startDrag({ x: 100, y: 100 });
      movement.endDrag({ x: 0, y: 0 });
      const result = movement.update({ x: 100, y: 100 }, { x: 0, y: 0 }, 16, 0);
      expect(result.velocity.y).toBeGreaterThan(0);
    });
  });

  describe("isSettled", () => {
    it("should return true when hovering", () => {
      movement.startHover({ x: 100, y: 100 });
      expect(movement.isSettled()).toBe(true);
    });

    it("should return false when dragging", () => {
      movement.startDrag({ x: 100, y: 100 });
      expect(movement.isSettled()).toBe(false);
    });
  });
});
