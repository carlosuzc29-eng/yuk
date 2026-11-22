import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { canonicalBone, morphWeights, retargetMixamoClips } from '@/lib/model3d/retarget';

/**
 * Esqueleto mínimo estilo Mixamo: los huesos apuntan por su +Y local.
 * armAngle: ángulo del brazo izquierdo medido desde la vertical hacia arriba (90° = pose T,
 * 135° = pose A, 45° por debajo de la horizontal; 180° = colgando).
 * roll: giro extra alrededor del eje del brazo (simula convenciones de "roll" distintas).
 */
function rig(prefix: string, unit: number, armAngleDeg: number, roll = 0) {
  const b = (name: string, pos: [number, number, number], q = new THREE.Quaternion()) => {
    const bone = new THREE.Bone();
    bone.name = `${prefix}${name}`;
    bone.position.set(pos[0] * unit, pos[1] * unit, pos[2] * unit);
    bone.quaternion.copy(q);
    return bone;
  };
  const z = (deg: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(deg));
  const y = (deg: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(deg));

  const hips = b('Hips', [0, 1.0, 0]);
  const spine = b('Spine', [0, 0.1, 0]);
  const spine2 = b('Spine2', [0, 0.3, 0]);
  const neck = b('Neck', [0, 0.15, 0]);
  const head = b('Head', [0, 0.1, 0]);
  // Brazo izquierdo hacia +X: rotación de -armAngle alrededor de Z (más un roll sobre su propio eje).
  const arm = b('LeftArm', [0.15, 0.1, 0], z(-armAngleDeg).multiply(y(roll)));
  const fore = b('LeftForeArm', [0, 0.3, 0]);
  const hand = b('LeftHand', [0, 0.25, 0]);
  const upleg = b('LeftUpLeg', [0.1, -0.05, 0], z(180));
  const leg = b('LeftLeg', [0, 0.45, 0]);
  const foot = b('LeftFoot', [0, 0.45, 0]);
  hips.add(spine, upleg);
  spine.add(spine2);
  spine2.add(neck, arm);
  neck.add(head);
  arm.add(fore);
  fore.add(hand);
  upleg.add(leg);
  leg.add(foot);
  const bones = [hips, spine, spine2, neck, head, arm, fore, hand, upleg, leg, foot];
  return { hips, bones, arm, fore, hand };
}

function target() {
  const r = rig('mixamorig', 1, 135, 30); // pose A, en metros, con otro roll de brazo
  const group = new THREE.Group();
  const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  group.add(mesh, r.hips);
  group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(r.bones));
  return { group, mesh, ...r };
}

function source() {
  const r = rig('mixamorig1', 100, 90); // pose T, en centímetros (prefijo alternativo de Mixamo)
  const root = new THREE.Group();
  root.scale.setScalar(0.01); // como un FBX de Mixamo
  root.add(r.hips);
  root.updateMatrixWorld(true);
  return { root, ...r };
}

const dir = (from: THREE.Object3D, to: THREE.Object3D) =>
  to.getWorldPosition(new THREE.Vector3()).sub(from.getWorldPosition(new THREE.Vector3())).normalize();

/** Clip que lleva el brazo izquierdo del origen de su ángulo de reposo a otro, y baja la cadera. */
function clip(name: string, src: ReturnType<typeof source>, armToDeg: number, hipDropCm = 0) {
  const q = (deg: number) =>
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(-deg)).toArray();
  const hipY = src.hips.position.y;
  return new THREE.AnimationClip(name, 1, [
    new THREE.QuaternionKeyframeTrack(`${src.arm.name}.quaternion`, [0, 1], [...q(armToDeg), ...q(armToDeg)]),
    new THREE.VectorKeyframeTrack(`${src.hips.name}.position`, [0, 1], [0, hipY - hipDropCm, 0, 0, hipY - hipDropCm, 0]),
  ]);
}

function sample(t: ReturnType<typeof target>, c: THREE.AnimationClip, time = 0.5) {
  const mixer = new THREE.AnimationMixer(t.group);
  mixer.clipAction(c).play();
  mixer.update(time);
  t.group.updateMatrixWorld(true);
}

describe('retargeting Mixamo pose T → modelo pose A', () => {
  it('normaliza nombres de huesos de Mixamo', () => {
    expect(canonicalBone('mixamorig:LeftArm')).toBe('leftarm');
    expect(canonicalBone('mixamorigLeftArm')).toBe('leftarm');
    expect(canonicalBone('mixamorig1:Hips')).toBe('hips');
  });

  it('un clip que mantiene la pose T pone los brazos del modelo horizontales (no a 45° de más)', () => {
    const t = target();
    const s = source();
    const { clips } = retargetMixamoClips(t.mesh, s.root, [clip('T', s, 90)]);
    sample(t, clips[0]);
    const d = dir(t.arm, t.fore);
    expect(d.x).toBeCloseTo(1, 3);
    expect(Math.abs(d.y)).toBeLessThan(1e-3);
  });

  it('un clip con los brazos abajo los deja pegados al cuerpo, sin atravesar el torso', () => {
    const t = target();
    const s = source();
    const { clips } = retargetMixamoClips(t.mesh, s.root, [clip('abajo', s, 170)]);
    sample(t, clips[0]);
    const d = dir(t.arm, t.fore);
    // 170°: casi vertical hacia abajo, 10° separado del cuerpo.
    const expected = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(170)), Math.cos(THREE.MathUtils.degToRad(170)), 0);
    expect(d.distanceTo(expected)).toBeLessThan(1e-3);
    // El antebrazo y la mano siguen al brazo (heredan la dirección).
    expect(dir(t.fore, t.hand).distanceTo(expected)).toBeLessThan(1e-3);
  });

  it('escala la cadera de centímetros a la altura del modelo', () => {
    const t = target();
    const s = source();
    const restHip = t.hips.getWorldPosition(new THREE.Vector3()).y;
    const { clips } = retargetMixamoClips(t.mesh, s.root, [clip('reposo', s, 90), clip('bajar', s, 90, 20)]);
    sample(t, clips[0]);
    expect(t.hips.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(restHip, 4);
    t.mesh.skeleton.pose();
    sample(t, clips[1]);
    // 20 cm del origen (cadera a 100 cm) → 20 % de la altura de cadera del modelo (1 m) = 0,2 m.
    expect(t.hips.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(restHip - 0.2, 4);
  });

  it('sin animación el modelo vuelve a su pose A y no se toca la geometría', () => {
    const t = target();
    const s = source();
    const geomBefore = t.mesh.geometry;
    const before = dir(t.arm, t.fore);
    retargetMixamoClips(t.mesh, s.root, [clip('T', s, 90)]);
    t.group.updateMatrixWorld(true);
    expect(dir(t.arm, t.fore).distanceTo(before)).toBeLessThan(1e-6);
    expect(t.mesh.geometry).toBe(geomBefore);
  });

  it('las pistas quedan con nombres de hueso resolubles desde la escena', () => {
    const t = target();
    const s = source();
    const { clips } = retargetMixamoClips(t.mesh, s.root, [clip('T', s, 90)]);
    clips[0].tracks.forEach((tr) => expect(tr.name).toMatch(/^mixamorig\w+\.(quaternion|position)$/));
  });
});

describe('morph targets', () => {
  it('mapea los deslizadores -1..+1 a los pares menos/más', () => {
    expect(morphWeights(0, 0)).toEqual({ peso_mas: 0, peso_menos: 0, musculo_mas: 0, musculo_menos: 0 });
    expect(morphWeights(0.6, -0.3)).toEqual({ peso_mas: 0.6, peso_menos: 0, musculo_mas: 0, musculo_menos: 0.3 });
    expect(morphWeights(-2, 2)).toEqual({ peso_mas: 0, peso_menos: 1, musculo_mas: 1, musculo_menos: 0 });
  });
});
