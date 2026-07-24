export * from "./parser/index.js";
export * from "./validator/index.js";
export * from "./ir/index.js";
export * from "./codegen/index.js";

import { generateC } from "./codegen/index.js";
import { buildIrDetailed } from "./ir/index.js";
import { parseSource } from "./parser/index.js";
import { validateProgram, type CompilerDiagnostic } from "./validator/index.js";

export interface CompileInput {
  filePath: string;
  source: string;
}

export interface CompileOutput {
  cSource: string;
  headerSource: string;
  diagnostics: string[];
  diagnosticsDetailed: CompilerDiagnostic[];
  hasErrors: boolean;
}

export function compileToC(input: CompileInput): CompileOutput {
  // Stub pipeline: parser -> validator -> IR -> codegen.
  const program = parseSource(input.source);
  const diagnosticsDetailed: CompilerDiagnostic[] = [];
  diagnosticsDetailed.push(...validateProgram(program));

  const irBuild = buildIrDetailed(program, input.filePath);
  diagnosticsDetailed.push(...irBuild.diagnostics);

  const diagnostics = diagnosticsDetailed.map(formatDiagnostic);
  const hasErrors = diagnosticsDetailed.some((d) => d.severity === "error");

  const generated = generateC(irBuild.ir);

  return {
    cSource: generated.cSource,
    headerSource: generated.headerSource,
    diagnostics,
    diagnosticsDetailed,
    hasErrors,
  };
}

function formatDiagnostic(d: CompilerDiagnostic): string {
  return `${d.fileName}:${d.line}:${d.column} ${d.code}: ${d.message}`;
}
