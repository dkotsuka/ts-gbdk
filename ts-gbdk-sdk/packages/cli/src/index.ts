#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { compileToC } from "@ts-gbdk/compiler";

function printHelp(): void {
  process.stdout.write(
    [
      "ts-gbdk CLI (bootstrap)",
      "",
      "Commands:",
      "  transpile <input.ts> [projectDir]",
      "  build <input.ts> [projectDir] [--target gb|gbc]",
      "  help",
    ].join("\n") + "\n",
  );
}

function transpile(inputPath: string, projectDir: string): number {
  const absIn = resolve(process.cwd(), inputPath);
  const absProjectDir = resolve(process.cwd(), projectDir);
  const absOut = join(absProjectDir, "gbdk-out");
  const absSrc = join(absOut, "src");
  const absBuild = join(absOut, "build");

  const source = readFileSync(absIn, "utf8");
  const result = compileToC({ filePath: absIn, source });

  if (result.diagnostics.length > 0) {
    for (const d of result.diagnostics) {
      process.stderr.write(`warning: ${d}\n`);
    }
  }

  mkdirSync(absOut, { recursive: true });
  mkdirSync(absSrc, { recursive: true });
  mkdirSync(absBuild, { recursive: true });

  const base = baseNameNoExt(absIn);
  writeFileSync(join(absSrc, `${base}.h`), result.headerSource, "utf8");
  writeFileSync(join(absSrc, `${base}.c`), result.cSource, "utf8");
  writeFileSync(join(absOut, "Makefile"), makefileTemplate(base), "utf8");

  process.stdout.write(`generated gbdk-out for ${base} in ${absOut}\n`);
  return 0;
}

function build(inputPath: string, projectDir: string, target: string): number {
  const absProjectDir = resolve(process.cwd(), projectDir);
  const absOut = join(absProjectDir, "gbdk-out");
  const absSrc = join(absOut, "src");
  const base = baseNameNoExt(resolve(process.cwd(), inputPath));

  const transpileCode = transpile(inputPath, projectDir);
  if (transpileCode !== 0) return transpileCode;

  const outputRom = join(absOut, "build", `${base}.${target}`);
  const inputC = join(absSrc, `${base}.c`);
  const lcc = findLccExecutable();
  const args = ["-o", outputRom, inputC];

  if (target === "gbc") {
    args.unshift("-Wm-yC");
  }

  const result = spawnSync(lcc, args, {
    stdio: "inherit",
    cwd: absOut,
    shell: process.platform === "win32",
  });

  if (result.error) {
    process.stderr.write(`failed to run lcc: ${result.error.message}\n`);
    return 1;
  }

  return result.status ?? 1;
}

function findLccExecutable(): string {
  const gbdkHome = process.env.GBDK_HOME;
  if (gbdkHome) {
    const winExe = join(gbdkHome, "bin", "lcc.exe");
    const unixExe = join(gbdkHome, "bin", "lcc");
    if (existsSync(winExe)) return winExe;
    if (existsSync(unixExe)) return unixExe;
  }

  return "lcc";
}

function makefileTemplate(projectName: string): string {
  return [
    "ifndef GBDK_HOME",
    "$(error Please set GBDK_HOME to your GBDK root path)",
    "endif",
    "",
    "LCC = $(GBDK_HOME)/bin/lcc",
    "PROJECTNAME = " + projectName,
    "CSOURCES = $(wildcard src/*.c)",
    "",
    "all: gb",
    "",
    "gb:",
    "\t$(LCC) -o build/$(PROJECTNAME).gb $(CSOURCES)",
    "",
    "gbc:",
    "\t$(LCC) -Wm-yC -o build/$(PROJECTNAME).gbc $(CSOURCES)",
    "",
    "clean:",
    "\trm -f build/*.gb build/*.gbc build/*.ihx build/*.map build/*.sym src/*.o",
    "",
  ].join("\n");
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
    if (args.length < 1) {
      process.stderr.write(
        "usage: ts-gbdk transpile <input.ts> [projectDir]\n",
      );
      return 1;
    }

    return transpile(args[0], args[1] ?? process.cwd());
  }

  if (cmd === "build") {
    if (args.length < 1) {
      process.stderr.write(
        "usage: ts-gbdk build <input.ts> [projectDir] [--target gb|gbc]\n",
      );
      return 1;
    }

    const targetArg = args.find((x) => x.startsWith("--target="));
    const target = targetArg ? targetArg.split("=")[1] : "gb";
    if (target !== "gb" && target !== "gbc") {
      process.stderr.write("unsupported target. use gb or gbc\n");
      return 1;
    }

    const projectDir =
      args[1] && !args[1].startsWith("--") ? args[1] : process.cwd();
    return build(args[0], projectDir, target);
  }

  process.stderr.write(`unknown command: ${cmd}\n`);
  printHelp();
  return 1;
}

process.exit(main());
