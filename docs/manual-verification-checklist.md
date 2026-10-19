# Manual Verification Checklist

This document lists all features that require manual verification on real desktop environments. Automated tests cannot verify native desktop behavior.

**Tester:** ____________  
**Date:** ____________

---

## Phase 1: MVP

### Windows

| # | Feature | Expected Result | Result | Date | Tester |
|---|---------|----------------|--------|------|--------|
| W1 | Transparent window | Window background is transparent, only Goku visible | | | |
| W2 | Always-on-top | Goku stays above normal application windows | | | |
| W3 | Click-through | Clicks on transparent areas pass through to apps below | | | |
| W4 | Click on sprite | Clicks on Goku's visible pixels register | | | |
| W5 | Drag Goku | Can grab and drag Goku to new position | | | |
| W6 | Throw Goku | Release while moving gives throw inertia | | | |
| W7 | Edge bounce | Goku bounces softly at screen edges | | | |
| W8 | Position persistence | Restart restores Goku to previous position | | | |
| W9 | Settings persistence | Settings survive app restart | | | |
| W10 | Pack import | Can import and select a sprite pack | | | |
| W11 | Multi-monitor | Goku positioned correctly on each display | | | |
| W12 | Display scaling | Goku renders correctly at different DPI scales | | | |
| W13 | No taskbar entry | Pet window does not appear in taskbar | | | |
| W14 | No focus stealing | Pet window never steals keyboard focus | | | |
| W15 | Settings window | Settings window opens and is usable | | | |
| W16 | App shutdown | App exits cleanly without orphan processes | | | |

### macOS

| # | Feature | Expected Result | Result | Date | Tester |
|---|---------|----------------|--------|------|--------|
| M1 | Transparent window | Window background is transparent, only Goku visible | | | |
| M2 | Always-on-top | Goku stays above normal application windows | | | |
| M3 | Click-through | Clicks on transparent areas pass through to apps below | | | |
| M4 | Click on sprite | Clicks on Goku's visible pixels register | | | |
| M5 | Drag Goku | Can grab and drag Goku to new position | | | |
| M6 | Throw Goku | Release while moving gives throw inertia | | | |
| M7 | Edge bounce | Goku bounces softly at screen edges | | | |
| M8 | Position persistence | Restart restores Goku to previous position | | | |
| M9 | Settings persistence | Settings survive app restart | | | |
| M10 | Pack import | Can import and select a sprite pack | | | |
| M11 | Multi-monitor | Goku positioned correctly on each display | | | |
| M12 | Retina scaling | Goku renders correctly on Retina displays | | | |
| M13 | No Dock entry | Pet window does not appear in Dock | | | |
| M14 | No focus stealing | Pet window never steals keyboard focus | | | |
| M15 | Settings window | Settings window opens and is usable | | | |
| M16 | App shutdown | App exits cleanly without orphan processes | | | |
| M17 | Gatekeeper | App launches without Gatekeeper warnings (signed) | | | |

---

## Phase 2: Keyboard and Combat (Future)

| # | Feature | Expected Result | Result | Date | Tester |
|---|---------|----------------|--------|------|--------|
| W17 | Keyboard strikes | Typing triggers punch/kick animations | | | |
| W18 | Special keys | Space=kick, Enter=uppercut, Backspace=block | | | |
| W19 | Alt double-tap | Double-tap Alt triggers Kamehameha | | | |
| W20 | Kamehameha beam | Beam renders on overlay, visual only | | | |
| W21 | Kaioken | High typing speed triggers red aura | | | |
| W22 | Shortcut preservation | Normal OS shortcuts still work | | | |

---

## Phase 3: Mouse and Nimbus (Future)

| # | Feature | Expected Result | Result | Date | Tester |
|---|---------|----------------|--------|------|--------|
| W23 | Mouse hunt | Fast cursor movement triggers pursuit | | | |
| W24 | Petting | Back-and-forth cursor over head triggers laugh | | | |
| W25 | Scroll reaction | Scrolling triggers scroll unroll animation | | | |
| W26 | Flying Nimbus | Nimbus appears when idle | | | |
| W27 | Idle life | Random idle animations play | | | |

---

## Phase 4: Productivity (Future)

| # | Feature | Expected Result | Result | Date | Tester |
|---|---------|----------------|--------|------|--------|
| W28 | Stretch reminders | Reminder appears at configured interval | | | |
| W29 | Water reminders | Reminder appears at configured interval | | | |
| W30 | Pomodoro | Timer counts down, transitions work | | | |
| W31 | Scheduled messages | Custom reminders appear on schedule | | | |
| W32 | Peek mode | Goku hides at screen edge in fullscreen apps | | | |

---

## Phase 5: AI Agent Integration (Future)

| # | Feature | Expected Result | Result | Date | Tester |
|---|---------|----------------|--------|------|--------|
| W33 | Agent status | Goku reflects AI agent state | | | |
| W34 | CLI (gokupet) | CLI sends status to running app | | | |

---

## Phase 6: Packaging (Future)

| # | Feature | Expected Result | Result | Date | Tester |
|---|---------|----------------|--------|------|--------|
| W35 | NSIS installer | Installer works, allows directory selection | | | |
| W36 | Portable mode | Portable exe runs from any folder | | | |
| W37 | macOS DMG | DMG mounts and installs correctly | | | |
| W38 | SmartScreen | No false positive warnings | | | |
| W39 | Start at login | App starts automatically on login | | | |
