/**
 * Core type definitions for the pet system.
 */

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayBounds {
  id: string;
  bounds: Rectangle;
  workArea: Rectangle;
  scaleFactor: number;
  isPrimary: boolean;
}

export type AnimationAction =
  | "idle"
  | "fly"
  | "hover"
  | "nimbus_ride"
  | "punch_1"
  | "punch_2"
  | "punch_3"
  | "kick_1"
  | "kick_2"
  | "uppercut"
  | "block"
  | "kamehameha_charge"
  | "kamehameha_fire"
  | "kaioken"
  | "laugh"
  | "scroll_unroll"
  | "peek"
  | "stretch"
  | "drink"
  | "thinking"
  | "done"
  | "drag"
  | "sleep"
  | "working"
  | "confused"
  | "eat"
  | "train"
  | "scratch_head"
  | "yawn"
  | "stomach_growl"
  | "look_around"
  | "spar";

export type AnimationLayer = "body" | "action" | "status";

export interface AnimationRequest {
  action: AnimationAction;
  priority: number;
  loop: boolean;
  interruptible: boolean;
  allowMovement: boolean;
  allowFacialOverride: boolean;
  duration?: number;
  onComplete?: () => void;
}

export interface AnimationState {
  currentAction: AnimationAction;
  layer: AnimationLayer;
  frameIndex: number;
  elapsed: number;
  loop: boolean;
  priority: number;
}

export interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteAction {
  sheet: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  framesPerRow: number;
  fps: number;
  anchorX: number;
  anchorY: number;
  loop: boolean;
  frameEvents: Record<string, number>;
  flip: boolean;
}

export interface SpritePack {
  id: string;
  name: string;
  author: string;
  version: string;
  license: string;
  facing: "left" | "right";
  actions: Record<string, SpriteAction>;
  imageCache: Map<string, HTMLImageElement>;
  /** "pixelated" (default): nearest-neighbour, whole-pixel scaling. "smooth": high-quality filtering for painted/high-res art. */
  rendering?: "pixelated" | "smooth";
  /** Screen px per frame px. When set, overrides the user's scale setting (used by high-res packs). */
  displayScale?: number;
  /** Kamehameha beam: where the hands are in the kamehameha_fire frame (frame px). */
  kamehameha?: { handX: number; handY: number };
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

export interface EyeOffset {
  x: number;
  y: number;
}

export interface PetState {
  position: Vector2;
  velocity: Vector2;
  facing: "left" | "right";
  isDragging: boolean;
  isThrowing: boolean;
  bobPhase: number;
  eyeOffset: EyeOffset;
  currentDisplay: string;
  scale: number;
  opacity: number;
}

export interface PhysicsConfig {
  gravity: number;
  bobAmplitude: number;
  bobFrequency: number;
  throwFriction: number;
  maxThrowVelocity: number;
  edgeBounceDamping: number;
  maxDeltaTime: number;
  hoverAcceleration: number;
  hoverDamping: number;
  wanderSpeed: number;
}

export type InputEventType =
  | "strikeRequested"
  | "modifierStateChanged"
  | "typingSpeedUpdated"
  | "kamehamehaRequested"
  | "scrollReactionRequested"
  | "mouseMoved"
  | "mouseClicked";

export interface DerivedInputEvent {
  type: InputEventType;
  timestamp: number;
  data?: Record<string, unknown>;
}
