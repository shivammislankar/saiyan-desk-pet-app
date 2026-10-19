# Security

## Overview

Security is a core concern for Saiyan Desktop Pet. This document describes the security measures in place.

## Electron Security

### Window Configuration
- `contextIsolation: true` — renderer processes are isolated from Node.js
- `nodeIntegration: false` — no direct Node.js access from renderers
- `sandbox: true` — renderer runs in a sandboxed environment
- Restrictive Content Security Policy (CSP)

### IPC Security
- All IPC arguments validated with Zod schemas
- No unrestricted IPC forwarding
- Narrow, typed preload API
- No direct Node.js access from any renderer

### Navigation Security
- `window.open` denied
- Unexpected navigation denied
- Remote content denied

## Input Security

### Global Input Hooks
- `uiohook-napi` is only imported in `src/core/input-normalizer.ts`
- Raw key codes are discarded immediately after processing
- No input event streams are persisted
- No raw input is sent to renderers or external services

### Privacy Invariants
- ESLint rule enforces import restriction
- Type-level guards prevent raw key codes in derived events
- Automated privacy invariant test
- CI check for forbidden patterns

## Local Server Security (Phase 5)

### Network Security
- Bound only to `127.0.0.1` (loopback)
- Never binds to `0.0.0.0`
- Host header validation (DNS-rebinding protection)
- Origin header rejection

### Authentication
- Mandatory token (at least 32 bytes, cryptographically secure)
- Constant-time token comparison
- Token never logged
- Token stored with restricted permissions

### Request Security
- Content-Type validation (exact match: `application/json`)
- Body size limit (1 KB)
- Rate limiting
- Bounded response bodies
- Correct status codes (400, 401, 403, 413, 415, 429)

### Input Validation
- All requests validated with schemas
- Agent identifiers restricted to safe character sets
- No code execution from server requests
- No shell command execution

## Sprite Pack Security

### Path Safety
- Only PNG files inside the pack folder are accepted
- Absolute paths rejected
- `..` traversal rejected
- Symlinks that escape the folder rejected

### Size Limits
- Maximum sheet dimensions: 4096 x 4096 pixels
- Maximum file size: 4 MB per sheet
- Maximum pack size: 50 MB

### Code Execution
- Packs are data only — never executed
- No scripts, no code, no executable content

## Dependency Security

### License Checking
- All dependencies checked against an allowlist (MIT, ISC, BSD, Apache-2.0, etc.)
- License check runs in CI

### Audit
- `npm audit` runs in CI
- Findings are reported, not hidden

### Minimization
- Only necessary dependencies are used
- Development-only tooling excluded from production bundle

## Reporting Vulnerabilities

Please report security vulnerabilities through GitHub private security advisories. Do not open public issues for security concerns.

## Security Checklist

- [x] Electron security defaults (contextIsolation, nodeIntegration, sandbox)
- [x] IPC validation with Zod schemas
- [x] Input hook import restriction
- [x] Privacy invariant tests
- [x] CI privacy checks
- [x] Sprite pack path safety
- [x] Sprite pack size limits
- [x] License checking
- [x] npm audit in CI
- [ ] Local server security (Phase 5)
- [ ] Token authentication (Phase 5)
