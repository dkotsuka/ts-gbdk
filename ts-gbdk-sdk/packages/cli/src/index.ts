#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { compileToC } from "@ts-gbdk/compiler";

function printHelp(): void {
  process.stdout.write(
    [
      "ts-gbdk CLI (bootstrap)",
      "",
      "Commands:",
      "  transpile <input.ts> <outDir>",
      "  help",
    ].join("\n") + "\n",
  );
}

function transpile(inputPath: string, outDir: string): number {
  const absIn = resolve(process.cwd(), inputPath);
  const absOut = resolve(process.cwd(), outDir);

  const source = readFileSync(absIn, "utf8");
  const result = compileToC({ filePath: absIn, source });

  if (result.diagnostics.length > 0) {
    for (const d of result.diagnostics) {
      process.stderr.write(`warning: ${d}\n`);
    }
  }

  mkdirSync(absOut, { recursive: true });
  const base = baseNameNoExt(absIn);
  writeFileSync(join(absOut, `${base}.h`), result.headerSource, "utf8");
  writeFileSync(join(absOut, `${base}.c`), result.cSource, "utf8");

  process.stdout.write(`generated ${base}.c and ${base}.h in ${absOut}\n`);
  return 0;
}

function baseNameNoExt(filePath: string): string {
  const name = filePath.substring(
    Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\")) + 1,
  );
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(0, dot) : name;
}

function main(): number {
  const [, , cmd, ...args] = process.argv;

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return 0;
  }

  if (cmd === "transpile") {
    if (args.length < 2) {
      process.stderr.write("usage: ts-gbdk transpile <input.ts> <outDir>\n");
      return 1;
    }

    return transpile(args[0], args[1]);
  }

  process.stderr.write(`unknown command: ${cmd}\n`);
  printHelp();
  return 1;
}

process.exit(main());
