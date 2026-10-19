/**
 * Zod schemas for validating untrusted JSON data.
 */
import { z } from "zod";

// Settings schema
export const settingsSchema = z.object({
  schemaVersion: z.number().int().positive(),
  scale: z.number().min(0.5).max(4).default(2),
  opacity: z.number().min(0.1).max(1).default(1),
  outfitColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#FF6600"),
  hairColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#000000"),
  spritePack: z.string().min(1).max(100).default("default"),
  nimbusMode: z.enum(["when-idle", "always", "never"]).default("never"),
  gravity: z.boolean().default(false),
  mouseHunt: z.boolean().default(true),
  petting: z.boolean().default(true),
  scrollReactions: z.boolean().default(true),
  keyboardCombat: z.boolean().default(true),
  kaioken: z.boolean().default(true),
  kamehamehaEnabled: z.boolean().default(true),
  kamehamehaTrigger: z.enum(["alt", "ctrl", "shift"]).default("alt"),
  kamehamehaTiming: z.number().min(200).max(1000).default(400),
  kamehamehaCooldown: z.number().min(1000).max(10000).default(3000),
  cursorAiming: z.boolean().default(false),
  sound: z.boolean().default(false),
  peekMode: z.boolean().default(false),
  startAtLogin: z.boolean().default(false),
  stretchReminderInterval: z.number().min(1).max(120).default(45),
  waterReminderInterval: z.number().min(1).max(120).default(60),
  pomodoroFocusDuration: z.number().min(1).max(120).default(25),
  pomodoroShortBreak: z.number().min(1).max(30).default(5),
  pomodoroLongBreak: z.number().min(1).max(60).default(15),
  pomodoroSessionsBeforeLongBreak: z.number().min(1).max(10).default(4),
  userName: z.string().max(50).default(""),
  animationIntensity: z.number().min(0).max(2).default(1),
  wandering: z.boolean().default(true),
});

export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = {
  schemaVersion: 1,
  scale: 2,
  opacity: 1,
  outfitColor: "#FF6600",
  hairColor: "#000000",
  spritePack: "default",
  nimbusMode: "when-idle",
  gravity: false,
  mouseHunt: true,
  petting: true,
  scrollReactions: true,
  keyboardCombat: true,
  kaioken: true,
  kamehamehaEnabled: true,
  kamehamehaTrigger: "alt",
  kamehamehaTiming: 400,
  kamehamehaCooldown: 3000,
  cursorAiming: false,
  sound: false,
  peekMode: false,
  startAtLogin: false,
  stretchReminderInterval: 45,
  waterReminderInterval: 60,
  pomodoroFocusDuration: 25,
  pomodoroShortBreak: 5,
  pomodoroLongBreak: 15,
  pomodoroSessionsBeforeLongBreak: 4,
  userName: "",
  animationIntensity: 1,
  wandering: true,
};

// Position persistence schema
export const positionSchema = z.object({
  displayId: z.string(),
  normalizedX: z.number().min(0).max(1),
  normalizedY: z.number().min(0).max(1),
});

export type PositionData = z.infer<typeof positionSchema>;

// Sprite pack manifest schema
export const packManifestSchema = z.object({
  name: z.string().min(1).max(100),
  author: z.string().max(100).default(""),
  version: z.string().min(1).max(20),
  license: z.string().max(500).default(""),
  facing: z.enum(["left", "right"]).default("right"),
});

export type PackManifest = z.infer<typeof packManifestSchema>;

// Action manifest schema
export const actionManifestSchema = z.object({
  sheet: z.string().min(1),
  frameWidth: z.number().int().positive().max(256),
  frameHeight: z.number().int().positive().max(256),
  frameCount: z.number().int().positive().max(256),
  framesPerRow: z.number().int().positive().max(64).optional(),
  fps: z.number().positive().min(1).max(60),
  anchorX: z.number(),
  anchorY: z.number(),
  loop: z.boolean().default(true),
  frameEvents: z.record(z.string(), z.number()).optional(),
  flip: z.boolean().default(false),
});

export type ActionManifest = z.infer<typeof actionManifestSchema>;

// Pack actions schema
export const packActionsSchema = z.object({
  actions: z.record(z.string(), actionManifestSchema),
});

export type PackActions = z.infer<typeof packActionsSchema>;

// To-do list (opened by clicking the pet)
export const TODO_LIMITS = { MAX_ITEMS: 200, MAX_TEXT: 200 } as const;

export const todoItemSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  text: z.string().trim().min(1).max(TODO_LIMITS.MAX_TEXT),
  done: z.boolean(),
  createdAt: z.number().int().nonnegative(),
});

export const todoListSchema = z.array(todoItemSchema).max(TODO_LIMITS.MAX_ITEMS);

export type TodoItem = z.infer<typeof todoItemSchema>;
