# Implementation Status

Last updated: 2026-10-16

Statuses follow SPEC section 27. "Automated" means unit/integration tests in `tests/`; "Headless" means the real renderer or packaged app was run in Chromium/Electron on a virtual display (no real desktop, mouse or global keyboard).

## IMPLEMENTED

| Feature | Source | Verification |
|---|---|---|
| Keyboard key categories (uiohook scan codes) | `src/core/input-normalizer.ts` | Automated: `tests/unit/input-normalizer.test.ts`, `tests/integration/privacy-invariant.test.ts` |
| Kamehameha double-tap state machine | `src/core/kamehameha-trigger.ts` | Automated: 13 cases in `tests/unit/kamehameha-trigger.test.ts` (window, repeat, Alt+Tab, Alt+Shift, held press, cooldown, trigger key, missed key-up) |
| To-do storage (validated, atomic, corruption backup) | `src/services/todo-service.ts` | Automated: `tests/unit/todo-service.test.ts` |
| Privacy invariants | `scripts/check-privacy-invariants.ts`, ESLint `no-restricted-imports` | CI script + lint |
| Original default pack (all required actions, beam) | `scripts/generate-placeholder-sprites.ts`, `assets/goku/` | `npm run verify-assets`, `validate-pack` |
| Physics, movement, animation controller (core modules) | `src/core/` | Automated: `tests/unit/` |
| Packaging config (Linux dir build) | `electron-builder.yml`, `package.json` | Packaged app launched headless on Electron 44: default pack synced and loaded, input hook started from the packaged prebuild, no errors |

## NEEDS MANUAL VERIFICATION

Code is written and was exercised as far as a headless environment allows. Each needs a real desktop run (see `docs/manual-verification-checklist.md`).

| Feature | Source | What was verified headless |
|---|---|---|
| Transparent, always-on-top, non-focusing pet window | `src/main/window-manager.ts` | Window created and renders |
| Drag, throw inertia, edge bounce, position persistence | `src/main/window-manager.ts`, `src/renderer/pet/renderer.ts` | Drag start/end IPC fire on sprite pixels only |
| Click vs drag (click opens to-do) | `src/renderer/pet/renderer.ts` | Click → toggle; drag → no toggle |
| To-do panel window | `src/main/todo-window.ts`, `src/renderer/todo/` | Panel UI: add/tick/save, light + dark |
| Idle completely still | `src/renderer/pet/renderer.ts` | Pixel-identical frames over 500 ms |
| Keyboard strikes from global input | `src/services/input-service.ts` | Strike frames render; real global keys not testable headless |
| Kamehameha sequence + beam overlay | `src/renderer/pet/renderer.ts`, `src/main/beam-window.ts`, `src/renderer/beam/` | Charge, chant, beam geometry (left and right), strikes ignored mid-charge |
| Sound effects | `src/renderer/pet/sound-fx.ts`, tray toggle | Rendered offline: no clipping/NaN; not listened to on real speakers |
| DPI-aware sharp rendering, pack-sized window | `src/renderer/pet/canvas-renderer.ts`, `renderer.ts` | 125% scaling: backing store 1.25×, crisp output |
| Tray icon and menu (Sound, Quit) | `src/main/app-lifecycle.ts`, `src/main/tray-icon.ts` | Icon images valid at 1× and 2× |
| Local packs (`packs/`), HD packs | `src/services/pack-service.ts`, `sprite-loader.ts` | HD pack renders and positions correctly |
| Windows installer / macOS DMG | `.github/workflows/release.yml` | Not built here (Linux environment) |
| Multi-monitor, mixed DPI | `src/main/` | Not testable headless |

## PARTIAL

| Feature | Missing |
|---|---|
| Tray menu | "Pause Animations" shown disabled ("coming soon"); settings window not opened |
| Animation layers/priorities (§9) | Core controller exists and is tested but the renderer still sequences animations itself |
| Speech text | Kamehameha chant only; no general speech-bubble system wired |

## NOT IMPLEMENTED

| Feature | Phase |
|---|---|
| Combos, afterimages, typing-speed effects | 2 |
| Kaioken | 2 |
| Permission status UI (macOS Input Monitoring) | 2 |
| Mouse hunt, petting, scroll reaction, idle life | 3 |
| Flying Nimbus as designed (currently a simple ellipse) | 3 |
| Reminders, Pomodoro, scheduled messages, peek mode | 4 |
| Settings window (exists as HTML, not opened) | 4 |
| AI-agent server and `gokupet` CLI | 5 |
| Palette customisation, start at login | 6 |
| Multi-pet | 7 |

## Latest Results (2026-10-16)

Run from a clean `npm ci` in the same order as CI:

| Step | Result |
|---|---|
| `npm run lint` | PASS (0 problems) |
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS, 73 tests in 7 files |
| `npm run check-privacy` | PASS |
| `npm run check-licenses` | PASS |
| `npm run verify-assets` | PASS (32 required actions, 18 sheets) |
| `npm audit --audit-level=high` | PASS; 8 moderate findings in build tooling with no upstream fix (see `docs/decisions.md` D19) |
| `npm run build` | PASS |
| `electron-builder --linux dir` + headless launch | PASS |
