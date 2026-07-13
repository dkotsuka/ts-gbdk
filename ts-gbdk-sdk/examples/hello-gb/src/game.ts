// hello-gb: exemplo de jogo minimo usando subconjunto ts-gbdk-sdk
// Tipos: u8 = uint8_t, u16 = uint16_t, void = void
// Funcoes sdk.X() sao mapeadas diretamente para GBDK (ex: sdk.joypad() -> joypad())

declare function joypad(): u8;
declare function move_sprite(idx: u8, x: u8, y: u8): void;

let playerX: u8 = 80;
let playerY: u8 = 72;

const SPEED: u8 = 1;
const J_LEFT: u8 = 0x20;
const J_RIGHT: u8 = 0x10;
const J_UP: u8 = 0x40;
const J_DOWN: u8 = 0x80;

function clamp(val: u8, min: u8, max: u8): u8 {
  if (val < min) {
    return min;
  }
  if (val > max) {
    return max;
  }
  return val;
}

function handleInput(): void {
  const pad: u8 = joypad();

  if ((pad & J_LEFT) !== 0) {
    playerX = playerX - SPEED;
  }
  if ((pad & J_RIGHT) !== 0) {
    playerX = playerX + SPEED;
  }
  if ((pad & J_UP) !== 0) {
    playerY = playerY - SPEED;
  }
  if ((pad & J_DOWN) !== 0) {
    playerY = playerY + SPEED;
  }

  playerX = clamp(playerX, 8, 160);
  playerY = clamp(playerY, 16, 144);
}

function updateFrame(): void {
  handleInput();
  move_sprite(0, playerX, playerY);
}
