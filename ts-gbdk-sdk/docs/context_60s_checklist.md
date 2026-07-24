# Checklist 60s (Antes de Cada Tarefa)

## 1) Classificar tarefa (10s)

Escolha um tipo:
- Bug
- Feature
- Refactor
- Docs

## 2) Definir ancora (15s)

Selecione 1 arquivo-ancora no dominio principal:
- Compiler: `packages/compiler/src/index.ts`
- CLI: `packages/cli/src/index.ts`
- Runtime: `packages/runtime-c/src/sdk_runtime.c`
- UI: `packages/ui/src/main.tsx`

## 3) Limitar contexto inicial (10s)

- Maximo de 3 arquivos na primeira iteracao.
- Nao abrir `gbdk-2020` sem gatilho tecnico explicito.

## 4) Definir criterio de saida (15s)

Escreva 1 frase:
- "Concluido quando ..."

Exemplos:
- "Concluido quando o comando build gera ROM sem erro."
- "Concluido quando o erro TSGBDKxxx nao aparece mais e os testes passam."

## 5) Definir validacao minima (10s)

Escolha 1 comando:
- `npm run build`
- `npm test`
- comando alvo da tarefa (ex.: transpile/build CLI)
