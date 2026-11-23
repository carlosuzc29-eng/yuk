/**
 * Motor de animación del maniquí de YUK.
 * Vista lateral (mira a la derecha) con cinemática inversa de dos huesos para brazos y piernas,
 * y vista frontal para movimientos en el plano frontal (elevaciones laterales, abducciones…).
 *
 * Convención de ángulos: 0° = hacia abajo, 90° = hacia delante (derecha), 180° = arriba, 270° = atrás.
 */
import type { ExerciseEquipment, MovementPattern, View2DMode } from '@/types/training';
import type { MuscleId, Sex } from '@/types/user';

export type V = [number, number];

export const L = {
  torso: 52,
  upperArm: 30,
  forearm: 27,
  thigh: 44,
  shin: 40,
  head: 10,
};

const rad = (d: number) => (d * Math.PI) / 180;
export const dir = (a: number): V => [Math.sin(rad(a)), Math.cos(rad(a))];
export const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
export const len = (a: V) => Math.hypot(a[0], a[1]);
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpV = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

function rotate(v: V, ang: number): V {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

/** IK de dos huesos: devuelve la articulación media (codo/rodilla) y el extremo alcanzable. */
export function ik(root: V, target: V, l1: number, l2: number, pref: V): { joint: V; end: V } {
  const d = sub(target, root);
  const dist = len(d);
  const cd = clamp(dist, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const u: V = dist > 1e-6 ? mul(d, 1 / dist) : [0, 1];
  const end = add(root, mul(u, cd));
  const a = Math.acos(clamp((l1 * l1 + cd * cd - l2 * l2) / (2 * l1 * cd), -1, 1));
  const j1 = add(root, mul(rotate(u, a), l1));
  const j2 = add(root, mul(rotate(u, -a), l1));
  const mid = lerpV(root, end, 0.5);
  const joint = dot(sub(j1, mid), pref) >= dot(sub(j2, mid), pref) ? j1 : j2;
  return { joint, end };
}

// ───────────────────────── Poses ─────────────────────────

export type Anchor = 'abs' | 'shoulder' | 'hip';

export interface SidePose {
  hip: V;
  /** Ángulo cadera→hombro. 180 = erguido. */
  torso: number;
  /** Inclinación extra de la cabeza respecto al torso. */
  head?: number;
  hand: V;
  handFrom?: Anchor;
  hand2?: V;
  ankle: V;
  ankleFrom?: Anchor;
  ankle2?: V;
  /** Vector tobillo→punta del pie. */
  toe?: V;
  toe2?: V;
  elbowDir?: V;
  elbowDir2?: V;
  kneeDir?: V;
  kneeDir2?: V;
}

export interface FrontPose {
  /** Abducción del brazo (0 = pegado al cuerpo, 90 = horizontal). */
  arm: number;
  /** Flexión adicional del antebrazo. */
  elbow: number;
  /** Abducción de la pierna derecha (vista). */
  leg: number;
  /** Abducción de la pierna izquierda (vista). */
  leg2?: number;
  /** Elevación de hombros (negativo = sube). */
  lift: number;
}

function resolve(p: V, from: Anchor | undefined, shoulder: V, hip: V): V {
  if (from === 'shoulder') return add(shoulder, p);
  if (from === 'hip') return add(hip, p);
  return p;
}

export function lerpSide(a: SidePose, b: SidePose, t: number): SidePose {
  return {
    hip: lerpV(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    head: lerp(a.head ?? 0, b.head ?? 0, t),
    hand: lerpV(a.hand, b.hand, t),
    handFrom: a.handFrom,
    hand2: a.hand2 || b.hand2 ? lerpV(a.hand2 ?? a.hand, b.hand2 ?? b.hand, t) : undefined,
    ankle: lerpV(a.ankle, b.ankle, t),
    ankleFrom: a.ankleFrom,
    ankle2: a.ankle2 || b.ankle2 ? lerpV(a.ankle2 ?? a.ankle, b.ankle2 ?? b.ankle, t) : undefined,
    toe: lerpV(a.toe ?? [13, 4], b.toe ?? [13, 4], t),
    toe2: a.toe2 || b.toe2 ? lerpV(a.toe2 ?? a.toe ?? [13, 4], b.toe2 ?? b.toe ?? [13, 4], t) : undefined,
    elbowDir: a.elbowDir,
    elbowDir2: a.elbowDir2,
    kneeDir: a.kneeDir,
    kneeDir2: a.kneeDir2,
  };
}

export function lerpFront(a: FrontPose, b: FrontPose, t: number): FrontPose {
  return {
    arm: lerp(a.arm, b.arm, t),
    elbow: lerp(a.elbow, b.elbow, t),
    leg: lerp(a.leg, b.leg, t),
    leg2: lerp(a.leg2 ?? 3, b.leg2 ?? 3, t),
    lift: lerp(a.lift, b.lift, t),
  };
}

// ───────────────────────── Esqueleto ─────────────────────────

export type SegName =
  | 'torso'
  | 'upperArm'
  | 'forearm'
  | 'thigh'
  | 'shin'
  | 'upperArm2'
  | 'forearm2'
  | 'thigh2'
  | 'shin2';

export interface Seg {
  a: V;
  b: V;
  wa: number;
  wb: number;
  /** Signo del normal "frontal" (para colocar músculos delante/detrás). */
  ns: 1 | -1;
  far?: boolean;
}

export interface Skeleton {
  view: 'side' | 'front' | 'back';
  segs: Partial<Record<SegName, Seg>>;
  shoulder: V;
  hip: V;
  head: V;
  neck: [V, V];
  hand: V;
  hand2: V;
  ankle: V;
  ankle2: V;
  toe: V;
  toe2: V;
  /** Contorno del torso (vista lateral, frontal o espalda). */
  torsoPath: string;
  /** Normal frontal del torso (vista lateral). */
  torsoFront: V;
}

/** Normal "delantero" de un segmento de extremidad (vista lateral). */
export function limbFront(s: Seg): V {
  const d = sub(s.b, s.a);
  const l = len(d) || 1;
  return mul([d[1] / l, -d[0] / l], s.ns);
}

function torsoOutline(hip: V, shoulder: V, front: V, sex: Sex = 'male'): string {
  const f = sex === 'female';
  const prof: [number, number, number][] = f
    ? [
        // t, delante, detrás (silueta atlética femenina)
        [-0.03, 7.5, 12.5],
        [0.14, 8.2, 11.5],
        [0.36, 7.2, 7.2],
        [0.64, 11.5, 9.2],
        [0.84, 10.0, 9.5],
        [1.02, 5.8, 6.8],
      ]
    : [
        // t, delante, detrás (silueta atlética masculina)
        [-0.03, 8.5, 11.2],
        [0.16, 8.8, 10.2],
        [0.38, 9.0, 8.0],
        [0.68, 13.0, 10.8],
        [0.86, 11.2, 10.5],
        [1.02, 6.8, 7.6],
      ];
  const fwd = prof.map(([t, fw]) => add(lerpV(hip, shoulder, t), mul(front, fw)));
  const back = prof.map(([t, , bk]) => add(lerpV(hip, shoulder, t), mul(front, -bk))).reverse();
  const pts = [...fwd, ...back];
  // Curva suave cerrada (Catmull-Rom → Bézier)
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} `;
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const p3 = pts[(i + 2) % pts.length];
    const c1 = add(p1, mul(sub(p2, p0), 1 / 6));
    const c2 = sub(p2, mul(sub(p3, p1), 1 / 6));
    d += `C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `;
  }
  return d + 'Z';
}

export function buildSide(p: SidePose, sex: Sex = 'male'): Skeleton {
  const f = sex === 'female';
  const hip = p.hip;
  const shoulder = add(hip, mul(dir(p.torso), L.torso));
  const headAng = p.torso + (p.head ?? 0);
  const neckTop = add(shoulder, mul(dir(headAng), 6));
  const head = add(shoulder, mul(dir(headAng), 16));
  const td = sub(shoulder, hip);
  const tl = len(td) || 1;
  const torsoFront: V = [-td[1] / tl, td[0] / tl];

  const handT = resolve(p.hand, p.handFrom, shoulder, hip);
  const hand2T = p.hand2 ? resolve(p.hand2, p.handFrom, shoulder, hip) : handT;
  const ankleT = resolve(p.ankle, p.ankleFrom, shoulder, hip);
  const ankle2T = p.ankle2 ? resolve(p.ankle2, p.ankleFrom, shoulder, hip) : ankleT;

  const eDir = p.elbowDir ?? [0, 1];
  const kDir = p.kneeDir ?? [1, 0];
  const arm = ik(shoulder, handT, L.upperArm, L.forearm, eDir);
  const arm2 = ik(shoulder, hand2T, L.upperArm, L.forearm, p.elbowDir2 ?? eDir);
  const leg = ik(hip, ankleT, L.thigh, L.shin, kDir);
  const leg2 = ik(hip, ankle2T, L.thigh, L.shin, p.kneeDir2 ?? kDir);

  const toe = add(leg.end, p.toe ?? [13, 4]);
  const toe2 = add(leg2.end, p.toe2 ?? p.toe ?? [13, 4]);

  const armScale = f ? 0.88 : 1;
  const legScale = f ? 0.98 : 1;

  return {
    view: 'side',
    segs: {
      torso: { a: hip, b: shoulder, wa: f ? 19 : 20, wb: f ? 14.5 : 16.5, ns: 1 },
      thigh2: { a: hip, b: leg2.joint, wa: 16 * legScale, wb: 10 * legScale, ns: 1, far: true },
      shin2: { a: leg2.joint, b: leg2.end, wa: 10.5 * legScale, wb: 6 * legScale, ns: 1, far: true },
      upperArm2: { a: shoulder, b: arm2.joint, wa: 10.5 * armScale, wb: 7.5 * armScale, ns: 1, far: true },
      forearm2: { a: arm2.joint, b: arm2.end, wa: 7.8 * armScale, wb: 5 * armScale, ns: 1, far: true },
      thigh: { a: hip, b: leg.joint, wa: 16 * legScale, wb: 10 * legScale, ns: 1 },
      shin: { a: leg.joint, b: leg.end, wa: 10.5 * legScale, wb: 6 * legScale, ns: 1 },
      upperArm: { a: shoulder, b: arm.joint, wa: 10.5 * armScale, wb: 7.5 * armScale, ns: 1 },
      forearm: { a: arm.joint, b: arm.end, wa: 7.8 * armScale, wb: 5 * armScale, ns: 1 },
    },
    shoulder,
    hip,
    head,
    neck: [shoulder, neckTop],
    hand: arm.end,
    hand2: arm2.end,
    ankle: leg.end,
    ankle2: leg2.end,
    toe,
    toe2,
    torsoPath: torsoOutline(hip, shoulder, torsoFront, sex),
    torsoFront,
  };
}

const CX = 120;

export function buildFront(p: FrontPose, sex: Sex = 'male', view: 'front' | 'back' = 'front'): Skeleton {
  const f = sex === 'female';
  const isBack = view === 'back';
  const shY = 46 + p.lift;
  const shHalf = f ? 18.5 : 22;
  const hipHalf = f ? 12.5 : 11;
  const waistHalf = f ? 12.5 : 15;
  const pelvisHalf = f ? 21 : 18.5;

  const shR: V = [CX + shHalf, shY];
  const shL: V = [CX - shHalf, shY];
  const hipR: V = [CX + hipHalf, 98];
  const hipL: V = [CX - hipHalf, 98];
  const head: V = [CX, 24];

  const armAngR = isBack ? (p.leg2 !== undefined ? p.arm : p.arm) : p.arm;
  const elR = add(shR, mul(dir(armAngR), L.upperArm));
  const handR = add(elR, mul(dir(armAngR + p.elbow), L.forearm));
  const elL = add(shL, mul(dir(-armAngR), L.upperArm));
  const handL = add(elL, mul(dir(-(armAngR + p.elbow)), L.forearm));

  const legR = isBack ? (p.leg2 ?? 3) : p.leg;
  const legL = isBack ? -p.leg : -(p.leg2 ?? 3);
  const knR = add(hipR, mul(dir(legR), L.thigh));
  const anR = add(knR, mul(dir(legR), L.shin));
  const knL = add(hipL, mul(dir(legL), L.thigh));
  const anL = add(knL, mul(dir(legL), L.shin));

  const torsoPath =
    `M ${CX - shHalf - 1} ${shY + 2} ` +
    `C ${CX - 10} ${shY - 4} ${CX + 10} ${shY - 4} ${CX + shHalf + 1} ${shY + 2} ` +
    `C ${CX + shHalf + 2} ${shY + 14} ${CX + waistHalf + 4} 68 ${CX + waistHalf} 82 ` +
    `C ${CX + waistHalf - 1} 90 ${CX + pelvisHalf} 94 ${CX + pelvisHalf} 102 ` +
    `L ${CX - pelvisHalf} 102 ` +
    `C ${CX - pelvisHalf} 94 ${CX - waistHalf + 1} 90 ${CX - waistHalf} 82 ` +
    `C ${CX - waistHalf - 4} 68 ${CX - shHalf - 2} ${shY + 14} ${CX - shHalf - 1} ${shY + 2} Z`;

  const armScale = f ? 0.88 : 1;

  return {
    view,
    segs: {
      thigh2: { a: hipL, b: knL, wa: f ? 16 : 15.5, wb: 10, ns: -1 },
      shin2: { a: knL, b: anL, wa: 10.5, wb: 6, ns: -1 },
      thigh: { a: hipR, b: knR, wa: f ? 16 : 15.5, wb: 10, ns: 1 },
      shin: { a: knR, b: anR, wa: 10.5, wb: 6, ns: 1 },
      upperArm2: { a: shL, b: elL, wa: 10.5 * armScale, wb: 7.5 * armScale, ns: -1 },
      forearm2: { a: elL, b: handL, wa: 7.8 * armScale, wb: 5 * armScale, ns: -1 },
      upperArm: { a: shR, b: elR, wa: 10.5 * armScale, wb: 7.5 * armScale, ns: 1 },
      forearm: { a: elR, b: handR, wa: 7.8 * armScale, wb: 5 * armScale, ns: 1 },
    },
    shoulder: shR,
    hip: hipR,
    head,
    neck: [[CX, shY], [CX, 34]],
    hand: handR,
    hand2: handL,
    ankle: anR,
    ankle2: anL,
    toe: add(anR, [5, 3]),
    toe2: add(anL, [-5, 3]),
    torsoPath,
    torsoFront: [0, 0],
  };
}

/**
 * Construye una proyección 2D Frontal ('front') o de Espalda ('back') a partir de una postura lateral (`skSide`),
 * respetando la altura biomecánica de cada articulación y la apertura anatómica de agarre, codos, rodillas y pies.
 */
export function buildProjectedFrontBack(
  skSide: Skeleton,
  t: number,
  sex: Sex,
  view: 'front' | 'back',
  pattern: MovementPattern,
  equipment: ExerciseEquipment
): Skeleton {
  const f = sex === 'female';
  const isBack = view === 'back';
  const shHalf = f ? 18.5 : 22;
  const hipHalf = f ? 12.5 : 11.5;
  const waistHalf = f ? 12.5 : 15;
  const pelvisHalf = f ? 21 : 18.5;

  let handHalf = shHalf + 5;
  let elbowHalf = shHalf + 6;
  let footHalf = 14;
  let kneeHalf = 14;

  switch (pattern) {
    case 'bench_press':
    case 'incline_press':
    case 'chest_press_machine':
    case 'push_up':
      handHalf = equipment === 'barra' ? 35 : 28;
      elbowHalf = shHalf + 14;
      footHalf = 16;
      kneeHalf = 15;
      break;
    case 'fly_lying':
      handHalf = lerp(11, 43, t);
      elbowHalf = lerp(18, 35, t);
      footHalf = 15;
      kneeHalf = 14;
      break;
    case 'fly_cable':
      handHalf = lerp(43, 9, t);
      elbowHalf = lerp(36, 17, t);
      footHalf = 14;
      kneeHalf = 14;
      break;
    case 'rear_delt_fly':
      handHalf = lerp(11, 43, t);
      elbowHalf = lerp(17, 35, t);
      footHalf = 14;
      kneeHalf = 14;
      break;
    case 'face_pull':
      handHalf = lerp(14, 28, t);
      elbowHalf = lerp(19, 36, t);
      footHalf = 14;
      kneeHalf = 14;
      break;
    case 'pulldown':
    case 'pull_up':
      handHalf = 36;
      elbowHalf = lerp(33, 27, t);
      footHalf = 11;
      kneeHalf = 11;
      break;
    case 'squat_back':
    case 'good_morning':
      handHalf = 36;
      elbowHalf = 30;
      footHalf = 18;
      kneeHalf = lerp(16, 22, t);
      break;
    case 'squat_front':
    case 'squat_machine':
      handHalf = equipment === 'barra' ? 28 : 10;
      elbowHalf = equipment === 'barra' ? 23 : 16;
      footHalf = 18;
      kneeHalf = lerp(16, 21, t);
      break;
    case 'leg_press':
      handHalf = 24;
      elbowHalf = 25;
      footHalf = 16;
      kneeHalf = 17;
      break;
    case 'hinge':
      handHalf = equipment === 'barra' ? 26 : 23;
      elbowHalf = 23;
      footHalf = 14;
      kneeHalf = 14;
      break;
    case 'hip_thrust':
    case 'glute_bridge':
      handHalf = 24;
      elbowHalf = 26;
      footHalf = 16;
      kneeHalf = 17;
      break;
    case 'overhead_press':
    case 'overhead_press_seated':
    case 'pike_push_up':
      handHalf = equipment === 'barra' ? 29 : 26;
      elbowHalf = lerp(31, 25, t);
      footHalf = 14;
      kneeHalf = 14;
      break;
    case 'row_bent':
    case 'row_chest_supported':
    case 'inverted_row':
      handHalf = equipment === 'barra' ? 29 : 24;
      elbowHalf = lerp(23, 30, t);
      footHalf = 14;
      kneeHalf = 14;
      break;
    case 'row_seated':
    case 'pushdown':
    case 'triceps_overhead':
    case 'kb_swing':
    case 'ab_wheel':
    case 'pallof_press':
    case 'cable_crunch':
    case 'straight_arm_pulldown':
      handHalf = 11;
      elbowHalf = 18;
      footHalf = 14;
      kneeHalf = 14;
      break;
    case 'curl':
    case 'curl_preacher':
    case 'curl_bayesian':
    case 'skull_crusher':
    case 'wrist_curl':
      handHalf = equipment === 'barra' ? 22 : 24;
      elbowHalf = shHalf + 2;
      footHalf = 14;
      kneeHalf = 14;
      break;
    case 'dip':
    case 'hanging_leg_raise':
      handHalf = 25;
      elbowHalf = 27;
      footHalf = 10;
      kneeHalf = 10;
      break;
    default:
      break;
  }

  // En posturas horizontales (press de banca, flexiones, plancha, curl femoral tumbado, puente),
  // aplicamos una perspectiva elevada de 22° para que el tronco, cabeza y brazos se lean con total claridad
  const rawHipY = skSide.hip[1];
  const rawShY = skSide.shoulder[1];
  const isHorizontalTorso = Math.abs(rawShY - rawHipY) < 26;
  const hipY = rawHipY;
  const shY = isHorizontalTorso ? Math.min(rawShY, hipY - 30) : rawShY;
  const headY = isHorizontalTorso ? shY - 15 : Math.min(skSide.head[1], shY - 13);

  const shR: V = [CX + shHalf, shY];
  const shL: V = [CX - shHalf, shY];
  const hipR: V = [CX + hipHalf, hipY];
  const hipL: V = [CX - hipHalf, hipY];
  const head: V = [CX, headY];

  const sideElbow1 = skSide.segs.upperArm?.b ?? [CX, shY + 24];
  const sideElbow2 = skSide.segs.upperArm2?.b ?? sideElbow1;
  const sideKnee1 = skSide.segs.thigh?.b ?? [CX, hipY + 38];
  const sideKnee2 = skSide.segs.thigh2?.b ?? sideKnee1;

  const yOffset = shY - rawShY;
  // Evitar que extremidades que apuntan hacia la cámara en vista lateral colapsen a longitud ~0 en Frontal/Espalda
  const ensureSpan = (rootY: number, rawTargetY: number, minSpan = 14): number => {
    const dy = rawTargetY - rootY;
    if (Math.abs(dy) >= minSpan) return rawTargetY;
    const sign = dy >= -1 ? 1 : -1;
    return rootY + sign * minSpan;
  };

  const el1Y = ensureSpan(shY, sideElbow1[1] + yOffset * 0.65, 13);
  const el2Y = ensureSpan(shY, sideElbow2[1] + yOffset * 0.65, 13);
  const h1Y = ensureSpan(el1Y, skSide.hand[1] + yOffset * 0.5, 12);
  const h2Y = ensureSpan(el2Y, skSide.hand2[1] + yOffset * 0.5, 12);

  const kn1Y = ensureSpan(hipY, sideKnee1[1], 16);
  const kn2Y = ensureSpan(hipY, sideKnee2[1], 16);
  const an1Y = ensureSpan(kn1Y, Math.max(skSide.ankle[1], kn1Y + 15), 15);
  const an2Y = ensureSpan(kn2Y, Math.max(skSide.ankle2[1], kn2Y + 15), 15);

  // En vista de espalda, la derecha e izquierda de la pantalla se invierten respecto a la vista frontal
  const elR: V = [CX + elbowHalf, isBack ? el2Y : el1Y];
  const elL: V = [CX - elbowHalf, isBack ? el1Y : el2Y];
  const handR: V = [CX + handHalf, isBack ? h2Y : h1Y];
  const handL: V = [CX - handHalf, isBack ? h1Y : h2Y];

  const knR: V = [CX + kneeHalf, isBack ? kn2Y : kn1Y];
  const knL: V = [CX - kneeHalf, isBack ? kn1Y : kn2Y];
  const anR: V = [CX + footHalf, isBack ? an2Y : an1Y];
  const anL: V = [CX - footHalf, isBack ? an1Y : an2Y];

  const midTorsoY = lerp(shY, hipY, 0.56);
  const waistY = lerp(shY, hipY, 0.72);
  const pelvisBotY = hipY + 4;

  const torsoPath =
    `M ${CX - shHalf - 1} ${shY + 2} ` +
    `C ${CX - 10} ${shY - 4} ${CX + 10} ${shY - 4} ${CX + shHalf + 1} ${shY + 2} ` +
    `C ${CX + shHalf + 2} ${midTorsoY} ${CX + waistHalf + 3} ${waistY - 6} ${CX + waistHalf} ${waistY} ` +
    `C ${CX + waistHalf - 1} ${hipY - 4} ${CX + pelvisHalf} ${hipY - 2} ${CX + pelvisHalf} ${pelvisBotY} ` +
    `L ${CX - pelvisHalf} ${pelvisBotY} ` +
    `C ${CX - pelvisHalf} ${hipY - 2} ${CX - waistHalf + 1} ${hipY - 4} ${CX - waistHalf} ${waistY} ` +
    `C ${CX - waistHalf - 3} ${waistY - 6} ${CX - shHalf - 2} ${midTorsoY} ${CX - shHalf - 1} ${shY + 2} Z`;

  const armScale = f ? 0.88 : 1;

  return {
    view,
    segs: {
      thigh2: { a: hipL, b: knL, wa: f ? 16 : 15.5, wb: 10, ns: -1 },
      shin2: { a: knL, b: anL, wa: 10.5, wb: 6, ns: -1 },
      thigh: { a: hipR, b: knR, wa: f ? 16 : 15.5, wb: 10, ns: 1 },
      shin: { a: knR, b: anR, wa: 10.5, wb: 6, ns: 1 },
      upperArm2: { a: shL, b: elL, wa: 10.5 * armScale, wb: 7.5 * armScale, ns: -1 },
      forearm2: { a: elL, b: handL, wa: 7.8 * armScale, wb: 5 * armScale, ns: -1 },
      upperArm: { a: shR, b: elR, wa: 10.5 * armScale, wb: 7.5 * armScale, ns: 1 },
      forearm: { a: elR, b: handR, wa: 7.8 * armScale, wb: 5 * armScale, ns: 1 },
    },
    shoulder: shR,
    hip: hipR,
    head,
    neck: [[CX, shY], [CX, headY + 9]],
    hand: handR,
    hand2: handL,
    ankle: anR,
    ankle2: anL,
    toe: add(anR, [5, 3]),
    toe2: add(anL, [-5, 3]),
    torsoPath,
    torsoFront: [0, 0],
  };
}

/**
 * Construye una vista Lateral ('side') cuando el patrón nativo del ejercicio es frontal
 * (elevaciones laterales, encogimientos, abducción y aducción de cadera).
 */
export function buildSideFromFront(
  p: FrontPose,
  sex: Sex,
  pattern: MovementPattern
): Skeleton {
  if (pattern === 'hip_abduction' || pattern === 'hip_adduction') {
    // Sentado en la máquina de abducción/aducción visto de perfil
    const openOffset = (p.leg - 3) * 0.25;
    return buildSide(
      {
        hip: [82, 128],
        torso: 184,
        hand: [88, 132],
        ankle: [126, 166 - openOffset],
        ankle2: [124, 166],
        toe: [13, 4],
        kneeDir: [1, -1],
        elbowDir: [-0.5, 1],
      },
      sex
    );
  }
  if (pattern === 'shrug') {
    // De pie realizando encogimiento vertical de trapecios visto de perfil
    return buildSide(
      {
        hip: [99, 95],
        torso: 180,
        hand: [3, 55 + p.lift * 1.1],
        handFrom: 'shoulder',
        ankle: [101, 178],
        elbowDir: [-0.3, 1],
      },
      sex
    );
  }
  // Elevaciones laterales vistas de perfil (ligera inclinación escapular y brazo subiendo hasta el hombro)
  const liftRatio = clamp((p.arm - 10) / 74, 0, 1);
  return buildSide(
    {
      hip: [98, 95],
      torso: 174,
      hand: [lerp(6, 16, liftRatio), lerp(55, 2, liftRatio)],
      handFrom: 'shoulder',
      ankle: [101, 178],
      elbowDir: [-0.4, 1],
    },
    sex
  );
}

// ───────────────────────── Músculos ─────────────────────────

/** [segmento, t centro, fracción de longitud, desplazamiento normal (+delante), grosor] */
type Placement = [SegName, number, number, number, number];

const SIDE_LIMB: Partial<Record<MuscleId, Placement[]>> = {
  deltoides_anterior: [['upperArm', 0.15, 0.36, 3, 8.5]],
  deltoides_lateral: [['upperArm', 0.14, 0.38, 0, 10]],
  deltoides_posterior: [['upperArm', 0.15, 0.36, -3, 8.5]],
  biceps: [['upperArm', 0.58, 0.55, 2.4, 5.5]],
  triceps: [['upperArm', 0.55, 0.62, -2.4, 6]],
  antebrazos: [['forearm', 0.38, 0.6, 0, 6]],
  gluteo_mayor: [['thigh', 0.08, 0.36, -5.5, 11]],
  gluteo_medio: [['thigh', -0.04, 0.22, -2, 8]],
  cuadriceps: [['thigh', 0.52, 0.72, 3.4, 8]],
  isquiotibiales: [['thigh', 0.56, 0.66, -3.4, 7]],
  aductores: [['thigh', 0.3, 0.46, 0.5, 6]],
  pantorrillas: [['shin', 0.3, 0.48, -2.8, 6.5]],
};

/** Torso: [t centro, fracción, desplazamiento, grosor] */
const SIDE_TORSO: Partial<Record<MuscleId, [number, number, number, number]>> = {
  pectorales: [0.78, 0.3, 8.5, 7],
  abdomen: [0.36, 0.42, 6.5, 5.5],
  oblicuos: [0.36, 0.38, 1.5, 8],
  dorsales: [0.62, 0.42, -6.5, 7],
  espalda_media: [0.8, 0.26, -7.5, 6],
  trapecio: [0.97, 0.26, -4, 6],
  lumbares: [0.22, 0.3, -6.5, 5],
};

export interface MuscleShape {
  key: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
  far?: boolean;
}

function ellipseOn(seg: Seg, t: number, frac: number, off: number, th: number, normal: V): MuscleShape {
  const c = add(lerpV(seg.a, seg.b, t), mul(normal, off));
  const d = sub(seg.b, seg.a);
  const rot = (Math.atan2(d[1], d[0]) * 180) / Math.PI;
  return { key: '', cx: c[0], cy: c[1], rx: Math.max(2, (len(d) * frac) / 2), ry: th / 2, rot };
}

export function muscleShapes(sk: Skeleton, muscle: MuscleId): MuscleShape[] {
  const out: MuscleShape[] = [];
  if (sk.view === 'side') {
    const tor = SIDE_TORSO[muscle];
    if (tor && sk.segs.torso) {
      const [t, frac, off, th] = tor;
      out.push({ ...ellipseOn(sk.segs.torso, t, frac, off, th, sk.torsoFront), key: `${muscle}-t` });
    }
    const limb = SIDE_LIMB[muscle];
    if (limb) {
      for (const [seg, t, frac, off, th] of limb) {
        for (const name of [seg, `${seg}2` as SegName]) {
          const s = sk.segs[name];
          if (!s) continue;
          out.push({
            ...ellipseOn(s, t, frac, off, th, limbFront(s)),
            key: `${muscle}-${name}`,
            far: s.far,
          });
        }
      }
    }
    return out;
  }

  // Vista frontal o de espalda
  const isBack = sk.view === 'back';
  const pairs: [SegName, SegName][] = [
    ['upperArm', 'upperArm2'],
    ['forearm', 'forearm2'],
    ['thigh', 'thigh2'],
    ['shin', 'shin2'],
  ];
  const onLimb = (base: SegName, t: number, frac: number, off: number, th: number) => {
    const pair = pairs.find((p) => p[0] === base)!;
    for (const name of pair) {
      const s = sk.segs[name];
      if (!s) continue;
      out.push({ ...ellipseOn(s, t, frac, off, th, limbFront(s)), key: `${muscle}-${name}` });
    }
  };
  const shY = sk.shoulder[1];
  const hipY = sk.hip[1];
  const torsoH = Math.max(24, hipY - shY);
  const yAt = (frac: number) => shY + torsoH * frac;

  switch (muscle) {
    case 'deltoides_lateral':
    case 'deltoides_anterior':
    case 'deltoides_posterior':
      onLimb('upperArm', 0.14, 0.42, 2, 10);
      break;
    case 'trapecio':
      out.push({ key: 'trap-r', cx: CX + 10, cy: shY - 1.5, rx: 10, ry: 3.8, rot: 18 });
      out.push({ key: 'trap-l', cx: CX - 10, cy: shY - 1.5, rx: 10, ry: 3.8, rot: -18 });
      if (isBack) {
        out.push({ key: 'trap-mid', cx: CX, cy: yAt(0.24), rx: 9.5, ry: torsoH * 0.22, rot: 0 });
      }
      break;
    case 'espalda_media':
      out.push({ key: 'rhom-r', cx: CX + 8.5, cy: yAt(0.28), rx: 7.5, ry: torsoH * 0.18, rot: -10 });
      out.push({ key: 'rhom-l', cx: CX - 8.5, cy: yAt(0.28), rx: 7.5, ry: torsoH * 0.18, rot: 10 });
      break;
    case 'dorsales':
      out.push({ key: 'lat-r', cx: CX + 13.5, cy: yAt(0.46), rx: 6.5, ry: torsoH * 0.26, rot: 14 });
      out.push({ key: 'lat-l', cx: CX - 13.5, cy: yAt(0.46), rx: 6.5, ry: torsoH * 0.26, rot: -14 });
      break;
    case 'lumbares':
      out.push({ key: 'lumb-r', cx: CX + 5.5, cy: yAt(0.76), rx: 4.5, ry: torsoH * 0.18, rot: 0 });
      out.push({ key: 'lumb-l', cx: CX - 5.5, cy: yAt(0.76), rx: 4.5, ry: torsoH * 0.18, rot: 0 });
      break;
    case 'biceps':
    case 'triceps':
      onLimb('upperArm', 0.56, 0.56, 0, 6.5);
      break;
    case 'antebrazos':
      onLimb('forearm', 0.38, 0.6, 0, 6);
      break;
    case 'gluteo_medio':
      onLimb('thigh', -0.02, 0.24, 9, 7.5);
      break;
    case 'gluteo_mayor':
      if (isBack) {
        out.push({ key: 'glut-r', cx: CX + 8.5, cy: hipY + 2, rx: 8.5, ry: 9.5, rot: 8 });
        out.push({ key: 'glut-l', cx: CX - 8.5, cy: hipY + 2, rx: 8.5, ry: 9.5, rot: -8 });
      } else {
        onLimb('thigh', 0.1, 0.3, 2, 10);
      }
      break;
    case 'aductores':
      onLimb('thigh', 0.32, 0.5, -3.5, 6);
      break;
    case 'cuadriceps':
    case 'isquiotibiales':
      onLimb('thigh', 0.54, 0.7, 0.5, 8.2);
      break;
    case 'pantorrillas':
      onLimb('shin', 0.32, 0.5, 0, 6.8);
      break;
    case 'pectorales':
      out.push({ key: 'pec-r', cx: CX + 10, cy: yAt(0.24), rx: 9.2, ry: Math.max(4.5, torsoH * 0.13), rot: 0 });
      out.push({ key: 'pec-l', cx: CX - 10, cy: yAt(0.24), rx: 9.2, ry: Math.max(4.5, torsoH * 0.13), rot: 0 });
      break;
    case 'abdomen':
      out.push({ key: 'abs', cx: CX, cy: yAt(0.62), rx: 6.8, ry: Math.max(8, torsoH * 0.27), rot: 0 });
      break;
    case 'oblicuos':
      out.push({ key: 'obl-r', cx: CX + 13, cy: yAt(0.64), rx: 3.8, ry: Math.max(7, torsoH * 0.22), rot: -8 });
      out.push({ key: 'obl-l', cx: CX - 13, cy: yAt(0.64), rx: 3.8, ry: Math.max(7, torsoH * 0.22), rot: 8 });
      break;
    default:
      break;
  }
  return out;
}

/** Polígono de una extremidad cónica (cápsula) con extremos redondeados. */
export function capsulePath(s: Seg): string {
  const d = sub(s.b, s.a);
  const l = len(d) || 1;
  const n: V = [-d[1] / l, d[0] / l];
  const a1 = add(s.a, mul(n, s.wa / 2));
  const a2 = add(s.a, mul(n, -s.wa / 2));
  const b1 = add(s.b, mul(n, s.wb / 2));
  const b2 = add(s.b, mul(n, -s.wb / 2));
  const f = (v: V) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`;
  return `M ${f(a1)} L ${f(b1)} A ${(s.wb / 2).toFixed(1)} ${(s.wb / 2).toFixed(1)} 0 0 1 ${f(b2)} L ${f(a2)} A ${(s.wa / 2).toFixed(1)} ${(s.wa / 2).toFixed(1)} 0 0 1 ${f(a1)} Z`;
}

export type LimbKind = 'thigh' | 'shin' | 'upperArm' | 'forearm';

/** Contorno anatómico esculpido con vientres musculares reales (cuádriceps, pantorrilla, bíceps, antebrazo). */
export function anatomicalLimbPath(s: Seg, kind: LimbKind): string {
  const d = sub(s.b, s.a);
  const l = len(d) || 1;
  const nf = limbFront(s); // normal hacia el frente anatómico
  const f = (v: V) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`;

  const ra = s.wa / 2;
  const rb = s.wb / 2;

  // Factores de abultamiento frontal (+nf) y posterior (-nf) en t = 0.35 y t = 0.7
  const profile: Record<LimbKind, [number, number, number, number]> = {
    thigh: [1.18, 0.96, 1.12, 0.92], // cuádriceps prominente al frente + isquiotibial detrás
    shin: [0.85, 0.72, 1.38, 0.68], // tibia recta al frente + gastrocnemio curvo y tendón de Aquiles fino
    upperArm: [1.12, 0.96, 1.12, 0.94], // deltoides/bíceps y tríceps
    forearm: [1.16, 0.78, 1.12, 0.75], // braquiorradial lleno cerca del codo, fino en muñeca
  };
  const [f1, f2, b1k, b2k] = profile[kind];

  const pt = (t: number, dist: number) => add(lerpV(s.a, s.b, t), mul(nf, dist));
  const aF = pt(0, ra);
  const aB = pt(0, -ra);
  const bF = pt(1, rb);
  const bB = pt(1, -rb);

  const cF1 = pt(0.32, lerp(ra, rb, 0.32) * f1);
  const cF2 = pt(0.72, lerp(ra, rb, 0.72) * f2);
  const cB1 = pt(0.72, -lerp(ra, rb, 0.72) * b2k);
  const cB2 = pt(0.30, -lerp(ra, rb, 0.30) * b1k);

  return (
    `M ${f(aF)} ` +
    `C ${f(cF1)} ${f(cF2)} ${f(bF)} ` +
    `A ${rb.toFixed(1)} ${rb.toFixed(1)} 0 0 1 ${f(bB)} ` +
    `C ${f(cB1)} ${f(cB2)} ${f(aB)} ` +
    `A ${ra.toFixed(1)} ${ra.toFixed(1)} 0 0 1 ${f(aF)} Z`
  );
}

/** Silueta anatómica de calzado deportivo / pie (talón, arco, suela y puntera). */
export function footPath(ankle: V, toe: V): string {
  const d = sub(toe, ankle);
  const l = len(d) || 1;
  const u: V = [d[0] / l, d[1] / l];
  const down: V = [-u[1], u[0]];
  // Asegurar que `down` apunta hacia abajo (y+)
  const dn: V = down[1] >= 0 ? down : [-down[0], -down[1]];
  const f = (v: V) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`;

  const heelTop = add(ankle, mul(u, -4.5));
  const heelBot = add(add(ankle, mul(u, -4.2)), mul(dn, 4.8));
  const arch = add(lerpV(ankle, toe, 0.45), mul(dn, 4.6));
  const toeBot = add(add(toe, mul(u, 2)), mul(dn, 3.6));
  const toeTop = add(add(toe, mul(u, 1.2)), mul(dn, -1.6));
  const instep = add(lerpV(ankle, toe, 0.42), mul(dn, -2.2));
  const ankleTop = add(ankle, mul(dn, -3.2));

  return (
    `M ${f(ankleTop)} ` +
    `Q ${f(instep)} ${f(toeTop)} ` +
    `Q ${f(add(toe, mul(u, 3.5)))} ${f(toeBot)} ` +
    `Q ${f(arch)} ${f(heelBot)} ` +
    `Q ${f(add(heelTop, mul(dn, 2)))} ${f(heelTop)} Z`
  );
}

/** Cabeza esculpida con perfil facial realista (frente, nariz, mentón, cráneo). */
export function sideHeadPath(head: V, neckBase: V): string {
  const d = sub(head, neckBase);
  const l = len(d) || 1;
  const up: V = [d[0] / l, d[1] / l];
  // Frente apunta a la derecha (x+) cuando la figura está erguida
  const fwd: V = [-up[1], up[0]];
  const f = (v: V) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`;
  const p = (fx: number, fy: number) => add(add(head, mul(fwd, fx)), mul(up, fy));

  return (
    `M ${f(p(-2, -9.5))} ` +
    `C ${f(p(-10.5, -8.5))} ${f(p(-11.5, 4.5))} ${f(p(-4.5, 9.8))} ` +
    `C ${f(p(2.5, 11.5))} ${f(p(9.2, 8.2))} ${f(p(9.6, 2.2))} ` +
    `L ${f(p(11.0, -0.5))} ` +
    `L ${f(p(9.2, -2.0))} ` +
    `C ${f(p(9.4, -5.2))} ${f(p(7.5, -8.5))} ${f(p(4.2, -9.2))} ` +
    `C ${f(p(1.5, -9.8))} ${f(p(-0.5, -9.8))} ${f(p(-2, -9.5))} Z`
  );
}
