import type { ParsedProgram } from "../parser/index.js";

export interface IrModule {
  moduleName: string;
  sourceHashHint: number;
}

export function buildIr(program: ParsedProgram, filePath: string): IrModule {
  return {
    moduleName: normalizeModuleName(filePath),
    sourceHashHint: program.rawSource.length,
  };
}

function normalizeModuleName(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  const name = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  return name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]/g, "_");
}
