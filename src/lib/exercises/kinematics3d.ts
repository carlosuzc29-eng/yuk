import * as THREE from 'three';
import type { Exercise, MovementPattern } from '@/types/training';
import type { Sex } from '@/types/user';
import { PATTERNS, type PatternDef } from './poses';
import { buildFront, buildSide, lerpFront, lerpSide, type Skeleton, type V } from './rig';

/** Escala: 100 px del rig 2D ≈ 1.02 m reales (estatura ~1.72 m). */
export const SCALE_3D = 0.0102;
export const GROUND_2D = 182;

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

/** Convierte un punto 2D de vista lateral (x=adelante, y=abajo) a 3D (x=lateral, y=arriba, z=adelante). */
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

interface LateralProfile {
  handWidth: number;
  elbowFlare: number;
  stanceWidth: number;
  kneeFlare: number;
}

function lateralProfileFor(pattern: MovementPattern, equipment: Exercise['equipment'], sex: Sex): LateralProfile {
  const f = sex === 'female';
  const baseSh = f ? 0.165 : 0.195;
  const baseHip = f ? 0.115 : 0.105;

  // Ancho de agarre y postura realista según patrón y equipo
  let handWidth = baseSh * 1.15;
  let elbowFlare = baseSh * 1.18;
  let stanceWidth = baseHip * 1.2;
  let kneeFlare = baseHip * 1.3;

  switch (pattern) {
    case 'bench_press':
    case 'incline_press':
    case 'chest_press_machine':
    case 'push_up':
      handWidth = equipment === 'barra' ? 0.34 : 0.27;
      elbowFlare = 0.32;
      stanceWidth = 0.19;
      kneeFlare = 0.21;
      break;
    case 'fly_lying':
    case 'fly_cable':
      handWidth = 0.34;
      elbowFlare = 0.36;
      break;
    case 'pulldown':
    case 'pull_up':
      handWidth = 0.34;
      elbowFlare = 0.31;
      stanceWidth = 0.14;
      break;
    case 'squat_back':
    case 'squat_front':
    case 'squat_machine':
    case 'good_morning':
      handWidth = equipment === 'barra' ? 0.35 : 0.16;
      elbowFlare = equipment === 'barra' ? 0.36 : 0.2;
      stanceWidth = 0.19;
      kneeFlare = 0.23;
      break;
    case 'leg_press':
      handWidth = 0.27;
      elbowFlare = 0.26;
      stanceWidth = 0.18;
      kneeFlare = 0.2;
      break;
    case 'hinge':
      handWidth = equipment === 'barra' ? 0.26 : 0.22;
      elbowFlare = 0.23;
      stanceWidth = 0.15;
      kneeFlare = 0.16;
      break;
    case 'hip_thrust':
    case 'glute_bridge':
      handWidth = 0.25;
      elbowFlare = 0.27;
      stanceWidth = 0.18;
      kneeFlare = 0.21;
      break;
    case 'overhead_press':
    case 'overhead_press_seated':
      handWidth = equipment === 'barra' ? 0.28 : 0.24;
      elbowFlare = 0.27;
      break;
    case 'row_bent':
    case 'row_chest_supported':
    case 'inverted_row':
      handWidth = equipment === 'barra' ? 0.3 : 0.23;
      elbowFlare = 0.28;
      break;
    case 'row_seated':
    case 'pushdown':
    case 'triceps_overhead':
    case 'kb_swing':
    case 'ab_wheel':
    case 'pallof_press':
    case 'cable_crunch':
    case 'straight_arm_pulldown':
      handWidth = 0.11;
      elbowFlare = 0.19;
      break;
    case 'face_pull':
      handWidth = 0.24;
      elbowFlare = 0.32;
      break;
    case 'rear_delt_fly':
      handWidth = 0.38;
      elbowFlare = 0.34;
      break;
    case 'dip':
      handWidth = 0.26;
      elbowFlare = 0.28;
      stanceWidth = 0.09;
      break;
    case 'curl':
    case 'curl_preacher':
    case 'curl_bayesian':
    case 'skull_crusher':
    case 'wrist_curl':
      handWidth = equipment === 'barra' ? 0.22 : 0.21;
      elbowFlare = 0.2;
      break;
    case 'leg_extension':
    case 'leg_curl_seated':
    case 'leg_curl_lying':
    case 'calf_raise_seated':
      handWidth = 0.25;
      elbowFlare = 0.24;
      stanceWidth = 0.13;
      kneeFlare = 0.14;
      break;
    case 'lunge':
    case 'split_squat_rear':
    case 'step_up':
      handWidth = equipment === 'barra' ? 0.34 : 0.23;
      elbowFlare = equipment === 'barra' ? 0.35 : 0.23;
      stanceWidth = 0.14;
      kneeFlare = 0.15;
      break;
    default:
      break;
  }

  return { handWidth, elbowFlare, stanceWidth, kneeFlare };
}

/** Construye una pose 3D completa y anatómicamente coherente a partir de cualquier patrón de `poses.ts`. */
export function buildPose3D(
  exercise: Exercise,
  t: number,
  sex: Sex
): { pose: Pose3D; sk: Skeleton; def: PatternDef } {
  const def = PATTERNS[exercise.pattern];
  const f = sex === 'female';
  const shHalf = f ? 0.165 : 0.198;
  const hipHalf = f ? 0.11 : 0.1;

  if (def.view === 'side') {
    const sk = buildSide(lerpSide(def.a, def.b, t), sex);
    const lat = lateralProfileFor(exercise.pattern, exercise.equipment, sex);

    // En aperturas/cruces, las manos se abren y cierran en X durante el movimiento
    let dynamicHandX = lat.handWidth;
    let dynamicElbowX = lat.elbowFlare;
    if (exercise.pattern === 'fly_lying') {
      // a = cerrado arriba, b = abierto abajo
      dynamicHandX = THREE.MathUtils.lerp(0.11, 0.44, t);
      dynamicElbowX = THREE.MathUtils.lerp(0.24, 0.41, t);
    } else if (exercise.pattern === 'fly_cable') {
      // a = abierto atrás, b = cerrado delante
      dynamicHandX = THREE.MathUtils.lerp(0.42, 0.08, t);
      dynamicElbowX = THREE.MathUtils.lerp(0.39, 0.22, t);
    } else if (exercise.pattern === 'rear_delt_fly') {
      dynamicHandX = THREE.MathUtils.lerp(0.14, 0.48, t);
      dynamicElbowX = THREE.MathUtils.lerp(0.19, 0.4, t);
    }

    const pelvis = side2DTo3D(sk.hip, 0);
    const neckBase = side2DTo3D(sk.shoulder, 0);
    const head = side2DTo3D(sk.head, 0);
    const waist = pelvis.clone().lerp(neckBase, 0.36);
    const chest = pelvis.clone().lerp(neckBase, 0.72);

    const torsoUp = neckBase.clone().sub(pelvis).normalize();
    const torsoRight = new THREE.Vector3(-1, 0, 0);
    const torsoForward = new THREE.Vector3().crossVectors(torsoUp, torsoRight).normalize();

    const uArmNear = sk.segs.upperArm!;
    const uArmFar = sk.segs.upperArm2!;
    const thighNear = sk.segs.thigh!;
    const thighFar = sk.segs.thigh2!;

    // Lado derecho = -X (cercano en vista 3/4 derecha), lado izquierdo = +X
    const shoulderR = side2DTo3D(sk.shoulder, -shHalf);
    const shoulderL = side2DTo3D(sk.shoulder, shHalf);
    const elbowR = side2DTo3D(uArmNear.b, -dynamicElbowX);
    const elbowL = side2DTo3D(uArmFar.b, dynamicElbowX);
    const wristR = side2DTo3D(sk.hand, -dynamicHandX);
    const wristL = side2DTo3D(sk.hand2, dynamicHandX);

    const hipR = side2DTo3D(sk.hip, -hipHalf);
    const hipL = side2DTo3D(sk.hip, hipHalf);
    const kneeR = side2DTo3D(thighNear.b, -lat.kneeFlare);
    const kneeL = side2DTo3D(thighFar.b, lat.kneeFlare);
    const ankleR = side2DTo3D(sk.ankle, -lat.stanceWidth);
    const ankleL = side2DTo3D(sk.ankle2, lat.stanceWidth);
    const toeR = side2DTo3D(sk.toe, -lat.stanceWidth * 1.08);
    const toeL = side2DTo3D(sk.toe2, lat.stanceWidth * 1.08);

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
        isSidePattern: true,
      },
    };
  }

  // Vista frontal (elevaciones laterales, encogimientos, abducción/aducción)
  const sk = buildFront(lerpFront(def.a, def.b, t), sex);
  const pelvis = new THREE.Vector3(0, (GROUND_2D - 98) * SCALE_3D, 0);
  const neckBase = new THREE.Vector3(0, (GROUND_2D - sk.shoulder[1]) * SCALE_3D, 0);
  const head = front2DTo3D(sk.head, 0);
  const waist = pelvis.clone().lerp(neckBase, 0.36);
  const chest = pelvis.clone().lerp(neckBase, 0.72);

  const torsoUp = new THREE.Vector3(0, 1, 0);
  const torsoRight = new THREE.Vector3(-1, 0, 0);
  const torsoForward = new THREE.Vector3(0, 0, 1);

  const uArmR = sk.segs.upperArm!;
  const uArmL = sk.segs.upperArm2!;
  const thighR = sk.segs.thigh!;
  const thighL = sk.segs.thigh2!;

  // En vista frontal de poses.ts, x > 120 es la derecha de la pantalla (+X en 3D mirando hacia +Z)
  const shoulderL = front2DTo3D(uArmR.a, 0);
  const shoulderR = front2DTo3D(uArmL.a, 0);
  const elbowL = front2DTo3D(uArmR.b, 0.04);
  const elbowR = front2DTo3D(uArmL.b, 0.04);
  const wristL = front2DTo3D(sk.hand, 0.09);
  const wristR = front2DTo3D(sk.hand2, 0.09);

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
