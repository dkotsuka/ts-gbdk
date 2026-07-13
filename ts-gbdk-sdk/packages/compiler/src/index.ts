export * from "./parser/index.js";
export * from "./validator/index.js";
export * from "./ir/index.js";
export * from "./codegen/index.js";

import { generateC } from "./codegen/index.js";
import { buildIr } from "./ir/index.js";
import { parseSource } from "./parser/index.js";
import { validateProgram } from "./validator/index.js";

export interface CompileInput {
  filePath: string;
  source: string;
}

export interface CompileOutput {
  cSource: string;
  headerSource: string;
  diagnostics: string[];
}

export function compileToC(input: CompileInput): CompileOutput {
  // Stub pipeline: parser -> validator -> IR -> codegen.
  const diagnostics: string[] = [];
  const program = parseSource(input.source);
  diagnostics.push(...validateProgram(program));

  const ir = buildIr(program, input.filePath);
  const generated = generateC(ir);

  return {
    cSource: generated.cSource,
    headerSource: generated.headerSource,
    diagnostics,
  };
}
