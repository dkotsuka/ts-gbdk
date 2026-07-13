import type { IrModule } from "../ir/index.js";

export interface GeneratedArtifacts {
  cSource: string;
  headerSource: string;
}

export function generateC(ir: IrModule): GeneratedArtifacts {
  const headerGuard = `${ir.moduleName.toUpperCase()}_H`;

  const headerSource = [
    `#ifndef ${headerGuard}`,
    `#define ${headerGuard}`,
    "",
    "#include <stdint.h>",
    "",
    `void ${ir.moduleName}_update(void);`,
    "",
    "#endif",
  ].join("\n");

  const cSource = [
    "#include <gb/gb.h>",
    "#include <stdint.h>",
    `#include \"${ir.moduleName}.h\"`,
    "",
    `void ${ir.moduleName}_update(void) {`,
    "    vsync();",
    "}",
    "",
    "void main(void) {",
    "    while (1) {",
    `        ${ir.moduleName}_update();`,
    "    }",
    "}",
  ].join("\n");

  return { cSource, headerSource };
}
