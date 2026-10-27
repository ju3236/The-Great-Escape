// 12×12 도트 아이콘과 캐릭터 초상화. 한 글자 = 한 픽셀, '.'은 투명.
const PIXEL_PALETTE = {
  k: '#0b0b0a', // 외곽선
  K: '#24251f', // 아주 어두운 면
  d: '#3d3f37', // 어두운 회색
  g: '#5f6157', // 회색
  m: '#8d8d7d', // 금속
  w: '#bdb59b', // 낡은 흰색
  y: '#8f7a32', // 바랜 노랑
  Y: '#c9b453', // 형광 노랑
  o: '#5c4128', // 나무
  b: '#36261a', // 짙은 나무
  r: '#6e221c', // 검붉은색
  R: '#a3362b', // 핏빛
  G: '#3f5534', // 짙은 녹색
  A: '#6b8550', // 녹색
  B: '#36465a', // 짙은 청색
  c: '#56697a', // 유리
  s: '#b8977a', // 피부
  p: '#8a6c58', // 피부 그늘
};

const PIXEL_ICONS = {
  clock: [
    '...kkkkkk...',
    '..kwwwwwwk..',
    '.kwwwwkwwwk.',
    'kwwwwwkwwwwk',
    'kwwwwwkwwwwk',
    'kwwwwwkkkwwk',
    'kwwwwwwwwwwk',
    'kwwwwwwwwwwk',
    '.kwwwwwwwwk.',
    '..kwwwwwwk..',
    '...kkkkkk...',
    '....kddk....',
  ],
  bed: [
    '............',
    'k...........',
    'kk..........',
    'kok.........',
    'kokww.......',
    'kokwwkkkkkkk',
    'kokBBBBBBBBk',
    'kokBBBBBBBBk',
    'kooooooooook',
    'kbbbbbbbbbbk',
    'kk........kk',
    'kk........kk',
  ],
  padlock: [
    '....kkkk....',
    '...kmmmmk...',
    '..kmk..kmk..',
    '..km....mk..',
    '..km....mk..',
    '.kkkkkkkkkk.',
    '.kyyyyyyyyk.',
    '.kyyykkyyyk.',
    '.kyyykkyyyk.',
    '.kyyyyyyyyk.',
    '.kyyyyyyyyk.',
    '.kkkkkkkkkk.',
  ],
  door: [
    '..kkkkkkkk..',
    '..koooooook.',
    '..kobbbbbok.',
    '..koboobbok.',
    '..kobbbbbok.',
    '..koooooyok.',
    '..kobbbbbok.',
    '..koboobbok.',
    '..kobbbbbok.',
    '..koooooook.',
    '..koooooook.',
    'kkkkkkkkkkkk',
  ],
  graffiti: [
    'kkkkkkkkkkkk',
    'kddddddddddk',
    'kdRdRdRdRddk',
    'kdRdRdRdRRdk',
    'kdRdRdRRRddk',
    'kdRdRRRdRddk',
    'kdRRRdRdRddk',
    'kRRdRdRdRddk',
    'kdRdRdRdRddk',
    'kddddddddddk',
    'kdgddddddgdk',
    'kkkkkkkkkkkk',
  ],
  board: [
    'kkkkkkkkkkkk',
    'kwwwwwwwwwwk',
    'kwRwRwwwwwwk',
    'kwwRwwwBBwwk',
    'kwRwRwwwwwwk',
    'kwwwwwBBBBwk',
    'kwwwwwwwwwwk',
    'kkkkkkkkkkkk',
    '...k....k...',
    '..k......k..',
    '.k........k.',
    'k..........k',
  ],
  mirror: [
    '....kkkk....',
    '...kcccck...',
    '..kccwccck..',
    '..kcwcckck..',
    '..kccckcck..',
    '..kcckccck..',
    '..kckcccck..',
    '..kcccccck..',
    '...kcccck...',
    '....kkkk....',
    '.....oo.....',
    '...oooooo...',
  ],
  keypad: [
    'kkkkkkkkkkkk',
    'kKKKKKKKKKKk',
    'kKAAAAAAAAKk',
    'kKKKKKKKKKKk',
    'kKmmKmmKmmKk',
    'kKKKKKKKKKKk',
    'kKmmKmmKmmKk',
    'kKKKKKKKKKKk',
    'kKmmKmmKmmKk',
    'kKKKKKKKKKKk',
    'kKKKmmKKRRKk',
    'kkkkkkkkkkkk',
  ],
  plank: [
    '............',
    '............',
    '............',
    '.gg......gg.',
    'kkkkkkkkkkkk',
    'kooooooooook',
    'kobooooobook',
    'kooooooooook',
    'kkkkkkkkkkkk',
    '.gg......gg.',
    '............',
    '............',
  ],
  doorlock: [
    '..kkkkkkkk..',
    '..kddddddk..',
    '..kdAAAAdk..',
    '..kddddddk..',
    '..kmdmdmdk..',
    '..kddddddk..',
    '..kmdmdmdk..',
    '..kddddddk..',
    '..kmdmdmdk..',
    '..kddddddk..',
    '..kddRRddk..',
    '..kkkkkkkk..',
  ],
  power: [
    'kkkkkkkkkkkk',
    'kggggggggggk',
    'kggggYYggggk',
    'kgggYYgggggk',
    'kggYYYYYgggk',
    'kgggggYYgggk',
    'kggggYYggggk',
    'kgggYYgggggk',
    'kggggggggggk',
    'kgKKgggKKggk',
    'kggggggggggk',
    'kkkkkkkkkkkk',
  ],
  book: [
    '............',
    '.kkkkkkkkkk.',
    '.kbrrrrrrrk.',
    '.kbrwwwwwrk.',
    '.kbrrrrrrrk.',
    '.kbrrrrrrrk.',
    '.kbrrrrrrrk.',
    '.kbrrrrrrrk.',
    '.kbrrrrrrrk.',
    '.kbwwwwwwwk.',
    '.kkkkkkkkkk.',
    '............',
  ],
  frame: [
    'kkkkkkkkkkkk',
    'kooooooooook',
    'kokkkkkkkkok',
    'kokcccccckok',
    'kokccsscckok',
    'kokccsscckok',
    'kokcddddckok',
    'kokddddddkok',
    'kokddddddkok',
    'kokkkkkkkkok',
    'kooooooooook',
    'kkkkkkkkkkkk',
  ],
  cabinet: [
    '..kkkkkkkk..',
    '..kggggggk..',
    '..kgkkkkgk..',
    '..kgkmmkgk..',
    '..kgkkkkgk..',
    '..kggggggk..',
    '..kkkkkkkk..',
    '..kgkkkkgk..',
    '..kgkmmkgk..',
    '..kgkkkkgk..',
    '..kggggggk..',
    '..kkkkkkkk..',
  ],
  monitor: [
    'kkkkkkkkkkkk',
    'kddddddddddk',
    'kdGGGGGGGGdk',
    'kdAAAAAAAAdk',
    'kdGGkGGGGGdk',
    'kdGkkkGGGGdk',
    'kdGGGGGGGGdk',
    'kdAAAAAAAAdk',
    'kddddddRdddk',
    'kkkkkkkkkkkk',
    '....kddk....',
    '..kkkkkkkk..',
  ],
  keybox: [
    'kkkkkkkkkkkk',
    'kooooooooook',
    'kobbbbbbbbok',
    'kobmbmbmbbok',
    'kobbbbbybbok',
    'kobbbbyybbok',
    'kobbbbbybbok',
    'kobbbbyybbok',
    'kobbbbbbbbok',
    'kooooooooook',
    'kkkkkkkkkkkk',
    '............',
  ],
  note: [
    '..kkkkkkk...',
    '..kwwwwwkk..',
    '..kwwwwwwk..',
    '..kwddddwk..',
    '..kwwwwwwk..',
    '..kwdddwwk..',
    '..kwwwwwwk..',
    '..kwddddwk..',
    '..kwwwwwwk..',
    '..kwRRwwwk..',
    '..kwwwwwwk..',
    '..kkkkkkkk..',
  ],
  card: [
    '............',
    '............',
    'kkkkkkkkkkkk',
    'kwwwwwwwwwwk',
    'kwBBwwwwwwwk',
    'kwBBwddddwwk',
    'kwwwwwwwwwwk',
    'kKKKKKKKKKKk',
    'kwwwwwwwwwwk',
    'kkkkkkkkkkkk',
    '............',
    '............',
  ],
  screwdriver: [
    '..........kk',
    '.........kmk',
    '........kmk.',
    '.......kmk..',
    '......kmk...',
    '.....kmk....',
    '....kRk.....',
    '...kRRRk....',
    '..kRRRk.....',
    '.kRRRk......',
    'kRRRk.......',
    'kkk.........',
  ],
  key: [
    '............',
    '............',
    '..kkkk......',
    '.kyyyyk.....',
    'kyykkyykkkkk',
    'kyk..kyyyyyk',
    'kyykkyykykyk',
    '.kyyyyk.k.k.',
    '..kkkk......',
    '............',
    '............',
    '............',
  ],
  fuse: [
    '....kkkk....',
    '....kmmk....',
    '...kkkkkk...',
    '...kcccck...',
    '...kcYcck...',
    '...kccYck...',
    '...kcYcck...',
    '...kccYck...',
    '...kcccck...',
    '...kkkkkk...',
    '....kmmk....',
    '....kkkk....',
  ],
  pin: [
    '...kkkkkk...',
    '..kRRRRRRk..',
    '.kRRRkkRRRk.',
    '.kRRkwwkRRk.',
    '.kRRkwwkRRk.',
    '.kRRRkkRRRk.',
    '..kRRRRRRk..',
    '...kRRRRk...',
    '....kRRk....',
    '.....kk.....',
    '............',
    '............',
  ],
  eye: [
    '............',
    '............',
    '............',
    '....kkkk....',
    '..kkwwwwkk..',
    '.kwwwkkwwwk.',
    'kwwwkcckwwwk',
    '.kwwwkkwwwk.',
    '..kkwwwwkk..',
    '....kkkk....',
    '............',
    '............',
  ],
  brain: [
    '............',
    '....kkkk....',
    '..kkspspkk..',
    '.kspsspsspk.',
    'kssppssppssk',
    'kpssspssspsk',
    'kssppsspsssk',
    '.kspsspsspk.',
    '..kkspspkk..',
    '....kkkk....',
    '............',
    '............',
  ],
  fist: [
    '............',
    '..kkkkkkkk..',
    '.kskskskssk.',
    '.kskskskssk.',
    '.kkkkkkkssk.',
    '.kssssssssk.',
    '.kssssssssk.',
    '..ksssssssk.',
    '...kssssssk.',
    '...kBBBBBBk.',
    '...kBBBBBBk.',
    '...kkkkkkkk.',
  ],
  clover: [
    '............',
    '..kkk..kkk..',
    '.kAAAkkAAAk.',
    '.kAAAAAAAAk.',
    '..kAAAAAAk..',
    '.kAAAAAAAAk.',
    '.kAAAkkAAAk.',
    '..kkk..kkk..',
    '.....kGk....',
    '......kGk...',
    '.......kk...',
    '............',
  ],
  bulb: [
    '....kkkk....',
    '..kkYYYYkk..',
    '.kYYwYYYYYk.',
    '.kYwYYYYYYk.',
    '.kYYYYYYYYk.',
    '.kYYYYYYYYk.',
    '..kYYYYYYk..',
    '...kYYYYk...',
    '...kmmmmk...',
    '...kggggk...',
    '...kmmmmk...',
    '....kkkk....',
  ],
  hourglass: [
    'kkkkkkkkkkkk',
    '.kyyyyyyyyk.',
    '..kyyyyyyk..',
    '...kyyyyk...',
    '....kyyk....',
    '.....kk.....',
    '....kwyk....',
    '...kwwyyk...',
    '..kwyyyyyk..',
    '.kyyyyyyyyk.',
    'kkkkkkkkkkkk',
    '............',
  ],
  skull: [
    '...kkkkkk...',
    '..kwwwwwwk..',
    '.kwwwwwwwwk.',
    '.kwwwwwwwwk.',
    '.kwkkwwkkwk.',
    '.kwkkwwkkwk.',
    '.kwwwkkwwwk.',
    '..kwwwwwwk..',
    '...kwkwkwk..',
    '...kkkkkkk..',
    '............',
    '............',
  ],
};

// 캐릭터 초상화: 기본 얼굴에 행 단위로 덮어써서 변형을 만든다.
// H = 테마색(머리카락), D = 테마색 어둡게, C = 옷
const SPRITE_BASE = [
  '...HHHHHH...',
  '..HHHHHHHH..',
  '.HHHHHHHHHH.',
  '.HHssssssHH.',
  '.HssksskssH.',
  '.HssssssssH.',
  '..sssppsss..',
  '...ssssss...',
  '..CCCssCCC..',
  '.CCCCCCCCCC.',
  'CCCCCCCCCCCC',
  'CCCCCCCCCCCC',
];
const SPRITES = {
  short: { label: '단발', rows: {} },
  long: {
    label: '장발',
    rows: {
      4: 'HHssksskssHH', 5: 'HHssssssssHH', 6: 'HHsssppsssHH', 7: 'HHHssssssHHH', 8: 'HHCCCssCCCHH',
    },
  },
  cap: { label: '모자', rows: { 0: '...DDDDDD...', 1: '..DDDDDDDD..', 2: '.DDDDDDDDDDD' } },
  glasses: { label: '안경', rows: { 4: '.HskwkkwksH.' } },
  cat: { label: '고양이귀', rows: { 0: '.HH......HH.', 1: '.HHHHHHHHHH.' } },
  bunny: { label: '토끼귀', rows: { 0: '..ww....ww..', 1: '..HHHHHHHH..' } },
  hood: {
    label: '후드',
    rows: {
      3: '.HHkkkkkkHH.', 6: '.HsssppsssH.', 7: '.HHssssssHH.', 8: '.HHCCssCCHH.',
    },
  },
  mask: { label: '마스크', rows: { 6: '..wwwwwwww..', 7: '...wwwwww...' } },
};

function shade(hex, amount) {
  const n = parseInt(String(hex).replace('#', ''), 16) || 0x888888;
  const f = (v) => Math.round(v * (1 - amount));
  const r = f(n >> 16 & 255), g = f(n >> 8 & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function gridToSvg(rows, palette, size, cls = 'px-icon') {
  let rects = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let run = 1;
      while (row[x + run] === ch) run++;
      if (ch !== '.' && palette[ch]) rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${palette[ch]}"/>`;
      x += run;
    }
  });
  const w = rows[0].length;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 ${w} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

const pixCache = new Map();
function pix(name, size = 24, overrides) {
  const key = `${name}|${size}|${overrides ? JSON.stringify(overrides) : ''}`;
  if (!pixCache.has(key)) {
    const rows = PIXEL_ICONS[name] || PIXEL_ICONS.padlock;
    pixCache.set(key, gridToSvg(rows, overrides ? { ...PIXEL_PALETTE, ...overrides } : PIXEL_PALETTE, size));
  }
  return pixCache.get(key);
}

function spriteSvg(variant, color, size) {
  const v = SPRITES[variant] || SPRITES.short;
  const rows = SPRITE_BASE.map((row, i) => v.rows[i] || row);
  const palette = { ...PIXEL_PALETTE, H: color, D: shade(color, 0.35), C: shade(color, 0.6) };
  return gridToSvg(rows, palette, size, 'px-sprite');
}

if (typeof module !== 'undefined') module.exports = { SPRITES };
