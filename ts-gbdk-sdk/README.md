# ts-gbdk-sdk

Monorepo inicial do SDK TypeScript para gerar C compativel com GBDK-2020.

## Pacotes

- packages/compiler: parser, validador, IR e codegen.
- packages/runtime-c: runtime em C para wrappers e utilitarios de execucao.
- packages/cli: comandos de linha para init, transpile e build.

## Comandos

- npm run build
- npm run dev
- npm run clean

## CLI (bootstrap)

Depois de compilar, execute:

- node packages/cli/dist/index.js transpile examples/hello-gb/src/game.ts examples/hello-gb
- node packages/cli/dist/index.js build examples/hello-gb/src/game.ts examples/hello-gb --target=gb

Requisitos para build de ROM:

- Definir GBDK_HOME apontando para o root de uma instalacao do GBDK com bin/lcc
- Ou ter lcc disponivel no PATH

## Estado atual

Esqueleto inicial com estruturas e implementacoes stub para evolucao incremental.
