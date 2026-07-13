export interface ParsedProgram {
  rawSource: string;
}

export function parseSource(source: string): ParsedProgram {
  // Placeholder parser until TS AST traversal is implemented.
  return { rawSource: source };
}
