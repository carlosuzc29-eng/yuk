import * as THREE from 'three';
import type { Exercise, MovementPattern } from '@/types/training';
import type { Sex } from '@/types/user';
import { PATTERNS, type PatternDef } from './poses';
import { L, buildFront, buildSide, lerpFront, lerpSide, type Skeleton, type V } from './rig';

/** Escala: 100 px del rig 2D = 1.02 m reales (estatura ~1.72 m). */
export const SCALE_3D = 0.0102;
export const GROUND_2D = 182;

export const BONE_LEN_3D = {
  torso: L.torso * SCALE_3D,
  upperArm: L.upperArm * SCALE_3D,
  forearm: L.forearm * SCALE_3D,
  thigh: L.thigh * SCALE_3D,
  shin: L.shin * SCALE_3D,
};

export interface Pose3D {
  pelvis: THREE.Vector3;
  waist: THREE.Vector3;
  chest: THREE.Vector3;
  neckBase: THREE.Vector3;
  head: THREE.Vector3;
  torsoRight: THREE.Vector3;
  torsoUp: THREE.Vector3;
  torsoForward: THREE.Vector3;

  shoulderL: THREE.Vector3;
  shoulderR: THREE.Vector3;
  elbowL: THREE.Vector3;
  elbowR: THREE.Vector3;
  wristL: THREE.Vector3;
  wristR: THREE.Vector3;

  hipL: THREE.Vector3;
  hipR: THREE.Vector3;
  kneeL: THREE.Vector3;
  kneeR: THREE.Vector3;
  ankleL: THREE.Vector3;
  ankleR: THREE.Vector3;
  toeL: THREE.Vector3;
  toeR: THREE.Vector3;

  anchor?: THREE.Vector3;
  groundY: number;
  isSidePattern: boolean;
}

/** Convierte un punto 2D de vista lateral (x=adelante, y=abajo) a 3D en el plano medio (x=0). */
export function side2DTo3D(p: V, lateralX = 0): THREE.Vector3 {
  return new THREE.Vector3(
    lateralX,
    (GROUND_2D - p[1]) * SCALE_3D,
    (p[0] - 100) * SCALE_3D
  );
}

/** Convierte un punto 2D de vista frontal (x=lateral, y=abajo) a 3D. */
export function front2DTo3D(p: V, depthZ = 0): THREE.Vector3 {
  return new THREE.Vector3(
    (p[0] - 120) * SCALE_3D,
    (GROUND_2D - p[1]) * SCALE_3D,
    depthZ
  );
}

/**
 * Cinemática inversa analítica 3D de dos huesos con longitudes CONSTANTES `l1` y `l2`.
 * Garantiza que ninguna extremidad se estire, aplaste ni desconecte en ningún ejercicio.
 */
export function solveIK3D(
  root: THREE.Vector3,
  target: THREE.Vector3,
  l1: number,
  l2: number,
  poleHint: THREE.Vector3
): { joint: THREE.Vector3; end: THREE.Vector3 } {
  const diff = target.clone().sub(root);
  const dist = diff.length();
  const minDist = Math.abs(l1 - l2) + 0.005;
  const maxDist = l1 + l2 - 0.003;
  const clampedDist = THREE.MathUtils.clamp(dist, minDist, maxDist);

  const dir = dist > 1e-5 ? diff.clone().divideScalar(dist) : new THREE.Vector3(0, -1, 0);
  const end = root.clone().addScaledVector(dir, clampedDist);

  // Ángulo en la raíz por ley de cosenos
  const cosAngle = THREE.MathUtils.clamp(
    (l1 * l1 + clampedDist * clampedDist - l2 * l2) / (2 * l1 * clampedDist),
    -1,
    1
  );
  const sinAngle = Math.sqrt(Math.max(0, 1 - cosAngle * cosAngle));

  // Proyectar poleHint ortogonalmente a `dir` para definir el plano de flexión natural
  const poleOrtho = poleHint
    .clone()
    .addScaledVector(dir, -poleHint.dot(dir));
  if (poleOrtho.lengthSq() < 1e-6) {
    poleOrtho.set(0, 0, 1).addScaledVector(dir, -dir.z);
    if (poleOrtho.lengthSq() < 1e-6) poleOrtho.set(1, 0, 0);
  }
  poleOrtho.normalize();

  const joint = root
    .clone()
    .addScaledVector(dir, l1 * cosAngle)
    .addScaledVector(poleOrtho, l1 * sinAngle);

  return { joint, end };
}

interface LateralConfig {
  handHalfWidth: number;
  elbowOutFlare: number;
  footHalfWidth: number;
  kneeOutFlare: number;
}

function lateralConfigFor(
  pattern: MovementPattern,
  equipment: Exercise['equipment'],
  sex: Sex
): LateralConfig {
  const f = sex === 'female';
  const sh = f ? 0.165 : 0.195;
  const hip = f ? 0.105 : 0.098;

  let handHalfWidth = sh * 1.05;
  let elbowOutFlare = 0.08;
  let footHalfWidth = hip * 1.15;
  let kneeOutFlare = 0.04;

  switch (pattern) {
    case 'bench_press':
    case 'incline_press':
    case 'chest_press_machine':
    case 'push_up':
      handHalfWidth = equipment === 'barra' ? 0.31 : 0.25;
      elbowOutFlare = 0.22;
      footHalfWidth = 0.17;
      kneeOutFlare = 0.06;
      break;
    case 'fly_lying':
    case 'fly_cable':
      handHalfWidth = 0.32;
      elbowOutFlare = 0.28;
      break;
    case 'pulldown':
    case 'pull_up':
      handHalfWidth = 0.32;
      elbowOutFlare = 0.28;
      footHalfWidth = 0.12;
      break;
    case 'squat_back':
    case 'squat_front':
    case 'squat_machine':
    case 'good_morning':
      handHalfWidth = equipment === 'barra' ? 0.33 : 0.13;
      elbowOutFlare = equipment === 'barra' ? 0.22 : 0.08;
      footHalfWidth = 0.18;
      kneeOutFlare = 0.14;
      break;
    case 'leg_press':
      handHalfWidth = 0.25;
      footHalfWidth = 0.16;
      kneeOutFlare = 0.1;
      break;
    case 'hinge':
      handHalfWidth = equipment === 'barra' ? 0.24 : 0.21;
      footHalfWidth = 0.14;
      kneeOutFlare = 0.05;
      break;
    case 'hip_thrust':
    case 'glute_bridge':
      handHalfWidth = 0.23;
      footHalfWidth = 0.16;
      kneeOutFlare = 0.1;
      break;
    case 'overhead_press':
    case 'overhead_press_seated':
      handHalfWidth = equipment === 'barra' ? 0.26 : 0.23;
      elbowOutFlare = 0.2;
      break;
    case 'row_bent':
    case 'row_chest_supported':
    case 'inverted_row':
      handHalfWidth = equipment === 'barra' ? 0.27 : 0.22;
      elbowOutFlare = 0.16;
      break;
    case 'row_seated':
    case 'pushdown':
    case 'triceps_overhead':
    case 'kb_swing':
    case 'ab_wheel':
    case 'pallof_press':
    case 'cable_crunch':
    case 'straight_arm_pulldown':
      handHalfWidth = 0.11;
      elbowOutFlare = 0.08;
      break;
    case 'face_pull':
      handHalfWidth = 0.22;
      elbowOutFlare = 0.26;
      break;
    case 'rear_delt_fly':
      handHalfWidth = 0.34;
      elbowOutFlare = 0.24;
      break;
    case 'dip':
      handHalfWidth = 0.25;
      elbowOutFlare = 0.14;
      footHalfWidth = 0.08;
      break;
    case 'lunge':
    case 'split_squat_rear':
    case 'step_up':
      handHalfWidth = equipment === 'barra' ? 0.32 : 0.22;
      footHalfWidth = 0.12;
      kneeOutFlare = 0.04;
      break;
    default:
      break;
  }

  return { handHalfWidth, elbowOutFlare, footHalfWidth, kneeOutFlare };
}

/**
 * Construye una pose 3D biomecánicamente exacta para cualquier ejercicio.
 * Usa `sk.torsoFront` para orientar el pecho/rostro correctamente tanto de pie
 * como tumbado boca arriba (press banca), boca abajo (flexiones/plancha/curl femoral) o inclinado.
 */
export function buildPose3D(
  exercise: Exercise,
  t: number,
  sex: Sex
): { pose: Pose3D; sk: Skeleton; def: PatternDef } {
  const def = PATTERNS[exercise.pattern];
  const f = sex === 'female';
  const shHalf = f ? 0.165 : 0.195;
  const hipHalf = f ? 0.105 : 0.098;

  if (def.view === 'side') {
    const sk = buildSide(lerpSide(def.a, def.b, t), sex);
    const cfg = lateralConfigFor(exercise.pattern, exercise.equipment, sex);

    let handHalf = cfg.handHalfWidth;
    if (exercise.pattern === 'fly_lying') {
      handHalf = THREE.MathUtils.lerp(0.1, 0.39, t);
    } else if (exercise.pattern === 'fly_cable') {
      handHalf = THREE.MathUtils.lerp(0.38, 0.08, t);
    } else if (exercise.pattern === 'rear_delt_fly') {
      handHalf = THREE.MathUtils.lerp(0.12, 0.4, t);
    }

    const pelvis = side2DTo3D(sk.hip, 0);
    const neckBase = side2DTo3D(sk.shoulder, 0);
    const head = side2DTo3D(sk.head, 0);
    const waist = pelvis.clone().lerp(neckBase, 0.38);
    const chest = pelvis.clone().lerp(neckBase, 0.72);

    // Base ortonormal real del torso a partir de `sk.torsoFront`
    // En 2D: x -> +Z, y -> -Y
    const torsoUp = neckBase.clone().sub(pelvis).normalize();
    const rawForward = new THREE.Vector3(0, -sk.torsoFront[1], sk.torsoFront[0]).normalize();
    // Asegurar ortogonalidad exacta:
    // torsoRight apunta hacia el hombro DERECHO del atleta (-X cuando está de pie mirando a +Z,
    // +X cuando está tumbado boca arriba con la cabeza en -Z y el pecho hacia +Y)
    const torsoRight = new THREE.Vector3().crossVectors(torsoUp, rawForward).normalize();
    const torsoForward = new THREE.Vector3().crossVectors(torsoRight, torsoUp).normalize();

    // Hombros y caderas colocados a lo largo del eje real `torsoRight`
    const shoulderR = neckBase.clone().addScaledVector(torsoRight, shHalf);
    const shoulderL = neckBase.clone().addScaledVector(torsoRight, -shHalf);
    const hipR = pelvis.clone().addScaledVector(torsoRight, hipHalf);
    const hipL = pelvis.clone().addScaledVector(torsoRight, -hipHalf);

    // Objetivos de manos y tobillos con separación lateral respecto a `torsoRight`
    const wristTargetR = side2DTo3D(sk.hand, 0).addScaledVector(torsoRight, handHalf);
    const wristTargetL = side2DTo3D(sk.hand2, 0).addScaledVector(torsoRight, -handHalf);

    const ankleTargetR = side2DTo3D(sk.ankle, 0).addScaledVector(torsoRight, cfg.footHalfWidth);
    const ankleTargetL = side2DTo3D(sk.ankle2, 0).addScaledVector(torsoRight, -cfg.footHalfWidth);

    // Vectores guía (pole vectors) en 3D a partir de las articulaciones 2D resueltas
    const elbow2DR = side2DTo3D(sk.segs.upperArm!.b, 0).addScaledVector(
      torsoRight,
      shHalf + cfg.elbowOutFlare
    );
    const elbow2DL = side2DTo3D(sk.segs.upperArm2!.b, 0).addScaledVector(
      torsoRight,
      -(shHalf + cfg.elbowOutFlare)
    );
    const knee2DR = side2DTo3D(sk.segs.thigh!.b, 0).addScaledVector(
      torsoRight,
      hipHalf + cfg.kneeOutFlare
    );
    const knee2DL = side2DTo3D(sk.segs.thigh2!.b, 0).addScaledVector(
      torsoRight,
      -(hipHalf + cfg.kneeOutFlare)
    );

    const poleArmR = elbow2DR.sub(shoulderR.clone().lerp(wristTargetR, 0.5));
    const poleArmL = elbow2DL.sub(shoulderL.clone().lerp(wristTargetL, 0.5));
    const poleLegR = knee2DR.sub(hipR.clone().lerp(ankleTargetR, 0.5));
    const poleLegL = knee2DL.sub(hipL.clone().lerp(ankleTargetL, 0.5));

    // Resolver IK 3D con longitudes de hueso constantes
    const armIK_R = solveIK3D(
      shoulderR,
      wristTargetR,
      BONE_LEN_3D.upperArm,
      BONE_LEN_3D.forearm,
      poleArmR
    );
    const armIK_L = solveIK3D(
      shoulderL,
      wristTargetL,
      BONE_LEN_3D.upperArm,
      BONE_LEN_3D.forearm,
      poleArmL
    );
    const legIK_R = solveIK3D(
      hipR,
      ankleTargetR,
      BONE_LEN_3D.thigh,
      BONE_LEN_3D.shin,
      poleLegR
    );
    const legIK_L = solveIK3D(
      hipL,
      ankleTargetL,
      BONE_LEN_3D.thigh,
      BONE_LEN_3D.shin,
      poleLegL
    );

    const toeDeltaR = side2DTo3D(sk.toe, 0).sub(side2DTo3D(sk.ankle, 0));
    const toeDeltaL = side2DTo3D(sk.toe2, 0).sub(side2DTo3D(sk.ankle2, 0));
    const toeR = legIK_R.end.clone().add(toeDeltaR).addScaledVector(torsoRight, 0.015);
    const toeL = legIK_L.end.clone().add(toeDeltaL).addScaledVector(torsoRight, -0.015);

    const anchor = def.anchor ? side2DTo3D(def.anchor, 0) : undefined;

    return {
      sk,
      def,
      pose: {
        pelvis,
        waist,
        chest,
        neckBase,
        head,
        torsoRight,
        torsoUp,
        torsoForward,
        shoulderL,
        shoulderR,
        elbowL: armIK_L.joint,
        elbowR: armIK_R.joint,
        wristL: armIK_L.end,
        wristR: armIK_R.end,
        hipL,
        hipR,
        kneeL: legIK_L.joint,
        kneeR: legIK_R.joint,
        ankleL: legIK_L.end,
        ankleR: legIK_R.end,
        toeL,
        toeR,
        anchor,
        groundY: 0,
        isSidePattern: true,
      },
    };
  }

  // Vista frontal (elevaciones laterales, encogimientos, abducción/aducción)
  const sk = buildFront(lerpFront(def.a, def.b, t), sex);
  const pelvis = new THREE.Vector3(0, (GROUND_2D - 98) * SCALE_3D, 0);
  const neckBase = new THREE.Vector3(0, (GROUND_2D - sk.shoulder[1]) * SCALE_3D, 0);
  const head = front2DTo3D(sk.head, 0);
  const waist = pelvis.clone().lerp(neckBase, 0.38);
  const chest = pelvis.clone().lerp(neckBase, 0.72);

  const torsoUp = new THREE.Vector3(0, 1, 0);
  const torsoRight = new THREE.Vector3(-1, 0, 0);
  const torsoForward = new THREE.Vector3(0, 0, 1);

  const uArmR = sk.segs.upperArm!;
  const uArmL = sk.segs.upperArm2!;
  const thighR = sk.segs.thigh!;
  const thighL = sk.segs.thigh2!;

  const shoulderL = front2DTo3D(uArmR.a, 0);
  const shoulderR = front2DTo3D(uArmL.a, 0);
  const elbowL = front2DTo3D(uArmR.b, 0.02);
  const elbowR = front2DTo3D(uArmL.b, 0.02);
  const wristL = front2DTo3D(sk.hand, 0.06);
  const wristR = front2DTo3D(sk.hand2, 0.06);

  const hipL = front2DTo3D(thighR.a, 0);
  const hipR = front2DTo3D(thighL.a, 0);
  const kneeL = front2DTo3D(thighR.b, 0.02);
  const kneeR = front2DTo3D(thighL.b, 0.02);
  const ankleL = front2DTo3D(sk.ankle, 0);
  const ankleR = front2DTo3D(sk.ankle2, 0);
  const toeL = ankleL.clone().add(new THREE.Vector3(0.02, -0.02, 0.14));
  const toeR = ankleR.clone().add(new THREE.Vector3(-0.02, -0.02, 0.14));

  const anchor =
    exercise.equipment === 'polea' || exercise.equipment === 'banda'
      ? new THREE.Vector3(-0.78, 0.08, 0)
      : undefined;

  return {
    sk,
    def,
    pose: {
      pelvis,
      waist,
      chest,
      neckBase,
      head,
      torsoRight,
      torsoUp,
      torsoForward,
      shoulderL,
      shoulderR,
      elbowL,
      elbowR,
      wristL,
      wristR,
      hipL,
      hipR,
      kneeL,
      kneeR,
      ankleL,
      ankleR,
      toeL,
      toeR,
      anchor,
      groundY: 0,
      isSidePattern: false,
    },
  };
}
