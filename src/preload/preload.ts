/**
 * Preload script: exposes a narrow, typed API to the renderer process.
 * Uses contextBridge with contextIsolation enabled.
 */

import { contextBridge, ipcRenderer } from "electron";
import type {
  AnimationChangePayload,
  PositionUpdatePayload,
  SettingsUpdatePayload,
  PermissionStatusPayload,
  GetSettingsResponse,
  GetPacksResponse,
  SelectPackRequest,
  OverlayShowPayload,
  OverlayHidePayload,
} from "../shared/ipc-contracts";

// Define the API exposed to the renderer
const api: Record<string, unknown> = {
  // Settings
  getSettings: (): Promise<GetSettingsResponse> => {
    return ipcRenderer.invoke("settings:get");
  },

  saveSettings: (settings: unknown): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke("settings:save", settings);
  },

  // Packs
  getPacks: (): Promise<GetPacksResponse> => {
    return ipcRenderer.invoke("packs:get");
  },

  selectPack: (packId: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke("packs:select", { packId } as SelectPackRequest);
  },

  openPacksFolder: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke("packs:open-folder");
  },

  // App info
  getDataDir: (): Promise<{ userData: string; dataDir: string }> => {
    return ipcRenderer.invoke("app:get-data-dir");
  },

  // Pet dragging
  petDragStart: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke("pet:drag-start");
  },

  petDragEnd: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke("pet:drag-end");
  },

  fireBeam: (req: {
    handX: number;
    handY: number;
    facing: "left" | "right";
    scale: number;
    durationMs: number;
  }): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke("pet:fire-beam", req);
  },

  petSetSize: (width: number, height: number): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke("pet:set-size", { width, height });
  },

  // To-do list
  toggleTodo: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke("pet:toggle-todo");
  },

  getTodos: (): Promise<{ todos: unknown[] }> => {
    return ipcRenderer.invoke("todo:get");
  },

  saveTodos: (todos: unknown): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke("todo:save", todos);
  },

  closeTodo: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke("todo:close");
  },

  // Event subscriptions
  onSettingsUpdate: (callback: (payload: SettingsUpdatePayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: SettingsUpdatePayload) => {
      callback(payload);
    };
    ipcRenderer.on("settings:update", handler);
    return () => {
      ipcRenderer.removeListener("settings:update", handler);
    };
  },

  onPositionUpdate: (callback: (payload: PositionUpdatePayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: PositionUpdatePayload) => {
      callback(payload);
    };
    ipcRenderer.on("position:update", handler);
    return () => {
      ipcRenderer.removeListener("position:update", handler);
    };
  },

  onAnimationChange: (callback: (payload: AnimationChangePayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: AnimationChangePayload) => {
      callback(payload);
    };
    ipcRenderer.on("animation:change", handler);
    return () => {
      ipcRenderer.removeListener("animation:change", handler);
    };
  },

  onPermissionStatus: (callback: (payload: PermissionStatusPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: PermissionStatusPayload) => {
      callback(payload);
    };
    ipcRenderer.on("permission:status", handler);
    return () => {
      ipcRenderer.removeListener("permission:status", handler);
    };
  },

  // Overlay
  showOverlay: (payload: OverlayShowPayload): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke("overlay:show", payload);
  },

  hideOverlay: (payload: OverlayHidePayload): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke("overlay:hide", payload);
  },

  onOverlayPayload: (callback: (payload: OverlayShowPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: OverlayShowPayload) => {
      callback(payload);
    };
    ipcRenderer.on("overlay:payload", handler);
    return () => {
      ipcRenderer.removeListener("overlay:payload", handler);
    };
  }
};

// Expose the API under both names (renderer code uses gokuPetAPI)
contextBridge.exposeInMainWorld("gokuPet", api);
contextBridge.exposeInMainWorld("gokuPetAPI", api);

// Type declaration for the renderer
export type GokuPetAPI = typeof api;