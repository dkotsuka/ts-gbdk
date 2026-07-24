/**
 * Golden tests for the TS -> C compiler pipeline.
 * Run with: node --import tsx packages/compiler/test/golden.test.ts
 * (after installing tsx as a devDependency)
 */
import assert from "node:assert/strict";
import { compileToC } from "../src/index.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function compile(source: string) {
  return compileToC({ filePath: "test.ts", source });
}

function assertC(source: string, expected: string[]) {
  const { cSource } = compile(source);
  for (const fragment of expected) {
    assert.ok(
      cSource.includes(fragment),
      `Expected C to contain:\n  ${fragment}\n\nActual:\n${cSource}`,
    );
  }
}

function assertDiag(source: string, code: string) {
  const { diagnostics } = compile(source);
  assert.ok(
    diagnostics.some((d) => d.includes(code)),
    `Expected diagnostic ${code}, got:\n${diagnostics.join("\n")}`,
  );
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg.split("\n")[0]}`);
    failed++;
  }
}

// ─── 1. Types ────────────────────────────────────────────────────────────────

console.log("\nTypes");

test("u8 → uint8_t global", () =>
  assertC("let x: u8 = 1;\nfunction updateFrame(): void {}", [
    "static uint8_t x = 1;",
  ]));

test("i8 → int8_t global", () =>
  assertC("let x: i8 = -5;\nfunction updateFrame(): void {}", [
    "static int8_t x = -5;",
  ]));

test("u16 → uint16_t global", () =>
  assertC("let x: u16 = 1000;\nfunction updateFrame(): void {}", [
    "static uint16_t x = 1000;",
  ]));

test("i16 → int16_t global", () =>
  assertC("let x: i16 = -1000;\nfunction updateFrame(): void {}", [
    "static int16_t x = -1000;",
  ]));

test("bool → uint8_t param", () =>
  assertC(
    "function check(flag: bool): void {}\nfunction updateFrame(): void {}",
    ["void test_check(uint8_t flag)"],
  ));

test("void return type", () =>
  assertC("function noop(): void {}\nfunction updateFrame(): void {}", [
    "void test_noop(void)",
  ]));

// ─── 2. Const vs let ─────────────────────────────────────────────────────────

console.log("\nConst vs let");

test("const global emits static const", () =>
  assertC("const SPEED: u8 = 2;\nfunction updateFrame(): void {}", [
    "static const uint8_t SPEED = 2;",
  ]));

test("let global emits static (mutable)", () =>
  assertC("let x: u8 = 0;\nfunction updateFrame(): void {}", [
    "static uint8_t x = 0;",
  ]));

// ─── 2.1 Arrays ─────────────────────────────────────────────────────────────

console.log("\nArrays");

test("const u8[] global emits static const array", () =>
  assertC(
    "const tiles: u8[] = [0x00, 0x7E, 0xFF];\nfunction updateFrame(): void {}",
    ["static const uint8_t tiles[] = {0, 126, 255};"],
  ));

test("let u8[] global emits static mutable array", () =>
  assertC("let map: u8[] = [1, 2, 3];\nfunction updateFrame(): void {}", [
    "static uint8_t map[] = {1, 2, 3};",
  ]));

test("const i16[] global maps to int16_t[]", () =>
  assertC(
    "const values: i16[] = [-1, 0, 10];\nfunction updateFrame(): void {}",
    ["static const int16_t values[] = {-1, 0, 10};"],
  ));

test("local array declaration emits [] initializer", () =>
  assertC(
    "function f(): void { const palette: u16[] = [0x7FFF, 0x03E0]; }\nfunction updateFrame(): void {}",
    ["uint16_t palette[] = {32767, 992};"],
  ));

// ─── 3. Expressions ──────────────────────────────────────────────────────────

console.log("\nExpressions");

test("binary +", () =>
  assertC(
    "function f(): u8 { return 1 + 2; }\nfunction updateFrame(): void {}",
    ["return (1 + 2);"],
  ));

test("binary &", () =>
  assertC(
    "function f(a: u8, b: u8): u8 { return a & b; }\nfunction updateFrame(): void {}",
    ["return (a & b);"],
  ));

test("binary comparison ===", () =>
  assertC(
    "function f(a: u8): bool { return a === 0; }\nfunction updateFrame(): void {}",
    ["return (a == 0);"],
  ));

test("binary comparison !==", () =>
  assertC(
    "function f(a: u8): bool { return a !== 0; }\nfunction updateFrame(): void {}",
    ["return (a != 0);"],
  ));

test("prefix !", () =>
  assertC(
    "function f(a: bool): bool { return !a; }\nfunction updateFrame(): void {}",
    ["return !(a);"],
  ));

test("postfix ++", () =>
  assertC("function f(a: u8): void { a++; }\nfunction updateFrame(): void {}", [
    "(a)++;",
  ]));

test("boolean literal true → 1", () =>
  assertC(
    "function f(): bool { return true; }\nfunction updateFrame(): void {}",
    ["return 1;"],
  ));

test("boolean literal false → 0", () =>
  assertC(
    "function f(): bool { return false; }\nfunction updateFrame(): void {}",
    ["return 0;"],
  ));

// ─── 4. Statements ───────────────────────────────────────────────────────────

console.log("\nStatements");

test("if without else", () =>
  assertC(
    "function f(x: u8): void { if (x > 0) { x = 0; } }\nfunction updateFrame(): void {}",
    ["if ((x > 0)) {", "(x = 0);"],
  ));

test("if with else", () =>
  assertC(
    "function f(x: u8): u8 { if (x > 0) { return x; } else { return 0; } }\nfunction updateFrame(): void {}",
    ["if ((x > 0)) {", "else {", "return 0;"],
  ));

test("while loop", () =>
  assertC(
    "function f(x: u8): void { while (x > 0) { x = x - 1; } }\nfunction updateFrame(): void {}",
    ["while ((x > 0)) {", "(x = (x - 1));"],
  ));

test("for loop", () =>
  assertC(
    "function f(): void { for (let i: u8 = 0; i < 10; i++) {} }\nfunction updateFrame(): void {}",
    ["for (uint8_t i = 0; (i < 10); (i)++)"],
  ));

test("local const var", () =>
  assertC(
    "function f(): void { const n: u8 = 5; }\nfunction updateFrame(): void {}",
    ["uint8_t n = 5;"],
  ));

// ─── 5. Functions ────────────────────────────────────────────────────────────

console.log("\nFunctions");

test("function mangled with module name", () =>
  assertC("function doThing(): void {}\nfunction updateFrame(): void {}", [
    "void test_doThing(void)",
  ]));

test("local function call mangled", () =>
  assertC(
    "function helper(): void {}\nfunction updateFrame(): void { helper(); }",
    ["test_helper();"],
  ));

test("external function call not mangled", () =>
  assertC(
    "declare function vsync(): void;\nfunction updateFrame(): void { vsync(); }",
    ["vsync();"],
  ));

test("function with multiple params", () =>
  assertC(
    "function add(a: u8, b: u8): u16 { return a + b; }\nfunction updateFrame(): void {}",
    ["uint16_t test_add(uint8_t a, uint8_t b)"],
  ));

// ─── 6. Game loop wiring ─────────────────────────────────────────────────────

console.log("\nGame loop wiring");

test("updateFrame is called in _update", () =>
  assertC("function updateFrame(): void {}", [
    "test_updateFrame();",
    "void test_update(void)",
  ]));

test("_update is called in main loop", () =>
  assertC("function updateFrame(): void {}", [
    "while (1) {",
    "test_update();",
  ]));

test("vsync called in update after frame", () =>
  assertC("function updateFrame(): void {}", ["vsync();"]));

// ─── 7. Header ───────────────────────────────────────────────────────────────

console.log("\nHeader");

test("header guard generated", () => {
  const { headerSource } = compile("function updateFrame(): void {}");
  assert.ok(headerSource.includes("#ifndef TEST_H"));
  assert.ok(headerSource.includes("#define TEST_H"));
  assert.ok(headerSource.includes("#endif"));
});

test("function forward decl in header", () =>
  assert.ok(
    compile(
      "function doThing(): void {}\nfunction updateFrame(): void {}",
    ).headerSource.includes("void test_doThing(void);"),
  ));

// ─── 8. Validator diagnostics ────────────────────────────────────────────────

console.log("\nValidator diagnostics");

test("class raises TSGBDK014", () => assertDiag("class Foo {}", "TSGBDK014"));

test("async raises TSGBDK018", () =>
  assertDiag("async function f() {}", "TSGBDK018"));

test("object literal raises TSGBDK016", () =>
  assertDiag("const o = {};", "TSGBDK016"));

test("new expression raises TSGBDK017", () =>
  assertDiag("class Foo {} const f = new Foo();", "TSGBDK017"));

test("missing updateFrame raises TSGBDK030", () =>
  assertDiag("function someFn(): void {}", "TSGBDK030"));

test("unsupported switch statement raises TSGBDK050", () =>
  assertDiag(
    "function updateFrame(): void { switch (1) { case 1: break; } }",
    "TSGBDK050",
  ));

test("unsupported ternary expression raises TSGBDK051", () =>
  assertDiag(
    "function updateFrame(): void { let x: u8 = true ? 1 : 0; }",
    "TSGBDK051",
  ));

test("unsupported in operator raises TSGBDK052", () =>
  assertDiag(
    "function updateFrame(): void { let x: bool = 1 in [1, 2]; }",
    "TSGBDK052",
  ));

test("unsupported complex callee raises TSGBDK054", () =>
  assertDiag(
    "declare function joypad(): u8; function updateFrame(): void { (joypad)(); }",
    "TSGBDK054",
  ));

test("hasErrors false for warning-only diagnostics", () => {
  const out = compile("function someFn(): void {}");
  assert.equal(out.hasErrors, false);
  assert.ok(out.diagnosticsDetailed.some((d) => d.code === "TSGBDK030"));
  assert.ok(
    out.diagnosticsDetailed.some(
      (d) => d.code === "TSGBDK030" && d.severity === "warning",
    ),
  );
});

test("hasErrors true when subset violation exists", () => {
  const out = compile("class Foo {}");
  assert.equal(out.hasErrors, true);
  assert.ok(
    out.diagnosticsDetailed.some(
      (d) => d.code === "TSGBDK014" && d.severity === "error",
    ),
  );
});

test("hasErrors true when IR fallback diagnostics exist", () => {
  const out = compile(
    "function updateFrame(): void { let x: u8 = true ? 1 : 0; }",
  );
  assert.equal(out.hasErrors, true);
  assert.ok(
    out.diagnosticsDetailed.some(
      (d) => d.code === "TSGBDK051" && d.category === "codegen-fallback",
    ),
  );
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
