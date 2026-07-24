import ts from "typescript";
import type { ParsedProgram } from "../parser/index.js";

export type DiagnosticSeverity = "error" | "warning";
export type DiagnosticCategory =
  | "syntax-subset"
  | "entrypoint"
  | "codegen-fallback";

export interface CompilerDiagnostic {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  fileName: string;
  line: number;
  column: number;
}

export function validateProgram(program: ParsedProgram): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];

  for (const issue of program.issues) {
    diagnostics.push(
      makeDiagnosticAtPosition(
        program.sourceFile,
        issue.position,
        issue.code,
        issue.message,
        issue.severity,
        issue.category,
      ),
    );
  }

  let hasMainLikeFunction = false;
  for (const stmt of program.sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text) {
      const fnName = stmt.name.text;
      if (fnName === "updateFrame" || fnName === "main") {
        hasMainLikeFunction = true;
      }
    }
  }

  if (!hasMainLikeFunction) {
    diagnostics.push(
      makeDiagnosticAtPosition(
        program.sourceFile,
        0,
        "TSGBDK030",
        "no top-level function named updateFrame or main found; generated loop will use a default frame step",
        "warning",
        "entrypoint",
      ),
    );
  }

  return diagnostics;
}

function makeDiagnosticAtPosition(
  sourceFile: ts.SourceFile,
  pos: number,
  code: string,
  message: string,
  severity: DiagnosticSeverity,
  category: DiagnosticCategory,
): CompilerDiagnostic {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  return {
    code,
    message,
    severity,
    category,
    fileName: sourceFile.fileName,
    line: line + 1,
    column: character + 1,
  };
}
