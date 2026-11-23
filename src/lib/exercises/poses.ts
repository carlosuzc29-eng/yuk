import type { MovementPattern } from '@/types/training';
import type { FrontPose, SidePose, V } from './rig';

/** Elementos fijos del escenario (bancos, barras, cajones…). */
export type Scene =
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number; rot?: number }
  | { t: 'line'; a: V; b: V; w: number }
  | { t: 'circle'; c: V; r: number };

/** Almohadillas que acompañan al cuerpo (se calculan con el esqueleto en cada frame). */
export type Pad = 'backpad' | 'chestpad' | 'anklepad' | 'anklepad_back' | 'thighpad' | 'hippad';

interface Base {
  /** Indicación de la fase A→B. */
  toB: string;
  /** Indicación de la fase B→A. */
  toA: string;
  /** true si A→B es la fase excéntrica (bajada controlada). */
  bIsEccentric: boolean;
  /** Ejercicio isométrico o de desplazamiento (ritmo constante). */
  steady?: boolean;
  scene?: Scene[];
  pads?: Pad[];
  /** Punto de anclaje para polea o banda. */
  anchor?: V;
  /** La polea se engancha al tobillo en lugar de a la mano. */
  anchorAtAnkle?: boolean;
  ground?: boolean;
}

export type PatternDef =
  | (Base & { view: 'side'; a: SidePose; b: SidePose })
  | (Base & { view: 'front'; a: FrontPose; b: FrontPose });

const G = 182; // suelo
const bench = (x: number, w: number, top = 150): Scene[] => [
  { t: 'rect', x, y: top, w, h: 7, r: 3 },
  { t: 'line', a: [x + 8, top + 7], b: [x + 8, G], w: 3 },
  { t: 'line', a: [x + w - 8, top + 7], b: [x + w - 8, G], w: 3 },
];
const seat = (x: number, w: number, top: number): Scene[] => [
  { t: 'rect', x, y: top, w, h: 7, r: 3 },
  { t: 'line', a: [x + w / 2, top + 7], b: [x + w / 2, G], w: 4 },
  { t: 'line', a: [x + 4, G], b: [x + w - 4, G], w: 4 },
];
const postBar = (x1: number, x2: number, y: number): Scene[] => [
  { t: 'line', a: [x1, y], b: [x2, y], w: 3 },
  { t: 'line', a: [x2, y], b: [x2, G], w: 3 },
];

// Posturas de pie reutilizables
const STAND: SidePose = {
  hip: [99, 95],
  torso: 180,
  hand: [2, 57],
  handFrom: 'shoulder',
  ankle: [101, 178],
};

// Tumbado en banco: la cadera apoya cerca del final del banco y los pies quedan firmes en el suelo,
// por delante de las rodillas (muslo casi horizontal, tibia casi vertical).
const SUPINE_BENCH = { hip: [108, 140] as V, torso: 270, ankle: [150, 180] as V, kneeDir: [0.25, -1] as V };

export const PATTERNS: Record<MovementPattern, PatternDef> = {
  // ───────── Piernas ─────────
  squat_back: {
    view: 'side',
    a: { hip: [97, 95], torso: 175, hand: [98, 47], ankle: [98, 178], elbowDir: [-1, 1] },
    b: { hip: [72, 140], torso: 140, hand: [102, 103], ankle: [98, 178], elbowDir: [-1, 1] },
    toB: 'Baja controlado, cadera atrás', toA: 'Sube empujando el suelo', bIsEccentric: true,
  },
  squat_front: {
    view: 'side',
    a: { hip: [97, 95], torso: 178, hand: [14, 18], handFrom: 'shoulder', ankle: [98, 178], elbowDir: [0, 1] },
    b: { hip: [76, 138], torso: 158, hand: [14, 18], handFrom: 'shoulder', ankle: [98, 178], elbowDir: [0, 1] },
    toB: 'Baja con el torso erguido', toA: 'Sube empujando con todo el pie', bIsEccentric: true,
  },
  squat_machine: {
    view: 'side',
    a: { hip: [92, 100], torso: 195, hand: [7, 4], handFrom: 'shoulder', ankle: [114, 176], elbowDir: [1, 1] },
    b: { hip: [76, 150], torso: 195, hand: [7, 4], handFrom: 'shoulder', ankle: [114, 176], elbowDir: [1, 1] },
    toB: 'Baja controlado 2–3 s', toA: 'Empuja la plataforma', bIsEccentric: true,
    pads: ['backpad'],
  },
  leg_press: {
    view: 'side',
    a: { hip: [80, 150], torso: 215, hand: [88, 150], ankle: [136, 94], toe: [-9, -9], elbowDir: [0, 1], kneeDir: [-0.3, -1] },
    b: { hip: [80, 150], torso: 215, hand: [88, 150], ankle: [110, 120], toe: [-9, -9], elbowDir: [0, 1], kneeDir: [-0.3, -1] },
    toB: 'Baja la plataforma controlando', toA: 'Empuja sin bloquear rodillas', bIsEccentric: true,
    pads: ['backpad'],
    scene: [{ t: 'rect', x: 60, y: 152, w: 34, h: 6, r: 3 }, { t: 'line', a: [77, 158], b: [77, G], w: 4 }],
  },
  lunge: {
    view: 'side',
    a: { hip: [99, 95], torso: 180, hand: [2, 57], handFrom: 'shoulder', ankle: [101, 178], ankle2: [99, 178] },
    b: {
      hip: [95, 134], torso: 178, hand: [2, 57], handFrom: 'shoulder',
      ankle: [126, 178], ankle2: [64, 172], toe2: [10, 8], kneeDir2: [0, 1],
    },
    toB: 'Paso largo y baja vertical', toA: 'Empuja con el talón delantero', bIsEccentric: true,
  },
  split_squat_rear: {
    view: 'side',
    a: {
      hip: [92, 100], torso: 172, hand: [2, 57], handFrom: 'shoulder',
      ankle: [120, 178], ankle2: [54, 146], toe2: [-12, 2], kneeDir2: [0, 1],
    },
    b: {
      hip: [88, 136], torso: 165, hand: [2, 57], handFrom: 'shoulder',
      ankle: [120, 178], ankle2: [54, 146], toe2: [-12, 2], kneeDir2: [0, 1],
    },
    toB: 'Baja controlado sobre la pierna delantera', toA: 'Sube con el pie delantero', bIsEccentric: true,
    scene: bench(28, 34, 150),
  },
  step_up: {
    view: 'side',
    a: {
      hip: [96, 112], torso: 168, hand: [2, 57], handFrom: 'shoulder',
      ankle: [122, 146], ankle2: [88, 178], kneeDir2: [1, 0],
    },
    b: {
      hip: [116, 64], torso: 178, hand: [2, 57], handFrom: 'shoulder',
      ankle: [120, 146], ankle2: [104, 128], toe2: [10, 8],
    },
    toB: 'Sube empujando con la pierna de arriba', toA: 'Baja controlado', bIsEccentric: false,
    scene: [{ t: 'rect', x: 108, y: 150, w: 46, h: 32, r: 3 }],
  },
  hinge: {
    view: 'side',
    a: { hip: [99, 96], torso: 180, hand: [3, 57], handFrom: 'shoulder', ankle: [102, 178] },
    b: { hip: [60, 108], torso: 100, hand: [-1, 56], handFrom: 'shoulder', ankle: [102, 178] },
    toB: 'Cadera atrás, espalda neutra', toA: 'Empuja la cadera al frente', bIsEccentric: true,
  },
  good_morning: {
    view: 'side',
    a: { hip: [97, 95], torso: 178, hand: [-3, 3], handFrom: 'shoulder', ankle: [98, 178], elbowDir: [-1, 1] },
    b: { hip: [66, 106], torso: 100, hand: [-3, 3], handFrom: 'shoulder', ankle: [98, 178], elbowDir: [-1, 1] },
    toB: 'Inclina con la espalda neutra', toA: 'Vuelve apretando glúteos', bIsEccentric: true,
  },
  hip_thrust: {
    view: 'side',
    // Pies fijos y algo adelantados: arriba del todo el muslo queda horizontal y la tibia vertical (rodilla ~90°).
    a: { hip: [90, 168], torso: 212, hand: [4, -9], handFrom: 'hip', ankle: [150, 178], kneeDir: [0.3, -1], elbowDir: [0, 1] },
    b: { hip: [112, 128], torso: 265, hand: [4, -9], handFrom: 'hip', ankle: [150, 178], kneeDir: [0.3, -1], elbowDir: [0, 1] },
    toB: 'Eleva la cadera, aprieta glúteos', toA: 'Baja controlado', bIsEccentric: false,
    scene: bench(30, 34, 132),
  },
  glute_bridge: {
    view: 'side',
    a: { hip: [100, 172], torso: 270, hand: [88, 178], ankle: [130, 178], kneeDir: [0, -1], elbowDir: [0, 1] },
    b: { hip: [104, 146], torso: 295, hand: [88, 178], ankle: [130, 178], kneeDir: [0, -1], elbowDir: [0, 1] },
    toB: 'Eleva la cadera y pausa', toA: 'Baja lento', bIsEccentric: false,
  },
  leg_extension: {
    view: 'side',
    a: { hip: [78, 124], torso: 184, hand: [86, 130], ankle: [122, 166], toe: [13, 4], kneeDir: [1, -1], elbowDir: [0, 1] },
    b: { hip: [78, 124], torso: 184, hand: [86, 130], ankle: [162, 128], toe: [3, -13], kneeDir: [1, -1], elbowDir: [0, 1] },
    toB: 'Extiende y aprieta 1 s', toA: 'Baja en 2–3 s', bIsEccentric: false,
    scene: seat(56, 64, 131), pads: ['backpad', 'anklepad'],
  },
  leg_curl_seated: {
    view: 'side',
    a: { hip: [78, 124], torso: 184, hand: [86, 130], ankle: [162, 128], toe: [3, -13], kneeDir: [1, -1], elbowDir: [0, 1] },
    b: { hip: [78, 124], torso: 184, hand: [86, 130], ankle: [112, 162], toe: [12, 6], kneeDir: [1, -1], elbowDir: [0, 1] },
    toB: 'Flexiona llevando el talón abajo', toA: 'Vuelve despacio', bIsEccentric: false,
    scene: seat(56, 64, 131), pads: ['backpad', 'anklepad_back', 'thighpad'],
  },
  leg_curl_lying: {
    view: 'side',
    a: { hip: [122, 142], torso: 90, hand: [196, 162], ankle: [36, 146], toe: [-2, 12], elbowDir: [0, 1], kneeDir: [0, 1] },
    b: { hip: [122, 142], torso: 90, hand: [196, 162], ankle: [90, 106], toe: [-12, -2], elbowDir: [0, 1], kneeDir: [0, 1] },
    toB: 'Lleva los talones a los glúteos', toA: 'Baja en 2–3 s', bIsEccentric: false,
    scene: [{ t: 'rect', x: 74, y: 151, w: 130, h: 7, r: 3 }, { t: 'line', a: [90, 158], b: [90, G], w: 3 }, { t: 'line', a: [190, 158], b: [190, G], w: 3 }],
    pads: ['anklepad_back'],
  },
  nordic_curl: {
    view: 'side',
    a: { hip: [101, 132], torso: 180, hand: [12, 18], handFrom: 'shoulder', ankle: [60, 176], toe: [-8, 6], kneeDir: [1, 1], elbowDir: [0, 1] },
    b: { hip: [134, 148], torso: 130, hand: [14, 40], handFrom: 'shoulder', ankle: [60, 176], toe: [-8, 6], kneeDir: [1, 1], elbowDir: [0, 1] },
    toB: 'Déjate caer lo más lento posible', toA: 'Vuelve ayudándote con las manos', bIsEccentric: true,
    scene: [{ t: 'rect', x: 48, y: 166, w: 12, h: 10, r: 3 }],
  },
  calf_raise: {
    view: 'side',
    a: { hip: [99, 95], torso: 180, hand: [8, 4], handFrom: 'shoulder', ankle: [100, 178], toe: [13, 4], elbowDir: [0, 1] },
    b: { hip: [98, 83], torso: 180, hand: [8, 4], handFrom: 'shoulder', ankle: [99, 166], toe: [14, 16], elbowDir: [0, 1] },
    toB: 'Sube al máximo y aprieta', toA: 'Baja hasta estirar y pausa', bIsEccentric: false,
  },
  calf_raise_seated: {
    view: 'side',
    a: { hip: [80, 124], torso: 182, hand: [120, 114], ankle: [122, 170], toe: [13, 4], kneeDir: [1, -1], elbowDir: [0, 1] },
    b: { hip: [80, 118], torso: 182, hand: [120, 108], ankle: [122, 160], toe: [13, 12], kneeDir: [1, -1], elbowDir: [0, 1] },
    toB: 'Sube los talones y aprieta', toA: 'Baja al máximo', bIsEccentric: false,
    scene: seat(58, 52, 131), pads: ['thighpad'],
  },

  // ───────── Pecho / empuje ─────────
  bench_press: {
    view: 'side',
    a: { ...SUPINE_BENCH, hand: [58, 88], elbowDir: [0, 1] },
    b: { ...SUPINE_BENCH, hand: [68, 124], elbowDir: [0, 1] },
    toB: 'Baja a la parte baja del pecho', toA: 'Empuja hasta extender', bIsEccentric: true,
    scene: bench(24, 102, 150),
  },
  incline_press: {
    view: 'side',
    a: { hip: [100, 146], torso: 240, hand: [60, 64], ankle: [128, 178], elbowDir: [0.2, 1] },
    b: { hip: [100, 146], torso: 240, hand: [72, 104], ankle: [128, 178], elbowDir: [0.2, 1] },
    toB: 'Baja al pecho alto', toA: 'Empuja arriba', bIsEccentric: true,
    pads: ['backpad'], scene: seat(84, 34, 152),
  },
  chest_press_machine: {
    view: 'side',
    a: { hip: [84, 128], torso: 186, hand: [134, 82], ankle: [118, 178], elbowDir: [-1, 0.4] },
    b: { hip: [84, 128], torso: 186, hand: [102, 86], ankle: [118, 178], elbowDir: [-1, 0.4] },
    toB: 'Vuelve hasta sentir el estiramiento', toA: 'Empuja hasta casi extender', bIsEccentric: true,
    pads: ['backpad'], scene: seat(64, 40, 135),
  },
  push_up: {
    view: 'side',
    a: { hip: [102, 143], torso: 113, hand: [150, 180], ankle: [25, 176], toe: [6, 6], elbowDir: [-0.3, -1] },
    b: { hip: [108, 168], torso: 96, hand: [150, 180], ankle: [25, 176], toe: [6, 6], elbowDir: [-0.3, -1] },
    toB: 'Baja con el cuerpo recto', toA: 'Empuja el suelo', bIsEccentric: true,
  },
  dip: {
    view: 'side',
    a: { hip: [98, 95], torso: 176, hand: [102, 100], ankle: [-16, 62], ankleFrom: 'hip', elbowDir: [-1, 0], kneeDir: [1, 0.3] },
    b: { hip: [88, 131], torso: 160, hand: [102, 100], ankle: [-16, 56], ankleFrom: 'hip', elbowDir: [-1, 0], kneeDir: [1, 0.3] },
    toB: 'Baja hasta hombros a la altura de codos', toA: 'Empuja hasta extender', bIsEccentric: true,
    scene: postBar(84, 120, 104), ground: false,
  },
  fly_cable: {
    view: 'side',
    a: { ...STAND, ankle2: [84, 176], toe2: [10, 6], hand: [8, 10], elbowDir: [0, 1] },
    b: { ...STAND, ankle2: [84, 176], toe2: [10, 6], hand: [48, 16], elbowDir: [0, 1] },
    toB: 'Junta las manos en un arco', toA: 'Abre hasta estirar el pecho', bIsEccentric: false,
    anchor: [96, -24],
  },
  fly_lying: {
    view: 'side',
    a: { ...SUPINE_BENCH, hand: [58, 90], elbowDir: [0.2, -1] },
    b: { ...SUPINE_BENCH, hand: [54, 130], elbowDir: [0.2, -1] },
    toB: 'Abre en arco hasta estirar', toA: 'Cierra con el mismo ángulo de codo', bIsEccentric: true,
    scene: bench(24, 102, 150),
  },
  overhead_press: {
    view: 'side',
    a: { ...STAND, hand: [111, 50], handFrom: 'abs', elbowDir: [1, 1] },
    b: { ...STAND, hand: [100, -10], handFrom: 'abs', elbowDir: [1, 0] },
    toB: 'Empuja vertical sobre la cabeza', toA: 'Baja controlado a las clavículas', bIsEccentric: false,
  },
  overhead_press_seated: {
    view: 'side',
    a: { hip: [88, 126], torso: 182, hand: [11, 6], handFrom: 'shoulder', ankle: [124, 178], elbowDir: [1, 1] },
    b: { hip: [88, 126], torso: 182, hand: [2, -54], handFrom: 'shoulder', ankle: [124, 178], elbowDir: [1, 0] },
    toB: 'Empuja hasta casi juntar arriba', toA: 'Baja a la altura de las orejas', bIsEccentric: false,
    pads: ['backpad'], scene: seat(68, 38, 133),
  },
  pike_push_up: {
    view: 'side',
    a: { hip: [96, 100], torso: 54, hand: [140, 180], ankle: [60, 178], toe: [8, 4], elbowDir: [-0.5, -1] },
    b: { hip: [98, 102], torso: 32, hand: [140, 180], ankle: [60, 178], toe: [8, 4], elbowDir: [-0.5, -1] },
    toB: 'Baja la cabeza entre las manos', toA: 'Empuja hasta extender', bIsEccentric: true,
  },

  // ───────── Hombros ─────────
  lateral_raise: {
    view: 'front',
    a: { arm: 10, elbow: 6, leg: 3, lift: 0 },
    b: { arm: 84, elbow: 8, leg: 3, lift: 0 },
    toB: 'Eleva hasta la altura de los hombros', toA: 'Baja en 2–3 s', bIsEccentric: false,
  },
  rear_delt_fly: {
    view: 'side',
    a: { hip: [70, 100], torso: 110, hand: [0, 55], handFrom: 'shoulder', ankle: [104, 178], elbowDir: [-1, 0] },
    b: { hip: [70, 100], torso: 110, hand: [-10, 14], handFrom: 'shoulder', ankle: [104, 178], elbowDir: [-1, 0] },
    toB: 'Abre los brazos hacia los lados', toA: 'Baja controlado', bIsEccentric: false,
  },
  face_pull: {
    view: 'side',
    a: { ...STAND, torso: 184, hand: [54, -2], ankle2: [84, 176], toe2: [10, 6], elbowDir: [0, 1] },
    b: { ...STAND, torso: 184, hand: [14, -16], ankle2: [84, 176], toe2: [10, 6], elbowDir: [-0.3, -1] },
    toB: 'Tira hacia la frente con codos altos', toA: 'Vuelve controlado', bIsEccentric: false,
    anchor: [204, 28],
  },
  shrug: {
    view: 'front',
    a: { arm: 6, elbow: 0, leg: 3, lift: 0 },
    b: { arm: 6, elbow: 0, leg: 3, lift: -9 },
    toB: 'Eleva los hombros hacia las orejas', toA: 'Baja controlado', bIsEccentric: false,
  },

  // ───────── Espalda / tirón ─────────
  row_seated: {
    view: 'side',
    a: { hip: [80, 150], torso: 160, hand: [54, 24], handFrom: 'shoulder', ankle: [150, 160], toe: [2, -12], elbowDir: [-1, 0] },
    b: { hip: [80, 150], torso: 186, hand: [14, 42], handFrom: 'shoulder', ankle: [150, 160], toe: [2, -12], elbowDir: [-1, 0] },
    toB: 'Tira hacia el abdomen, junta escápulas', toA: 'Estira los brazos sin redondear', bIsEccentric: false,
    anchor: [214, 150], scene: [{ t: 'rect', x: 56, y: 157, w: 52, h: 7, r: 3 }, { t: 'line', a: [82, 164], b: [82, G], w: 4 }, { t: 'rect', x: 152, y: 140, w: 6, h: 30, r: 2 }],
  },
  row_bent: {
    view: 'side',
    a: { hip: [66, 100], torso: 110, hand: [0, 56], handFrom: 'shoulder', ankle: [104, 178], elbowDir: [-1, 0] },
    b: { hip: [66, 100], torso: 110, hand: [-16, 30], handFrom: 'shoulder', ankle: [104, 178], elbowDir: [-1, -1] },
    toB: 'Tira hacia el ombligo', toA: 'Baja sin perder la postura', bIsEccentric: false,
  },
  row_chest_supported: {
    view: 'side',
    a: { hip: [88, 132], torso: 135, hand: [0, 56], handFrom: 'shoulder', ankle: [74, 178], elbowDir: [-1, 0], kneeDir: [1, 0] },
    b: { hip: [88, 132], torso: 135, hand: [-18, 24], handFrom: 'shoulder', ankle: [74, 178], elbowDir: [-1, -1], kneeDir: [1, 0] },
    toB: 'Lleva los codos atrás', toA: 'Vuelve hasta estirar', bIsEccentric: false,
    pads: ['chestpad'],
  },
  inverted_row: {
    view: 'side',
    a: { hip: [117, 162], torso: 259, hand: [66, 96], ankle: [200, 178], toe: [-2, -12], elbowDir: [1, 0.6] },
    b: { hip: [118, 137], torso: 242, hand: [66, 96], ankle: [198, 178], toe: [-2, -12], elbowDir: [1, 0.6] },
    toB: 'Lleva el pecho a la barra', toA: 'Baja controlado', bIsEccentric: false,
    scene: [{ t: 'line', a: [40, 96], b: [86, 96], w: 3 }, { t: 'line', a: [42, 96], b: [42, G], w: 3 }],
  },
  pulldown: {
    view: 'side',
    a: { hip: [90, 140], torso: 182, hand: [98, 34], ankle: [126, 178], elbowDir: [1, 0] },
    b: { hip: [90, 140], torso: 192, hand: [104, 84], ankle: [126, 178], elbowDir: [0, 1] },
    toB: 'Tira hacia la clavícula', toA: 'Sube controlado hasta estirar', bIsEccentric: false,
    anchor: [98, -36], scene: seat(70, 40, 147), pads: ['thighpad'],
  },
  pull_up: {
    view: 'side',
    a: { hip: [100, 88], torso: 180, hand: [102, -24], ankle: [-6, 80], ankleFrom: 'hip', elbowDir: [1, 0.3], kneeDir: [1, 0] },
    b: { hip: [100, 36], torso: 188, hand: [102, -24], ankle: [-8, 79], ankleFrom: 'hip', elbowDir: [1, 0.45], kneeDir: [1, 0] },
    toB: 'Tira hasta pasar la barbilla', toA: 'Baja a brazos extendidos', bIsEccentric: false,
    scene: [{ t: 'line', a: [60, -24], b: [150, -24], w: 3 }], ground: false,
  },
  straight_arm_pulldown: {
    view: 'side',
    a: { ...STAND, torso: 165, hand: [40, -38], ankle2: [86, 176], toe2: [10, 6], elbowDir: [0, 1] },
    b: { ...STAND, torso: 165, hand: [12, 54], ankle2: [86, 176], toe2: [10, 6], elbowDir: [0, 1] },
    toB: 'Lleva la barra a los muslos con brazos rectos', toA: 'Sube hasta estirar', bIsEccentric: false,
    anchor: [196, -30],
  },

  // ───────── Brazos ─────────
  curl: {
    view: 'side',
    a: { ...STAND, hand: [3, 57], elbowDir: [-0.3, 1] },
    b: { ...STAND, hand: [12, 8], elbowDir: [-0.3, 1] },
    toB: 'Flexiona sin mover los codos', toA: 'Baja controlado', bIsEccentric: false,
    anchor: [140, G],
  },
  curl_preacher: {
    view: 'side',
    a: { hip: [92, 120], torso: 172, hand: [40, 41], handFrom: 'shoulder', ankle: [122, 178], elbowDir: [1, 1] },
    b: { hip: [92, 120], torso: 172, hand: [26, -5], handFrom: 'shoulder', ankle: [122, 178], elbowDir: [1, 1] },
    toB: 'Flexiona hasta contraer', toA: 'Baja hasta casi extender', bIsEccentric: false,
    scene: [...seat(70, 36, 127), { t: 'line', a: [104, 80], b: [134, 112], w: 7 }, { t: 'line', a: [128, 112], b: [128, G], w: 4 }],
  },
  curl_bayesian: {
    view: 'side',
    a: { ...STAND, ankle2: [82, 176], toe2: [10, 6], hand: [-16, 54], elbowDir: [-1, 0.5] },
    b: { ...STAND, ankle2: [82, 176], toe2: [10, 6], hand: [2, 4], elbowDir: [-1, 0.5] },
    toB: 'Flexiona sin adelantar el codo', toA: 'Vuelve hasta estirar', bIsEccentric: false,
    anchor: [20, 170],
  },
  pushdown: {
    view: 'side',
    a: { ...STAND, torso: 172, hand: [22, 28], elbowDir: [-0.5, 1] },
    b: { ...STAND, torso: 172, hand: [6, 56], elbowDir: [-0.5, 1] },
    toB: 'Extiende los codos', toA: 'Sube controlado a 90°', bIsEccentric: false,
    anchor: [150, -34],
  },
  triceps_overhead: {
    view: 'side',
    a: { ...STAND, torso: 168, ankle2: [84, 176], toe2: [10, 6], hand: [-14, -6], elbowDir: [0.5, -1] },
    b: { ...STAND, torso: 168, ankle2: [84, 176], toe2: [10, 6], hand: [22, -52], elbowDir: [0.5, -1] },
    toB: 'Extiende los brazos', toA: 'Baja hasta el estiramiento', bIsEccentric: false,
    anchor: [10, 30],
  },
  skull_crusher: {
    view: 'side',
    a: { ...SUPINE_BENCH, hand: [50, 88], elbowDir: [0.2, -1] },
    b: { ...SUPINE_BENCH, hand: [40, 124], elbowDir: [0.2, -1] },
    toB: 'Baja flexionando solo los codos', toA: 'Extiende', bIsEccentric: true,
    scene: bench(24, 102, 150),
  },
  wrist_curl: {
    view: 'side',
    a: { hip: [90, 126], torso: 150, hand: [140, 134], ankle: [128, 178], elbowDir: [-0.3, 1] },
    b: { hip: [90, 126], torso: 150, hand: [140, 122], ankle: [128, 178], elbowDir: [-0.3, 1] },
    toB: 'Flexiona las muñecas', toA: 'Baja hasta estirar', bIsEccentric: false,
    scene: seat(66, 40, 133),
  },
  farmer_carry: {
    view: 'side',
    a: { ...STAND, hip: [100, 98], ankle: [86, 178], ankle2: [116, 178], kneeDir: [1, 0] },
    b: { ...STAND, hip: [100, 98], ankle: [116, 178], ankle2: [86, 178], kneeDir: [1, 0] },
    toB: 'Camina con pasos cortos', toA: 'Torso firme, hombros atrás', bIsEccentric: false, steady: true,
  },

  // ───────── Core ─────────
  crunch: {
    view: 'side',
    a: { hip: [110, 172], torso: 270, hand: [-12, -8], handFrom: 'shoulder', ankle: [148, 178], kneeDir: [0, -1], elbowDir: [0.5, -1] },
    b: { hip: [110, 172], torso: 242, hand: [-12, -10], handFrom: 'shoulder', ankle: [148, 178], kneeDir: [0, -1], elbowDir: [0.5, -1] },
    toB: 'Enrolla el tronco, exhala', toA: 'Baja controlado', bIsEccentric: false,
  },
  cable_crunch: {
    view: 'side',
    a: { hip: [98, 134], torso: 176, hand: [8, -6], handFrom: 'shoulder', ankle: [58, 178], toe: [-8, 4], kneeDir: [1, 1], elbowDir: [1, 0] },
    b: { hip: [94, 136], torso: 122, head: -10, hand: [8, -6], handFrom: 'shoulder', ankle: [58, 178], toe: [-8, 4], kneeDir: [1, 1], elbowDir: [1, 0] },
    toB: 'Enrolla la columna hacia los muslos', toA: 'Vuelve estirando el abdomen', bIsEccentric: false,
    anchor: [130, -36],
  },
  hanging_leg_raise: {
    view: 'side',
    a: { hip: [100, 88], torso: 180, hand: [102, -24], ankle: [0, 82], ankleFrom: 'hip', elbowDir: [1, 0], kneeDir: [1, 0] },
    b: { hip: [98, 86], torso: 184, hand: [102, -24], ankle: [34, 26], ankleFrom: 'hip', elbowDir: [1, 0], kneeDir: [1, -1] },
    toB: 'Eleva las piernas enrollando la pelvis', toA: 'Baja sin balancearte', bIsEccentric: false,
    scene: [{ t: 'line', a: [60, -24], b: [150, -24], w: 3 }], ground: false,
  },
  plank: {
    view: 'side',
    a: { hip: [99, 159], torso: 101, hand: [172, 180], ankle: [17, 176], toe: [6, 6], elbowDir: [-1, 0] },
    b: { hip: [99, 157], torso: 100, hand: [172, 180], ankle: [17, 176], toe: [6, 6], elbowDir: [-1, 0] },
    toB: 'Mantén el cuerpo en línea', toA: 'Respira sin soltar el abdomen', bIsEccentric: false, steady: true,
  },
  side_plank: {
    view: 'side',
    a: { hip: [99, 164], torso: 101, hand: [172, 180], ankle: [17, 176], toe: [6, 6], elbowDir: [-1, 0] },
    b: { hip: [99, 154], torso: 99, hand: [172, 180], ankle: [17, 176], toe: [6, 6], elbowDir: [-1, 0] },
    toB: 'Eleva la cadera', toA: 'Mantén sin rotar', bIsEccentric: false, steady: true,
  },
  dead_bug: {
    view: 'side',
    a: {
      hip: [116, 172], torso: 270, hand: [66, 116], hand2: [66, 116], ankle: [156, 128], ankle2: [156, 128],
      kneeDir: [0, -1], kneeDir2: [0, -1], elbowDir: [0, -1],
    },
    b: {
      hip: [116, 172], torso: 270, hand: [12, 160], hand2: [66, 116], ankle: [198, 160], ankle2: [156, 128],
      kneeDir: [0, -1], kneeDir2: [0, -1], elbowDir: [0, -1],
    },
    toB: 'Extiende brazo y pierna contrarios', toA: 'Vuelve sin despegar la lumbar', bIsEccentric: false,
  },
  pallof_press: {
    view: 'side',
    a: { ...STAND, hand: [12, 16], elbowDir: [-0.3, 1] },
    b: { ...STAND, hand: [54, 14], elbowDir: [-0.3, 1] },
    toB: 'Empuja al frente sin rotar', toA: 'Vuelve al pecho', bIsEccentric: false,
    anchor: [24, 62],
  },
  ab_wheel: {
    view: 'side',
    a: { hip: [94, 134], torso: 97, hand: [150, 176], ankle: [54, 178], toe: [-8, 4], kneeDir: [1, 1], elbowDir: [-1, 0] },
    b: { hip: [126, 160], torso: 94, hand: [228, 172], ankle: [54, 178], toe: [-8, 4], kneeDir: [1, 1], elbowDir: [-1, 0] },
    toB: 'Rueda al frente con la pelvis retraída', toA: 'Vuelve tirando con el abdomen', bIsEccentric: true,
  },
  back_extension: {
    view: 'side',
    a: { hip: [114, 112], torso: 30, hand: [10, 10], handFrom: 'shoulder', ankle: [60, 176], toe: [-4, 8], elbowDir: [1, 0] },
    b: { hip: [114, 112], torso: 140, hand: [10, 10], handFrom: 'shoulder', ankle: [60, 176], toe: [-4, 8], elbowDir: [1, 0] },
    toB: 'Sube hasta alinear el cuerpo', toA: 'Baja flexionando la cadera', bIsEccentric: false,
    pads: ['hippad'], scene: [{ t: 'rect', x: 50, y: 172, w: 26, h: 6, r: 3 }, { t: 'line', a: [60, 178], b: [128, 120], w: 4 }],
  },
  kb_swing: {
    view: 'side',
    a: { hip: [64, 106], torso: 104, hand: [-22, 46], handFrom: 'shoulder', ankle: [102, 178] },
    b: { hip: [100, 95], torso: 180, hand: [54, 12], handFrom: 'shoulder', ankle: [102, 178] },
    toB: 'Extiende la cadera de forma explosiva', toA: 'Deja que la pesa vuelva entre las piernas', bIsEccentric: false,
  },
  hip_abduction: {
    view: 'front',
    a: { arm: 7, elbow: 4, leg: 3, lift: 0 },
    b: { arm: 7, elbow: 4, leg: 36, lift: 0 },
    toB: 'Abre la pierna sin inclinarte', toA: 'Vuelve despacio', bIsEccentric: false,
  },
  hip_adduction: {
    view: 'front',
    a: { arm: 7, elbow: 4, leg: 30, leg2: 30, lift: 0 },
    b: { arm: 7, elbow: 4, leg: 3, leg2: 3, lift: 0 },
    toB: 'Cierra las piernas apretando', toA: 'Abre controlado', bIsEccentric: false,
  },
  glute_kickback: {
    view: 'side',
    a: { ...STAND, torso: 162, hip: [96, 96], hand: [40, 30], ankle: [98, 174], ankle2: [100, 178], elbowDir: [0, 1] },
    b: { ...STAND, torso: 162, hip: [96, 96], hand: [40, 30], ankle: [46, 156], ankle2: [100, 178], toe: [-4, 12], elbowDir: [0, 1] },
    toB: 'Lleva la pierna atrás', toA: 'Vuelve sin arquear la espalda', bIsEccentric: false,
    anchor: [160, 178], anchorAtAnkle: true,
  },
};
