# Privacy

## Our Commitment

Saiyan Desk Pet is designed with privacy as a core principle. We believe a desktop pet should be a companion, not a surveillance tool.

## What We Collect

**Nothing.** This application does not collect, store, or transmit any personal data.

## What We Never Do

- **Never record typed text** or store which keys were pressed
- **Never log raw key codes** or input event details
- **Never send input data** to the renderer, localhost server, or any external service
- **Never capture passwords**, clipboard contents, or unrelated user activity
- **Never add telemetry** or analytics
- **Never suppress or modify** ordinary OS keyboard shortcuts

## How Input is Handled

Global keyboard input is processed through a strict pipeline:

1. **Raw input events** are received by `src/services/input-service.ts`, the only file allowed to import `uiohook-napi`
2. **Immediate conversion**: the key code is handed straight to `src/core/input-normalizer.ts`, which returns a derived event (`strikeRequested`, `modifierStateChanged`, ...)
3. **Raw key codes are discarded** right there; they are never stored, logged, or transmitted
4. **Derived events** contain only coarse categories (letter, number, space, enter, backspace, arrow, punctuation) or a coarse modifier kind (alt, ctrl, shift, meta), never a specific key identity
5. **What leaves the input service** is only an animation request ("strike, frame 3" or "kamehameha"), sent to the pet window. The Kamehameha double-tap detector sees only those coarse kinds plus timestamps, kept in memory for a few hundred milliseconds

## Privacy Invariants (Enforced in Code)

### Import Restriction
An ESLint rule (`no-restricted-imports`) forbids importing `uiohook-napi` anywhere in `src/` except `src/services/input-service.ts` (which opts out explicitly, with a comment explaining why).

### Type-Level Guard
Derived event types are declared so they cannot carry raw key codes.

### Invariant Test
An automated test feeds a simulated stream of key events (including distinctive sentinel key codes) through the input pipeline while spying on the logger, console, all IPC channels, the agent server, and filesystem writes. It asserts that none of the sentinels appear anywhere.

### CI Check
`scripts/check-privacy-invariants.ts` greps for forbidden patterns (logging of key event objects, writing event arrays to disk) and fails the build if found.

## Local Server

The AI coding-agent server (Phase 5, not implemented yet) will be:
- Bound **only** to `127.0.0.1` (loopback)
- Protected by a **mandatory token** (at least 32 bytes, cryptographically secure)
- Never sends data externally
- Never executes shell commands or interprets messages as instructions

## Data Storage

All data is stored locally in the per-user data directory:
- Settings (JSON configuration) and the pet's last position
- Your to-do list (`todos.json`)
- Sprite packs (user-provided, validated)
- Agent token (restricted permissions)

No data ever leaves your computer.

## Open Source

This project is fully open source (MIT license). You can audit every line of code to verify these privacy claims.

## Reporting Privacy Concerns

If you believe this application violates these privacy principles, please report it through GitHub private security advisories.
