import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { canonicalBone, findSkinnedMesh, retargetMixamoClips } from '@/lib/model3d/retarget';
import { createDrivenGLBCharacter } from '@/lib/model3d/driveExercisePose';
import { buildPose3D } from '@/lib/exercises/kinematics3d';
import { EXERCISES } from '@/lib/exercises/catalog';

/**
 * Pruebas con los modelos reales (public/models/hombre.glb y mujer.glb). Como no hay archivos de
 * Mixamo en el repositorio, se fabrica una "animación de Mixamo" a partir del propio esqueleto:
 * mismo árbol de huesos, pero con reposo en pose T, en centímetros y con prefijo `mixamorig1`.
 */

async function loadModel(file: string) {
  const buf = readFileSync(resolve(__dirname, '../public/models', file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new GLTFLoader().parseAsync(ab, '');
  return gltf.scene;
}

const bone = (root: THREE.Object3D, canon: string) => {
  let found: THREE.Bone | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.Bone).isBone && canonicalBone(o.name) === canon) found = o as THREE.Bone;
  });
  if (!found) throw new Error(`falta ${canon}`);
  return found as THREE.Bone;
};

const wpos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const dir = (a: THREE.Object3D, b: THREE.Object3D) => wpos(b).sub(wpos(a)).normalize();

/** Gira un hueso en espacio mundo para que (hueso → hijo) apunte a `target`. */
function aim(b: THREE.Bone, child: THREE.Bone, target: THREE.Vector3) {
  const q = new THREE.Quaternion().setFromUnitVectors(dir(b, child), target.clone().normalize());
  const world = b.getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
  const parentWorld = b.parent!.getWorldQuaternion(new THREE.Quaternion());
  b.quaternion.copy(parentWorld.invert().multiply(world));
  b.updateMatrixWorld(true);
}

/** Construye una "animación de Mixamo": reposo en pose T, centímetros, prefijo mixamorig1. */
function makeMixamoSource(model: THREE.Object3D) {
  const src = cloneSkinned(model);
  src.updateMatrixWorld(true);
  for (const side of ['left', 'right'] as const) {
    const sign = Math.sign(wpos(bone(src, `${side}forearm`)).x - wpos(bone(src, `${side}arm`)).x);
    const out = new THREE.Vector3(sign, 0, 0);
    aim(bone(src, `${side}arm`), bone(src, `${side}forearm`), out);
    aim(bone(src, `${side}forearm`), bone(src, `${side}hand`), out);
  }
  // Pasamos el esqueleto a centímetros bajo una raíz con escala 0,01 (como un FBX de Mixamo).
  const bones: THREE.Bone[] = [];
  src.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
  });
  bones.forEach((b) => {
    b.position.multiplyScalar(100);
    b.name = b.name.replace(/^mixamorig/, 'mixamorig1');
  });
  const hips = bones.find((b) => canonicalBone(b.name) === 'hips')!;
  const rigParent = hips.parent!;
  rigParent.position.multiplyScalar(100);
  const root = new THREE.Group();
  root.scale.setScalar(0.01);
  root.add(src);
  // Quitamos la malla con skin: un FBX de animación "sin skin" sólo trae huesos.
  const mesh = findSkinnedMesh(src);
  mesh?.parent?.remove(mesh);
  root.updateMatrixWorld(true);
  return { root, bones };
}

/** Clip que mantiene todos los huesos del origen en su reposo (pose T) y opcionalmente rota uno. */
function holdClip(name: string, bones: THREE.Bone[], extra?: { bone: THREE.Bone; worldRot: THREE.Quaternion }) {
  const tracks: THREE.KeyframeTrack[] = bones.map((b) => {
    let q = b.quaternion.clone();
    if (extra && extra.bone === b) {
      const world = b.getWorldQuaternion(new THREE.Quaternion()).premultiply(extra.worldRot);
      q = b.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world);
    }
    return new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, [0, 1], [...q.toArray(), ...q.toArray()]);
  });
  const hips = bones.find((b) => canonicalBone(b.name) === 'hips')!;
  tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, [0, 1], [...hips.position.toArray(), ...hips.position.toArray()]));
  return new THREE.AnimationClip(name, 1, tracks);
}

function play(model: THREE.Object3D, clip: THREE.AnimationClip) {
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clip).play();
  mixer.update(0.5);
  model.updateMatrixWorld(true);
}

describe.each(['hombre.glb', 'mujer.glb'])('retargeting con %s', (file) => {
  it('tiene esqueleto mixamorig, skin y los cuatro morph targets', async () => {
    const model = await loadModel(file);
    const mesh = findSkinnedMesh(model)!;
    expect(mesh).toBeTruthy();
    expect(mesh.skeleton.bones.length).toBe(52);
    expect(Object.keys(mesh.morphTargetDictionary!).sort()).toEqual(['musculo_mas', 'musculo_menos', 'peso_mas', 'peso_menos']);
  });

  it('el modelo está en pose A (brazos ~45° bajo la horizontal)', async () => {
    const model = await loadModel(file);
    model.updateMatrixWorld(true);
    for (const side of ['left', 'right']) {
      const d = dir(bone(model, `${side}arm`), bone(model, `${side}forearm`));
      const below = THREE.MathUtils.radToDeg(Math.asin(-d.y));
      expect(below).toBeGreaterThan(25);
      expect(below).toBeLessThan(65);
    }
  });

  it('una animación en pose T se reproduce en pose T; sin animación vuelve a la pose A', async () => {
    const model = await loadModel(file);
    model.updateMatrixWorld(true);
    const mesh = findSkinnedMesh(model)!;
    const geom = mesh.geometry;
    const posBefore = (geom.attributes.position.array as Float32Array).slice();
    const restArm = dir(bone(model, 'leftarm'), bone(model, 'leftforearm'));
    const restHip = wpos(bone(model, 'hips')).y;

    const { root, bones } = makeMixamoSource(model);
    const { clips, unmatched } = retargetMixamoClips(mesh, root, [holdClip('T', bones)]);
    expect(unmatched).toEqual([]);

    // Sin animación: pose A intacta.
    model.updateMatrixWorld(true);
    expect(dir(bone(model, 'leftarm'), bone(model, 'leftforearm')).distanceTo(restArm)).toBeLessThan(1e-4);

    play(model, clips[0]);
    for (const side of ['left', 'right']) {
      const arm = dir(bone(model, `${side}arm`), bone(model, `${side}forearm`));
      const fore = dir(bone(model, `${side}forearm`), bone(model, `${side}hand`));
      expect(Math.abs(arm.y), `${side} brazo horizontal`).toBeLessThan(0.01);
      expect(Math.abs(fore.y), `${side} antebrazo horizontal`).toBeLessThan(0.01);
    }
    // La cadera queda a la altura del modelo (la animación venía en centímetros).
    expect(wpos(bone(model, 'hips')).y).toBeCloseTo(restHip, 3);
    // Las piernas siguen como en el origen (no cambian de pose).
    const legT = dir(bone(model, 'leftupleg'), bone(model, 'leftleg'));
    const legS = dir(bone(root, 'leftupleg'), bone(root, 'leftleg'));
    expect(legT.distanceTo(legS)).toBeLessThan(1e-3);
    // La geometría no se modifica.
    expect(mesh.geometry).toBe(geom);
    expect(Array.from(geom.attributes.position.array as Float32Array)).toEqual(Array.from(posBefore));
  });

  it('bajar los brazos en la animación los baja en el modelo con la misma dirección', async () => {
    const model = await loadModel(file);
    model.updateMatrixWorld(true);
    const mesh = findSkinnedMesh(model)!;
    const { root, bones } = makeMixamoSource(model);
    const srcArm = bone(root, 'leftarm');
    // 75° hacia abajo desde la pose T, alrededor del eje frontal.
    const sign = Math.sign(dir(srcArm, bone(root, 'leftforearm')).x);
    const worldRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(-75 * sign));
    const clip = holdClip('abajo', bones, { bone: srcArm, worldRot });

    // Dirección esperada: la del origen con ese clip aplicado.
    play(root, clip);
    const expected = dir(srcArm, bone(root, 'leftforearm'));
    root.traverse((o) => (o as THREE.Bone).isBone && (o as THREE.Bone).updateMatrixWorld());

    // Reiniciamos el origen al reposo (pose T) antes de adaptar.
    const fresh = makeMixamoSource(model);
    const { clips } = retargetMixamoClips(mesh, fresh.root, [holdClip('abajo', fresh.bones, { bone: bone(fresh.root, 'leftarm'), worldRot })]);
    play(model, clips[0]);
    const got = dir(bone(model, 'leftarm'), bone(model, 'leftforearm'));
    expect(got.distanceTo(expected)).toBeLessThan(0.01);
    expect(got.y).toBeLessThan(-0.9); // casi colgando, no atravesando el torso
  });

  it('anima el esqueleto del GLB en ejercicios reales sin NaN', async () => {
    const model = await loadModel(file);
    const sex = file === 'mujer.glb' ? 'female' : 'male';
    const driven = createDrivenGLBCharacter(model, sex);
    for (const ex of EXERCISES.slice(0, 8)) {
      for (const t of [0, 0.5, 1]) {
        const { pose } = buildPose3D(ex, t, sex);
        driven.applyPose(pose);
        expect(Number.isFinite(pose.wristL.x)).toBe(true);
        expect(Number.isFinite(pose.wristR.y)).toBe(true);
        expect(Number.isFinite(pose.ankleL.z)).toBe(true);
      }
    }
    driven.dispose();
  });
});
