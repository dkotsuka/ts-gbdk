// Global numeric types for the ts-gbdk-sdk subset language.
// These are erased at transpile time and mapped to their C equivalents:
//   u8  -> uint8_t
//   i8  -> int8_t
//   u16 -> uint16_t
//   i16 -> int16_t
//   bool is native TypeScript – no alias needed.

declare type u8 = number;
declare type i8 = number;
declare type u16 = number;
declare type i16 = number;

// Marks a function as declared externally (GBDK API, asm, runtime-c).
// The transpiler will emit a call without generating a body.
// Usage: declare function joypad(): u8;
