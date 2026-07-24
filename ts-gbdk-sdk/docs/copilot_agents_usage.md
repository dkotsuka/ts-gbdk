# Copilot Agents Usage (ts-gbdk-sdk)

This repository defines domain-specific Copilot agents under .github/agents and scoped instructions under .github/instructions.

## Available agents

- Compiler Agent
- CLI Agent
- UI Agent
- Docs Agent

## How to trigger

Use explicit intent in your prompt so routing is obvious.

Examples:
- "Use Compiler Agent to add a new TSGBDK diagnostic for unsupported syntax."
- "Use CLI Agent to improve build error output when GBDK_HOME is missing."
- "Use UI Agent to refactor workspace editor state handling."
- "Use Docs Agent to sync README and context docs after command changes."

## Routing tips

- Mention package path and task type in the first sentence.
- Keep one domain per task whenever possible.
- If task spans domains, start with primary domain and state secondary impact.

## Context-saving rules

- Start with up to 3 files in domain.
- Expand only to direct dependencies.
- Consult gbdk-2020 only for toolchain/platform questions.
