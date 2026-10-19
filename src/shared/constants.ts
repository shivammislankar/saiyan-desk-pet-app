/**
 * Shared constants used across the application.
 */

export const APP_NAME = "saiyan-desk-pet";
export const APP_TITLE = "Saiyan Desk Pet";
export const DEFAULT_WINDOW_WIDTH = 256;
export const DEFAULT_WINDOW_HEIGHT = 256;
export const PET_SCALE = 2;
export const PET_FRAME_WIDTH = 32;
export const PET_FRAME_HEIGHT = 32;

// Physics constants
export const PHYSICS = {
  BOB_AMPLITUDE: 4,
  BOB_FREQUENCY: 1.5,
  DRAG_LIFT_PIXELS: 8,
  THROW_FRICTION: 0.92,
  MAX_THROW_VELOCITY: 2000,
  EDGE_BOUNCE_DAMPING: 0.6,
  MAX_DELTA_TIME: 100, // ms
  DEFAULT_GRAVITY: 0,
  WANDER_INTERVAL_MIN: 5000,
  WANDER_INTERVAL_MAX: 15000,
  WANDER_SPEED: 30,
  HOVER_ACCELERATION: 200,
  HOVER_DAMPING: 3,
} as const;

// Animation priorities (higher = more important)
export const ANIMATION_PRIORITY = {
  USER_INTERACTION: 100,
  KAMEHAMEHA: 90,
  SYSTEM_FEEDBACK: 80,
  REMINDER: 70,
  AGENT_ONE_SHOT: 65,
  KEYBOARD_STRIKE: 60,
  MOUSE_REACTION: 50,
  AMBIENT_AGENT: 40,
  IDLE: 10,
} as const;

// IPC channel names
export const IPC_CHANNELS = {
  // Main -> Renderer
  POSITION_UPDATE: "position:update",
  ANIMATION_CHANGE: "animation:change",
  SETTINGS_UPDATE: "settings:update",
  PERMISSION_STATUS: "permission:status",

  // Renderer -> Main
  DRAG_START: "drag:start",
  DRAG_END: "drag:end",
  CLICK_THROUGH: "click:through",
  REQUEST_ANIMATION: "request:animation",

  // Settings
  GET_SETTINGS: "settings:get",
  SAVE_SETTINGS: "settings:save",
  GET_PACKS: "packs:get",
  SELECT_PACK: "packs:select",

  // Overlay
  SHOW_OVERLAY: "overlay:show",
  HIDE_OVERLAY: "overlay:hide",
} as const;

// Default settings schema version
export const SETTINGS_SCHEMA_VERSION = 1;

// Sprite pack constraints
export const PACK_CONSTRAINTS = {
  MAX_SHEET_DIMENSION: 4096,
  MAX_FILE_SIZE_MB: 4,
  MAX_FRAMES_PER_ACTION: 64,
  MAX_ACTIONS: 100,
  MAX_PACK_SIZE_MB: 50,
} as const;
