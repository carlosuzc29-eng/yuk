/**
 * Retargeting de animaciones de Mixamo (esqueleto en pose T) a los personajes de YUK
 * (mismo esqueleto `mixamorig:*`, pero con pose de reposo en A).
 *
 * `SkeletonUtils.retargetClip` copia la orientación de cada hueso en espacio mundo y admite un
 * desfase por hueso (`localOffsets`):   mundo_destino = mundo_origen · desfase.
 *
 * El desfase NO debe igualar la pose T del origen con la pose A del destino: entonces toda la
 * animación saldría girada ~45° en los brazos (un clip con los brazos pegados al cuerpo los
 * metería dentro del torso). Lo correcto es:
 *
 *  1. Llevar temporalmente el esqueleto destino a la pose de reposo del origen (pose T),
 *     alineando la dirección de cada hueso con la de su equivalente.
 *  2. Calcular  desfase = (reposo_origen)⁻¹ · destino_en_pose_T.  Así el desfase sólo contiene
 *     las diferencias de orientación interna de los huesos (roll), no la diferencia de pose.
 *  3. Volver a la pose A del bind.
 *
 * Resultado: cada fotograma de la animación reproduce la misma dirección de huesos en el modelo,
 * y sin animación el modelo sigue en su pose A.
 *
 * La posición de la cadera se escala por la relación de alturas cadera-suelo de ambos esqueletos
 * (Mixamo suele exportar en centímetros).
 *
 * No se modifica la geometría: sólo se generan pistas de rotación/posición de huesos.
 */

import * as THREE from 'three';
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Nombre canónico de un hueso: sin prefijo `mixamorig`, `mixamorig1:`, etc., en minúsculas. */
export function canonicalBone(name: string): string {
  return name.replace(/^mixamorig\d*[:_]?/i, '').toLowerCase();
}

export function findSkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.SkinnedMesh).isSkinnedMesh) found = o as THREE.SkinnedMesh;
  });
  return found;
}

/** Transformaciones locales de reposo de cada esqueleto (la pose A tal como viene en el GLB). */
const REST = new WeakMap<THREE.Skeleton, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }[]>();

/**
 * Guarda la pose de reposo del esqueleto. Debe llamarse al cargar el modelo, antes de animarlo.
 *
 * No usamos `Skeleton.pose()` como reposo: asume que el hueso raíz cuelga del espacio de bind de
 * la malla. En los GLB exportados de Blender la raíz (Hips) cuelga de un nodo `*_rig` desplazado
 * (0,82 m en hombre.glb), y `pose()` la deja desplazada esa misma distancia.
 */
export function captureRestPose(mesh: THREE.SkinnedMesh) {
  if (REST.has(mesh.skeleton)) return;
  REST.set(
    mesh.skeleton,
    mesh.skeleton.bones.map((b) => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }))
  );
}

/** Devuelve el esqueleto a la pose de reposo guardada (pose A). */
export function restPose(mesh: THREE.SkinnedMesh) {
  const snap = REST.get(mesh.skeleton);
  if (!snap) {
    mesh.skeleton.pose();
    return;
  }
  mesh.skeleton.bones.forEach((b, i) => {
    b.position.copy(snap[i].p);
    b.quaternion.copy(snap[i].q);
    b.scale.copy(snap[i].s);
  });
  mesh.skeleton.bones[0]?.parent?.updateMatrixWorld(true);
}

function collectBones(root: THREE.Object3D): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
  });
  return bones;
}

function topAncestor(o: THREE.Object3D): THREE.Object3D {
  let r = o;
  while (r.parent) r = r.parent;
  return r;
}

/** Hijo que define la dirección de un hueso (columna en la cadera, cuello en el pecho, dedo medio en la mano). */
const DIRECTION_CHILD_PREFERENCE = ['spine', 'spine1', 'spine2', 'neck', 'lefthandmiddle1', 'righthandmiddle1'];

/**
 * Gira cada hueso del destino (en espacio mundo, de padres a hijos) para que apunte en la misma
 * dirección que su equivalente del origen en reposo. Sólo cambia rotaciones de huesos en memoria.
 */
function matchRestDirections(hips: THREE.Bone, names: Record<string, string>, srcSkeleton: THREE.Skeleton) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const tDir = new THREE.Vector3();
  const sDir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const world = new THREE.Quaternion();
  const parentWorld = new THREE.Quaternion();

  const visit = (bone: THREE.Bone) => {
    const src = srcSkeleton.getBoneByName(names[bone.name] ?? '');
    const kids = bone.children.filter((c): c is THREE.Bone => (c as THREE.Bone).isBone && !!names[c.name]);
    if (src && kids.length) {
      const child = kids.find((k) => DIRECTION_CHILD_PREFERENCE.includes(canonicalBone(k.name))) ?? kids[0];
      const srcChild = srcSkeleton.getBoneByName(names[child.name]);
      if (srcChild) {
        tDir.subVectors(child.getWorldPosition(a), bone.getWorldPosition(b));
        sDir.subVectors(srcChild.getWorldPosition(a), src.getWorldPosition(b));
        if (tDir.lengthSq() > 1e-12 && sDir.lengthSq() > 1e-12) {
          q.setFromUnitVectors(tDir.normalize(), sDir.normalize());
          bone.getWorldQuaternion(world);
          world.premultiply(q);
          if (bone.parent) bone.parent.getWorldQuaternion(parentWorld);
          else parentWorld.identity();
          bone.quaternion.copy(parentWorld.invert().multiply(world));
          bone.updateMatrixWorld(true);
        }
      }
    }
    bone.children.forEach((c) => {
      if ((c as THREE.Bone).isBone) visit(c as THREE.Bone);
    });
  };
  visit(hips);
}

/**
 * Altura de la cadera sobre el suelo (y = 0) en unidades de mundo. Las animaciones de Mixamo tienen
 * el origen entre los pies y el visor apoya el modelo en y = 0, así que la relación de alturas
 * deja la cadera del modelo exactamente a su altura de reposo.
 */
function hipHeight(bones: THREE.Bone[]): number | null {
  const hips = bones.find((b) => canonicalBone(b.name) === 'hips');
  if (!hips) return null;
  const y = hips.getWorldPosition(new THREE.Vector3()).y;
  return y > 1e-6 ? y : null;
}

export interface RetargetResult {
  clips: THREE.AnimationClip[];
  /** Huesos del modelo sin equivalente en la animación (se quedan en reposo). */
  unmatched: string[];
}

export interface RetargetOptions {
  /** Fotogramas por segundo del clip resultante (Mixamo exporta a 30). */
  fps?: number;
}

/**
 * Adapta los clips de `source` (escena cargada de un FBX/GLB de Mixamo) al `target`.
 * El target debe estar ya colocado en la escena (su matriz de mundo final), porque la
 * posición de la cadera se resuelve en espacio mundo.
 */
export function retargetMixamoClips(
  target: THREE.SkinnedMesh,
  source: THREE.Object3D,
  clips: THREE.AnimationClip[],
  opts: RetargetOptions = {}
): RetargetResult {
  let srcBones = collectBones(source);
  if (!srcBones.length) {
    // Un GLB de sólo animación (sin malla) no tiene skin: GLTFLoader carga sus huesos como nodos
    // normales. Los reconocemos por nombre (mismos huesos que el modelo).
    const targetCanon = new Set(target.skeleton.bones.map((b) => canonicalBone(b.name)));
    const nodes: THREE.Object3D[] = [];
    source.traverse((o) => {
      if (o !== source && targetCanon.has(canonicalBone(o.name))) nodes.push(o);
    });
    srcBones = nodes as THREE.Bone[];
  }
  if (!srcBones.length) throw new Error('El archivo de animación no contiene un esqueleto compatible (mixamorig).');

  // Reposo del origen: el bind pose si tiene malla con skin; si no, las transformaciones del archivo
  // (en Mixamo "sin skin" son la pose T).
  const srcSkinned = findSkinnedMesh(source);
  const srcSkeleton = srcSkinned ? srcSkinned.skeleton : new THREE.Skeleton(srcBones);
  if (srcSkinned) srcSkinned.skeleton.pose();
  // retargetClip lee `source.skeleton` y anima `source` con un AnimationMixer (las pistas se
  // resuelven por nombre entre sus descendientes).
  (source as THREE.Object3D & { skeleton?: THREE.Skeleton }).skeleton = srcSkeleton;
  source.updateMatrixWorld(true);

  const srcByCanon = new Map(srcSkeleton.bones.map((b) => [canonicalBone(b.name), b]));
  const names: Record<string, string> = {};
  const unmatched: string[] = [];
  let hipName: string | undefined;
  for (const bone of target.skeleton.bones) {
    const src = srcByCanon.get(canonicalBone(bone.name));
    if (!src) {
      unmatched.push(bone.name);
      continue;
    }
    names[bone.name] = src.name;
    if (canonicalBone(bone.name) === 'hips') hipName = src.name;
  }
  if (!hipName) throw new Error('La animación no tiene hueso de cadera (Hips) compatible.');

  // 1. Destino a la pose de reposo del origen (pose T), de padres a hijos.
  captureRestPose(target); // si el visor no la guardó al cargar, el estado actual se toma como reposo
  const root = topAncestor(target);
  root.updateMatrixWorld(true);
  restPose(target);
  const targetHips = target.skeleton.bones.find((b) => names[b.name] === hipName)!;
  matchRestDirections(targetHips, names, srcSkeleton);

  // 2. Desfases de orientación interna con ambos esqueletos en la misma pose.
  const localOffsets: Record<string, THREE.Matrix4> = {};
  const qT = new THREE.Quaternion();
  const qS = new THREE.Quaternion();
  for (const bone of target.skeleton.bones) {
    const src = names[bone.name] ? srcSkeleton.getBoneByName(names[bone.name]) : undefined;
    if (!src) continue;
    bone.getWorldQuaternion(qT);
    src.getWorldQuaternion(qS);
    localOffsets[bone.name] = new THREE.Matrix4().makeRotationFromQuaternion(qS.invert().multiply(qT));
  }

  const tH = hipHeight(target.skeleton.bones);
  const sH = hipHeight(srcSkeleton.bones);
  const scale = tH && sH ? tH / sH : 1;

  const out = clips.map((clip) => {
    const rc = retargetClip(target, source as THREE.SkinnedMesh, clip, {
      names,
      hip: hipName,
      scale,
      localOffsets,
      fps: opts.fps ?? 30,
      preserveBonePositions: true,
      preserveBoneMatrix: true,
      useFirstFramePosition: false,
    } as Parameters<typeof retargetClip>[3]);
    // Las pistas salen como `.bones[Nombre].prop` (relativas a la SkinnedMesh). Las renombramos a
    // `Nombre.prop` para que el mixer de la escena completa las resuelva por nombre de nodo.
    rc.tracks.forEach((t) => {
      t.name = t.name.replace(/^\.bones\[([^\]]+)\]\./, '$1.');
    });
    rc.name = clip.name;
    return rc;
  });

  // Dejamos el modelo en su pose A.
  restPose(target);
  root.updateMatrixWorld(true);

  return { clips: out, unmatched };
}

/** Pesos de los morph targets a partir de dos deslizadores de -1 a +1. */
export function morphWeights(peso: number, musculo: number): Record<string, number> {
  const c = (v: number) => Math.max(-1, Math.min(1, v));
  const p = c(peso);
  const m = c(musculo);
  return {
    peso_mas: Math.max(0, p),
    peso_menos: Math.max(0, -p),
    musculo_mas: Math.max(0, m),
    musculo_menos: Math.max(0, -m),
  };
}
