/**
 * Physics engine for pet movement.
 * Delta-time based integration with exponential damping.
 */

import { PHYSICS } from "../shared/constants";
import type { PhysicsConfig, Rectangle, Vector2 } from "./types";

export class PhysicsEngine {
  private config: PhysicsConfig;

  constructor(config?: Partial<PhysicsConfig>) {
    this.config = {
      gravity: config?.gravity ?? PHYSICS.DEFAULT_GRAVITY,
      bobAmplitude: config?.bobAmplitude ?? PHYSICS.BOB_AMPLITUDE,
      bobFrequency: config?.bobFrequency ?? PHYSICS.BOB_FREQUENCY,
      throwFriction: config?.throwFriction ?? PHYSICS.THROW_FRICTION,
      maxThrowVelocity: config?.maxThrowVelocity ?? PHYSICS.MAX_THROW_VELOCITY,
      edgeBounceDamping: config?.edgeBounceDamping ?? PHYSICS.EDGE_BOUNCE_DAMPING,
      maxDeltaTime: config?.maxDeltaTime ?? PHYSICS.MAX_DELTA_TIME,
      hoverAcceleration: config?.hoverAcceleration ?? PHYSICS.HOVER_ACCELERATION,
      hoverDamping: config?.hoverDamping ?? PHYSICS.HOVER_DAMPING,
      wanderSpeed: config?.wanderSpeed ?? PHYSICS.WANDER_SPEED,
    };
  }

  /**
   * Clamp delta time to prevent physics explosions after suspend/resume.
   */
  clampDeltaTime(deltaMs: number): number {
    return Math.min(Math.max(deltaMs, 0), this.config.maxDeltaTime);
  }

  /**
   * Apply exponential velocity decay (frame-rate independent).
   */
  applyFriction(velocity: Vector2, deltaMs: number, friction?: number): Vector2 {
    const f = friction ?? this.config.throwFriction;
    const factor = Math.pow(f, deltaMs / 1000);
    return {
      x: velocity.x * factor,
      y: velocity.y * factor,
    };
  }

  /**
   * Update position based on velocity and delta time.
   */
  integrate(position: Vector2, velocity: Vector2, deltaMs: number): Vector2 {
    const dt = this.clampDeltaTime(deltaMs) / 1000;
    return {
      x: position.x + velocity.x * dt,
      y: position.y + velocity.y * dt,
    };
  }

  /**
   * Apply gravity to velocity.
   */
  applyGravity(velocity: Vector2, deltaMs: number): Vector2 {
    if (this.config.gravity === 0) return velocity;
    const dt = this.clampDeltaTime(deltaMs) / 1000;
    return {
      x: velocity.x,
      y: velocity.y + this.config.gravity * dt,
    };
  }

  /**
   * Clamp velocity to maximum throw speed.
   */
  clampVelocity(velocity: Vector2): Vector2 {
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    if (speed > this.config.maxThrowVelocity) {
      const scale = this.config.maxThrowVelocity / speed;
      return { x: velocity.x * scale, y: velocity.y * scale };
    }
    return velocity;
  }

  /**
   * Calculate soft edge bounce.
   */
  applyEdgeBounce(
    position: Vector2,
    velocity: Vector2,
    bounds: Rectangle,
    margin: number = 0
  ): { position: Vector2; velocity: Vector2; hitEdge: boolean } {
    let newVelX = velocity.x;
    let newVelY = velocity.y;
    let newPosX = position.x;
    let newPosY = position.y;
    let hitEdge = false;

    const minX = bounds.x + margin;
    const maxX = bounds.x + bounds.width - margin;
    const minY = bounds.y + margin;
    const maxY = bounds.y + bounds.height - margin;

    if (position.x < minX) {
      newPosX = minX;
      newVelX = Math.abs(velocity.x) * this.config.edgeBounceDamping;
      hitEdge = true;
    } else if (position.x > maxX) {
      newPosX = maxX;
      newVelX = -Math.abs(velocity.x) * this.config.edgeBounceDamping;
      hitEdge = true;
    }

    if (position.y < minY) {
      newPosY = minY;
      newVelY = Math.abs(velocity.y) * this.config.edgeBounceDamping;
      hitEdge = true;
    } else if (position.y > maxY) {
      newPosY = maxY;
      newVelY = -Math.abs(velocity.y) * this.config.edgeBounceDamping;
      hitEdge = true;
    }

    return {
      position: { x: newPosX, y: newPosY },
      velocity: { x: newVelX, y: newVelY },
      hitEdge,
    };
  }

  /**
   * Calculate sine-wave bob offset.
   */
  calculateBobOffset(bobPhase: number): number {
    return Math.sin(bobPhase * this.config.bobFrequency * Math.PI * 2) * this.config.bobAmplitude;
  }

  /**
   * Estimate velocity from position history.
   */
  estimateVelocity(history: Array<{ x: number; y: number; time: number }>): Vector2 {
    if (history.length < 2) return { x: 0, y: 0 };

    // Use last few samples for smoother estimate
    const recent = history.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = (last.time - first.time) / 1000;

    if (dt <= 0) return { x: 0, y: 0 };

    return {
      x: (last.x - first.x) / dt,
      y: (last.y - first.y) / dt,
    };
  }

  /**
   * Smoothly interpolate towards target velocity.
   */
  smoothApproach(
    current: Vector2,
    target: Vector2,
    deltaMs: number,
    acceleration: number,
    damping: number
  ): Vector2 {
    const dt = this.clampDeltaTime(deltaMs) / 1000;
    const factor = Math.min(1, acceleration * dt);
    const dampFactor = Math.exp(-damping * dt);

    return {
      x: (current.x + (target.x - current.x) * factor) * dampFactor,
      y: (current.y + (target.y - current.y) * factor) * dampFactor,
    };
  }

  /**
   * Update physics config (e.g., when gravity is toggled).
   */
  updateConfig(config: Partial<PhysicsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): PhysicsConfig {
    return { ...this.config };
  }
}
