/**
 * Motor de animación del maniquí de YUK.
 * Vista lateral (mira a la derecha) con cinemática inversa de dos huesos para brazos y piernas,
 * y vista frontal para movimientos en el plano frontal (elevaciones laterales, abducciones…).
 *
 * Convención de ángulos: 0° = hacia abajo, 90° = hacia delante (derecha), 180° = arriba, 270° = atrás.
 */
import type { MuscleId } from '@/types/user';

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
  view: 'side' | 'front';
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
  /** Contorno del torso (vista lateral) o trapecio (vista frontal). */
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

function torsoOutline(hip: V, shoulder: V, front: V): string {
  const prof: [number, number, number][] = [
    // t, delante, detrás
    [0, 8, 11],
    [0.35, 9, 8],
    [0.72, 12, 10],
    [1, 7, 8],
  ];
  const fwd = prof.map(([t, f]) => add(lerpV(hip, shoulder, t), mul(front, f)));
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

export function buildSide(p: SidePose): Skeleton {
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

  return {
    view: 'side',
    segs: {
      torso: { a: hip, b: shoulder, wa: 20, wb: 16, ns: 1 },
      thigh2: { a: hip, b: leg2.joint, wa: 15, wb: 10, ns: 1, far: true },
      shin2: { a: leg2.joint, b: leg2.end, wa: 10, wb: 6.5, ns: 1, far: true },
      upperArm2: { a: shoulder, b: arm2.joint, wa: 10, wb: 7.5, ns: 1, far: true },
      forearm2: { a: arm2.joint, b: arm2.end, wa: 7.5, wb: 5.5, ns: 1, far: true },
      thigh: { a: hip, b: leg.joint, wa: 15, wb: 10, ns: 1 },
      shin: { a: leg.joint, b: leg.end, wa: 10, wb: 6.5, ns: 1 },
      upperArm: { a: shoulder, b: arm.joint, wa: 10, wb: 7.5, ns: 1 },
      forearm: { a: arm.joint, b: arm.end, wa: 7.5, wb: 5.5, ns: 1 },
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
    torsoPath: torsoOutline(hip, shoulder, torsoFront),
    torsoFront,
  };
}

const CX = 120;

export function buildFront(p: FrontPose): Skeleton {
  const shY = 46 + p.lift;
  const shR: V = [CX + 21, shY];
  const shL: V = [CX - 21, shY];
  const hipR: V = [CX + 11, 98];
  const hipL: V = [CX - 11, 98];
  const head: V = [CX, 24];

  const elR = add(shR, mul(dir(p.arm), L.upperArm));
  const handR = add(elR, mul(dir(p.arm + p.elbow), L.forearm));
  const elL = add(shL, mul(dir(-p.arm), L.upperArm));
  const handL = add(elL, mul(dir(-(p.arm + p.elbow)), L.forearm));

  const legR = p.leg;
  const legL = -(p.leg2 ?? 3);
  const knR = add(hipR, mul(dir(legR), L.thigh));
  const anR = add(knR, mul(dir(legR), L.shin));
  const knL = add(hipL, mul(dir(legL), L.thigh));
  const anL = add(knL, mul(dir(legL), L.shin));

  // Torso frontal: hombros anchos, cintura, cadera
  const tp = [
    [CX - 22, shY + 2],
    [CX + 22, shY + 2],
    [CX + 17, 74],
    [CX + 15, 88],
    [CX + 19, 100],
    [CX - 19, 100],
    [CX - 15, 88],
    [CX - 17, 74],
  ] as V[];
  const torsoPath =
    `M ${tp[0][0]} ${tp[0][1]} Q ${CX} ${shY - 3} ${tp[1][0]} ${tp[1][1]} ` +
    `Q ${CX + 21} 62 ${tp[2][0]} ${tp[2][1]} L ${tp[3][0]} ${tp[3][1]} Q ${CX + 20} 94 ${tp[4][0]} ${tp[4][1]} ` +
    `L ${tp[5][0]} ${tp[5][1]} Q ${CX - 20} 94 ${tp[6][0]} ${tp[6][1]} L ${tp[7][0]} ${tp[7][1]} Q ${CX - 21} 62 ${tp[0][0]} ${tp[0][1]} Z`;

  return {
    view: 'front',
    segs: {
      thigh2: { a: hipL, b: knL, wa: 15, wb: 10, ns: -1 },
      shin2: { a: knL, b: anL, wa: 10, wb: 6.5, ns: -1 },
      thigh: { a: hipR, b: knR, wa: 15, wb: 10, ns: 1 },
      shin: { a: knR, b: anR, wa: 10, wb: 6.5, ns: 1 },
      upperArm2: { a: shL, b: elL, wa: 10, wb: 7.5, ns: -1 },
      forearm2: { a: elL, b: handL, wa: 7.5, wb: 5.5, ns: -1 },
      upperArm: { a: shR, b: elR, wa: 10, wb: 7.5, ns: 1 },
      forearm: { a: elR, b: handR, wa: 7.5, wb: 5.5, ns: 1 },
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

  // Vista frontal
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
  switch (muscle) {
    case 'deltoides_lateral':
    case 'deltoides_anterior':
    case 'deltoides_posterior':
      onLimb('upperArm', 0.14, 0.4, 2, 10);
      break;
    case 'trapecio':
      out.push({ key: 'trap-r', cx: CX + 10, cy: shY - 2, rx: 10, ry: 3.5, rot: 18 });
      out.push({ key: 'trap-l', cx: CX - 10, cy: shY - 2, rx: 10, ry: 3.5, rot: -18 });
      break;
    case 'biceps':
    case 'triceps':
      onLimb('upperArm', 0.58, 0.55, 0, 6);
      break;
    case 'antebrazos':
      onLimb('forearm', 0.38, 0.6, 0, 6);
      break;
    case 'gluteo_medio':
      onLimb('thigh', -0.02, 0.24, 9, 7);
      break;
    case 'gluteo_mayor':
      onLimb('thigh', 0.1, 0.3, 2, 10);
      break;
    case 'aductores':
      onLimb('thigh', 0.3, 0.5, -3.5, 6);
      break;
    case 'cuadriceps':
      onLimb('thigh', 0.55, 0.7, 0.5, 8);
      break;
    case 'pantorrillas':
      onLimb('shin', 0.3, 0.48, 0, 6);
      break;
    case 'pectorales':
      out.push({ key: 'pec-r', cx: CX + 10, cy: shY + 13, rx: 9, ry: 6, rot: 0 });
      out.push({ key: 'pec-l', cx: CX - 10, cy: shY + 13, rx: 9, ry: 6, rot: 0 });
      break;
    case 'abdomen':
      out.push({ key: 'abs', cx: CX, cy: 80, rx: 6.5, ry: 14, rot: 0 });
      break;
    case 'oblicuos':
      out.push({ key: 'obl-r', cx: CX + 13, cy: 82, rx: 3.5, ry: 11, rot: -8 });
      out.push({ key: 'obl-l', cx: CX - 13, cy: 82, rx: 3.5, ry: 11, rot: 8 });
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
