/**
 * Movement controller: handles hovering, drifting, wandering, dragging, and throwing.
 */

import { PHYSICS } from "../shared/constants";
import { PhysicsEngine } from "./physics";
import type { Rectangle, Vector2 } from "./types";

export type MovementMode = "hover" | "wander" | "drag" | "throw";

export interface MovementState {
  mode: MovementMode;
  targetPosition: Vector2 | null;
  wanderDirection: Vector2 | null;
  dragHistory: Array<{ x: number; y: number; time: number }>;
  throwVelocity: Vector2;
  lastSettledTime: number;
}

export class MovementController {
  private physics: PhysicsEngine;
  private state: MovementState; 
  private bounds: Rectangle | null = null;
  private wanderTimer: number = 0;
  private wanderInterval: number = PHYSICS.WANDER_INTERVAL_MIN;
  private isGravityEnabled: boolean = false;

  constructor(physics: PhysicsEngine) {
    this.physics = physics;
    this.state = {
      mode: "hover",
      targetPosition: null,
      wanderDirection: null,
      dragHistory: [],
      throwVelocity: { x: 0, y: 0 },
      lastSettledTime: Date.now(),
    };
  }

  /**
   * Set the display bounds for edge collision.
   */
  setBounds(bounds: Rectangle): void {
    this.bounds = bounds;
  }

  /**
   * Get current movement mode.
   */
  getMode(): MovementMode {
    return this.state.mode;
  }

  /**
   * Start hovering at a position.
   */
  startHover(position: Vector2): void {
    this.state.mode = "hover";
    this.state.targetPosition = { ...position };
    this.state.wanderDirection = null;
    this.state.dragHistory = [];
  }

  /**
   * Start wandering (bounded idle flying).
   */
  startWander(_currentPosition: Vector2): void {
    this.state.mode = "wander";
    this.state.targetPosition = null;
    this.wanderInterval =
      PHYSICS.WANDER_INTERVAL_MIN +
      Math.random() * (PHYSICS.WANDER_INTERVAL_MAX - PHYSICS.WANDER_INTERVAL_MIN);
    this.wanderTimer = 0;

    // Pick a random direction
    const angle = Math.random() * Math.PI * 2;
    this.state.wanderDirection = {
      x: Math.cos(angle) * PHYSICS.WANDER_SPEED,
      y: Math.sin(angle) * PHYSICS.WANDER_SPEED * 0.5, // Less vertical movement
    };
  }

  /**
   * Start dragging - record position history for velocity estimation.
   */
  startDrag(position: Vector2): void {
    this.state.mode = "drag";
    this.state.dragHistory = [{ x: position.x, y: position.y, time: Date.now() }];
    this.state.targetPosition = null;
    this.state.wanderDirection = null;
  }

  /**
   * Update drag position.
   */
  updateDrag(position: Vector2): void {
    if (this.state.mode !== "drag") return;

    const now = Date.now();
    this.state.dragHistory.push({ x: position.x, y: position.y, time: now });

    // Keep only recent history (last 200ms)
    const cutoff = now - 200;
    this.state.dragHistory = this.state.dragHistory.filter((h) => h.time >= cutoff);
  }

  /**
   * End dragging and optionally throw.
   */
  endDrag(throwVelocity?: Vector2): void {
    if (this.state.mode !== "drag") return;

    if (throwVelocity) {
      this.state.mode = "throw";
      this.state.throwVelocity = this.physics.clampVelocity(throwVelocity);
    } else {
      this.state.mode = "hover";
      this.state.lastSettledTime = Date.now();
    }
    this.state.dragHistory = [];
  }

  /**
   * Estimate velocity from drag history.
   */
  estimateDragVelocity(): Vector2 {
    return this.physics.estimateVelocity(this.state.dragHistory);
  }

  /**
   * Update movement based on delta time.
   */
  update(
    currentPosition: Vector2,
    currentVelocity: Vector2,
    deltaMs: number,
    bobPhase: number
  ): { position: Vector2; velocity: Vector2; facing: "left" | "right" } {
    let newPosition = { ...currentPosition };
    let newVelocity = { ...currentVelocity };
    let facing: "left" | "right" = currentVelocity.x < 0 ? "left" : "right";

    switch (this.state.mode) {
      case "hover": {
        // Gentle bobbing, no drift
        const bobOffset = this.physics.calculateBobOffset(bobPhase);
        newPosition.y = currentPosition.y + bobOffset * (deltaMs / 1000);

        // Smoothly decelerate
        newVelocity = this.physics.smoothApproach(
          currentVelocity,
          { x: 0, y: 0 },
          deltaMs,
          PHYSICS.HOVER_ACCELERATION,
          PHYSICS.HOVER_DAMPING
        );

        // Check if we should start wandering
        this.wanderTimer += deltaMs;
        if (this.wanderTimer >= this.wanderInterval && this.state.targetPosition) {
          this.wanderTimer = 0;
          // Stay in hover but allow slight drift
        }
        break;
      }

      case "wander": {
        // Bounded wandering flight
        if (this.state.wanderDirection) {
          newVelocity = {
            x: this.state.wanderDirection.x,
            y: this.state.wanderDirection.y + this.physics.calculateBobOffset(bobPhase),
          };
          newPosition = this.physics.integrate(currentPosition, newVelocity, deltaMs);
          facing = newVelocity.x < 0 ? "left" : "right";
        }

        this.wanderTimer += deltaMs;
        if (this.wanderTimer >= this.wanderInterval) {
          this.state.mode = "hover";
          this.wanderTimer = 0;
        }

        // Apply edge bounds
        if (this.bounds) {
          const result = this.physics.applyEdgeBounce(newPosition, newVelocity, this.bounds, 32);
          newPosition = result.position;
          newVelocity = result.velocity;
          if (result.hitEdge) {
            // Bounce wander direction
            if (this.state.wanderDirection) {
              this.state.wanderDirection = {
                x: -this.state.wanderDirection.x,
                y: -this.state.wanderDirection.y,
              };
            }
          }
        }
        break;
      }

      case "drag": {
        // While dragging, position is controlled externally
        newVelocity = { x: 0, y: 0 };
        break;
      }

      case "throw": {
        // Apply throw velocity with friction
        newVelocity = this.physics.applyFriction(currentVelocity, deltaMs);
        newPosition = this.physics.integrate(currentPosition, newVelocity, deltaMs);
        facing = newVelocity.x < 0 ? "left" : "right";

        // Apply gravity if enabled
        if (this.isGravityEnabled) {
          newVelocity = this.physics.applyGravity(newVelocity, deltaMs);
        }

        // Apply edge bounds
        if (this.bounds) {
          const result = this.physics.applyEdgeBounce(newPosition, newVelocity, this.bounds, 32);
          newPosition = result.position;
          newVelocity = result.velocity;
        }

        // Settle into hover when velocity is low
        const speed = Math.sqrt(newVelocity.x ** 2 + newVelocity.y ** 2);
        if (speed < 5) {
          this.state.mode = "hover";
          this.state.lastSettledTime = Date.now();
          newVelocity = { x: 0, y: 0 };
        }
        break;
      }
    }

    return { position: newPosition, velocity: newVelocity, facing };
  }

  /**
   * Enable or disable gravity.
   */
  setGravity(enabled: boolean): void {
    this.isGravityEnabled = enabled;
    this.physics.updateConfig({ gravity: enabled ? 800 : 0 });
  }

  /**
   * Check if the pet is settled (hovering with low velocity).
   */
  isSettled(): boolean {
    return this.state.mode === "hover";
  }

  /**
   * Get time since last settled (ms).
   */
  timeSinceSettled(): number {
    return Date.now() - this.state.lastSettledTime;
  }
}
