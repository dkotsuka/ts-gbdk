# Roadmap – ts-gbdk-sdk

Objetivo: transformar o SDK em uma experiência de desenvolvimento completa onde o
usuário escreve TypeScript, tem autocomplete e documentação inline de toda a API
do GBDK, e compila a ROM com um único clique.

---

## Fase 1 – Declarações completas da API do GBDK (pequeno escopo)

**Meta:** qualquer função do GBDK pode ser chamada em TS com tipos corretos,
autocomplete e documentação inline – sem precisar escrever `declare` manualmente.

### 1.1 Módulos de declaração por header GBDK

Criar `packages/types/gbdk/` com um arquivo `.d.ts` por header principal:

| Arquivo de declaração | Header GBDK mapeado |
|-----------------------|---------------------|
| `gb.d.ts` | `<gb/gb.h>` – vsync, joypad, delay |
| `sprites.d.ts` | `<gb/gb.h>` – set_sprite_data, move_sprite, set_sprite_tile |
| `background.d.ts` | `<gb/gb.h>` – set_bkg_data, set_bkg_tiles, scroll_bkg |
| `sound.d.ts` | `<gb/gb.h>` – NR10–NR52 wrappers |
| `metasprites.d.ts` | `<gb/metasprites.h>` |
| `font.d.ts` | `<gbdk/font.h>` |
| `platform.d.ts` | `<gbdk/platform.h>` – constantes de plataforma |

### 1.2 JSDoc em todas as declarações

Cada função deve ter:
- Descrição de comportamento
- `@param` com tipo e significado
- `@example` com snippet mínimo
- `@see` linkando para a doc online (`https://gbdk.org/docs/api/...`)

Exemplo:
```ts
/**
 * Move a hardware sprite to (x, y).
 * @param id   Sprite index (0–39)
 * @param x    Screen X position (pixels)
 * @param y    Screen Y position (pixels)
 * @see https://gbdk.org/docs/api/gb_8h.html#move_sprite
 */
declare function move_sprite(id: u8, x: u8, y: u8): void;
```

### 1.3 Inclusão automática em novos projetos

- `packages/types/index.d.ts` re-exporta todos os módulos acima
- `sdk init` já inclui o arquivo no `tsconfig.json` gerado
- Sem necessidade de `declare` manual para funções GBDK padrão

**Critério de aceite:** abrir `game.ts` e digitar `move_` mostra autocomplete
com assinatura e documentação, sem configuração adicional.

---

## Fase 2 – Diagnósticos como erros nativos do TypeScript (pequeno escopo)

**Meta:** erros `TSGBDKxxx` aparecem como squiggles vermelhos no editor, não
apenas como warnings no terminal.

### 2.1 Language Service Plugin

Criar `packages/ts-plugin/` implementando um TypeScript Language Service Plugin:
- Recebe o AST e roda o validador do compiler
- Convém os `ParseIssue` em `ts.Diagnostic` com `category: Error`
- Registrado via `plugins` no `tsconfig.json` gerado pelo `init`

### 2.2 Mensagens de erro enriquecidas

- Código `TSGBDKxxx` visível no painel Problems do VS Code
- Sugestão de fix inline (Quick Fix) onde aplicável
  - Ex: `class Foo` → sugerir conversão para `interface + funções`

**Critério de aceite:** escrever `class Enemy {}` em `game.ts` mostra sublinhado
vermelho com a mensagem `TSGBDK014` diretamente no editor.

---

## Fase 3 – Extensão VS Code (médio escopo)

**Meta:** botão de um clique para compilar a ROM, sem abrir terminal.

### 3.1 Pacote da extensão

Criar `packages/vscode-extension/` com:
- `package.json` de extensão VS Code
- Comandos registrados (`contributes.commands`):
  - `ts-gbdk.build` – transpile + lcc → ROM
  - `ts-gbdk.transpile` – só gera C/H
  - `ts-gbdk.initProject` – abre input para nome e cria projeto

### 3.2 Botão na Status Bar

- Item fixo na barra inferior: `▶ Build ROM (gb)`
- Clique executa `ts-gbdk.build` no arquivo TS ativo
- Indicador de estado: `⟳ Building...` → `✓ ROM ready` ou `✗ Build failed`

### 3.3 Configurações da extensão

Via `contributes.configuration`:

| Setting | Descrição |
|---------|-----------|
| `ts-gbdk.gbdkHome` | Caminho para o root do GBDK (`GBDK_HOME`) |
| `ts-gbdk.defaultTarget` | `gb` ou `gbc` |
| `ts-gbdk.autoTranspileOnSave` | Transpile automático ao salvar |

### 3.4 Painel de output dedicado

- Output Channel `ts-gbdk` para logs de build
- Erros do lcc parseados e exibidos no painel Problems
- Link clicável para abrir o arquivo `.gb` ou abrir no emulador

**Critério de aceite:**
1. Instalar a extensão
2. Abrir `game.ts`
3. Clicar `▶ Build ROM (gb)` na status bar
4. ROM gerada sem abrir terminal

---

## Fase 4 – Integração com emulador (médio escopo)

**Meta:** após build, a ROM abre automaticamente no emulador configurado.

### 4.1 Detecção de emulador

- Verificar emuladores comuns no PATH: `mgba`, `bgb`, `sameboy`
- Setting `ts-gbdk.emulatorPath` para caminho customizado

### 4.2 Comando "Build & Run"

- `ts-gbdk.buildAndRun` – build completo + abre ROM no emulador
- Atalho de teclado sugerido: `Ctrl+Shift+R`
- Botão adicional na status bar: `▶▶ Build & Run`

### 4.3 Watch mode

- `ts-gbdk.watch` – monitora mudanças em `src/**/*.ts`, transpila
  automaticamente e recompila a ROM
- Ícone de watch ativo na status bar

---

## Sequência de implementação recomendada

```
Fase 1.1 → 1.2 → 1.3   (base das declarações)
     ↓
Fase 2.1 → 2.2          (diagnósticos no editor)
     ↓
Fase 3.1 → 3.2 → 3.3 → 3.4   (extensão VS Code)
     ↓
Fase 4.1 → 4.2 → 4.3   (emulador + watch)
```

A Fase 3 depende das Fases 1 e 2 estarem estáveis pois a extensão invoca
o compiler e o ts-plugin internamente.
