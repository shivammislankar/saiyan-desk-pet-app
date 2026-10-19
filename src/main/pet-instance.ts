/**
 * PetInstance: contains all per-pet state.
 * Designed for future multi-pet support - no global singletons for position, animation or state.
 */

import { PhysicsEngine } from "../core/physics";
import { MovementController } from "../core/movement-controller";
import { AnimationController } from "../core/animation-controller";
import type { Vector2, DisplayBounds, PetState, AnimationRequest } from "../core/types";

export interface PetInstanceConfig {
  id: string;
  displayBounds: DisplayBounds;
  initialPosition?: Vector2;
  scale?: number;
  opacity?: number;
}

export class PetInstance {
  readonly id: string;
  readonly scale: number;
  readonly opacity: number;
  private physics: PhysicsEngine;
  private movement: MovementController;
  private animation: AnimationController;
  private state: PetState;
  private displayBounds: DisplayBounds;
  private bobPhase: number = 0;
  private lastUpdateTime: number = Date.now();

  constructor(config: PetInstanceConfig) {
    this.id = config.id;
    this.displayBounds = config.displayBounds;
    this.scale = config.scale ?? 2;
    this.opacity = config.opacity ?? 1;

    // Initialize state
    const initialPos = config.initialPosition ?? { x: 128, y: 128 };
    this.state = {
      position: { ...initialPos },
      velocity: { x: 0, y: 0 },
      facing: "right",
      isDragging: false,
      isThrowing: false,
      bobPhase: 0,
      eyeOffset: { x: 0, y: 0 },
      currentDisplay: config.displayBounds.id,
      scale: this.scale,
      opacity: this.opacity,
    };

    // Initialize physics and controllers
    this.physics = new PhysicsEngine();
    this.movement = new MovementController(this.physics);
    this.animation = new AnimationController();

    // Set bounds
    this.movement.setBounds(config.displayBounds.workArea);
  }

  /**
   * Update the pet state.
   */
  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.bobPhase += dt;

    // Update movement
    const result = this.movement.update(
      this.state.position,
      this.state.velocity,
      deltaMs,
      this.bobPhase
    );

    this.state.position = result.position;
    this.state.velocity = result.velocity;
    this.state.facing = result.facing;
    this.state.bobPhase = this.bobPhase;

    // Update animation
    this.animation.update(deltaMs);

    this.lastUpdateTime = Date.now();
  }

  /**
   * Get the current render state.
   */
  getRenderState(): {
    position: Vector2;
    facing: "left" | "right";
    scale: number;
    opacity: number;
    bobOffset: number;
    eyeOffset: { x: number; y: number };
    currentAction: string;
    frameIndex: number;
    isDragging: boolean;
  } {
    const bobOffset = this.physics.calculateBobOffset(this.bobPhase);
    const animState = this.animation.getEffectiveAnimation();

    return {
      position: { ...this.state.position },
      facing: this.state.facing,
      scale: this.scale,
      opacity: this.opacity,
      bobOffset,
      eyeOffset: { ...this.state.eyeOffset },
      currentAction: animState.currentAction,
      frameIndex: animState.frameIndex,
      isDragging: this.state.isDragging,
    };
  }

  /**
   * Start dragging.
   */
  startDrag(): void {
    this.state.isDragging = true;
    this.movement.startDrag(this.state.position);
    this.animation.request({
      action: "drag",
      priority: 100,
      loop: true,
      interruptible: true,
      allowMovement: false,
      allowFacialOverride: false,
    });
  }

  /**
   * Update drag position.
   */
  updateDrag(position: Vector2): void {
    this.state.position = { ...position };
    this.movement.updateDrag(position);
  }

  /**
   * End dragging.
   */
  endDrag(): void {
    const velocity = this.movement.estimateDragVelocity();
    this.state.isDragging = false;
    this.movement.endDrag(velocity);
    this.state.velocity = velocity;
  }

  /**
   * Request an animation.
   */
  requestAnimation(request: AnimationRequest): boolean {
    return this.animation.request(request);
  }

  /**
   * Update display bounds.
   */
  updateDisplayBounds(bounds: DisplayBounds): void {
    this.displayBounds = bounds;
    this.movement.setBounds(bounds.workArea);
    this.state.currentDisplay = bounds.id;
  }

  /**
   * Get normalized position for persistence.
   */
  getNormalizedPosition(): { displayId: string; x: number; y: number } {
    const { workArea } = this.displayBounds;
    return {
      displayId: this.displayBounds.id,
      x: (this.state.position.x - workArea.x) / workArea.width,
      y: (this.state.position.y - workArea.y) / workArea.height,
    };
  }

  /**
   * Restore position from normalized coordinates.
   */
  setNormalizedPosition(displayId: string, x: number, y: number): void {
    if (displayId !== this.displayBounds.id) return;

    const { workArea } = this.displayBounds;
    this.state.position = {
      x: workArea.x + x * workArea.width,
      y: workArea.y + y * workArea.height,
    };
    this.movement.startHover(this.state.position);
  }

  /**
   * Get the movement controller (for advanced interactions).
   */
  getMovementController(): MovementController {
    return this.movement;
  }

  /**
   * Get the animation controller (for advanced interactions).
   */
  getAnimationController(): AnimationController {
    return this.animation;
  }

  /**
   * Get the physics engine (for advanced interactions).
   */
  getPhysicsEngine(): PhysicsEngine {
    return this.physics;
  }

  /**
   * Clean up resources.
   */
  shutdown(): void {
    this.animation.reset();
  }
}
