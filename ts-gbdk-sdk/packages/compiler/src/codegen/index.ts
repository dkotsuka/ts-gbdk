import type { IrModule, IrExpr, IrStmt } from "../ir/index.js";
import { emitIrExpr } from "../ir/index.js";

export interface GeneratedArtifacts {
  cSource: string;
  headerSource: string;
}

export function generateC(ir: IrModule): GeneratedArtifacts {
  const guard = `${ir.moduleName.toUpperCase()}_H`;
  const frameCall = ir.frameFunctionName
    ? `${ir.moduleName}_${ir.frameFunctionName}();`
    : "vsync();";

  // Header: forward declarations for all user functions
  const funcDecls = ir.functions
    .map((f) => {
      const params = f.params.length
        ? f.params.map((p) => `${p.cType} ${p.name}`).join(", ")
        : "void";
      return `${f.returnType} ${f.mangledName}(${params});`;
    })
    .join("\n");

  const headerSource = [
    `#ifndef ${guard}`,
    `#define ${guard}`,
    "",
    "#include <stdint.h>",
    "",
    `void ${ir.moduleName}_update(void);`,
    funcDecls,
    "",
    "#endif",
  ].join("\n");

  // C source: globals, user function bodies, update wrapper, main
  const globalLines = ir.globalVars
    .map((v) =>
      v.init ? `static ${v.cType} ${v.name} = ${emitIrExpr(v.init)};` : `static ${v.cType} ${v.name};`,
    )
    .join("\n");

  const funcBodies = ir.functions
    .map((f) => {
      const params = f.params.length
        ? f.params.map((p) => `${p.cType} ${p.name}`).join(", ")
        : "void";
      const body = emitStmts(f.body, "    ");
      return [
        `${f.returnType} ${f.mangledName}(${params}) {`,
        body || "    /* empty */",
        "}",
      ].join("\n");
    })
    .join("\n\n");

  const updateBody = [
    `    ${frameCall}`,
    ir.frameFunctionName ? "    vsync();" : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sections = [
    "#include <gb/gb.h>",
    "#include <stdint.h>",
    `#include "${ir.moduleName}.h"`,
    "",
    ...(globalLines ? [globalLines, ""] : []),
    ...(funcBodies ? [funcBodies, ""] : []),
    `void ${ir.moduleName}_update(void) {`,
    updateBody,
    "}",
    "",
    "void main(void) {",
    "    while (1) {",
    `        ${ir.moduleName}_update();`,
    "    }",
    "}",
  ];

  return { cSource: sections.join("\n"), headerSource };
}

// ─── Statement emitter ───────────────────────────────────────────────────────────

function emitStmts(stmts: IrStmt[], indent: string): string {
  return stmts.map((s) => emitStmt(s, indent)).join("\n");
}

function emitStmt(stmt: IrStmt, indent: string): string {
  const i  = indent;
  const i2 = indent + "    ";

  switch (stmt.kind) {
    case "return":
      return stmt.expr ? `${i}return ${emitIrExpr(stmt.expr)};` : `${i}return;`;

    case "if": {
      const lines = [
        `${i}if (${emitIrExpr(stmt.cond)}) {`,
        emitStmts(stmt.then, i2),
        `${i}}`,
      ];
      if (stmt.els.length) {
        lines.push(`${i}else {`, emitStmts(stmt.els, i2), `${i}}`);
      }
      return lines.join("\n");
    }

    case "while":
      return [
        `${i}while (${emitIrExpr(stmt.cond)}) {`,
        emitStmts(stmt.body, i2),
        `${i}}`,
      ].join("\n");

    case "for": {
      const condStr = stmt.cond ? emitIrExpr(stmt.cond) : "";
      const stepStr = stmt.step ? emitIrExpr(stmt.step) : "";
      return [
        `${i}for (${stmt.initStr}; ${condStr}; ${stepStr}) {`,
        emitStmts(stmt.body, i2),
        `${i}}`,
      ].join("\n");
    }

    case "var":
      return stmt.init
        ? `${i}${stmt.cType} ${stmt.name} = ${emitIrExpr(stmt.init)};`
        : `${i}${stmt.cType} ${stmt.name};`;

    case "expr":
      return `${i}${emitIrExpr(stmt.expr)};`;

    case "raw":
      return `${i}${stmt.text}`;
  }
}
