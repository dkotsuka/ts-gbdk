# Global instructions for ts-gbdk-sdk

## Primary goal

Keep context usage lean and domain-focused.

## Scope defaults

- Default implementation scope is this repository only.
- Treat gbdk-2020 as reference-only, consult only on explicit toolchain or platform questions.
- Prefer package-local changes over cross-package edits when possible.

## Context budget

- First pass: read up to 3 core files for the active domain.
- Expand only to direct dependencies with evidence of impact.
- Validate with the smallest relevant command first.

## Domain routing

- Compiler work: packages/compiler first.
- CLI work: packages/cli first.
- UI work: packages/ui first.
- Docs work: README + docs first.

## Safety

- Do not create or modify implementation files under gbdk-2020.
- Keep changes minimal and avoid unrelated refactors.
