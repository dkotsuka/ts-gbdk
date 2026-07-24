import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiPlay, FiRefreshCw, FiSquare } from "react-icons/fi";
import {
  GameboyCoreAdapter,
  type EmulatorJoypadButton,
  type EmulatorMode,
} from "./gameboyCore";

export type RomSelection = {
  path: string;
  name: string;
  handle: FileSystemFileHandle;
};

type JoypadButton = EmulatorJoypadButton;

type JoypadState = Record<JoypadButton, boolean>;

type EmulatorPanelProps = {
  selectedRom: RomSelection | null;
  activeRom: RomSelection | null;
  mode: EmulatorMode;
  onChangeMode: (mode: EmulatorMode) => void;
  onRunSelectedRom: () => void;
};

const SCREEN_WIDTH = 160;
const SCREEN_HEIGHT = 144;
const SCREEN_SCALE = 2;

const KEYBOARD_MAP: Record<string, JoypadButton> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  z: "b",
  x: "a",
  Enter: "start",
  Shift: "select",
};

const INITIAL_JOYPAD_STATE: JoypadState = {
  up: false,
  down: false,
  left: false,
  right: false,
  a: false,
  b: false,
  start: false,
  select: false,
};

async function readRomBytes(rom: RomSelection): Promise<Uint8Array> {
  const file = await rom.handle.getFile();
  const bytes = new Uint8Array(await file.arrayBuffer());
  return bytes;
}

function drawPlaceholderFrame(
  canvas: HTMLCanvasElement,
  message: string,
  accentColor = "#4f6a7d",
): void {
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(79, 106, 125, 0.22)";
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

  ctx.fillStyle = accentColor;
  ctx.font = "bold 11px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("GBC 2x", canvas.width / 2, 22);

  ctx.fillStyle = "#5e7688";
  ctx.font = "10px 'Courier New', monospace";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

export function EmulatorPanel({
  selectedRom,
  activeRom,
  mode,
  onChangeMode,
  onRunSelectedRom,
}: EmulatorPanelProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coreRef = useRef<GameboyCoreAdapter | null>(null);
  const lastJoypadSnapshotRef = useRef<JoypadState>(INITIAL_JOYPAD_STATE);
  const [joypad, setJoypad] = useState<JoypadState>(INITIAL_JOYPAD_STATE);
  const [statusMessage, setStatusMessage] = useState(
    "Selecione uma ROM e clique em Rodar.",
  );
  const [isCoreReady, setIsCoreReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingRom, setIsLoadingRom] = useState(false);
  const [romSizeBytes, setRomSizeBytes] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const viewportSize = useMemo(
    () => ({
      width: SCREEN_WIDTH * SCREEN_SCALE,
      height: SCREEN_HEIGHT * SCREEN_SCALE,
    }),
    [],
  );

  const ensureCore = useCallback(async (): Promise<GameboyCoreAdapter> => {
    if (coreRef.current) {
      return coreRef.current;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      throw new Error("Canvas do emulador indisponivel.");
    }

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Nao foi possivel obter o contexto 2D do emulador.");
    }

    const core = await GameboyCoreAdapter.create(context);
    coreRef.current = core;
    setIsCoreReady(true);

    return core;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || isRunning) {
      return;
    }

    drawPlaceholderFrame(
      canvas,
      statusMessage,
      isCoreReady ? "#4f6a7d" : "#6b879b",
    );
  }, [statusMessage, isRunning, isCoreReady]);

  useEffect(() => {
    if (isCoreReady) {
      return;
    }

    let isCancelled = false;

    const initializeCore = async () => {
      try {
        setStatusMessage("Inicializando core do emulador...");
        await ensureCore();

        if (!isCancelled) {
          setStatusMessage("Core pronto. Selecione uma ROM e clique em Rodar.");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "erro desconhecido";

        if (!isCancelled) {
          setStatusMessage(
            `Falha ao carregar o core do emulador: ${errorMessage}.`,
          );
        }
      }
    };

    void initializeCore();

    return () => {
      isCancelled = true;
    };
  }, [ensureCore, isCoreReady]);

  useEffect(() => {
    if (!activeRom) {
      setIsRunning(false);
      setRomSizeBytes(null);
      setFps(null);
      setStatusMessage("Selecione uma ROM e clique em Rodar.");
      return;
    }

    let isCancelled = false;

    const loadRom = async () => {
      try {
        setIsLoadingRom(true);
        setStatusMessage(`Carregando ${activeRom.name}...`);

        const romBytes = await readRomBytes(activeRom);
        const core = await ensureCore();

        if (isCancelled) {
          return;
        }

        await core.loadRom(romBytes, mode);

        setRomSizeBytes(romBytes.byteLength);
        setIsRunning(true);
        const runtimeMode = (await core.isGbcRuntime()) ? "GBC" : "GB";
        setStatusMessage(
          `ROM ativa: ${activeRom.name} (${Math.ceil(romBytes.byteLength / 1024)} KB) | Runtime: ${runtimeMode}`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "erro desconhecido";

        if (isCancelled) {
          return;
        }

        setIsRunning(false);
        setRomSizeBytes(null);
        setStatusMessage(
          `Falha ao carregar a ROM selecionada: ${errorMessage}.`,
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingRom(false);
        }
      }
    };

    void loadRom();

    return () => {
      isCancelled = true;
    };
  }, [activeRom, ensureCore, mode]);

  useEffect(() => {
    if (!isRunning || !coreRef.current) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextFps = coreRef.current?.getFps() ?? 0;

      if (nextFps > 0) {
        setFps(nextFps);
      }
    }, 300);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning]);

  useEffect(() => {
    if (!coreRef.current) {
      return;
    }

    const previous = lastJoypadSnapshotRef.current;
    const next = joypad;

    (Object.keys(next) as JoypadButton[]).forEach((button) => {
      if (previous[button] !== next[button]) {
        coreRef.current?.setButtonState(button, next[button]);
      }
    });

    lastJoypadSnapshotRef.current = next;
  }, [joypad]);

  useEffect(() => {
    const handleKeyChange = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const mappedButton = KEYBOARD_MAP[key];

      if (!mappedButton) {
        return;
      }

      event.preventDefault();
      setJoypad((current) => {
        if (current[mappedButton] === pressed) {
          return current;
        }

        return {
          ...current,
          [mappedButton]: pressed,
        };
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      handleKeyChange(event, true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      handleKeyChange(event, false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      void coreRef.current?.destroy();
      coreRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (activeRom) {
      setIsCollapsed(false);
    }
  }, [activeRom]);

  const hasSelectedRom = selectedRom !== null;
  const selectedRomExtension = selectedRom?.name.toLowerCase().endsWith(".gbc")
    ? "gbc"
    : selectedRom?.name.toLowerCase().endsWith(".gb")
      ? "gb"
      : null;

  const compatibilityHint = useMemo(() => {
    if (!selectedRomExtension) {
      return null;
    }

    if (selectedRomExtension === "gb" && mode === "gbc") {
      return {
        tone: "info" as const,
        text: "ROM .GB e compativel com modo GBC.",
      };
    }

    if (selectedRomExtension === "gbc" && mode === "gb") {
      return {
        tone: "warning" as const,
        text: "Algumas ROMs .GBC possuem retrocompatibilidade em GB, mas podem perder recursos de cor.",
      };
    }

    return null;
  }, [mode, selectedRomExtension]);

  const setVirtualButtonState = (button: JoypadButton, pressed: boolean) => {
    setJoypad((current) => ({
      ...current,
      [button]: pressed,
    }));
  };

  const makeVirtualButtonHandlers = (button: JoypadButton) => ({
    onMouseDown: () => {
      setVirtualButtonState(button, true);
    },
    onMouseUp: () => {
      setVirtualButtonState(button, false);
    },
    onMouseLeave: () => {
      setVirtualButtonState(button, false);
    },
    onTouchStart: () => {
      setVirtualButtonState(button, true);
    },
    onTouchEnd: () => {
      setVirtualButtonState(button, false);
    },
    onTouchCancel: () => {
      setVirtualButtonState(button, false);
    },
  });

  return (
    <aside
      className={`emulator-panel is-open${isCollapsed ? " is-collapsed" : ""}`}
    >
      <div className="emulator-panel-header">
        <strong>Game Boy Color</strong>
        <button
          type="button"
          className="emulator-action emulator-collapse-toggle"
          onClick={() => {
            setIsCollapsed((current) => !current);
          }}
          title={
            isCollapsed
              ? "Expandir painel do emulador"
              : "Recolher painel do emulador"
          }
          aria-label={
            isCollapsed
              ? "Expandir painel do emulador"
              : "Recolher painel do emulador"
          }
          aria-expanded={!isCollapsed}
        >
          <FiChevronDown aria-hidden="true" />
        </button>
      </div>

      <div className="emulator-panel-body">
        <div className="emulator-controls-row">
          <label className="emulator-mode-select-wrap" htmlFor="emulator-mode">
            <span>Modo</span>
            <select
              id="emulator-mode"
              className="emulator-mode-select"
              value={mode}
              onChange={(event) => {
                onChangeMode(event.target.value as EmulatorMode);
              }}
              aria-label="Selecionar modo do emulador"
            >
              <option value="gb">GB</option>
              <option value="gbc">GBC</option>
            </select>
          </label>

          <button
            type="button"
            className="emulator-run-button"
            disabled={!hasSelectedRom || isLoadingRom}
            onClick={onRunSelectedRom}
          >
            <FiPlay aria-hidden="true" />
            <span>{isLoadingRom ? "Carregando..." : "Rodar"}</span>
          </button>

          <button
            type="button"
            className="emulator-secondary-button"
            disabled={!isRunning}
            onClick={() => {
              void (async () => {
                if (!coreRef.current || !activeRom) {
                  setStatusMessage("Nenhuma ROM ativa para reset.");
                  return;
                }

                try {
                  await coreRef.current.reset(mode);
                  setStatusMessage(`ROM resetada: ${activeRom.name}.`);
                } catch {
                  setStatusMessage("Falha ao resetar a ROM ativa.");
                }
              })();
            }}
          >
            <FiRefreshCw aria-hidden="true" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            className="emulator-secondary-button"
            disabled={!isRunning}
            onClick={() => {
              void coreRef.current?.stop();
              setIsRunning(false);
              setFps(null);
              setStatusMessage("Execução parada.");
            }}
          >
            <FiSquare aria-hidden="true" />
            <span>Parar</span>
          </button>
        </div>

        <div
          className="emulator-screen-shell"
          style={{
            width: `${viewportSize.width + 24}px`,
          }}
        >
          <div className="emulator-screen-meta" aria-live="polite">
            <span>160x144 para 320x288</span>
            <span>
              {isRunning && fps !== null ? `${Math.round(fps)} FPS` : "FPS --"}
            </span>
          </div>
          <canvas
            ref={canvasRef}
            className="emulator-screen"
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
          />
        </div>

        <div className="emulator-status" aria-live="polite">
          <div>{statusMessage}</div>
          <div>Modo atual: {mode.toUpperCase()}</div>
          <div>
            Selecionada: {selectedRom ? selectedRom.name : "nenhuma"} | Ativa:{" "}
            {activeRom ? activeRom.name : "nenhuma"}
          </div>
          {compatibilityHint ? (
            <div
              className={
                compatibilityHint.tone === "warning"
                  ? "emulator-status-warning"
                  : undefined
              }
            >
              {compatibilityHint.text}
            </div>
          ) : null}
          <div>
            Tamanho ROM:{" "}
            {romSizeBytes ? `${Math.ceil(romSizeBytes / 1024)} KB` : "-"}
          </div>
        </div>

        <div className="emulator-virtual-pad">
          <div className="emulator-dpad-grid">
            <button
              type="button"
              className={`pad-button pad-dir${joypad.up ? " is-pressed" : ""}`}
              {...makeVirtualButtonHandlers("up")}
            >
              Up
            </button>
            <button
              type="button"
              className={`pad-button pad-dir${joypad.left ? " is-pressed" : ""}`}
              {...makeVirtualButtonHandlers("left")}
            >
              Left
            </button>
            <button
              type="button"
              className={`pad-button pad-dir${joypad.right ? " is-pressed" : ""}`}
              {...makeVirtualButtonHandlers("right")}
            >
              Right
            </button>
            <button
              type="button"
              className={`pad-button pad-dir${joypad.down ? " is-pressed" : ""}`}
              {...makeVirtualButtonHandlers("down")}
            >
              Down
            </button>
          </div>

          <div className="emulator-action-pad">
            <button
              type="button"
              className={`pad-button pad-action${joypad.b ? " is-pressed" : ""}`}
              {...makeVirtualButtonHandlers("b")}
            >
              B
            </button>
            <button
              type="button"
              className={`pad-button pad-action${joypad.a ? " is-pressed" : ""}`}
              {...makeVirtualButtonHandlers("a")}
            >
              A
            </button>
          </div>
        </div>

        <div className="emulator-start-select">
          <button
            type="button"
            className={`pad-button pad-meta${joypad.select ? " is-pressed" : ""}`}
            {...makeVirtualButtonHandlers("select")}
          >
            Select
          </button>
          <button
            type="button"
            className={`pad-button pad-meta${joypad.start ? " is-pressed" : ""}`}
            {...makeVirtualButtonHandlers("start")}
          >
            Start
          </button>
        </div>

        <div className="emulator-keyboard-hint">
          Teclado: setas = direcional, Z = B, X = A, Enter = Start, Shift =
          Select.
        </div>
      </div>
    </aside>
  );
}
