import ts from "typescript";
import type { ParsedProgram } from "../parser/index.js";

export interface IrModule {
  moduleName: string;
  sourceHashHint: number;
  functionNames: string[];
  frameFunctionName: string | null;
}

export function buildIr(program: ParsedProgram, filePath: string): IrModule {
  const functionNames = getTopLevelFunctionNames(program.sourceFile);
  const frameFunctionName = functionNames.includes("updateFrame")
    ? "updateFrame"
    : functionNames.includes("main")
      ? "main"
      : null;

  return {
    moduleName: normalizeModuleName(filePath),
    sourceHashHint: program.rawSource.length,
    functionNames,
    frameFunctionName,
  };
}

function getTopLevelFunctionNames(sourceFile: ts.SourceFile): string[] {
  const names: string[] = [];
  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text) {
      names.push(stmt.name.text);
    }
  }
  return names;
}

function normalizeModuleName(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  const name = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  return name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]/g, "_");
}
