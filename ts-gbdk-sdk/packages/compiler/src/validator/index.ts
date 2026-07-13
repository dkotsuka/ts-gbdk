import ts from "typescript";
import type { ParsedProgram } from "../parser/index.js";

export function validateProgram(program: ParsedProgram): string[] {
  const diagnostics: string[] = [];

  for (const issue of program.issues) {
    diagnostics.push(
      formatAtPosition(
        program.sourceFile,
        issue.position,
        `${issue.code}: ${issue.message}`,
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
      "TSGBDK030: no top-level function named updateFrame or main found; generated loop will use a default frame step",
    );
  }

  return diagnostics;
}

function formatAtPosition(
  sourceFile: ts.SourceFile,
  pos: number,
  message: string,
): string {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  return `${sourceFile.fileName}:${line + 1}:${character + 1} ${message}`;
}
