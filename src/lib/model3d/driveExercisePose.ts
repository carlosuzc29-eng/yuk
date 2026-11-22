import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Sex } from '@/types/user';
import type { Pose3D } from '@/lib/exercises/kinematics3d';
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

  // Centrar pies en y = 0 en pose de reposo
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -box.min.y, -center.z);
  root.updateMatrixWorld(true);

  const skinnedMesh = findSkinnedMesh(root)!;
  captureRestPose(skinnedMesh);

  // Configurar materiales tipo escultura ZBrush según las referencias
  const isF = sex === 'female';
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

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

  // Altura de la cadera en reposo del GLB (~0.999m en hombre, ~0.955m en mujer)
  // vs altura de pie en Pose3D (~0.887m): factor de escala para que los pies toquen el suelo exacto y=0
  const restHipWorld = hips.getWorldPosition(new THREE.Vector3());
  const poseStandingHipY = (182 - 95) * 0.0102; // 0.8874m
  const heightScale = restHipWorld.y / poseStandingHipY;
  const restHipsWorldQuat = hips.getWorldQuaternion(new THREE.Quaternion());

  // Doblar ligeramente los dedos para que sujeten barras y mancuernas con naturalidad
  const FINGER_NAMES = [
    'index1', 'index2', 'index3',
    'middle1', 'middle2', 'middle3',
    'ring1', 'ring2', 'ring3',
    'pinky1', 'pinky2', 'pinky3',
  ];
  const curlQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.55);

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const curDir = new THREE.Vector3();
  const targetDir = new THREE.Vector3();
  const rotQ = new THREE.Quaternion();
  const worldQ = new THREE.Quaternion();
  const parentWorldQ = new THREE.Quaternion();
  const basisMat = new THREE.Matrix4();
  const torsoWorldQ = new THREE.Quaternion();

  /** Gira `bone` en espacio mundo para que el vector `(bone -> child)` apunte en la dirección `dirWorld`. */
  const aimBone = (bone: THREE.Bone, child: THREE.Bone, dirWorld: THREE.Vector3) => {
    if (dirWorld.lengthSq() < 1e-8) return;
    curDir.subVectors(child.getWorldPosition(tmpA), bone.getWorldPosition(tmpB));
    if (curDir.lengthSq() < 1e-8) return;
    curDir.normalize();
    targetDir.copy(dirWorld).normalize();
    rotQ.setFromUnitVectors(curDir, targetDir);
    bone.getWorldQuaternion(worldQ).premultiply(rotQ);
    if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
    else parentWorldQ.identity();
    bone.quaternion.copy(parentWorldQ.invert().multiply(worldQ));
    bone.updateMatrixWorld(true);
  };

  const applyPose = (pose: Pose3D) => {
    // 1. Restaurar pose A limpia
    restPose(skinnedMesh);
    root.updateMatrixWorld(true);

    // 2. Colocar y orientar la pelvis (Hips) en espacio mundo
    const targetPelvis = new THREE.Vector3(
      pose.pelvis.x,
      pose.pelvis.y * heightScale,
      pose.pelvis.z
    );
    if (hips.parent) {
      hips.parent.updateMatrixWorld(true);
      hips.position.copy(hips.parent.worldToLocal(targetPelvis.clone()));
    } else {
      hips.position.copy(targetPelvis);
    }

    // Orientación del torso respecto a la pose de reposo (de pie mirando a +Z: basis = [+X, +Y, +Z])
    basisMat.makeBasis(pose.torsoLeft, pose.torsoUp, pose.torsoForward);
    torsoWorldQ.setFromRotationMatrix(basisMat).multiply(restHipsWorldQuat);
    if (hips.parent) {
      hips.parent.getWorldQuaternion(parentWorldQ);
      hips.quaternion.copy(parentWorldQ.invert().multiply(torsoWorldQ));
    } else {
      hips.quaternion.copy(torsoWorldQ);
    }
    hips.updateMatrixWorld(true);

    // 3. Cuello y cabeza
    if (neck && head) {
      aimBone(neck, head, tmpA.subVectors(pose.head, pose.neckBase));
    }

    // 4. Piernas y pies (de cadera a rodilla, de rodilla a tobillo, de tobillo a puntera)
    aimBone(leftUpLeg, leftLeg, tmpA.subVectors(pose.kneeL, pose.hipL));
    aimBone(leftLeg, leftFoot, tmpA.subVectors(pose.ankleL, pose.kneeL));
    if (leftToe) aimBone(leftFoot, leftToe, tmpA.subVectors(pose.toeL, pose.ankleL));

    aimBone(rightUpLeg, rightLeg, tmpA.subVectors(pose.kneeR, pose.hipR));
    aimBone(rightLeg, rightFoot, tmpA.subVectors(pose.ankleR, pose.kneeR));
    if (rightToe) aimBone(rightFoot, rightToe, tmpA.subVectors(pose.toeR, pose.ankleR));

    // 5. Brazos y antebrazos (de hombro a codo, de codo a muñeca)
    aimBone(leftArm, leftForeArm, tmpA.subVectors(pose.elbowL, pose.shoulderL));
    aimBone(leftForeArm, leftHand, tmpA.subVectors(pose.wristL, pose.elbowL));

    aimBone(rightArm, rightForeArm, tmpA.subVectors(pose.elbowR, pose.shoulderR));
    aimBone(rightForeArm, rightHand, tmpA.subVectors(pose.wristR, pose.elbowR));

    // Flexión suave de dedos para agarre natural
    for (const side of ['lefthand', 'righthand'] as const) {
      for (const fn of FINGER_NAMES) {
        const fb = bones.get(`${side}${fn}`);
        if (fb) {
          fb.quaternion.multiply(curlQuat);
        }
      }
    }
    spine2.updateMatrixWorld(true);

    // 6. Sincronizar las coordenadas reales del modelo GLB de vuelta en `pose`
    // para que barras, mancuernas, cables y rodillos de máquinas queden anclados a sus manos/pies reales
    leftHand.getWorldPosition(pose.wristL);
    rightHand.getWorldPosition(pose.wristR);
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
