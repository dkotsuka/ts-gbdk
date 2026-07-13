import ts from "typescript";

export interface ParseIssue {
  code: string;
  message: string;
  position: number;
}

export interface ParsedProgram {
  rawSource: string;
  sourceFile: ts.SourceFile;
  issues: ParseIssue[];
}

export function parseSource(source: string): ParsedProgram {
  const sourceFile = ts.createSourceFile(
    "input.ts",
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );

  const issues: ParseIssue[] = [];
  visitNode(sourceFile, issues);

  return { rawSource: source, sourceFile, issues };
}

function visitNode(node: ts.Node, issues: ParseIssue[]): void {
  if (ts.isClassDeclaration(node)) {
    issues.push(
      issue("TSGBDK014", "class declarations are not supported in MVP", node),
    );
  }

  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    issues.push(
      issue(
        "TSGBDK015",
        "anonymous functions and closures are not supported in MVP",
        node,
      ),
    );
  }

  if (ts.isObjectLiteralExpression(node)) {
    issues.push(
      issue("TSGBDK016", "object literals are not supported in MVP", node),
    );
  }

  if (ts.isNewExpression(node)) {
    issues.push(
      issue("TSGBDK017", "new expressions are not supported in MVP", node),
    );
  }

  if (hasAsyncModifier(node)) {
    issues.push(
      issue("TSGBDK018", "async/await is not supported in MVP", node),
    );
  }

  if (ts.isAwaitExpression(node)) {
    issues.push(
      issue("TSGBDK018", "async/await is not supported in MVP", node),
    );
  }

  ts.forEachChild(node, (child) => visitNode(child, issues));
}

function hasAsyncModifier(node: ts.Node): boolean {
  const modifiers = (node as ts.HasModifiers).modifiers;
  if (!modifiers) return false;
  return modifiers.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
}

function issue(code: string, message: string, node: ts.Node): ParseIssue {
  return { code, message, position: node.getStart() };
}
