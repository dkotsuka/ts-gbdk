export type DocumentationStatus = "ready" | "declare" | "limited";

export type DocumentationEntry = {
  id: string;
  name: string;
  header: string;
  category: string;
  usageSummary: string;
  cSignature: string;
  tsDeclaration: string;
  tsUsage: string;
  notes: string;
  status: DocumentationStatus;
};

export type DocumentationGroup = {
  id: string;
  title: string;
  description: string;
  entries: DocumentationEntry[];
};

export type DocumentationCatalogContext = {
  projectName: string | null;
  hasProject: boolean;
  hasMainFile: boolean;
};

export const DOCUMENTATION_GROUPS: DocumentationGroup[] = [
  {
    id: "input-timing",
    title: "Input e Timing",
    description:
      "Funcoes basicas para leitura de controle e sincronizacao de frame.",
    entries: [
      {
        id: "joypad",
        name: "joypad",
        header: "<gb/gb.h>",
        category: "input",
        usageSummary: "Leitura do estado atual dos botoes do controle.",
        cSignature: "uint8_t joypad(void);",
        tsDeclaration: "declare function joypad(): u8;",
        tsUsage: "const pad: u8 = joypad();",
        notes:
          "Use mascaras de botoes para validar direcoes e acoes dentro de updateFrame.",
        status: "ready",
      },
      {
        id: "vsync",
        name: "vsync",
        header: "<gb/gb.h>",
        category: "timing",
        usageSummary: "Sincroniza o loop com o v-blank para evitar tearing.",
        cSignature: "void vsync(void);",
        tsDeclaration: "declare function vsync(): void;",
        tsUsage: "vsync();",
        notes:
          "O loop gerado pelo compilador ja chama vsync; evite duplicar sem necessidade.",
        status: "ready",
      },
      {
        id: "delay",
        name: "delay",
        header: "<gb/gb.h>",
        category: "timing",
        usageSummary: "Pausa curta em milissegundos entre estados de jogo.",
        cSignature: "void delay(uint16_t ms);",
        tsDeclaration: "declare function delay(ms: u16): void;",
        tsUsage: "delay(50);",
        notes:
          "Util para pausas curtas em estados de menu, evitando loops ocupados.",
        status: "declare",
      },
    ],
  },
  {
    id: "sprites-bg",
    title: "Sprites e Background",
    description:
      "Carregamento de tiles e posicionamento de sprites para a cena principal.",
    entries: [
      {
        id: "set-sprite-data",
        name: "set_sprite_data",
        header: "<gb/gb.h>",
        category: "sprites",
        usageSummary: "Carrega tiles graficos para a memoria de sprites.",
        cSignature:
          "void set_sprite_data(uint8_t first_tile, uint8_t nb_tiles, const uint8_t *data);",
        tsDeclaration:
          "declare function set_sprite_data(firstTile: u8, tileCount: u8, data: u8[]): void;",
        tsUsage: "set_sprite_data(0, 1, spriteTiles);",
        notes:
          "Prefira arrays estaticos (u8[]) para dados de tile no subconjunto atual.",
        status: "limited",
      },
      {
        id: "set-sprite-tile",
        name: "set_sprite_tile",
        header: "<gb/gb.h>",
        category: "sprites",
        usageSummary: "Define qual tile grafico sera usado por um sprite.",
        cSignature: "void set_sprite_tile(uint8_t nb, uint8_t tile);",
        tsDeclaration:
          "declare function set_sprite_tile(id: u8, tile: u8): void;",
        tsUsage: "set_sprite_tile(0, 0);",
        notes: "Defina o tile do sprite antes de chamar move_sprite no frame.",
        status: "declare",
      },
      {
        id: "move-sprite",
        name: "move_sprite",
        header: "<gb/gb.h>",
        category: "sprites",
        usageSummary: "Move o sprite para uma posicao (x, y) na tela.",
        cSignature: "void move_sprite(uint8_t nb, uint8_t x, uint8_t y);",
        tsDeclaration:
          "declare function move_sprite(id: u8, x: u8, y: u8): void;",
        tsUsage: "move_sprite(0, playerX, playerY);",
        notes: "Funcao essencial para jogos de acao em updateFrame.",
        status: "ready",
      },
      {
        id: "set-bkg-tiles",
        name: "set_bkg_tiles",
        header: "<gb/gb.h>",
        category: "background",
        usageSummary: "Escreve blocos de tiles no mapa de background.",
        cSignature:
          "void set_bkg_tiles(uint8_t x, uint8_t y, uint8_t w, uint8_t h, const uint8_t *tiles);",
        tsDeclaration:
          "declare function set_bkg_tiles(x: u8, y: u8, w: u8, h: u8, tiles: u8[]): void;",
        tsUsage: "set_bkg_tiles(0, 0, 20, 18, mapTiles);",
        notes:
          "Recomendado carregar mapa em blocos pequenos para facilitar debug de indices.",
        status: "limited",
      },
    ],
  },
  {
    id: "metasprites-font-platform",
    title: "Metasprites, Font e Platform",
    description:
      "Recursos utilitarios para layout visual e adaptacao de plataforma.",
    entries: [
      {
        id: "move-metasprite",
        name: "move_metasprite",
        header: "<gb/metasprites.h>",
        category: "metasprites",
        usageSummary: "Move um personagem composto por varios sprites.",
        cSignature:
          "uint8_t move_metasprite(const metasprite_t* metasprite, uint8_t base_tile, uint8_t base_prop, uint8_t x, uint8_t y);",
        tsDeclaration:
          "declare function move_metasprite(data: u8[], baseTile: u8, baseProp: u8, x: u8, y: u8): u8;",
        tsUsage: "move_metasprite(heroMeta, 0, 0, playerX, playerY);",
        notes:
          "No MVP, trate dados de metasprite como array estatico e evite estruturas dinamicas.",
        status: "limited",
      },
      {
        id: "font-init",
        name: "font_init",
        header: "<gbdk/font.h>",
        category: "font",
        usageSummary: "Inicializa a fonte para texto e UI no jogo.",
        cSignature: "void font_init(void);",
        tsDeclaration: "declare function font_init(): void;",
        tsUsage: "font_init();",
        notes:
          "Use no setup inicial para preparar texto em UI e debug overlays.",
        status: "declare",
      },
      {
        id: "cpu-cgb",
        name: "_cpu",
        header: "<gbdk/platform.h>",
        category: "platform",
        usageSummary: "Detecta modo de CPU para adaptar logica GB/GBC.",
        cSignature: "extern uint8_t _cpu;",
        tsDeclaration: "declare const _cpu: u8;",
        tsUsage: "const isCgb: bool = _cpu !== 0;",
        notes: "Constante util para caminhos condicionais entre GB e GBC.",
        status: "declare",
      },
    ],
  },
];

export const DOCUMENTATION_ENTRIES: DocumentationEntry[] =
  DOCUMENTATION_GROUPS.flatMap((group) => group.entries);

export function findDocumentationEntryById(
  entryId: string,
): DocumentationEntry | null {
  return DOCUMENTATION_ENTRIES.find((entry) => entry.id === entryId) ?? null;
}
