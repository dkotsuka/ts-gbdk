import type { IrModule } from "../ir/index.js";

export interface GeneratedArtifacts {
  cSource: string;
  headerSource: string;
}

export function generateC(ir: IrModule): GeneratedArtifacts {
  const headerGuard = `${ir.moduleName.toUpperCase()}_H`;
  const frameCall = ir.frameFunctionName
    ? `${ir.moduleName}_${ir.frameFunctionName}();`
    : "vsync();";
  const userFunctions = ir.functionNames
    .map((fn) => `void ${ir.moduleName}_${fn}(void);`)
    .join("\n");
  const userFunctionBodies = ir.functionNames
    .map((fn) =>
      [
        `void ${ir.moduleName}_${fn}(void) {`,
        "    // TODO: generated from TypeScript body in next milestone.",
        "}",
      ].join("\n"),
    )
    .join("\n\n");

  const headerSource = [
    `#ifndef ${headerGuard}`,
    `#define ${headerGuard}`,
    "",
    "#include <stdint.h>",
    "",
    `void ${ir.moduleName}_update(void);`,
    userFunctions,
    "",
    "#endif",
  ].join("\n");

  const cSource = [
    "#include <gb/gb.h>",
    "#include <stdint.h>",
    `#include \"${ir.moduleName}.h\"`,
    "",
    userFunctionBodies,
    userFunctionBodies ? "" : "",
    `void ${ir.moduleName}_update(void) {`,
    `    ${frameCall}`,
    ir.frameFunctionName ? "    vsync();" : "",
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
