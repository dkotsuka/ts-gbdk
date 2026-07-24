# ts-gbdk-sdk

SDK TypeScript que transpila para C compativel com [GBDK-2020](https://github.com/gbdk-2020/gbdk-2020).
Escreva jogos Game Boy em TypeScript e gere ROMs `.gb` / `.gbc`.

Para os próximos passos do projeto veja o [ROADMAP](./ROADMAP.md).

## Como funciona

```
game.ts  →  [ts-gbdk compiler]  →  game.c + game.h + Makefile  →  [lcc/GBDK]  →  game.gb
```

O compilador usa a TypeScript Compiler API para percorrer o AST, valida o subconjunto
suportado e emite C valido para ser compilado pelo toolchain do GBDK-2020.

## Inicio rapido

```bash
# 1. Instalar dependencias do SDK
cd ts-gbdk-sdk
npm install
npm run build

# 2. Criar um novo projeto de jogo
node packages/cli/dist/index.js init meu-jogo .

# 3. Transpile TS -> C
cd meu-jogo
node ../packages/cli/dist/index.js transpile src/game.ts .

# 4. Build da ROM (requer GBDK instalado)
GBDK_HOME=/caminho/do/gbdk node ../packages/cli/dist/index.js build src/game.ts . --target=gb
```

A ROM gerada ficara em `gbdk-out/build/meu-jogo.gb`.

## Subconjunto TypeScript suportado

| Construto TS               | C gerado                      |
| -------------------------- | ----------------------------- |
| `let x: u8 = 0`            | `static uint8_t x = 0;`       |
| `const N: u8 = 4`          | `static const uint8_t N = 4;` |
| `function f(a: u8): u16`   | `uint16_t mod_f(uint8_t a)`   |
| `if / else`                | `if / else`                   |
| `while`                    | `while`                       |
| `for (let i: u8 = 0; ...)` | `for (uint8_t i = 0; ...)`    |
| `a & b`, `a !== b`, `a++`  | operadores C diretos          |
| `localFn()`                | `module_localFn()` (mangling) |
| `declare function vsync()` | chamada externa sem corpo     |

**Tipos:** `u8` → `uint8_t`, `i8` → `int8_t`, `u16` → `uint16_t`, `i16` → `int16_t`, `bool` → `uint8_t`, `void` → `void`.

**Nao suportado no MVP:** `class`, `async/await`, closures, objetos dinamicos, `new`.
Qualquer recurso fora do subconjunto gera um erro `TSGBDKxxx` com arquivo e linha.

## Pacotes

| Pacote               | Descricao                                    |
| -------------------- | -------------------------------------------- |
| `packages/compiler`  | Parser TS, validador, IR e codegen C         |
| `packages/types`     | Declaracoes globais `u8`, `i8`, `u16`, `i16` |
| `packages/runtime-c` | Runtime C com wrappers para GBDK             |
| `packages/cli`       | CLI: `init`, `transpile`, `build`            |
| `examples/hello-gb`  | Exemplo de jogo com input e sprite           |

## Comandos do workspace

```bash
npm run build   # compila todos os pacotes TypeScript
npm test        # executa os 35 golden tests do compiler
npm run clean   # limpa artefatos de build
```

## Fluxo de contexto (desenvolvimento)

Para reduzir ruido e acelerar tarefas no SDK:

- Playbook operacional: `docs/context_playbook.md`
- Checklist rapido por tarefa: `docs/context_60s_checklist.md`
- Template de metricas: `docs/context_task_log_template.md`
- Guia de agentes do Copilot: `docs/copilot_agents_usage.md`

Regra principal: usar `ts-gbdk-sdk` como escopo padrao e consultar `gbdk-2020` apenas sob gatilho tecnico.

## CLI

```
ts-gbdk init <projectName> [parentDir]
ts-gbdk transpile <input.ts> [projectDir] [--strict-diagnostics]
ts-gbdk build <input.ts> [projectDir] [--target gb|gbc] [--no-strict-diagnostics]
```

- `transpile` por padrao gera artefatos mesmo com diagnostics; use `--strict-diagnostics` para falhar quando houver erros.
- `build` por padrao e estrito para evitar gerar ROM quando houver erros TSGBDK; use `--no-strict-diagnostics` para modo permissivo.

### Requisitos para build de ROM

- Definir `GBDK_HOME` apontando para a raiz de uma instalacao do GBDK com `bin/lcc`
- Ou ter `lcc` disponivel no PATH

## Estrutura do projeto gerado por `init`

```
meu-jogo/
  src/
    game.ts        ← codigo TypeScript do jogo
  assets/          ← recursos graficos e sonoros
  gbdk-out/
    src/           ← C/H gerados pelo transpiler
    build/         ← ROM .gb/.gbc gerada pelo GBDK
  tsconfig.json    ← aponta para tipos do SDK (u8, i8, u16, i16)
  package.json
  .gitignore
```
