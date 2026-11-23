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
  /** Eje +X del personaje (apunta hacia su hombro IZQUIERDO; forma base dextrógira con torsoUp y torsoForward). */
  torsoLeft: THREE.Vector3;
  /** Eje -X del personaje (apunta hacia su hombro DERECHO). */
  torsoRight: THREE.Vector3;
  /** Eje +Y del torso (pelvis -> cuello). */
  torsoUp: THREE.Vector3;
  /** Eje +Z del torso (dirección hacia donde mira el pecho/rostro). */
  torsoForward: THREE.Vector3;

  shoulderL: THREE.Vector3;
  shoulderR: THREE.Vector3;
  elbowL: THREE.Vector3;
  elbowR: THREE.Vector3;
  wristL: THREE.Vector3;
  wristR: THREE.Vector3;
  /** Eje de los nudillos de cada mano para orientar mancuernas y agarres. */
  gripAxisL?: THREE.Vector3;
  gripAxisR?: THREE.Vector3;

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

  const cosAngle = THREE.MathUtils.clamp(
    (l1 * l1 + clampedDist * clampedDist - l2 * l2) / (2 * l1 * clampedDist),
    -1,
    1
  );
  const sinAngle = Math.sqrt(Math.max(0, 1 - cosAngle * cosAngle));

  const poleOrtho = poleHint.clone().addScaledVector(dir, -poleHint.dot(dir));
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
  const sh = f ? 0.155 : 0.21;
  const hip = f ? 0.095 : 0.105;

  let handHalfWidth = sh * 1.05;
  let elbowOutFlare = 0.08;
  let footHalfWidth = hip * 1.15;
  let kneeOutFlare = 0.04;

  switch (pattern) {
    case 'bench_press':
    case 'incline_press':
      // Pies abiertos y apoyados a los lados del banco (que mide ~0,34 m de ancho).
      handHalfWidth = equipment === 'barra' ? 0.31 : 0.25;
      elbowOutFlare = 0.22;
      footHalfWidth = 0.3;
      kneeOutFlare = 0.12;
      break;
    case 'chest_press_machine':
    case 'push_up':
      handHalfWidth = equipment === 'barra' ? 0.31 : 0.25;
      elbowOutFlare = 0.22;
      footHalfWidth = 0.17;
      kneeOutFlare = 0.06;
      break;
    case 'fly_lying':
      handHalfWidth = 0.32;
      elbowOutFlare = 0.28;
      footHalfWidth = 0.3;
      kneeOutFlare = 0.12;
      break;
    case 'fly_cable':
      handHalfWidth = 0.32;
      elbowOutFlare = 0.28;
      break;
    case 'skull_crusher':
      handHalfWidth = 0.15; // agarre de barra EZ, algo más estrecho que los hombros
      elbowOutFlare = 0.06;
      footHalfWidth = 0.3;
      kneeOutFlare = 0.12;
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
    case 'farmer_carry':
    case 'calf_raise':
      handHalfWidth = equipment === 'barra' ? 0.33 : sh + 0.085;
      footHalfWidth = 0.12;
      kneeOutFlare = 0.04;
      break;
    case 'curl':
    case 'curl_preacher':
    case 'curl_bayesian':
      handHalfWidth = equipment === 'barra' ? 0.24 : sh + 0.045;
      elbowOutFlare = 0.04;
      footHalfWidth = 0.14;
      break;
    default:
      if (equipment === 'mancuernas' || equipment === 'kettlebell') {
        handHalfWidth = Math.max(handHalfWidth, sh + 0.065);
      }
      break;
  }

  return { handHalfWidth, elbowOutFlare, footHalfWidth, kneeOutFlare };
}

export function buildPose3D(
  exercise: Exercise,
  t: number,
  sex: Sex
): { pose: Pose3D; sk: Skeleton; def: PatternDef } {
  const def = PATTERNS[exercise.pattern];
  const f = sex === 'female';
  const shHalf = f ? 0.155 : 0.21;
  const hipHalf = f ? 0.095 : 0.108;

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

    // Base ortonormal dextrógira (torsoLeft × torsoUp = torsoForward):
    // En reposo de pie mirando a +Z: torsoLeft = (+1, 0, 0), torsoUp = (0, 1, 0), torsoForward = (0, 0, 1).
    const torsoUp = neckBase.clone().sub(pelvis).normalize();
    const rawForward = new THREE.Vector3(0, -sk.torsoFront[1], sk.torsoFront[0]).normalize();
    const torsoLeft = new THREE.Vector3().crossVectors(torsoUp, rawForward).normalize();
    const torsoForward = new THREE.Vector3().crossVectors(torsoLeft, torsoUp).normalize();
    const torsoRight = torsoLeft.clone().negate();

    // Lado derecho del cuerpo en `torsoRight` (-X de pie), lado izquierdo en `torsoLeft` (+X de pie)
    const shoulderR = neckBase.clone().addScaledVector(torsoRight, shHalf);
    const shoulderL = neckBase.clone().addScaledVector(torsoLeft, shHalf);
    const hipR = pelvis.clone().addScaledVector(torsoRight, hipHalf);
    const hipL = pelvis.clone().addScaledVector(torsoLeft, hipHalf);

    let wristTargetR = side2DTo3D(sk.hand, 0).addScaledVector(torsoRight, handHalf);
    let wristTargetL = side2DTo3D(sk.hand2, 0).addScaledVector(torsoLeft, handHalf);

    // Ajustes anatómicos 3D para que las barras y mancuernas nunca atraviesen el torso, cuello ni muslos
    if (exercise.pattern === 'squat_back' || exercise.pattern === 'good_morning') {
      // En sentadilla trasera y buenos días, la barra apoya sobre el trapecio superior detrás del cuello
      const barCenter = neckBase
        .clone()
        .addScaledVector(torsoForward, -0.095)
        .addScaledVector(torsoUp, 0.02);
      wristTargetR = barCenter.clone().addScaledVector(torsoRight, handHalf);
      wristTargetL = barCenter.clone().addScaledVector(torsoLeft, handHalf);
    } else if (exercise.pattern === 'squat_front') {
      // En sentadilla frontal o goblet, la barra/pesa se sujeta delante de las clavículas/deltoides
      const isGoblet = exercise.equipment !== 'barra';
      const gh = isGoblet ? 0.075 : 0.26;
      const barCenter = neckBase
        .clone()
        .addScaledVector(torsoForward, isGoblet ? 0.17 : 0.125)
        .addScaledVector(torsoUp, isGoblet ? -0.06 : 0.015);
      wristTargetR = barCenter.clone().addScaledVector(torsoRight, gh);
      wristTargetL = barCenter.clone().addScaledVector(torsoLeft, gh);
    } else if (exercise.pattern === 'hinge') {
      // En peso muerto / bisagra de cadera, la barra/mancuernas bajan rozando delante de los muslos y tibias
      const minFrontZ = Math.max(pelvis.z + 0.175, side2DTo3D(sk.segs.thigh!.b, 0).z + 0.085);
      if (wristTargetR.z < minFrontZ) wristTargetR.z = minFrontZ;
      if (wristTargetL.z < minFrontZ) wristTargetL.z = minFrontZ;
    } else if (exercise.pattern === 'curl' || exercise.pattern === 'pushdown') {
      // En curl de bíceps y jalón de tríceps de pie, las manos siempre operan por delante de los muslos/abdomen
      const minFrontZ = pelvis.z + 0.175;
      if (wristTargetR.z < minFrontZ) wristTargetR.z = minFrontZ;
      if (wristTargetL.z < minFrontZ) wristTargetL.z = minFrontZ;
    } else if (exercise.pattern === 'bench_press' || exercise.pattern === 'incline_press') {
      // En press de banca/inclinado, en la parte baja la barra toca la superficie pectoral sin hundirse en el pecho
      const minChestProj = 0.145;
      for (const w of [wristTargetR, wristTargetL]) {
        const rel = w.clone().sub(neckBase);
        const fwdProj = rel.dot(torsoForward);
        if (fwdProj < minChestProj) {
          w.addScaledVector(torsoForward, minChestProj - fwdProj);
        }
      }
    }

    const ankleTargetR = side2DTo3D(sk.ankle, 0).addScaledVector(torsoRight, cfg.footHalfWidth);
    const ankleTargetL = side2DTo3D(sk.ankle2, 0).addScaledVector(torsoLeft, cfg.footHalfWidth);

    const elbow2DR = side2DTo3D(sk.segs.upperArm!.b, 0).addScaledVector(
      torsoRight,
      shHalf + cfg.elbowOutFlare
    );
    const elbow2DL = side2DTo3D(sk.segs.upperArm2!.b, 0).addScaledVector(
      torsoLeft,
      shHalf + cfg.elbowOutFlare
    );
    const knee2DR = side2DTo3D(sk.segs.thigh!.b, 0).addScaledVector(
      torsoRight,
      hipHalf + cfg.kneeOutFlare
    );
    const knee2DL = side2DTo3D(sk.segs.thigh2!.b, 0).addScaledVector(
      torsoLeft,
      hipHalf + cfg.kneeOutFlare
    );

    const poleArmR = elbow2DR.sub(shoulderR.clone().lerp(wristTargetR, 0.5));
    const poleArmL = elbow2DL.sub(shoulderL.clone().lerp(wristTargetL, 0.5));
    const poleLegR = knee2DR.sub(hipR.clone().lerp(ankleTargetR, 0.5));
    const poleLegL = knee2DL.sub(hipL.clone().lerp(ankleTargetL, 0.5));

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
    const toeL = legIK_L.end.clone().add(toeDeltaL).addScaledVector(torsoLeft, 0.015);

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
        torsoLeft,
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
  const torsoLeft = new THREE.Vector3(1, 0, 0);
  const torsoRight = new THREE.Vector3(-1, 0, 0);
  const torsoForward = new THREE.Vector3(0, 0, 1);

  const uArmR = sk.segs.upperArm!;
  const uArmL = sk.segs.upperArm2!;
  const thighR = sk.segs.thigh!;
  const thighL = sk.segs.thigh2!;

  const handZ = exercise.equipment === 'barra' ? 0.18 : 0.11;
  const shoulderL = front2DTo3D(uArmR.a, 0);
  const shoulderR = front2DTo3D(uArmL.a, 0);
  const elbowL = front2DTo3D(uArmR.b, 0.04);
  const elbowR = front2DTo3D(uArmL.b, 0.04);
  const wristL = front2DTo3D(sk.hand, handZ);
  const wristR = front2DTo3D(sk.hand2, handZ);

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
      torsoLeft,
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
