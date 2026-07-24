import ts from "typescript";
import type { ParsedProgram } from "../parser/index.js";
import type { CompilerDiagnostic } from "../validator/index.js";

// ─── IR Types ────────────────────────────────────────────────────────────────

export interface IrParam {
  name: string;
  cType: string;
}

export interface IrVar {
  cType: string;
  name: string;
  isConst: boolean;
  isArray: boolean;
  init: IrExpr | null;
}

export interface IrFunction {
  name: string;
  mangledName: string;
  params: IrParam[];
  returnType: string;
  body: IrStmt[];
}

export type IrExpr =
  | { kind: "num"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "ident"; name: string }
  | { kind: "array"; items: IrExpr[] }
  | { kind: "bin"; op: string; left: IrExpr; right: IrExpr }
  | { kind: "unary"; op: string; operand: IrExpr; prefix: boolean }
  | { kind: "call"; callee: string; args: IrExpr[] }
  | { kind: "raw"; text: string };

export type IrStmt =
  | { kind: "return"; expr: IrExpr | null }
  | { kind: "if"; cond: IrExpr; then: IrStmt[]; els: IrStmt[] }
  | { kind: "while"; cond: IrExpr; body: IrStmt[] }
  | {
      kind: "for";
      initStr: string;
      cond: IrExpr | null;
      step: IrExpr | null;
      body: IrStmt[];
    }
  | {
      kind: "var";
      cType: string;
      name: string;
      isArray: boolean;
      init: IrExpr | null;
    }
  | { kind: "expr"; expr: IrExpr }
  | { kind: "raw"; text: string };

export interface IrModule {
  moduleName: string;
  sourceHashHint: number;
  globalVars: IrVar[];
  functions: IrFunction[];
  frameFunctionName: string | null;
}

export interface IrBuildOutput {
  ir: IrModule;
  diagnostics: CompilerDiagnostic[];
}

// ─── Shared expression emitter (used by IR builder and codegen) ──────────────

export function emitIrExpr(expr: IrExpr): string {
  switch (expr.kind) {
    case "num":
      return expr.value;
    case "bool":
      return expr.value ? "1" : "0";
    case "ident":
      return expr.name;
    case "array":
      return `{${expr.items.map(emitIrExpr).join(", ")}}`;
    case "raw":
      return expr.text;
    case "unary":
      return expr.prefix
        ? `${expr.op}(${emitIrExpr(expr.operand)})`
        : `(${emitIrExpr(expr.operand)})${expr.op}`;
    case "bin":
      return `(${emitIrExpr(expr.left)} ${expr.op} ${emitIrExpr(expr.right)})`;
    case "call":
      return `${expr.callee}(${expr.args.map(emitIrExpr).join(", ")})`;
  }
}

// ─── IR Builder ──────────────────────────────────────────────────────────────

// Module-level context set during each buildIr call (single-threaded, reentrant-safe for our use case)
let _currentModule = "";
let _localFunctionNames: Set<string> = new Set();
let _currentSourceFile: ts.SourceFile;
let _irDiagnostics: CompilerDiagnostic[] = [];

export function buildIrDetailed(
  program: ParsedProgram,
  filePath: string,
): IrBuildOutput {
  const moduleName = normalizeModuleName(filePath);
  _currentModule = moduleName;
  _currentSourceFile = program.sourceFile;
  _irDiagnostics = [];
  _localFunctionNames = new Set(
    Array.from(program.sourceFile.statements)
      .filter(
        (s): s is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(s) && !!s.name?.text && !!s.body,
      )
      .map((s) => s.name!.text),
  );

  const globalVars = buildGlobalVars(program.sourceFile);
  const functions = buildFunctions(program.sourceFile, moduleName);
  const functionNames = functions.map((f) => f.name);
  const frameFunctionName = functionNames.includes("updateFrame")
    ? "updateFrame"
    : functionNames.includes("main")
      ? "main"
      : null;

  return {
    ir: {
      moduleName,
      sourceHashHint: program.rawSource.length,
      globalVars,
      functions,
      frameFunctionName,
    },
    diagnostics: _irDiagnostics,
  };
}

export function buildIr(program: ParsedProgram, filePath: string): IrModule {
  return buildIrDetailed(program, filePath).ir;
}

function buildGlobalVars(sf: ts.SourceFile): IrVar[] {
  const vars: IrVar[] = [];
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      const isConst = (stmt.declarationList.flags & ts.NodeFlags.Const) !== 0;
      for (const decl of stmt.declarationList.declarations) {
        const isArray =
          isArrayTypeNode(decl.type) ||
          !!(decl.initializer && ts.isArrayLiteralExpression(decl.initializer));
        vars.push({
          cType: mapTsType(decl.type),
          name: ts.isIdentifier(decl.name) ? decl.name.text : "__unknown",
          isConst,
          isArray,
          init: decl.initializer ? buildExpr(decl.initializer) : null,
        });
      }
    }
  }
  return vars;
}

function buildFunctions(sf: ts.SourceFile, moduleName: string): IrFunction[] {
  const result: IrFunction[] = [];
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text && stmt.body) {
      const name = stmt.name.text;
      const params = Array.from(stmt.parameters).map((p) => ({
        name: ts.isIdentifier(p.name) ? p.name.text : "__p",
        cType: mapTsType(p.type),
      }));
      result.push({
        name,
        mangledName: `${moduleName}_${name}`,
        params,
        returnType: mapTsType(stmt.type),
        body: buildStmts(stmt.body.statements),
      });
    }
  }
  return result;
}

function buildStmts(stmts: ts.NodeArray<ts.Statement>): IrStmt[] {
  return stmts.flatMap(buildStmt);
}

function buildBlock(node: ts.Statement): IrStmt[] {
  return ts.isBlock(node) ? buildStmts(node.statements) : buildStmt(node);
}

function buildStmt(node: ts.Statement): IrStmt[] {
  if (ts.isReturnStatement(node)) {
    return [
      {
        kind: "return",
        expr: node.expression ? buildExpr(node.expression) : null,
      },
    ];
  }
  if (ts.isIfStatement(node)) {
    return [
      {
        kind: "if",
        cond: buildExpr(node.expression),
        then: buildBlock(node.thenStatement),
        els: node.elseStatement ? buildBlock(node.elseStatement) : [],
      },
    ];
  }
  if (ts.isWhileStatement(node)) {
    return [
      {
        kind: "while",
        cond: buildExpr(node.expression),
        body: buildBlock(node.statement),
      },
    ];
  }
  if (ts.isForStatement(node)) {
    return [
      {
        kind: "for",
        initStr: node.initializer ? buildForInitStr(node.initializer) : "",
        cond: node.condition ? buildExpr(node.condition) : null,
        step: node.incrementor ? buildExpr(node.incrementor) : null,
        body: buildBlock(node.statement),
      },
    ];
  }
  if (ts.isVariableStatement(node)) {
    return Array.from(node.declarationList.declarations).map((d) => ({
      kind: "var" as const,
      cType: mapTsType(d.type),
      name: ts.isIdentifier(d.name) ? d.name.text : "__unknown",
      isArray:
        isArrayTypeNode(d.type) ||
        !!(d.initializer && ts.isArrayLiteralExpression(d.initializer)),
      init: d.initializer ? buildExpr(d.initializer) : null,
    }));
  }
  if (ts.isExpressionStatement(node)) {
    return [{ kind: "expr", expr: buildExpr(node.expression) }];
  }
  if (ts.isBlock(node)) {
    return buildStmts(node.statements);
  }
  pushIrDiagnostic(
    node,
    "TSGBDK050",
    `statement kind '${ts.SyntaxKind[node.kind]}' is not supported by the current TS->C lowering`,
  );
  return [
    { kind: "raw", text: `/* unsupported: ${ts.SyntaxKind[node.kind]} */` },
  ];
}

function buildForInitStr(node: ts.ForInitializer): string {
  if (ts.isVariableDeclarationList(node)) {
    return Array.from(node.declarations)
      .map((d) => {
        const name = ts.isIdentifier(d.name) ? d.name.text : "__x";
        const cType = mapTsType(d.type);
        const init = d.initializer ? emitIrExpr(buildExpr(d.initializer)) : "";
        return init ? `${cType} ${name} = ${init}` : `${cType} ${name}`;
      })
      .join(", ");
  }
  return emitIrExpr(buildExpr(node as ts.Expression));
}

function buildExpr(node: ts.Expression): IrExpr {
  if (ts.isNumericLiteral(node)) return { kind: "num", value: node.text };
  if (ts.isArrayLiteralExpression(node)) {
    return {
      kind: "array",
      items: node.elements.map((e) => buildExpr(e as ts.Expression)),
    };
  }
  if (ts.isStringLiteral(node))
    return { kind: "raw", text: `"${node.text.replace(/"/g, '\\"')}"` };
  if (node.kind === ts.SyntaxKind.TrueKeyword)
    return { kind: "bool", value: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword)
    return { kind: "bool", value: false };
  if (ts.isIdentifier(node)) return { kind: "ident", name: node.text };
  if (ts.isParenthesizedExpression(node)) return buildExpr(node.expression);
  if (ts.isAsExpression(node)) return buildExpr(node.expression);
  if (ts.isBinaryExpression(node)) {
    const mappedOp = mapBinaryOp(node.operatorToken.kind);
    if (!mappedOp) {
      pushIrDiagnostic(
        node.operatorToken,
        "TSGBDK052",
        `binary operator '${node.operatorToken.getText()}' is not supported by the current TS->C lowering`,
      );
      return { kind: "raw", text: `/* unsupported-binary-op */` };
    }
    return {
      kind: "bin",
      op: mappedOp,
      left: buildExpr(node.left),
      right: buildExpr(node.right),
    };
  }
  if (ts.isPrefixUnaryExpression(node)) {
    // Collapse -(number) into a single negative numeric literal for clean C output
    if (
      node.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(node.operand)
    ) {
      return { kind: "num", value: `-${node.operand.text}` };
    }
    const mappedOp = mapPrefixOp(node.operator);
    if (!mappedOp) {
      pushIrDiagnostic(
        node,
        "TSGBDK053",
        `prefix operator '${node.operator === ts.SyntaxKind.PlusToken ? "+" : (ts.tokenToString(node.operator) ?? "unknown")}' is not supported by the current TS->C lowering`,
      );
      return { kind: "raw", text: `/* unsupported-prefix-op */` };
    }
    return {
      kind: "unary",
      op: mappedOp,
      operand: buildExpr(node.operand),
      prefix: true,
    };
  }
  if (ts.isPostfixUnaryExpression(node)) {
    const op = node.operator === ts.SyntaxKind.PlusPlusToken ? "++" : "--";
    return {
      kind: "unary",
      op,
      operand: buildExpr(node.operand),
      prefix: false,
    };
  }
  if (ts.isCallExpression(node)) {
    const callee = resolveCallee(node.expression);
    if (!callee) {
      pushIrDiagnostic(
        node.expression,
        "TSGBDK054",
        "callee expression is not supported; use direct identifier calls or property access (e.g. sdk.fn)",
      );
    }
    return {
      kind: "call",
      callee: callee ?? "__unknown_callee",
      args: node.arguments.map(buildExpr),
    };
  }
  pushIrDiagnostic(
    node,
    "TSGBDK051",
    `expression kind '${ts.SyntaxKind[node.kind]}' is not supported by the current TS->C lowering`,
  );
  return { kind: "raw", text: `/* expr:${ts.SyntaxKind[node.kind]} */` };
}

function resolveCallee(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) {
    const name = expr.text;
    // Local function call -> mangle with module prefix
    if (_localFunctionNames.has(name)) return `${_currentModule}_${name}`;
    return name;
  }
  if (ts.isPropertyAccessExpression(expr)) {
    const obj = ts.isIdentifier(expr.expression)
      ? expr.expression.text
      : "__obj";
    const prop = expr.name.text;
    // sdk.X → X  (strip SDK namespace, maps to GBDK directly)
    if (obj === "sdk") return prop;
    return `${obj}_${prop}`;
  }
  return null;
}

// ─── Type mapping ─────────────────────────────────────────────────────────────

function mapTsType(typeNode: ts.TypeNode | undefined): string {
  if (!typeNode) return "uint8_t";
  if (ts.isArrayTypeNode(typeNode)) {
    return mapTsType(typeNode.elementType);
  }
  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    switch (typeNode.typeName.text) {
      case "u8":
        return "uint8_t";
      case "i8":
        return "int8_t";
      case "u16":
        return "uint16_t";
      case "i16":
        return "int16_t";
    }
  }
  switch (typeNode.kind) {
    case ts.SyntaxKind.BooleanKeyword:
      return "uint8_t";
    case ts.SyntaxKind.VoidKeyword:
      return "void";
    case ts.SyntaxKind.NumberKeyword:
      return "uint16_t";
  }
  return "uint8_t";
}

function isArrayTypeNode(typeNode: ts.TypeNode | undefined): boolean {
  return !!typeNode && ts.isArrayTypeNode(typeNode);
}

function mapBinaryOp(op: ts.BinaryOperator): string | null {
  switch (op) {
    case ts.SyntaxKind.EqualsEqualsEqualsToken:
      return "==";
    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      return "!=";
    case ts.SyntaxKind.EqualsEqualsToken:
      return "==";
    case ts.SyntaxKind.ExclamationEqualsToken:
      return "!=";
    case ts.SyntaxKind.LessThanToken:
      return "<";
    case ts.SyntaxKind.LessThanEqualsToken:
      return "<=";
    case ts.SyntaxKind.GreaterThanToken:
      return ">";
    case ts.SyntaxKind.GreaterThanEqualsToken:
      return ">=";
    case ts.SyntaxKind.AmpersandAmpersandToken:
      return "&&";
    case ts.SyntaxKind.BarBarToken:
      return "||";
    case ts.SyntaxKind.PlusToken:
      return "+";
    case ts.SyntaxKind.MinusToken:
      return "-";
    case ts.SyntaxKind.AsteriskToken:
      return "*";
    case ts.SyntaxKind.SlashToken:
      return "/";
    case ts.SyntaxKind.PercentToken:
      return "%";
    case ts.SyntaxKind.EqualsToken:
      return "=";
    case ts.SyntaxKind.PlusEqualsToken:
      return "+=";
    case ts.SyntaxKind.MinusEqualsToken:
      return "-=";
    case ts.SyntaxKind.AsteriskEqualsToken:
      return "*=";
    case ts.SyntaxKind.SlashEqualsToken:
      return "/=";
    case ts.SyntaxKind.AmpersandToken:
      return "&";
    case ts.SyntaxKind.BarToken:
      return "|";
    case ts.SyntaxKind.CaretToken:
      return "^";
    case ts.SyntaxKind.LessThanLessThanToken:
      return "<<";
    case ts.SyntaxKind.GreaterThanGreaterThanToken:
      return ">>";
    default:
      return null;
  }
}

function mapPrefixOp(op: ts.PrefixUnaryOperator): string | null {
  switch (op) {
    case ts.SyntaxKind.ExclamationToken:
      return "!";
    case ts.SyntaxKind.MinusToken:
      return "-";
    case ts.SyntaxKind.PlusToken:
      return "+";
    case ts.SyntaxKind.PlusPlusToken:
      return "++";
    case ts.SyntaxKind.MinusMinusToken:
      return "--";
    case ts.SyntaxKind.TildeToken:
      return "~";
    default:
      return null;
  }
}

function pushIrDiagnostic(node: ts.Node, code: string, message: string): void {
  const { line, character } = _currentSourceFile.getLineAndCharacterOfPosition(
    node.getStart(),
  );
  _irDiagnostics.push({
    code,
    message,
    severity: "error",
    category: "codegen-fallback",
    fileName: _currentSourceFile.fileName,
    line: line + 1,
    column: character + 1,
  });
}

function normalizeModuleName(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  const name = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  return name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]/g, "_");
}
