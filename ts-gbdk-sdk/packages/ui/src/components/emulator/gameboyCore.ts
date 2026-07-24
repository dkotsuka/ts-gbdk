export type EmulatorJoypadButton =
  | "up"
  | "down"
  | "left"
  | "right"
  | "a"
  | "b"
  | "start"
  | "select";

export type EmulatorMode = "gb" | "gbc";

type WasmBoyJoypadState = {
  UP: boolean;
  RIGHT: boolean;
  DOWN: boolean;
  LEFT: boolean;
  A: boolean;
  B: boolean;
  SELECT: boolean;
  START: boolean;
};

type WasmBoyApi = {
  config: (
    options?: {
      isGbcEnabled?: boolean;
      isAudioEnabled?: boolean;
      headless?: boolean;
      gameboyFrameRate?: number;
    },
    canvasElement?: HTMLCanvasElement,
  ) => Promise<void>;
  loadROM: (rom: Uint8Array | ArrayBuffer) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  reset: (options?: { isGbcEnabled?: boolean }) => Promise<void>;
  setJoypadState: (state: WasmBoyJoypadState) => void;
  getFPS: () => number;
  isGBC: () => Promise<boolean>;
};

function resolveWasmBoyApi(moduleValue: unknown): WasmBoyApi | null {
  if (!moduleValue || typeof moduleValue !== "object") {
    return null;
  }

  const moduleRecord = moduleValue as Record<string, unknown>;
  const namedExport = moduleRecord.WasmBoy;

  if (namedExport && typeof namedExport === "object") {
    return namedExport as WasmBoyApi;
  }

  const defaultExport = moduleRecord.default;

  if (defaultExport && typeof defaultExport === "object") {
    const defaultRecord = defaultExport as Record<string, unknown>;

    if (defaultRecord.WasmBoy && typeof defaultRecord.WasmBoy === "object") {
      return defaultRecord.WasmBoy as WasmBoyApi;
    }

    return defaultExport as WasmBoyApi;
  }

  return null;
}

function createEmptyJoypadState(): WasmBoyJoypadState {
  return {
    UP: false,
    RIGHT: false,
    DOWN: false,
    LEFT: false,
    A: false,
    B: false,
    SELECT: false,
    START: false,
  };
}

const BUTTON_TO_JOYPAD_KEY: Record<
  EmulatorJoypadButton,
  keyof WasmBoyJoypadState
> = {
  up: "UP",
  right: "RIGHT",
  down: "DOWN",
  left: "LEFT",
  a: "A",
  b: "B",
  select: "SELECT",
  start: "START",
};

export class GameboyCoreAdapter {
  private readonly canvasElement: HTMLCanvasElement;

  private readonly wasmBoy: WasmBoyApi;

  private hasStarted = false;

  private lastRom: Uint8Array | null = null;

  private mode: EmulatorMode = "gbc";

  private joypadState: WasmBoyJoypadState = createEmptyJoypadState();

  private frameListener: ((timestampMs: number) => void) | null = null;

  private constructor(canvasElement: HTMLCanvasElement, wasmBoy: WasmBoyApi) {
    this.canvasElement = canvasElement;
    this.wasmBoy = wasmBoy;
  }

  static async create(
    canvasContext: CanvasRenderingContext2D,
  ): Promise<GameboyCoreAdapter> {
    const moduleValue =
      await import("../../../../../lib/wasmboy/dist/wasmboy.wasm.esm.js");
    const wasmBoy = resolveWasmBoyApi(moduleValue);

    if (!wasmBoy) {
      throw new Error("Nao foi possivel resolver a API WasmBoy.");
    }

    return new GameboyCoreAdapter(canvasContext.canvas, wasmBoy);
  }

  private async configure(mode: EmulatorMode): Promise<void> {
    this.mode = mode;

    await this.wasmBoy.config(
      {
        isGbcEnabled: mode === "gbc",
        isAudioEnabled: true,
        headless: false,
        gameboyFrameRate: 60,
      },
      this.canvasElement,
    );
  }

  private startIfNeeded(): void {
    if (this.hasStarted) {
      return;
    }

    void this.wasmBoy.play();
    this.hasStarted = true;
  }

  async loadRom(romBytes: Uint8Array, mode: EmulatorMode): Promise<void> {
    const romCopy = new Uint8Array(romBytes.byteLength);
    romCopy.set(romBytes);

    await this.configure(mode);

    this.lastRom = romCopy;
    await this.wasmBoy.loadROM(romCopy);

    this.startIfNeeded();
    this.applyJoypadState();
  }

  async reset(mode: EmulatorMode): Promise<void> {
    this.mode = mode;

    await this.wasmBoy.reset({
      isGbcEnabled: mode === "gbc",
    });

    this.startIfNeeded();
    this.applyJoypadState();

    if (this.lastRom) {
      await this.wasmBoy.loadROM(this.lastRom);
      this.startIfNeeded();
      this.applyJoypadState();
    }
  }

  private applyJoypadState(): void {
    this.wasmBoy.setJoypadState(this.joypadState);
  }

  async isGbcRuntime(): Promise<boolean> {
    return this.wasmBoy.isGBC();
  }

  getFps(): number {
    return this.wasmBoy.getFPS();
  }

  async stop(): Promise<void> {
    this.joypadState = createEmptyJoypadState();
    this.applyJoypadState();

    await this.wasmBoy.pause();
    this.hasStarted = false;
  }

  setButtonState(button: EmulatorJoypadButton, pressed: boolean): void {
    const key = BUTTON_TO_JOYPAD_KEY[button];
    this.joypadState[key] = pressed;
    this.applyJoypadState();
  }

  setFrameListener(listener: ((timestampMs: number) => void) | null): void {
    this.frameListener = listener;

    if (listener) {
      listener(performance.now());
    }
  }

  async destroy(): Promise<void> {
    await this.stop();
    this.frameListener = null;
    this.lastRom = null;
  }
}
