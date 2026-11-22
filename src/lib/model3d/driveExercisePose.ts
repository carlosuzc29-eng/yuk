import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Sex } from '@/types/user';
import { BONE_LEN_3D, solveIK3D, type Pose3D } from '@/lib/exercises/kinematics3d';
import { canonicalBone, captureRestPose, findSkinnedMesh, restPose } from './retarget';

/**
 * Carga y anima en tiempo real los modelos 3D reales exportados de Blender
 * (`public/models/hombre.glb` y `public/models/mujer.glb`, con esqueleto `mixamorig:*`
 * de 52 huesos y mapas de normales) a partir de cualquier `Pose3D` de ejercicio.
 */

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const modelCache = new Map<Sex, Promise<THREE.Object3D>>();

export function preloadGLBCharacter(sex: Sex): Promise<THREE.Object3D> {
  const existing = modelCache.get(sex);
  if (existing) return existing;

  const file = sex === 'female' ? '/models/mujer.glb' : '/models/hombre.glb';
  const url = `${basePath}${file}`;

  const promise = new Promise<THREE.Object3D>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => {
        modelCache.delete(sex);
        reject(err);
      }
    );
  });

  modelCache.set(sex, promise);
  return promise;
}

export interface DrivenGLBCharacter {
  root: THREE.Object3D;
  skinnedMesh: THREE.SkinnedMesh;
  /** Aplica `pose` al esqueleto `mixamorig` y sincroniza las posiciones reales de manos/pies en `pose` para las máquinas. */
  applyPose: (pose: Pose3D) => void;
  dispose: () => void;
}

/**
 * Prepara una instancia clonada de `hombre.glb` o `mujer.glb` lista para ser animada
 * fotograma a fotograma por el motor de ejercicios.
 */
export function createDrivenGLBCharacter(templateScene: THREE.Object3D, sex: Sex): DrivenGLBCharacter {
  const root = cloneSkinned(templateScene);

  const skinnedMesh = findSkinnedMesh(root)!;

  // Mapa rápido de huesos por nombre canónico
  const bones = new Map<string, THREE.Bone>();
  for (const b of skinnedMesh.skeleton.bones) {
    bones.set(canonicalBone(b.name), b);
  }

  const hips = bones.get('hips')!;
  const spine2 = bones.get('spine2')!;
  const neck = bones.get('neck')!;
  const head = bones.get('head')!;
  const leftArm = bones.get('leftarm')!;
  const leftForeArm = bones.get('leftforearm')!;
  const leftHand = bones.get('lefthand')!;
  const rightArm = bones.get('rightarm')!;
  const rightForeArm = bones.get('rightforearm')!;
  const rightHand = bones.get('righthand')!;
  const leftUpLeg = bones.get('leftupleg')!;
  const leftLeg = bones.get('leftleg')!;
  const leftFoot = bones.get('leftfoot')!;
  const leftToe = bones.get('lefttoebase')!;
  const rightUpLeg = bones.get('rightupleg')!;
  const rightLeg = bones.get('rightleg')!;
  const rightFoot = bones.get('rightfoot')!;
  const rightToe = bones.get('righttoebase')!;

  // Centrar horizontalmente en la cadera (x=0, z=0) y apoyar las plantas de los pies en y=0
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const hipsInit = hips.getWorldPosition(new THREE.Vector3());
  root.position.set(-hipsInit.x, -box.min.y, -hipsInit.z);
  root.updateMatrixWorld(true);

  captureRestPose(skinnedMesh);

  // Configurar materiales tipo escultura ZBrush y poner en 0 los morph targets
  // (los GLB vienen exportados con los 4 shape keys en 1)
  const isF = sex === 'female';
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    if (mesh.morphTargetInfluences) {
      mesh.morphTargetInfluences.fill(0);
    }

    const srcMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const normalMap = srcMat?.normalMap ?? null;
    mesh.material = new THREE.MeshStandardMaterial({
      color: isF ? 0xe6e5e1 : 0xb8bbc2,
      roughness: isF ? 0.46 : 0.54,
      metalness: 0.04,
      normalMap,
      normalScale: new THREE.Vector2(isF ? 1 : 0.7, isF ? 1 : 0.7),
    });
  });

  // Métricas anatómicas exactas del esqueleto GLB en pose de reposo
  const restHipsPos = hips.getWorldPosition(new THREE.Vector3());
  const restHipsWorldQuat = hips.getWorldQuaternion(new THREE.Quaternion());
  const restHipL = leftUpLeg.getWorldPosition(new THREE.Vector3());
  const restHipR = rightUpLeg.getWorldPosition(new THREE.Vector3());
  const restHipMid = restHipL.clone().lerp(restHipR, 0.5);
  // Vector desde el punto medio de cabezas femorales (UpLeg) hasta el hueso raíz (Hips / sacro)
  const hipsFromHipMidRest = restHipsPos.clone().sub(restHipMid);

  const restAnkleY =
    0.5 *
    (leftFoot.getWorldPosition(new THREE.Vector3()).y +
      rightFoot.getWorldPosition(new THREE.Vector3()).y);
  const POSE_ANKLE_FLOOR_Y = (182 - 178) * 0.0102; // 0.0408m

  const glbThighLen = restHipL.distanceTo(leftLeg.getWorldPosition(new THREE.Vector3()));
  const glbShinLen = leftLeg
    .getWorldPosition(new THREE.Vector3())
    .distanceTo(leftFoot.getWorldPosition(new THREE.Vector3()));
  const glbUpperArmLen = leftArm
    .getWorldPosition(new THREE.Vector3())
    .distanceTo(leftForeArm.getWorldPosition(new THREE.Vector3()));
  const glbForeArmLen = leftForeArm
    .getWorldPosition(new THREE.Vector3())
    .distanceTo(leftHand.getWorldPosition(new THREE.Vector3()));

  const legScale = (glbThighLen + glbShinLen) / (BONE_LEN_3D.thigh + BONE_LEN_3D.shin);
  const armScale = (glbUpperArmLen + glbForeArmLen) / (BONE_LEN_3D.upperArm + BONE_LEN_3D.forearm);

  const FINGER_CHAINS = ['index', 'middle', 'ring', 'pinky'] as const;

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const dirVec = new THREE.Vector3();
  const curDir = new THREE.Vector3();
  const targetDir = new THREE.Vector3();
  const rotQ = new THREE.Quaternion();
  const worldQ = new THREE.Quaternion();
  const parentWorldQ = new THREE.Quaternion();
  const basisMat = new THREE.Matrix4();
  const rotFromRest = new THREE.Quaternion();
  const torsoWorldQ = new THREE.Quaternion();

  /** Gira `bone` en espacio mundo para que el vector `(bone -> child)` apunte en la dirección `dirWorld`. */
  const aimBone = (bone: THREE.Bone, child: THREE.Bone, dirWorld: THREE.Vector3) => {
    if (dirWorld.lengthSq() < 1e-8) return;
    targetDir.copy(dirWorld).normalize();
    curDir.subVectors(child.getWorldPosition(tmpA), bone.getWorldPosition(tmpB));
    if (curDir.lengthSq() < 1e-8) return;
    curDir.normalize();
    rotQ.setFromUnitVectors(curDir, targetDir);
    bone.getWorldQuaternion(worldQ).premultiply(rotQ);
    if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
    else parentWorldQ.identity();
    bone.quaternion.copy(parentWorldQ.invert().multiply(worldQ));
    bone.updateMatrixWorld(true);
  };

  /** Aplica una rotación `deltaWorldQ` en espacio mundo al hueso `bone`. */
  const rotateBoneWorld = (bone: THREE.Bone, deltaWorldQ: THREE.Quaternion) => {
    bone.getWorldQuaternion(worldQ).premultiply(deltaWorldQ);
    if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
    else parentWorldQ.identity();
    bone.quaternion.copy(parentWorldQ.invert().multiply(worldQ));
    bone.updateMatrixWorld(true);
  };

  /**
   * Orienta la muñeca, alinea la línea de nudillos con la barra/mancuerna, cierra los dedos
   * alrededor del agarre y devuelve el centro real de la palma (`gripCenter`) y el eje del mango (`gripAxis`).
   */
  const poseHandAndGrip = (
    side: 'lefthand' | 'righthand',
    handBone: THREE.Bone,
    forearmDir: THREE.Vector3,
    desiredThumbDir: THREE.Vector3
  ): { gripCenter: THREE.Vector3; gripAxis: THREE.Vector3 } => {
    const isLeft = side === 'lefthand';
    const mid1 = bones.get(`${side}middle1`);
    const idx1 = bones.get(`${side}index1`);
    const pnk1 = bones.get(`${side}pinky1`);

    if (!mid1 || !idx1 || !pnk1) {
      return {
        gripCenter: handBone.getWorldPosition(new THREE.Vector3()),
        gripAxis: new THREE.Vector3(1, 0, 0),
      };
    }

    // 1. Alinear el eje longitudinal de la mano (muñeca -> nudillo medio) con el antebrazo
    aimBone(handBone, mid1, forearmDir);

    // 2. Girar la mano alrededor de su eje longitudinal para que la línea de nudillos (meñique -> índice)
    // quede alineada con el eje de la barra o mancuerna (`desiredThumbDir`).
    const handLong = mid1
      .getWorldPosition(new THREE.Vector3())
      .sub(handBone.getWorldPosition(new THREE.Vector3()))
      .normalize();

    const curThumb = idx1
      .getWorldPosition(new THREE.Vector3())
      .sub(pnk1.getWorldPosition(new THREE.Vector3()));
    curThumb.addScaledVector(handLong, -curThumb.dot(handLong));

    const targetThumb = desiredThumbDir
      .clone()
      .addScaledVector(handLong, -desiredThumbDir.dot(handLong));

    if (curThumb.lengthSq() > 1e-6 && targetThumb.lengthSq() > 1e-6) {
      curThumb.normalize();
      targetThumb.normalize();
      rotQ.setFromUnitVectors(curThumb, targetThumb);
      rotateBoneWorld(handBone, rotQ);
    }

    // 3. Calcular el vector normal real de la palma después de alinear los nudillos
    const handPos = handBone.getWorldPosition(new THREE.Vector3());
    const mid1Pos = mid1.getWorldPosition(new THREE.Vector3());
    const longVec = mid1Pos.clone().sub(handPos).normalize();
    const thumbVec = idx1
      .getWorldPosition(new THREE.Vector3())
      .sub(pnk1.getWorldPosition(new THREE.Vector3()))
      .normalize();

    const palmNormal = isLeft
      ? new THREE.Vector3().crossVectors(longVec, thumbVec).normalize()
      : new THREE.Vector3().crossVectors(thumbVec, longVec).normalize();

    // 4. Cerrar las falanges de los 4 dedos envolviendo el cilindro de 3cm de la barra/mancuerna
    const f1Dir = longVec.clone().multiplyScalar(0.38).addScaledVector(palmNormal, 0.92);
    const f2Dir = longVec.clone().multiplyScalar(-0.55).addScaledVector(palmNormal, 0.83);
    const f3Dir = longVec.clone().multiplyScalar(-0.88).addScaledVector(palmNormal, 0.45);

    for (const chain of FINGER_CHAINS) {
      const b1 = bones.get(`${side}${chain}1`);
      const b2 = bones.get(`${side}${chain}2`);
      const b3 = bones.get(`${side}${chain}3`);
      if (b1 && b2) aimBone(b1, b2, f1Dir);
      if (b2 && b3) {
        aimBone(b2, b3, f2Dir);
        // Pequeña flexión adicional en la falange distal
        b3.getWorldQuaternion(worldQ);
        rotQ.setFromUnitVectors(f2Dir.clone().normalize(), f3Dir.clone().normalize());
        rotateBoneWorld(b3, rotQ);
      }
    }

    // Cerrar el pulgar oponiéndose a los dedos alrededor del mango
    const th1 = bones.get(`${side}thumb1`);
    const th2 = bones.get(`${side}thumb2`);
    const th3 = bones.get(`${side}thumb3`);
    if (th1 && th2 && th3) {
      const thumbCloseDir = palmNormal
        .clone()
        .multiplyScalar(0.72)
        .addScaledVector(longVec, 0.45)
        .addScaledVector(thumbVec, -0.52);
      aimBone(th2, th3, thumbCloseDir);
    }

    // 5. Centro exacto del cilindro sujetado dentro de la mano cerrada
    const gripCenter = mid1Pos
      .clone()
      .addScaledVector(palmNormal, 0.022)
      .addScaledVector(longVec, -0.012);

    // Eje del mango apuntando hacia +torsoLeft (de derecha a izquierda del cuerpo)
    const gripAxis = isLeft ? thumbVec.clone().negate() : thumbVec.clone();

    return { gripCenter, gripAxis };
  };

  const applyPose = (pose: Pose3D) => {
    // 1. Restaurar pose A limpia
    restPose(skinnedMesh);
    root.updateMatrixWorld(true);

    // 2. Orientación del torso respecto a la pose de reposo (de pie mirando a +Z: basis = [+X, +Y, +Z])
    basisMat.makeBasis(pose.torsoLeft, pose.torsoUp, pose.torsoForward);
    rotFromRest.setFromRotationMatrix(basisMat);
    torsoWorldQ.copy(rotFromRest).multiply(restHipsWorldQuat);

    // Objetivos de tobillo en el espacio del modelo GLB (manteniendo las plantas de los pies en y=0)
    const targetAnkleL = new THREE.Vector3(
      pose.ankleL.x,
      restAnkleY + (pose.ankleL.y - POSE_ANKLE_FLOOR_Y) * legScale,
      pose.ankleL.z
    );
    const targetAnkleR = new THREE.Vector3(
      pose.ankleR.x,
      restAnkleY + (pose.ankleR.y - POSE_ANKLE_FLOOR_Y) * legScale,
      pose.ankleR.z
    );

    // Posición de las cabezas femorales y del hueso raíz Hips (sacro)
    const targetHipMid = new THREE.Vector3(
      pose.pelvis.x,
      restAnkleY + (pose.pelvis.y - POSE_ANKLE_FLOOR_Y) * legScale,
      pose.pelvis.z
    );
    const hipsOffsetWorld = hipsFromHipMidRest.clone().applyQuaternion(rotFromRest);
    const targetHips = targetHipMid.clone().add(hipsOffsetWorld);

    const setHipsTransform = (worldPos: THREE.Vector3) => {
      if (hips.parent) {
        hips.parent.updateMatrixWorld(true);
        hips.position.copy(hips.parent.worldToLocal(worldPos.clone()));
        hips.parent.getWorldQuaternion(parentWorldQ);
        hips.quaternion.copy(parentWorldQ.invert().multiply(torsoWorldQ));
      } else {
        hips.position.copy(worldPos);
        hips.quaternion.copy(torsoWorldQ);
      }
      hips.updateMatrixWorld(true);
    };

    setHipsTransform(targetHips);

    // Si es un ejercicio colgado de barra fija (dominadas, fondos, remo invertido) o con manos apoyadas en el suelo
    // (flexiones, plancha), anclamos la posición del cuerpo para que las manos coincidan con la barra/suelo
    const relWristL = pose.wristL.clone().sub(pose.shoulderL).multiplyScalar(armScale);
    const relWristR = pose.wristR.clone().sub(pose.shoulderR).multiplyScalar(armScale);

    const isFloorHands = pose.wristL.y <= 0.14 && pose.torsoUp.y < 0.72;
    const isHangingBar = pose.ankleL.y > 0.18 && pose.wristL.y > 0.85;

    if (isFloorHands || isHangingBar) {
      const glbShMid = leftArm
        .getWorldPosition(new THREE.Vector3())
        .lerp(rightArm.getWorldPosition(new THREE.Vector3()), 0.5);
      const relWristMid = relWristL.clone().lerp(relWristR, 0.5);
      const desiredWristMid = pose.wristL.clone().lerp(pose.wristR, 0.5);
      if (isFloorHands) {
        desiredWristMid.y = Math.max(0.035, pose.wristL.y);
      }
      const delta = desiredWristMid.sub(glbShMid.add(relWristMid));
      targetHips.add(delta);
      if (isHangingBar) {
        targetAnkleL.add(delta);
        targetAnkleR.add(delta);
      }
      setHipsTransform(targetHips);
    }

    // 3. Cuello y cabeza
    if (neck && head) {
      aimBone(neck, head, dirVec.subVectors(pose.head, pose.neckBase));
    }

    // 4. Cinemática inversa 3D real de dos huesos para las PIERNAS del GLB
    const glbHipL = leftUpLeg.getWorldPosition(new THREE.Vector3());
    const glbHipR = rightUpLeg.getWorldPosition(new THREE.Vector3());

    const poleLegL = pose.kneeL.clone().sub(pose.hipL.clone().lerp(pose.ankleL, 0.5));
    const poleLegR = pose.kneeR.clone().sub(pose.hipR.clone().lerp(pose.ankleR, 0.5));

    const ikLegL = solveIK3D(glbHipL, targetAnkleL, glbThighLen, glbShinLen, poleLegL);
    const ikLegR = solveIK3D(glbHipR, targetAnkleR, glbThighLen, glbShinLen, poleLegR);

    aimBone(leftUpLeg, leftLeg, dirVec.subVectors(ikLegL.joint, glbHipL));
    aimBone(leftLeg, leftFoot, dirVec.subVectors(ikLegL.end, ikLegL.joint));
    if (leftToe) aimBone(leftFoot, leftToe, dirVec.subVectors(pose.toeL, pose.ankleL));

    aimBone(rightUpLeg, rightLeg, dirVec.subVectors(ikLegR.joint, glbHipR));
    aimBone(rightLeg, rightFoot, dirVec.subVectors(ikLegR.end, ikLegR.joint));
    if (rightToe) aimBone(rightFoot, rightToe, dirVec.subVectors(pose.toeR, pose.ankleR));

    // 5. Cinemática inversa 3D real de dos huesos para los BRAZOS del GLB
    const glbShoulderL = leftArm.getWorldPosition(new THREE.Vector3());
    const glbShoulderR = rightArm.getWorldPosition(new THREE.Vector3());

    const targetWristL = glbShoulderL.clone().add(relWristL);
    const targetWristR = glbShoulderR.clone().add(relWristR);

    // Si las manos pasan a la altura de la cadera/muslos, asegurar holgura lateral para no rozar la malla
    for (const [tw, sign] of [
      [targetWristL, 1],
      [targetWristR, -1],
    ] as const) {
      const nearHipY = Math.abs(tw.y - glbHipL.y) < 0.24;
      const nearHipZ = Math.abs(tw.z - glbHipL.z) < 0.14;
      const minLat = isF ? 0.23 : 0.26;
      if (nearHipY && nearHipZ && Math.abs(tw.x) > 0.14 && Math.abs(tw.x) < minLat) {
        tw.x = sign * minLat;
      }
    }

    const poleArmL = pose.elbowL.clone().sub(pose.shoulderL.clone().lerp(pose.wristL, 0.5));
    const poleArmR = pose.elbowR.clone().sub(pose.shoulderR.clone().lerp(pose.wristR, 0.5));

    const ikArmL = solveIK3D(glbShoulderL, targetWristL, glbUpperArmLen, glbForeArmLen, poleArmL);
    const ikArmR = solveIK3D(glbShoulderR, targetWristR, glbUpperArmLen, glbForeArmLen, poleArmR);

    const foreDirL = dirVec.subVectors(ikArmL.end, ikArmL.joint).clone();
    aimBone(leftArm, leftForeArm, dirVec.subVectors(ikArmL.joint, glbShoulderL));
    aimBone(leftForeArm, leftHand, foreDirL);

    const foreDirR = dirVec.subVectors(ikArmR.end, ikArmR.joint).clone();
    aimBone(rightArm, rightForeArm, dirVec.subVectors(ikArmR.joint, glbShoulderR));
    aimBone(rightForeArm, rightHand, foreDirR);

    // 6. Orientar manos, cerrar dedos sobre la barra/mancuerna y obtener el punto de agarre real en la palma
    const gripL = poseHandAndGrip('lefthand', leftHand, foreDirL, pose.torsoRight);
    const gripR = poseHandAndGrip('righthand', rightHand, foreDirR, pose.torsoLeft);

    spine2.updateMatrixWorld(true);

    // 7. Sincronizar las coordenadas reales del agarre de la palma y articulaciones de vuelta en `pose`
    // para que barras olímpicas, mancuernas, cables y máquinas queden exactamente dentro de las manos cerradas
    pose.wristL.copy(gripL.gripCenter);
    pose.wristR.copy(gripR.gripCenter);
    pose.gripAxisL = gripL.gripAxis;
    pose.gripAxisR = gripR.gripAxis;
    leftForeArm.getWorldPosition(pose.elbowL);
    rightForeArm.getWorldPosition(pose.elbowR);
    leftFoot.getWorldPosition(pose.ankleL);
    rightFoot.getWorldPosition(pose.ankleR);
    leftLeg.getWorldPosition(pose.kneeL);
    rightLeg.getWorldPosition(pose.kneeR);
    hips.getWorldPosition(pose.pelvis);
    neck.getWorldPosition(pose.neckBase);
  };

  const dispose = () => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => mat?.dispose());
    });
  };

  return { root, skinnedMesh, applyPose, dispose };
}
