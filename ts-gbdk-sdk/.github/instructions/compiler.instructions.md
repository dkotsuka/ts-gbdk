---
applyTo: "packages/compiler/**"
description: "Use when working on parser, validator, IR, codegen, diagnostics, or compiler golden tests."
---

# Compiler-focused instructions

## Entry points

Start in this order:

1. packages/compiler/src/index.ts
2. packages/compiler/src/parser/index.ts
3. packages/compiler/src/validator/index.ts
4. packages/compiler/src/ir/index.ts
5. packages/compiler/src/codegen/index.ts

## Working style

- Confirm the affected compiler stage before changing code.
- Preserve diagnostic codes and message style.
- Keep generated C output deterministic.

## Validation

- Prefer targeted tests first.
- If uncertain, run workspace tests:
  - npm test
