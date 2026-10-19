# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- To-do list: click the pet to open a panel beside him (add, tick, edit, delete; saved between restarts)
- Kamehameha: double-tap Alt (configurable) to charge with a chant and fire a beam in a temporary click-through overlay
- Sound effects synthesised with Web Audio (punch, kick, charge, beam); off by default, toggle in the tray
- High-resolution sprite packs: per-pack `rendering` and `displayScale`, DPI-aware canvas, window sized to the pack
- Local packs from the repository's git-ignored `packs/` folder
- Original code-generated default character and beam

### Changed

- Idle is completely still (no bobbing or frame cycling)
- Electron 44, electron-builder 26, Vitest 5, esbuild 0.28; Node 22.12+
- ESLint now lints TypeScript (typescript-eslint)

### Fixed

- Keyboard keys were categorised with browser key codes instead of uiohook scan codes
- Every action was drawn from the idle sheet; missing sprite sheets broke the whole pack
- Tray icon image was corrupt, so the tray menu was unreachable
- Installers did not bundle the renderer or include the keyboard hook
- Blurry rendering at non-100% display scaling

### Removed

- Third-party sprites from the repository (kept locally, git-ignored)

## [0.1.0] - 2026-10-11

### Added

- Electron shell with transparent, frameless sprite window
- Canvas 2D renderer with pixel-art placeholder Goku
- Hover and bobbing physics
- Drag and drop with throw inertia
- Edge response with soft bounce
- Eye tracking
- Position persistence across restarts
- Basic settings file with Zod validation
- Click-through with pixel-aware hit testing
- Placeholder sprite generator script
- Asset verification script
- Sprite pack loader with Default pack
- Pack validator with path safety checks
- Pack import tool
- Data directory override (GOKUPET_DATA_DIR, --data-dir)
- Portable mode (portable.flag)
- PetInstance abstraction for future multi-pet support
- Layered animation controller with priorities
- Privacy invariants check script
- MIT license
- Repository hygiene (.gitignore, image guard)
- CI workflow (GitHub Actions)
- Release workflow (GitHub Actions)
- Issue templates and PR template
- Documentation (architecture, privacy, security, decisions)
