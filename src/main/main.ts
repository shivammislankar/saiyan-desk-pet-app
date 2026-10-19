/**
 * Main entry point for the Electron application.
 */

import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { WindowManager } from "./window-manager";
import { AppLifecycle } from "./app-lifecycle";
import { SettingsService } from "../services/settings-service";
import { PackService } from "../services/pack-service";
import { InputService } from "../services/input-service";
import { TodoService } from "../services/todo-service";
import { TodoWindow } from "./todo-window";
import { BeamWindow, type FireBeamRequest } from "./beam-window";

let windowManager: WindowManager;
let appLifecycle: AppLifecycle;
let settingsService: SettingsService;
let packService: PackService;
let inputService: InputService;
let todoService: TodoService;
let todoWindow: TodoWindow;
const beamWindow = new BeamWindow();

/**
 * Initialize the application.
 */
async function initialize(): Promise<void> {
  // Initialize services
  settingsService = new SettingsService();
  await settingsService.initialize();

  packService = new PackService(settingsService);
  await packService.initialize();

  // Initialize window manager
  windowManager = new WindowManager(settingsService, packService);
  await windowManager.initialize();

  // To-do list (opened by clicking the pet)
  todoService = new TodoService(settingsService.getDataDirectory());
  todoService.load();
  todoWindow = new TodoWindow(() => windowManager.getSpriteWindow());

  // Initialize app lifecycle
  appLifecycle = new AppLifecycle(windowManager, settingsService);
  appLifecycle.initialize();

  // Global keyboard -> combat strikes (never logs or stores key identities)
  inputService = new InputService(
    settingsService,
    () => windowManager.getSpriteWindow()
  );
  try {
    inputService.start();
    console.log("Global input service started - check keypress reactions");
  } catch (error) {
    console.error("Global input unavailable (see tray/settings):", error);
  }

  // Set up IPC handlers
  setupIpcHandlers();
}

/**
 * Set up IPC handlers with validation.
 */
function setupIpcHandlers(): void {
  // Get settings
  ipcMain.handle("settings:get", async () => {
    return { settings: settingsService.getSettings() };
  });

  // Save settings
  ipcMain.handle("settings:save", async (_event, args: unknown) => {
    const result = settingsService.validateSettings(args);
    if (result.success) {
      await settingsService.saveSettings(result.data);
      windowManager.notifySettingsUpdate();
    }
    return result;
  });

  // Get packs
  ipcMain.handle("packs:get", async () => {
    return packService.getAvailablePacks();
  });

  // Select pack
  ipcMain.handle("packs:select", async (_event, args: { packId: string }) => {
    return packService.selectPack(args.packId);
  });

  // Open packs folder
  ipcMain.handle("packs:open-folder", async () => {
    const packsPath = packService.getPacksFolderPath();
    await shell.openPath(packsPath);
    return { success: true };
  });

  // Pet dragging (renderer reports edges; main moves the window)
  ipcMain.handle("pet:drag-start", async () => {
    beamWindow.destroy(); // grabbing him interrupts the attack
    windowManager.petDragStart();
    return { success: true };
  });

  ipcMain.handle("pet:drag-end", async () => {
    windowManager.petDragEnd();
    return { success: true };
  });

  // Kamehameha beam overlay. Only geometry comes from the renderer; the image
  // comes from the active pack, validated in PackService.
  ipcMain.handle("pet:fire-beam", async (_event, args: unknown) => {
    const a = (args ?? {}) as Partial<FireBeamRequest>;
    const num = (v: unknown, min: number, max: number): v is number =>
      typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
    if (
      !num(a.handX, -2048, 2048) ||
      !num(a.handY, -2048, 2048) ||
      !num(a.scale, 0.1, 8) ||
      !num(a.durationMs, 300, 5000) ||
      (a.facing !== "left" && a.facing !== "right")
    ) {
      return { success: false, error: "Invalid beam request" };
    }
    const pet = windowManager.getSpriteWindow();
    const effect = packService.getKamehamehaEffect();
    if (!pet || pet.isDestroyed() || !effect) return { success: false, error: "No beam available" };
    beamWindow.fire(pet, effect, a as FireBeamRequest);
    return { success: true };
  });

  ipcMain.handle("pet:set-size", async (_event, args: unknown) => {
    const { width, height } = (args ?? {}) as { width?: unknown; height?: unknown };
    return windowManager.setPetSize(width, height);
  });

  // To-do list
  ipcMain.handle("pet:toggle-todo", async () => {
    todoWindow.toggle();
    return { success: true };
  });

  ipcMain.handle("todo:get", async () => {
    return { todos: todoService.getTodos() };
  });

  ipcMain.handle("todo:save", async (_event, todos: unknown) => {
    return todoService.save(todos);
  });

  ipcMain.handle("todo:close", async () => {
    todoWindow.close();
    return { success: true };
  });

  // Get data directory info
  appLifecycle.registerDataDirHandler();
}

/**
 * Application entry point.
 */
// Sound effects play from the pet window, which never takes focus or gets a
// "user gesture"; without this Chromium would keep its audio suspended.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

app.whenReady().then(async () => {
  try {
    await initialize();
  } catch (error) {
    console.error("Failed to initialize application:", error);
    dialog.showErrorBox(
      "Saiyan Desk Pet - Startup Error",
      `Failed to start: ${error instanceof Error ? error.message : String(error)}`
    );
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      initialize();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (inputService) {
    inputService.stop();
  }
  if (todoWindow) {
    todoWindow.close();
  }
  beamWindow.destroy();
  if (appLifecycle) {
    appLifecycle.shutdown();
  }
});
