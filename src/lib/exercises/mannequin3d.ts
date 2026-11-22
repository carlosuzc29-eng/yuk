import * as THREE from 'three';
import type { MuscleId, Sex } from '@/types/user';
import type { Pose3D } from './kinematics3d';

/**
 * Maniquí 3D escultórico estilo ZBrush Clay (masculino y femenino)
 * con proporciones anatómicas realistas basadas en las referencias visuales
 * y superposición de los 19 grupos musculares iluminables.
 */

export interface Mannequin3D {
  root: THREE.Group;
  update: (pose: Pose3D, concentricPulse: number) => void;
  setActiveMuscles: (primary: MuscleId[], secondary: MuscleId[]) => void;
  dispose: () => void;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Crea una geometría orgánica lofted (`LatheGeometry`) de y = 0 a y = 1 con perfil de radios. */
function buildLatheLimb(profile: [number, number][], radialSegs = 24): THREE.LatheGeometry {
  const pts = profile.map(([t, r]) => new THREE.Vector2(Math.max(0.002, r), t));
  const geo = new THREE.LatheGeometry(pts, radialSegs);
  geo.computeVertexNormals();
  return geo;
}

/** Orienta y escala un mesh de extremidad de `start` a `end` preservando el frente anatómico. */
function placeLimb(
  mesh: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radiusScaleX = 1,
  radiusScaleZ = 1
) {
  const dir = end.clone().sub(start);
  const length = Math.max(0.02, dir.length());
  mesh.position.copy(start);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.scale.set(radiusScaleX, length, radiusScaleZ);
}

/** Orienta un grupo cuyo origen está en `origin` según los ejes (right, up, forward). */
function orientBasis(
  obj: THREE.Object3D,
  origin: THREE.Vector3,
  right: THREE.Vector3,
  up: THREE.Vector3,
  forward: THREE.Vector3
) {
  obj.position.copy(origin);
  const m = new THREE.Matrix4().makeBasis(right, up, forward);
  obj.quaternion.setFromRotationMatrix(m);
}

export function createMannequin3D(sex: Sex): Mannequin3D {
  const f = sex === 'female';
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

  // Material arcilla/mármol mate estilo ZBrush Studio (referencias masculina y femenina)
  const clayMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: f ? 0xdedfe3 : 0xcdd0d6,
      roughness: f ? 0.52 : 0.58,
      metalness: 0.04,
    })
  );

  const jointMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: f ? 0xd2d4d9 : 0xc0c4cb,
      roughness: 0.62,
      metalness: 0.03,
    })
  );

  // Materiales de músculos activos (primario intenso, secundario suave)
  const primMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff5a14,
      emissive: 0xff3c00,
      emissiveIntensity: 0.45,
      roughness: 0.42,
      metalness: 0.06,
    })
  );

  const secMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff9f66,
      emissive: 0xd95f18,
      emissiveIntensity: 0.2,
      roughness: 0.5,
      metalness: 0.04,
    })
  );

  const muscleMeshes = new Map<MuscleId, THREE.Mesh[]>();
  const registerMuscle = (id: MuscleId, mesh: THREE.Mesh) => {
    const arr = muscleMeshes.get(id) ?? [];
    arr.push(mesh);
    muscleMeshes.set(id, arr);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const makeSphere = (rx: number, ry: number, rz: number, mat: THREE.Material = clayMat) => {
    const g = trackGeo(new THREE.SphereGeometry(1, 24, 18));
    g.scale(rx, ry, rz);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // ─────────────── 1. TORSO ESCULPIDO (Pelvis → Cintura → Pecho) ───────────────
  const torsoGroup = new THREE.Group();
  root.add(torsoGroup);

  // Tronco principal lofted de y=0 (pelvis) a y=0.53 (base cuello)
  const torsoProfile: [number, number][] = f
    ? [
        [0.0, 0.055],
        [0.06, 0.155], // caderas femeninas
        [0.16, 0.145],
        [0.34, 0.108], // cintura marcada estilo reloj de arena
        [0.54, 0.128], // caja torácica
        [0.74, 0.148], // parte alta torso
        [0.92, 0.145], // hombros estilizados
        [1.0, 0.055],
      ]
    : [
        [0.0, 0.06],
        [0.08, 0.142], // pelvis atlética masculina
        [0.24, 0.138],
        [0.4, 0.135], // cintura sólida
        [0.64, 0.168], // dorsales en V
        [0.82, 0.184], // pecho y hombros anchos
        [0.94, 0.172],
        [1.0, 0.065],
      ];

  const torsoGeo = trackGeo(buildLatheLimb(torsoProfile, 32));
  // Aplanar ligeramente en Z (profundidad pecho-espalda realista)
  torsoGeo.scale(1, 0.53, f ? 0.68 : 0.66);
  const torsoCore = new THREE.Mesh(torsoGeo, clayMat);
  torsoCore.castShadow = true;
  torsoCore.receiveShadow = true;
  torsoGroup.add(torsoCore);

  // Pectorales / busto esculpido según referencia masculina o femenina
  for (const side of [-1, 1]) {
    const pec = makeSphere(
      f ? 0.066 : 0.088,
      f ? 0.064 : 0.066,
      f ? 0.068 : 0.048
    );
    pec.position.set(side * (f ? 0.062 : 0.082), f ? 0.365 : 0.395, f ? 0.082 : 0.088);
    pec.rotation.y = side * (f ? -0.18 : -0.14);
    pec.rotation.x = f ? 0.16 : 0.08;
    torsoGroup.add(registerMuscle('pectorales', pec));
  }

  // Clavículas sutiles
  for (const side of [-1, 1]) {
    const clav = makeSphere(0.08, 0.013, 0.015, clayMat);
    clav.position.set(side * (f ? 0.078 : 0.092), 0.478, 0.058);
    clav.rotation.z = side * 0.12;
    clav.rotation.y = side * -0.25;
    torsoGroup.add(clav);
  }

  // Abdomen (6-pack anatómico sutil estilo escultura ZBrush)
  const abPairs: [number, number, number][] = [
    [0.295, f ? 0.032 : 0.042, f ? 0.032 : 0.038],
    [0.23, f ? 0.03 : 0.04, f ? 0.03 : 0.036],
    [0.165, f ? 0.028 : 0.036, f ? 0.032 : 0.04],
  ];
  for (const [y, rx, ry] of abPairs) {
    for (const side of [-1, 1]) {
      const ab = makeSphere(rx, ry, f ? 0.022 : 0.028);
      ab.position.set(side * (f ? 0.026 : 0.036), y, f ? 0.072 : 0.086);
      torsoGroup.add(registerMuscle('abdomen', ab));
    }
  }

  // Oblicuos laterales
  for (const side of [-1, 1]) {
    const obl = makeSphere(0.034, 0.1, 0.056);
    obl.position.set(side * (f ? 0.094 : 0.118), 0.21, 0.015);
    obl.rotation.z = side * (f ? 0.14 : -0.06);
    torsoGroup.add(registerMuscle('oblicuos', obl));
  }

  // Trapecio superior y medio
  const trapUpper = makeSphere(f ? 0.105 : 0.132, 0.065, 0.062);
  trapUpper.position.set(0, 0.495, -0.045);
  torsoGroup.add(registerMuscle('trapecio', trapUpper));

  // Espalda media (romboides / escápulas)
  for (const side of [-1, 1]) {
    const midBack = makeSphere(0.062, 0.076, 0.045);
    midBack.position.set(side * 0.055, 0.4, -0.078);
    torsoGroup.add(registerMuscle('espalda_media', midBack));
  }

  // Dorsales (alas en V)
  for (const side of [-1, 1]) {
    const lat = makeSphere(f ? 0.055 : 0.074, 0.135, 0.058);
    lat.position.set(side * (f ? 0.108 : 0.138), 0.33, -0.048);
    lat.rotation.z = side * -0.22;
    lat.rotation.y = side * 0.3;
    torsoGroup.add(registerMuscle('dorsales', lat));
  }

  // Lumbares (erectores espinales)
  for (const side of [-1, 1]) {
    const lumb = makeSphere(0.04, 0.095, 0.04);
    lumb.position.set(side * 0.042, 0.16, -0.076);
    torsoGroup.add(registerMuscle('lumbares', lumb));
  }

  // Glúteo mayor y glúteo medio (esculpidos realistas según referencia)
  for (const side of [-1, 1]) {
    const gluteMax = makeSphere(
      f ? 0.092 : 0.082,
      f ? 0.102 : 0.09,
      f ? 0.095 : 0.074
    );
    gluteMax.position.set(side * (f ? 0.076 : 0.068), 0.025, f ? -0.078 : -0.064);
    torsoGroup.add(registerMuscle('gluteo_mayor', gluteMax));

    const gluteMed = makeSphere(
      f ? 0.056 : 0.046,
      0.062,
      f ? 0.068 : 0.056
    );
    gluteMed.position.set(side * (f ? 0.128 : 0.112), 0.085, -0.025);
    torsoGroup.add(registerMuscle('gluteo_medio', gluteMed));
  }

  // ─────────────── 2. CUELLO Y CABEZA ESCULPIDA (Estilo ZBrush) ───────────────
  const headGroup = new THREE.Group();
  root.add(headGroup);

  // Cuello estilizado
  const neckGeo = trackGeo(
    buildLatheLimb(
      [
        [0, f ? 0.056 : 0.068],
        [0.45, f ? 0.046 : 0.058],
        [1, f ? 0.048 : 0.06],
      ],
      20
    )
  );
  neckGeo.scale(1, 0.11, 1.05);
  const neckMesh = new THREE.Mesh(neckGeo, clayMat);
  neckMesh.position.set(0, -0.11, -0.005);
  neckMesh.castShadow = true;
  headGroup.add(neckMesh);

  // Cráneo + rostro ovalado
  const cranium = makeSphere(f ? 0.082 : 0.088, f ? 0.105 : 0.112, f ? 0.098 : 0.104);
  cranium.position.set(0, 0.03, 0);
  headGroup.add(cranium);

  // Mandíbula / mentón esculpido
  const jaw = makeSphere(f ? 0.052 : 0.064, 0.055, f ? 0.068 : 0.076);
  jaw.position.set(0, -0.042, 0.03);
  headGroup.add(jaw);

  // Puente nasal + nariz sutil
  const nose = makeSphere(0.013, 0.024, 0.024);
  nose.position.set(0, 0.002, f ? 0.098 : 0.105);
  nose.rotation.x = -0.25;
  headGroup.add(nose);

  // Arco superciliar (frente)
  const brow = makeSphere(f ? 0.058 : 0.066, 0.018, 0.026);
  brow.position.set(0, 0.042, f ? 0.084 : 0.09);
  headGroup.add(brow);

  // Orejas sutiles
  for (const side of [-1, 1]) {
    const ear = makeSphere(0.012, 0.028, 0.018);
    ear.position.set(side * (f ? 0.082 : 0.088), 0.005, -0.004);
    headGroup.add(ear);
  }

  // ─────────────── 3. EXTREMIDADES ESCULPIDAS (Lathe + Músculos) ───────────────
  const upperArmGeo = trackGeo(
    buildLatheLimb(
      [
        [0.0, f ? 0.046 : 0.058],
        [0.2, f ? 0.05 : 0.062], // cabeza del deltoides
        [0.52, f ? 0.044 : 0.056], // bíceps / tríceps
        [0.85, f ? 0.036 : 0.044],
        [1.0, f ? 0.034 : 0.041], // codo
      ],
      22
    )
  );

  const forearmGeo = trackGeo(
    buildLatheLimb(
      [
        [0.0, f ? 0.035 : 0.043],
        [0.24, f ? 0.041 : 0.051], // braquiorradial lleno
        [0.62, f ? 0.032 : 0.039],
        [0.92, f ? 0.025 : 0.03], // muñeca fina
        [1.0, f ? 0.024 : 0.029],
      ],
      20
    )
  );

  const thighGeo = trackGeo(
    buildLatheLimb(
      [
        [0.0, f ? 0.084 : 0.082], // cadera / glúteo superior
        [0.25, f ? 0.088 : 0.086], // muslo superior lleno
        [0.55, f ? 0.076 : 0.078], // cuádriceps / isquiotibiales
        [0.82, f ? 0.058 : 0.062], // vasto medial lágrima
        [1.0, f ? 0.05 : 0.054], // rodilla
      ],
      24
    )
  );

  const shinGeo = trackGeo(
    buildLatheLimb(
      [
        [0.0, f ? 0.048 : 0.052], // rodilla
        [0.28, f ? 0.055 : 0.06], // pantorrilla gastrocnemio
        [0.58, f ? 0.043 : 0.046],
        [0.86, f ? 0.03 : 0.033], // tendón de Aquiles delgado
        [1.0, f ? 0.031 : 0.034], // tobillo
      ],
      22
    )
  );

  const footGeo = trackGeo(
    buildLatheLimb(
      [
        [0.0, 0.036],
        [0.3, 0.04],
        [0.75, 0.038],
        [1.0, 0.022],
      ],
      16
    )
  );
  footGeo.scale(1.1, 1, 0.62);

  function createArm(side: -1 | 1) {
    const upperGroup = new THREE.Group();
    const uMesh = new THREE.Mesh(upperArmGeo, clayMat);
    uMesh.castShadow = true;
    uMesh.receiveShadow = true;
    upperGroup.add(uMesh);

    // 3 cabezas del deltoides en la parte superior del brazo (y ~ 0.06..0.24)
    const deltLat = makeSphere(f ? 0.052 : 0.064, 0.16, f ? 0.052 : 0.062);
    deltLat.position.set(side * 0.012, 0.12, 0);
    upperGroup.add(registerMuscle('deltoides_lateral', deltLat));

    const deltAnt = makeSphere(f ? 0.046 : 0.056, 0.15, f ? 0.048 : 0.056);
    deltAnt.position.set(0, 0.13, 0.022);
    upperGroup.add(registerMuscle('deltoides_anterior', deltAnt));

    const deltPost = makeSphere(f ? 0.046 : 0.056, 0.15, f ? 0.048 : 0.056);
    deltPost.position.set(0, 0.13, -0.022);
    upperGroup.add(registerMuscle('deltoides_posterior', deltPost));

    // Bíceps y tríceps en el vientre del brazo
    const bicep = makeSphere(f ? 0.038 : 0.048, 0.24, f ? 0.04 : 0.048);
    bicep.position.set(0, 0.54, 0.022);
    upperGroup.add(registerMuscle('biceps', bicep));

    const tricep = makeSphere(f ? 0.04 : 0.05, 0.26, f ? 0.042 : 0.05);
    tricep.position.set(0, 0.52, -0.022);
    upperGroup.add(registerMuscle('triceps', tricep));

    const foreGroup = new THREE.Group();
    const fMesh = new THREE.Mesh(forearmGeo, clayMat);
    fMesh.castShadow = true;
    fMesh.receiveShadow = true;
    foreGroup.add(fMesh);

    const foreMuscle = makeSphere(f ? 0.042 : 0.052, 0.28, f ? 0.042 : 0.052);
    foreMuscle.position.set(0, 0.34, 0.008);
    foreGroup.add(registerMuscle('antebrazos', foreMuscle));

    const elbowJoint = makeSphere(f ? 0.036 : 0.043, f ? 0.036 : 0.043, f ? 0.036 : 0.043, jointMat);
    const handMesh = makeSphere(f ? 0.032 : 0.038, f ? 0.046 : 0.052, f ? 0.028 : 0.032, clayMat);

    root.add(upperGroup, foreGroup, elbowJoint, handMesh);
    return { upperGroup, foreGroup, elbowJoint, handMesh };
  }

  function createLeg(side: -1 | 1) {
    const thighGroup = new THREE.Group();
    const tMesh = new THREE.Mesh(thighGeo, clayMat);
    tMesh.castShadow = true;
    tMesh.receiveShadow = true;
    thighGroup.add(tMesh);

    const quad = makeSphere(f ? 0.072 : 0.076, 0.34, f ? 0.068 : 0.072);
    quad.position.set(0, 0.5, 0.028);
    thighGroup.add(registerMuscle('cuadriceps', quad));

    const ham = makeSphere(f ? 0.066 : 0.068, 0.32, f ? 0.062 : 0.064);
    ham.position.set(0, 0.52, -0.028);
    thighGroup.add(registerMuscle('isquiotibiales', ham));

    const addM = makeSphere(f ? 0.052 : 0.05, 0.24, 0.054);
    addM.position.set(-side * 0.036, 0.34, 0.004);
    thighGroup.add(registerMuscle('aductores', addM));

    const shinGroup = new THREE.Group();
    const sMesh = new THREE.Mesh(shinGeo, clayMat);
    sMesh.castShadow = true;
    sMesh.receiveShadow = true;
    shinGroup.add(sMesh);

    const calf = makeSphere(f ? 0.052 : 0.056, 0.24, f ? 0.054 : 0.058);
    calf.position.set(0, 0.32, -0.022);
    shinGroup.add(registerMuscle('pantorrillas', calf));

    const kneeJoint = makeSphere(f ? 0.05 : 0.054, f ? 0.05 : 0.054, f ? 0.052 : 0.056, jointMat);
    const footMesh = new THREE.Mesh(footGeo, jointMat);
    footMesh.castShadow = true;
    footMesh.receiveShadow = true;

    root.add(thighGroup, shinGroup, kneeJoint, footMesh);
    return { thighGroup, shinGroup, kneeJoint, footMesh };
  }

  const armL = createArm(1);
  const armR = createArm(-1);
  const legL = createLeg(1);
  const legR = createLeg(-1);

  const setActiveMuscles = (primary: MuscleId[], secondary: MuscleId[]) => {
    const pSet = new Set(primary);
    const sSet = new Set(secondary.filter((m) => !pSet.has(m)));
    for (const [id, meshes] of muscleMeshes.entries()) {
      const mat = pSet.has(id) ? primMat : sSet.has(id) ? secMat : clayMat;
      for (const m of meshes) m.material = mat;
    }
  };

  const update = (pose: Pose3D, concentricPulse: number) => {
    // Pulso emisivo suave durante la fase concéntrica
    primMat.emissiveIntensity = 0.38 + concentricPulse * 0.48;
    secMat.emissiveIntensity = 0.16 + concentricPulse * 0.16;

    // 1. Torso
    const torsoLen = pose.neckBase.distanceTo(pose.pelvis);
    orientBasis(torsoGroup, pose.pelvis, pose.torsoRight, pose.torsoUp, pose.torsoForward);
    torsoGroup.scale.set(1, torsoLen / 0.53, 1);

    // 2. Cabeza orientada con el cuello
    const headUp = pose.head.clone().sub(pose.neckBase).normalize();
    const headFwd = new THREE.Vector3().crossVectors(headUp, pose.torsoRight).normalize();
    orientBasis(headGroup, pose.head, pose.torsoRight, headUp, headFwd);

    // 3. Brazos
    placeLimb(armL.upperGroup, pose.shoulderL, pose.elbowL, 1, 1);
    placeLimb(armL.foreGroup, pose.elbowL, pose.wristL, 1, 1);
    armL.elbowJoint.position.copy(pose.elbowL);
    armL.handMesh.position.copy(pose.wristL);

    placeLimb(armR.upperGroup, pose.shoulderR, pose.elbowR, 1, 1);
    placeLimb(armR.foreGroup, pose.elbowR, pose.wristR, 1, 1);
    armR.elbowJoint.position.copy(pose.elbowR);
    armR.handMesh.position.copy(pose.wristR);

    // 4. Piernas y pies
    placeLimb(legL.thighGroup, pose.hipL, pose.kneeL, 1, 1.06);
    placeLimb(legL.shinGroup, pose.kneeL, pose.ankleL, 1, 1.05);
    legL.kneeJoint.position.copy(pose.kneeL);
    placeLimb(legL.footMesh, pose.ankleL, pose.toeL, 1, 1);

    placeLimb(legR.thighGroup, pose.hipR, pose.kneeR, 1, 1.06);
    placeLimb(legR.shinGroup, pose.kneeR, pose.ankleR, 1, 1.05);
    legR.kneeJoint.position.copy(pose.kneeR);
    placeLimb(legR.footMesh, pose.ankleR, pose.toeR, 1, 1);
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  };

  return { root, update, setActiveMuscles, dispose };
}
