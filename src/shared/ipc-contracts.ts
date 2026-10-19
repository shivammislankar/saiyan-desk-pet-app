/**
 * IPC contract types - shared between main and renderer processes.
 */

export interface PositionUpdatePayload {
  x: number;
  y: number;
  displayId: string;
}

export interface AnimationChangePayload {
  action: string;
  frameIndex?: number; // Optional frame index within a multi-frame action (e.g., combined strikes sheet)
  priority: number;
  loop: boolean;
  allowMovement: boolean;
  allowFacialOverride: boolean;
  facing?: "left" | "right"; // Kamehameha: which way to fire
}

export interface SettingsUpdatePayload {
  settings: Record<string, unknown>;
}

export interface PermissionStatusPayload {
  granted: boolean;
  platform: string;
  message?: string;
}

export interface DragStartPayload {
  x: number;
  y: number;
}

export interface DragEndPayload {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

export interface RequestAnimationPayload {
  action: string;
  priority: number;
  loop: boolean;
  duration?: number;
}

export interface GetSettingsResponse {
  settings: Record<string, unknown>;
}

export interface SaveSettingsRequest {
  settings: Record<string, unknown>;
}

export interface GetPacksResponse {
  packs: Array<{
    id: string;
    name: string;
    author: string;
    version: string;
    path: string;
  }>;
  active: string;
}

export interface SelectPackRequest {
  packId: string;
}

export interface OverlayShowPayload {
  displayId: string;
  effect: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayHidePayload {
  displayId: string;
}
