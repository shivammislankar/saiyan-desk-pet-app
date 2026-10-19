/**
 * Centralized animation controller.
 * Manages layered animations with priority-based interruption.
 */

import { eventBus } from "./event-bus";
import { getLayerForAction, getPriorityForAction } from "./animation-priorities";
import type { AnimationAction, AnimationRequest, AnimationState } from "./types";

interface ActiveAnimation {
  request: AnimationRequest;
  state: AnimationState;
  startTime: number;
}

export class AnimationController {
  private layers: Map<string, ActiveAnimation> = new Map();
  private maxDuration: number = 10000; // Watchdog timeout

  constructor() {
    this.layers.set("body", this.createIdleAnimation());
    this.layers.set("action", this.createIdleAnimation());
    this.layers.set("status", this.createIdleAnimation());
  }

  /**
   * Request an animation. May interrupt lower-priority animations.
   */
  request(request: AnimationRequest): boolean {
    const layer = getLayerForAction(request.action);
    const priority = request.priority || getPriorityForAction(request.action);

    // Check if we can interrupt the current animation on this layer
    const current = this.layers.get(layer);
    if (current) {
      const currentPriority = current.request.priority;

      // Can't interrupt higher or equal priority animations
      if (priority < currentPriority && !current.request.interruptible) {
        return false;
      }

      // Same priority: only interrupt if the new one is explicitly interruptible
      if (priority === currentPriority && !request.interruptible) {
        return false;
      }
    }

    // Start the new animation
    const state: AnimationState = {
      currentAction: request.action,
      layer: layer as "body" | "action" | "status",
      frameIndex: 0,
      elapsed: 0,
      loop: request.loop,
      priority,
    };

    this.layers.set(layer, { request, state, startTime: Date.now() });

    eventBus.emit("animation:changed", {
      action: request.action,
      layer,
      priority,
      loop: request.loop,
    });

    return true;
  }

  /**
   * Update all animations based on delta time.
   */
  update(deltaMs: number): void {
    const now = Date.now();

    for (const [layerName, active] of this.layers) {
      active.state.elapsed += deltaMs;

      // Calculate frame index
      // Frame calculation would use the actual sprite data
      // For now, increment frame index modulo frame count
      active.state.frameIndex++;

      // Check for completion
      if (!active.state.loop && active.request.duration) {
        if (active.state.elapsed >= active.request.duration) {
          this.completeAnimation(layerName);
        }
      }

      // Watchdog: force complete if exceeded max duration
      if (now - active.startTime > this.maxDuration && !active.state.loop) {
        this.completeAnimation(layerName);
      }
    }
  }

  /**
   * Complete an animation and restore the appropriate underlying state.
   */
  completeAnimation(layerName: string): void {
    const active = this.layers.get(layerName);
    if (!active) return;

    // Call completion callback
    if (active.request.onComplete) {
      try {
        active.request.onComplete();
      } catch (error) {
        console.error("Animation completion callback error:", error);
      }
    }

    // Restore to idle
    this.layers.set(layerName, this.createIdleAnimation());

    eventBus.emit("animation:completed", {
      layer: layerName,
      action: active.state.currentAction,
    });
  }

  /**
   * Get the current animation state for a layer.
   */
  getLayerState(layerName: string): AnimationState | null {
    const active = this.layers.get(layerName);
    return active ? { ...active.state } : null;
  }

  /**
   * Get the effective animation considering all layers.
   */
  getEffectiveAnimation(): AnimationState {
    // Priority: body > action > status for display
    const body = this.layers.get("body");
    const action = this.layers.get("action");
    const status = this.layers.get("status");

    // Body layer always shows (it's the movement pose)
    if (body && body.state.currentAction !== "idle") {
      return { ...body.state };
    }

    // Action layer overrides body for one-shots
    if (action && action.state.currentAction !== "idle") {
      return { ...action.state };
    }

    // Status layer is ambient (face/aura only, handled by renderer)
    if (status && status.state.currentAction !== "idle") {
      return { ...status.state };
    }

    // Default to idle
    return {
      currentAction: "idle",
      layer: "body",
      frameIndex: 0,
      elapsed: 0,
      loop: true,
      priority: 0,
    };
  }

  /**
   * Check if a specific action is currently active.
   */
  isActionActive(action: AnimationAction): boolean {
    for (const [, active] of this.layers) {
      if (active.state.currentAction === action) {
        return true;
      }
    }
    return false;
  }

  /**
   * Force return to idle state.
   */
  reset(): void {
    this.layers.set("body", this.createIdleAnimation());
    this.layers.set("action", this.createIdleAnimation());
    this.layers.set("status", this.createIdleAnimation());
  }

  /**
   * Create an idle animation state.
   */
  private createIdleAnimation(): ActiveAnimation {
    return {
      request: {
        action: "idle",
        priority: 0,
        loop: true,
        interruptible: true,
        allowMovement: true,
        allowFacialOverride: false,
      },
      state: {
        currentAction: "idle",
        layer: "body",
        frameIndex: 0,
        elapsed: 0,
        loop: true,
        priority: 0,
      },
      startTime: Date.now(),
    };
  }
}
