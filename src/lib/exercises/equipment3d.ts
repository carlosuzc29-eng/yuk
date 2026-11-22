import * as THREE from 'three';
import type { Exercise } from '@/types/training';
import type { PatternDef } from './poses';
import { side2DTo3D, SCALE_3D, type Pose3D } from './kinematics3d';

/**
 * Constructor de máquinas y equipamiento de gimnasio 3D realistas
 * (barras olímpicas, discos, mancuernas hexagonales, bancos tapizados,
 * torre de poleas con placas de peso y cable tenso dinámico, prensa 45°,
 * máquina de extensión/curl femoral, rack de dominadas/fondos, etc.).
 */

export interface Equipment3D {
  root: THREE.Group;
  update: (pose: Pose3D) => void;
  dispose: () => void;
}

const UP = new THREE.Vector3(0, 1, 0);

function orientCylinderBetween(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  const d = b.clone().sub(a);
  const len = Math.max(0.005, d.length());
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
  mesh.scale.set(1, len, 1);
}

export function createEquipment3D(exercise: Exercise, def: PatternDef): Equipment3D {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Materiales de gimnasio comercial premium
  const steelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x252932, roughness: 0.4, metalness: 0.78 })
  );
  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd4d9e0, roughness: 0.18, metalness: 0.92 })
  );
  const leatherMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.72, metalness: 0.08 })
  );
  const rubberMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.85, metalness: 0.12 })
  );
  const accentRingMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xff5a14, roughness: 0.42, metalness: 0.25 })
  );
  const bandMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xff6b1a, roughness: 0.55, metalness: 0.05 })
  );
  const stackMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2e333e, roughness: 0.5, metalness: 0.65 })
  );

  const box = (w: number, h: number, d: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, segs = 20) => {
    const m = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(rt, rb, h, segs)), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  const updaters: ((pose: Pose3D) => void)[] = [];

  // ─────────────── 1. ESCENARIO ESTÁTICO (Bancos, racks, cajones, asientos) ───────────────
  def.scene?.forEach((it) => {
    if (it.t === 'rect') {
      const center = side2DTo3D([it.x + it.w / 2, it.y + it.h / 2], 0);
      const lengthZ = Math.max(0.12, it.w * SCALE_3D);
      const heightY = Math.max(0.05, it.h * SCALE_3D);
      const widthX = exercise.pattern === 'step_up' ? 0.52 : 0.34;
      const mat = exercise.pattern === 'step_up' ? steelMat : leatherMat;
      const pad = box(widthX, heightY, lengthZ, mat);
      pad.position.copy(center);
      root.add(pad);
      // Marco metálico inferior del tapizado
      if (heightY < 0.16) {
        const frame = box(widthX * 0.82, 0.032, lengthZ * 0.94, steelMat);
        frame.position.set(center.x, center.y - heightY / 2 - 0.016, center.z);
        root.add(frame);
      }
    } else if (it.t === 'line') {
      const a = side2DTo3D(it.a, 0);
      const b = side2DTo3D(it.b, 0);
      const isHorizontalBar = Math.abs(a.y - b.y) < 0.05 && exercise.pattern !== 'dip';
      if (isHorizontalBar && (exercise.pattern === 'pull_up' || exercise.pattern === 'hanging_leg_raise' || exercise.pattern === 'inverted_row')) {
        // Rack completo con dos postes verticales + barra horizontal cromada
        const barY = a.y;
        const barZ = (a.z + b.z) / 2;
        const bar = cyl(0.018, 0.018, 1.25, chromeMat);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, barY, barZ);
        root.add(bar);
        for (const sx of [-0.6, 0.6]) {
          const post = box(0.06, barY + 0.06, 0.06, steelMat);
          post.position.set(sx, (barY + 0.06) / 2, barZ);
          root.add(post);
          const baseFoot = box(0.12, 0.04, 0.65, steelMat);
          baseFoot.position.set(sx, 0.02, barZ);
          root.add(baseFoot);
        }
      } else if (exercise.pattern === 'dip') {
        // Barras paralelas de fondos (dos lados en ±0.27m)
        for (const sx of [-0.27, 0.27]) {
          const seg = cyl(0.022, 0.022, 1, steelMat, 14);
          orientCylinderBetween(
            seg,
            new THREE.Vector3(sx, a.y, a.z),
            new THREE.Vector3(sx, b.y, b.z)
          );
          root.add(seg);
        }
      } else {
        // Patas / soportes estructurales de acero
        const leg = cyl(0.022, 0.022, 1, steelMat, 14);
        orientCylinderBetween(leg, a, b);
        root.add(leg);
        if (Math.min(a.y, b.y) < 0.06) {
          const footBar = box(0.42, 0.03, 0.06, steelMat);
          footBar.position.set(0, 0.015, a.y < b.y ? a.z : b.z);
          root.add(footBar);
        }
      }
    }
  });

  // ─────────────── 2. ALMOHADILLAS Y PALANCAS DINÁMICAS DE MÁQUINAS ───────────────
  def.pads?.forEach((pad) => {
    if (pad === 'backpad' || pad === 'chestpad') {
      const padMesh = box(0.34, 0.56, 0.08, leatherMat);
      const spine = box(0.06, 0.64, 0.06, steelMat);
      spine.position.set(0, -0.06, pad === 'backpad' ? -0.055 : 0.055);
      const grp = new THREE.Group();
      grp.add(padMesh, spine);
      root.add(grp);
      updaters.push((pose) => {
        const mid = pose.pelvis.clone().lerp(pose.neckBase, 0.5);
        const offset = pose.torsoForward.clone().multiplyScalar(pad === 'backpad' ? -0.15 : 0.16);
        grp.position.copy(mid).add(offset);
        const m = new THREE.Matrix4().makeBasis(pose.torsoRight, pose.torsoUp, pose.torsoForward);
        grp.quaternion.setFromRotationMatrix(m);
      });
    } else if (pad === 'anklepad' || pad === 'anklepad_back' || pad === 'thighpad' || pad === 'hippad') {
      const roller = cyl(0.055, 0.055, 0.44, leatherMat, 18);
      roller.rotation.z = Math.PI / 2;
      const capL = cyl(0.058, 0.058, 0.015, accentRingMat, 18);
      capL.rotation.z = Math.PI / 2;
      capL.position.x = 0.22;
      const capR = capL.clone();
      capR.position.x = -0.22;
      const grp = new THREE.Group();
      grp.add(roller, capL, capR);
      root.add(grp);

      // Brazo metálico articulado desde la rodilla (en máquinas de pierna)
      let armMesh: THREE.Mesh | null = null;
      if (pad === 'anklepad' || pad === 'anklepad_back') {
        armMesh = cyl(0.018, 0.018, 1, chromeMat, 12);
        root.add(armMesh);
      }

      updaters.push((pose) => {
        if (pad === 'anklepad' || pad === 'anklepad_back') {
          const midAnkle = pose.ankleL.clone().lerp(pose.ankleR, 0.5);
          const midKnee = pose.kneeL.clone().lerp(pose.kneeR, 0.5);
          const shinDir = midAnkle.clone().sub(midKnee).normalize();
          const shinFwd = new THREE.Vector3().crossVectors(shinDir, new THREE.Vector3(-1, 0, 0)).normalize();
          const sign = pad === 'anklepad' ? 1 : -1;
          grp.position.copy(midAnkle).addScaledVector(shinFwd, sign * 0.075);
          if (armMesh) {
            orientCylinderBetween(
              armMesh,
              new THREE.Vector3(-0.26, midKnee.y, midKnee.z),
              new THREE.Vector3(-0.26, grp.position.y, grp.position.z)
            );
          }
        } else if (pad === 'thighpad') {
          const midKnee = pose.kneeL.clone().lerp(pose.kneeR, 0.5);
          grp.position.set(0, midKnee.y + 0.1, midKnee.z - 0.04);
        } else if (pad === 'hippad') {
          grp.position.copy(pose.pelvis).addScaledVector(pose.torsoForward, 0.12);
        }
      });
    }
  });

  // ─────────────── 3. MÁQUINAS ESPECÍFICAS (Prensa 45°, Torre de Poleas, Rack, Press Máquina) ───────────────
  if (exercise.pattern === 'leg_press') {
    // Plataforma inclinada de prensa 45° + discos laterales que se mueven con los pies
    const sledGroup = new THREE.Group();
    const plate = box(0.68, 0.44, 0.05, steelMat);
    const tread = box(0.62, 0.38, 0.058, rubberMat);
    sledGroup.add(plate, tread);
    // Discos olímpicos cargados a los lados del trineo
    for (const sx of [-0.42, 0.42]) {
      const bumper = cyl(0.21, 0.21, 0.055, rubberMat, 24);
      bumper.rotation.z = Math.PI / 2;
      bumper.position.set(sx, 0, 0.12);
      const ring = cyl(0.17, 0.17, 0.06, accentRingMat, 24);
      ring.rotation.z = Math.PI / 2;
      ring.position.set(sx, 0, 0.12);
      sledGroup.add(bumper, ring);
    }
    root.add(sledGroup);

    // Rieles cromados inclinados 45°
    for (const sx of [-0.36, 0.36]) {
      const rail = cyl(0.02, 0.02, 1.35, chromeMat, 14);
      orientCylinderBetween(
        rail,
        new THREE.Vector3(sx, 0.12, -0.05),
        new THREE.Vector3(sx, 1.15, 0.85)
      );
      root.add(rail);
    }

    updaters.push((pose) => {
      const midFoot = pose.ankleL.clone().lerp(pose.ankleR, 0.5);
      sledGroup.position.set(0, midFoot.y + 0.06, midFoot.z + 0.14);
      sledGroup.rotation.x = -Math.PI / 4;
    });
  }

  // Torre de poleas real con pila de placas de peso + polea + cable tenso dinámico
  if (exercise.equipment === 'polea' || exercise.equipment === 'banda') {
    const isBand = exercise.equipment === 'banda';
    const cableL = cyl(isBand ? 0.011 : 0.0045, isBand ? 0.011 : 0.0045, 1, isBand ? bandMat : chromeMat, 10);
    const cableR = cyl(isBand ? 0.011 : 0.0045, isBand ? 0.011 : 0.0045, 1, isBand ? bandMat : chromeMat, 10);
    root.add(cableL, cableR);

    // Si es polea, construimos la columna metálica con pila de pesas en la posición del anclaje
    let towerBuilt = false;
    const pulleyWheel = cyl(0.055, 0.055, 0.026, chromeMat, 20);
    pulleyWheel.rotation.z = Math.PI / 2;
    if (!isBand) root.add(pulleyWheel);

    // Barra de jalón o manerales en manos
    const isBarAttachment =
      exercise.pattern === 'pulldown' ||
      exercise.pattern === 'straight_arm_pulldown' ||
      exercise.pattern === 'pushdown' ||
      exercise.pattern === 'curl' ||
      exercise.pattern === 'row_seated';
    const attachBar = isBarAttachment ? cyl(0.015, 0.015, 1, chromeMat, 14) : null;
    if (attachBar) root.add(attachBar);

    updaters.push((pose) => {
      const anchor = pose.anchor ?? new THREE.Vector3(0, 1.95, 0.65);
      if (!isBand && !towerBuilt) {
        towerBuilt = true;
        const towerZ = anchor.z + (anchor.z >= 0 ? 0.08 : -0.08);
        const towerX = pose.isSidePattern ? 0 : anchor.x;
        const towerH = Math.max(2.05, anchor.y + 0.15);

        // Dos columnas de acero + base
        for (const dx of [-0.22, 0.22]) {
          const col = box(0.05, towerH, 0.05, steelMat);
          col.position.set(towerX + dx, towerH / 2, towerZ);
          root.add(col);
        }
        const topBeam = box(0.52, 0.06, 0.14, steelMat);
        topBeam.position.set(towerX, towerH, towerZ);
        root.add(topBeam);

        // Pila de placas de hierro (weight stack)
        for (let i = 0; i < 10; i++) {
          const brick = box(0.34, 0.042, 0.14, stackMat);
          brick.position.set(towerX, 0.16 + i * 0.055, towerZ);
          root.add(brick);
        }
      }

      if (!isBand) pulleyWheel.position.copy(anchor);

      if (def.anchorAtAnkle) {
        orientCylinderBetween(cableL, anchor, pose.ankleR);
        cableR.visible = false;
      } else if (attachBar) {
        const midHand = pose.wristL.clone().lerp(pose.wristR, 0.5);
        orientCylinderBetween(cableL, anchor, midHand);
        cableR.visible = false;
        const barL = pose.wristL.clone().add(new THREE.Vector3(0.08, 0, 0));
        const barR = pose.wristR.clone().add(new THREE.Vector3(-0.08, 0, 0));
        orientCylinderBetween(attachBar, barL, barR);
      } else if (pose.isSidePattern) {
        const anchorL = anchor.clone().add(new THREE.Vector3(0.28, 0, 0));
        const anchorR = anchor.clone().add(new THREE.Vector3(-0.28, 0, 0));
        orientCylinderBetween(cableL, anchorL, pose.wristL);
        orientCylinderBetween(cableR, anchorR, pose.wristR);
      } else {
        orientCylinderBetween(cableL, anchor, pose.wristR);
        cableR.visible = false;
      }
    });
  }

  // Máquina de press de pecho / hombro / hack squat: estructura trasera + brazos articulados
  if (
    exercise.equipment === 'maquina' &&
    (exercise.pattern === 'chest_press_machine' ||
      exercise.pattern === 'overhead_press_seated' ||
      exercise.pattern === 'row_chest_supported' ||
      exercise.pattern === 'squat_machine')
  ) {
    // Torre de peso trasera
    const machineCol = box(0.36, 1.65, 0.22, steelMat);
    machineCol.position.set(0, 0.825, -0.58);
    root.add(machineCol);
    for (let i = 0; i < 8; i++) {
      const brick = box(0.28, 0.045, 0.14, stackMat);
      brick.position.set(0, 0.2 + i * 0.06, -0.58);
      root.add(brick);
    }

    const leverL = cyl(0.018, 0.018, 1, chromeMat, 12);
    const leverR = cyl(0.018, 0.018, 1, chromeMat, 12);
    const gripL = cyl(0.02, 0.02, 0.14, rubberMat, 12);
    const gripR = cyl(0.02, 0.02, 0.14, rubberMat, 12);
    root.add(leverL, leverR, gripL, gripR);

    updaters.push((pose) => {
      const pivotL = new THREE.Vector3(0.28, 1.38, -0.45);
      const pivotR = new THREE.Vector3(-0.28, 1.38, -0.45);
      orientCylinderBetween(leverL, pivotL, pose.wristL);
      orientCylinderBetween(leverR, pivotR, pose.wristR);
      gripL.position.copy(pose.wristL);
      gripR.position.copy(pose.wristR);
    });
  }

  // ─────────────── 4. IMPLEMENTOS EN MANOS (Barra olímpica, Mancuernas, Kettlebell, Rueda) ───────────────
  if (exercise.equipment === 'barra') {
    const barGroup = new THREE.Group();
    const shaft = cyl(0.015, 0.015, 2.05, chromeMat, 18);
    shaft.rotation.z = Math.PI / 2;
    barGroup.add(shaft);

    // Mangas y discos olímpicos 20kg + 10kg a ambos lados
    for (const sx of [-1, 1]) {
      const sleeve = cyl(0.025, 0.025, 0.34, chromeMat, 16);
      sleeve.rotation.z = Math.PI / 2;
      sleeve.position.x = sx * 0.84;
      barGroup.add(sleeve);

      const plate1 = cyl(0.215, 0.215, 0.048, rubberMat, 28);
      plate1.rotation.z = Math.PI / 2;
      plate1.position.x = sx * 0.72;
      const ring1 = cyl(0.175, 0.175, 0.052, accentRingMat, 28);
      ring1.rotation.z = Math.PI / 2;
      ring1.position.x = sx * 0.72;

      const plate2 = cyl(0.17, 0.17, 0.036, rubberMat, 24);
      plate2.rotation.z = Math.PI / 2;
      plate2.position.x = sx * 0.785;

      const collar = cyl(0.036, 0.036, 0.032, chromeMat, 16);
      collar.rotation.z = Math.PI / 2;
      collar.position.x = sx * 0.83;

      barGroup.add(plate1, ring1, plate2, collar);
    }
    root.add(barGroup);

    // En sentadillas o press de banca con barra, añadir postes del rack detrás para contexto real
    if (exercise.pattern === 'squat_back' || exercise.pattern === 'squat_front') {
      for (const sx of [-0.58, 0.58]) {
        const post = box(0.055, 1.9, 0.055, steelMat);
        post.position.set(sx, 0.95, -0.35);
        root.add(post);
        const foot = box(0.09, 0.035, 0.72, steelMat);
        foot.position.set(sx, 0.017, -0.2);
        root.add(foot);
      }
    }

    updaters.push((pose) => {
      const mid = pose.wristL.clone().lerp(pose.wristR, 0.5);
      barGroup.position.copy(mid);
    });
  } else if (exercise.equipment === 'mancuernas') {
    const buildDumbbell = () => {
      const g = new THREE.Group();
      const handle = cyl(0.015, 0.015, 0.15, chromeMat, 12);
      handle.rotation.z = Math.PI / 2;
      g.add(handle);
      for (const sx of [-0.095, 0.095]) {
        const hex = cyl(0.068, 0.068, 0.062, rubberMat, 6);
        hex.rotation.z = Math.PI / 2;
        hex.position.x = sx;
        const rim = cyl(0.042, 0.042, 0.066, accentRingMat, 6);
        rim.rotation.z = Math.PI / 2;
        rim.position.x = sx;
        g.add(hex, rim);
      }
      return g;
    };
    const dbL = buildDumbbell();
    const dbR = buildDumbbell();
    root.add(dbL, dbR);

    updaters.push((pose) => {
      dbL.position.copy(pose.wristL);
      dbR.position.copy(pose.wristR);
      if (exercise.unilateral) dbL.visible = false;
    });
  } else if (exercise.equipment === 'kettlebell') {
    const kb = new THREE.Group();
    const bell = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 20, 16)), rubberMat);
    bell.position.y = -0.11;
    bell.castShadow = true;
    const handle = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.065, 0.016, 12, 20, Math.PI)), steelMat);
    handle.position.y = -0.02;
    kb.add(bell, handle);
    root.add(kb);
    updaters.push((pose) => {
      kb.position.copy(pose.wristL.clone().lerp(pose.wristR, 0.5));
    });
  } else if (exercise.pattern === 'ab_wheel') {
    const wheelGroup = new THREE.Group();
    const tire = cyl(0.095, 0.095, 0.048, rubberMat, 24);
    tire.rotation.z = Math.PI / 2;
    const hub = cyl(0.055, 0.055, 0.054, accentRingMat, 20);
    hub.rotation.z = Math.PI / 2;
    const axle = cyl(0.014, 0.014, 0.3, chromeMat, 12);
    axle.rotation.z = Math.PI / 2;
    wheelGroup.add(tire, hub, axle);
    root.add(wheelGroup);
    updaters.push((pose) => {
      const mid = pose.wristL.clone().lerp(pose.wristR, 0.5);
      wheelGroup.position.set(mid.x, Math.max(0.095, mid.y), mid.z);
    });
  }

  const update = (pose: Pose3D) => {
    for (const fn of updaters) fn(pose);
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  };

  return { root, update, dispose };
}
