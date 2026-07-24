---
applyTo: "packages/cli/**"
description: "Use when implementing or debugging init, transpile, build, command parsing, and toolchain invocation in CLI."
---

# CLI-focused instructions

## Entry points

Start in this order:

1. packages/cli/src/index.ts
2. README command flow (init/transpile/build)
3. compiler entry only if CLI change affects compile pipeline

## Working style

- Keep command UX stable and explicit.
- Favor clear error messages with actionable next steps.
- Keep Windows compatibility in path and process execution.

## Validation

- Build TypeScript workspace first:
  - npm run build
- Run command-path scenario relevant to change.
