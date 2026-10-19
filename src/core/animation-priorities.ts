/**
 * Animation priority constants and layer definitions.
 */

import { ANIMATION_PRIORITY } from "../shared/constants";

export { ANIMATION_PRIORITY };

/**
 * Animation layers.
 * Body: movement pose (hover, fly, nimbus_ride, drag)
 * Action: strikes, Kamehameha, reminders, mouse reactions, one-shot agent reactions
 * Status: ambient AI-agent state (thinking, working)
 */
export type AnimationLayerName = "body" | "action" | "status";

/**
 * Get layer name for a given action.
 */
export function getLayerForAction(action: string): AnimationLayerName {
  // Body layer actions
  if (["hover", "fly", "nimbus_ride", "drag"].includes(action)) {
    return "body";
  }

  // Status layer actions (ambient agent states)
  if (["thinking", "working"].includes(action)) {
    return "status";
  }

  // Everything else is action layer
  return "action";
}

/**
 * Get priority for a given action.
 */
export function getPriorityForAction(action: string): number {
  switch (action) {
    case "drag":
      return ANIMATION_PRIORITY.USER_INTERACTION;
    case "kamehameha_charge":
    case "kamehameha_fire":
      return ANIMATION_PRIORITY.KAMEHAMEHA;
    case "done":
    case "error":
      return ANIMATION_PRIORITY.AGENT_ONE_SHOT;
    case "stretch":
    case "drink":
      return ANIMATION_PRIORITY.REMINDER;
    case "punch_1":
    case "punch_2":
    case "punch_3":
    case "kick_1":
    case "kick_2":
    case "uppercut":
    case "block":
    case "kaioken":
      return ANIMATION_PRIORITY.KEYBOARD_STRIKE;
    case "laugh":
    case "scroll_unroll":
      return ANIMATION_PRIORITY.MOUSE_REACTION;
    case "thinking":
    case "working":
      return ANIMATION_PRIORITY.AMBIENT_AGENT;
    default:
      return ANIMATION_PRIORITY.IDLE;
  }
}
