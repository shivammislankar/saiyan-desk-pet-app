# Architecture

## Overview

Goku Desktop Pet is an Electron desktop application with a transparent, frameless sprite window containing a Canvas 2D renderer. The architecture separates concerns into main process, preload, renderer, core logic, and services.

## Process Model

```
┌─────────────────────────────────────────────────────┐
│                  Main Process                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ WindowManager │  │ DisplayMgr   │  │ Tray      │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │       │
│  ┌──────┴─────────────────┴─────────────────┴─────┐ │
│  │              App Lifecycle                      │ │
│  └────────────────────┬───────────────────────────┘ │
│                       │                              │
│  ┌────────────────────┴───────────────────────────┐ │
│  │              PetInstance                        │ │
│  │  ┌─────────────┐  ┌──────────────────────────┐ │ │
│  │  │ Physics     │  │ Animation Controller     │ │ │
│  │  │ Engine      │  │ (layered, prioritized)   │ │ │
│  │  └─────────────┘  └──────────────────────────┘ │ │
│  └────────────────────────────────────────────────┘ │
│                       │                              │
│  ┌────────────────────┴───────────────────────────┐ │
│  │              Services                           │ │
│  │  Settings │ Pack │ Reminder │ Pomodoro │ Sound │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ IPC (typed, validated)
┌──────────────────────┴──────────────────────────────┐
│                  Preload                             │
│  Narrow typed API exposed via contextBridge           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│                  Renderer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Canvas       │  │ Sprite       │  │ Particle   │ │
│  │ Renderer     │  │ Loader       │  │ System    │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Hit Testing  │  │ Speech       │                 │
│  │              │  │ Bubbles      │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

### PetInstance

All per-pet state lives in a `PetInstance` object. No global singletons for position, animation or state. This enables future multi-pet support.

### Layered Animation

Three layers (body, action, status) with a priority system. Ambient states never block interactive ones.

### Delta-Time Physics

All movement uses delta-time integration, never frame-count-based. Exponential velocity damping for stability.

### Secure IPC

All IPC arguments validated with Zod schemas. No unrestricted forwarding. Narrow typed preload API.

### Data Directory Override

`GOKUPET_DATA_DIR` environment variable and `--data-dir` flag. Portable mode via `portable.flag` file.

## Module Boundaries

- **main/**: Electron lifecycle, window management, tray, IPC handlers
- **preload/**: Typed API bridge via contextBridge
- **renderer/**: Canvas rendering, sprite loading, hit testing, UI
- **core/**: Physics, animation, input processing, combat, movement
- **services/**: Settings, packs, reminders, Pomodoro, agent server, sound, CLI
- **shared/**: Schemas, constants, IPC contracts

## Security

- `contextIsolation: true`, `nodeIntegration: false`
- Sandbox enabled where compatible
- Restrictive CSP
- All IPC validated with Zod
- No remote content
- No Node.js access from renderers
