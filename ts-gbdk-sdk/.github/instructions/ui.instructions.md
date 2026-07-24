---
applyTo: "packages/ui/**"
description: "Use when implementing or fixing UI components, app state flow, styling, or UI build behavior."
---

# UI-focused instructions

## Entry points

Start in this order:

1. packages/ui/src/main.tsx
2. packages/ui/src/app/\*\* or active feature component
3. shared style files used by the feature

## Working style

- Keep UI changes isolated from compiler and CLI unless explicitly required.
- Preserve existing UI architecture and naming patterns.
- Prefer small, testable component edits.

## Validation

- Build UI package or workspace:
  - npm run build
- If available, run UI dev/build command path used by team.
