# Step 1 — Design system and brand

**Date:** 2026-10-23  **Result:** passed

## What was built
- Design tokens (`src/design/tokens.css`): sunny-amber Material 3 colour roles, light and dark, type scale, spacing, shapes, elevation and motion.
- Components (`src/design/ui.tsx`, `components.css`): buttons (filled, tonal, outlined, text, danger), icon button, filter chips, switch, progress (known and unknown length), notes, text field, grouped list rows, sheet and toasts.
- Theme setting: System, Light or Dark, stored only on this device and applied before first paint.
- The Happy PDF logo (`public/icons/logo.svg`) and icons: favicon, 192 and 512 px, maskable 512 px, Apple touch icon.
- Figtree font bundled with the app, so no font is fetched from the web.
- A design gallery at `/design` showing every piece.

## Checks
| Check | Result |
|---|---|
| Colour contrast | Every text role is 4.5:1 or better on canvas, card and sunken surfaces in both themes; control outlines 3:1 or better (ratios recorded in `tokens.css`) |
| Automated accessibility scan (axe, WCAG 2.1 AA) | No violations, light and dark, phone and desktop |
| Theme choice applies and survives reload | Passed |
| Sheet: confirm with toast, Escape cancels | Passed |
| Switch works from the keyboard | Passed |
| No sideways scrolling | Passed |
| All browser tests | 16 of 16 passed — `browser-tests.txt` |
| Unit tests | 3 of 3 passed — `unit-tests.txt` |

Screenshots: `design-{phone,desktop}-{light,dark}.png`, logo: `logo-512.png`.

## Bugs found and fixed
- None found in this step.
