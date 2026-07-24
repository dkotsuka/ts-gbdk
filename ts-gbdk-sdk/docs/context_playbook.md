# Context Playbook (ts-gbdk-sdk)

Objetivo: reduzir ruido de contexto e acelerar diagnostico/implementacao no SDK.

## 1. Escopo Padrao

- Escopo default: apenas `ts-gbdk-sdk`.
- `gbdk-2020` e somente referencia sob demanda.
- Nunca abrir documentacao extensa fora do dominio da tarefa sem gatilho tecnico.

## 2. Entrada por Tipo de Tarefa

### Compiler

Arquivos de partida:
- `packages/compiler/src/index.ts`
- `packages/compiler/src/parser/index.ts`
- `packages/compiler/src/validator/index.ts`
- `packages/compiler/src/ir/index.ts`
- `packages/compiler/src/codegen/index.ts`

Regra: comecar em `index.ts` e descer apenas nos modulos tocados pela mudanca.

### CLI / Build

Arquivos de partida:
- `packages/cli/src/index.ts`
- `README.md` (fluxo init/transpile/build)

Regra: validar fluxo de comando primeiro, depois abrir compilador apenas se houver impacto.

### Runtime / Types

Arquivos de partida:
- `packages/runtime-c/src/sdk_runtime.c`
- `packages/types/` (declarations)

Regra: entrar apenas em tarefas de ABI, bindings, tipos globais ou projeto gerado.

### UI

Arquivos de partida:
- `packages/ui/src/main.tsx`
- `packages/ui/src/` (componentes relacionados)

Regra: manter UI isolada de compiler/CLI, exceto quando a tarefa cruza fronteiras.

## 3. Orcamento de Contexto por Iteracao

- Iteracao inicial: ate 3 arquivos nucleares.
- Iteracao de aprofundamento: abrir apenas dependencias diretas com evidencia de impacto.
- Iteracao final: validar com testes/comandos necessarios e revisar regressao local.

## 4. Playbooks por Intencao

### Bug

1. Reproduzir caminho minimo.
2. Ler arquivo-ancora + chamadas diretas.
3. Abrir testes correlatos.
4. Corrigir e validar em comando unico.

### Feature

1. Localizar ponto de extensao principal.
2. Mapear padrao existente no mesmo pacote.
3. Implementar mudanca no menor conjunto de arquivos.
4. Validar contrato publico.

### Refactor

1. Mapear usos do simbolo.
2. Estimar impacto de interface.
3. Aplicar mudanca sem alterar comportamento.
4. Rodar testes de area e smoke do workspace.

### Docs

1. Sincronizar fonte principal (`README.md`).
2. Atualizar roadmap/spec apenas se houver impacto de plano.
3. Evitar duplicacao entre documentos.

## 5. Gatilhos para Consultar gbdk-2020

Consultar `gbdk-2020` somente quando houver duvida sobre:
- flags de toolchain (`lcc`, `sdcc`, `makebin`, etc.)
- comportamento de plataforma alvo (gb/gbc/sms/nes)
- compatibilidade de API/headers com GBDK

Ao consultar:
1. Registrar qual pagina foi usada.
2. Extrair apenas o trecho necessario.
3. Retornar imediatamente ao escopo `ts-gbdk-sdk`.

## 6. KPIs de Qualidade de Contexto

- Arquivos lidos por tarefa.
- Tempo ate primeira hipotese util.
- Retrabalho por contexto irrelevante.

Meta inicial (2 semanas):
- <= 6 arquivos por tarefa media.
- Hipotese inicial em ate 10 minutos.
- Reduzir retrabalho por contexto errado em 30%.
