import * as THREE from 'three';
import type { MuscleId, Sex } from '@/types/user';
import { BONE_LEN_3D, type Pose3D } from './kinematics3d';

/**
 * Escultura anatómica 3D continua estilo ZBrush Studio Clay (masculina y femenina).
 *
 * En lugar de pegar esferas sueltas sobre cilindros, cada segmento corporal
 * (torso completo con pecho/abdomen/dorsales/glúteos, cabeza+cuello, brazo,
 * antebrazo, muslo y pierna) es una ÚNICA malla paramétrica continua de alta
 * resolución donde los relieves musculares y surcos anatómicos están esculpidos
 * directamente en la superficie y los músculos activos se iluminan suavemente
 * mediante color por vértice (`vertexColors`), sin costuras ni deformaciones.
 */

export interface Mannequin3D {
  root: THREE.Group;
  update: (pose: Pose3D, concentricPulse: number) => void;
  setActiveMuscles: (primary: MuscleId[], secondary: MuscleId[]) => void;
  dispose: () => void;
}

/** Campana gaussiana 2D en coordenadas cilíndricas (ángulos en radianes, altura v en 0..1). */
function gauss(theta: number, v: number, t0: number, v0: number, st: number, sv: number): number {
  // Distancia angular mínima envuelta en [-PI, PI]
  let dt = theta - t0;
  while (dt > Math.PI) dt -= Math.PI * 2;
  while (dt < -Math.PI) dt += Math.PI * 2;
  const dv = v - v0;
  return Math.exp(-0.5 * ((dt * dt) / (st * st) + (dv * dv) / (sv * sv)));
}

/** Par simétrico izquierdo/derecho de campanas gaussianas respecto a theta = 0 (frente) o PI (espalda). */
function symGauss(theta: number, v: number, tAbs: number, v0: number, st: number, sv: number): number {
  return (
    gauss(theta, v, tAbs, v0, st, sv) +
    gauss(theta, v, -tAbs, v0, st, sv)
  );
}

interface SculptedSegment {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  recolor: (primary: Set<MuscleId>, secondary: Set<MuscleId>, pulse: number) => void;
}

type SculptEval = (
  theta: number,
  v: number
) => {
  rx: number;
  rz: number;
  yOffset?: number;
  zOffset?: number;
  weights: Partial<Record<MuscleId, number>>;
};

/**
 * Construye una malla cerrada continua (`uSegs x vSegs`) con tapas suaves en ambos extremos
 * y pesos musculares por vértice para iluminación anatómica sin costuras.
 */
function buildSculptedLoft(
  lengthY: number,
  vMin: number,
  vMax: number,
  uSegs: number,
  vSegs: number,
  evalFn: SculptEval,
  material: THREE.Material,
  baseColor: THREE.Color
): SculptedSegment {
  const ringVerts = uSegs + 1;
  const totalVerts = (vSegs + 1) * ringVerts;
  const positions = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const vertexWeights: Partial<Record<MuscleId, number>>[] = new Array(totalVerts);

  let ptr = 0;
  for (let iv = 0; iv <= vSegs; iv++) {
    const vNorm = iv / vSegs;
    // Suavizado esférico en los polos (iv=0 e iv=vSegs) para cerrar las articulaciones sin huecos
    const capFade =
      vNorm < 0.045
        ? Math.sin((vNorm / 0.045) * (Math.PI / 2))
        : vNorm > 0.955
          ? Math.sin(((1 - vNorm) / 0.045) * (Math.PI / 2))
          : 1;
    const y = THREE.MathUtils.lerp(vMin, vMax, vNorm) * lengthY;

    for (let iu = 0; iu <= uSegs; iu++) {
      // theta = 0 es el frente (+Z), +PI/2 es +X (izquierda), -PI/2 es -X (derecha), PI es espalda (-Z)
      const theta = (iu / uSegs) * Math.PI * 2 - Math.PI;
      const { rx, rz, yOffset = 0, zOffset = 0, weights } = evalFn(theta, vNorm);

      const x = Math.sin(theta) * rx * capFade;
      const z = Math.cos(theta) * rz * capFade + zOffset;

      positions[ptr * 3] = x;
      positions[ptr * 3 + 1] = y + yOffset;
      positions[ptr * 3 + 2] = z;

      colors[ptr * 3] = baseColor.r;
      colors[ptr * 3 + 1] = baseColor.g;
      colors[ptr * 3 + 2] = baseColor.b;

      vertexWeights[ptr] = weights;
      ptr += 1;
    }
  }

  const indices: number[] = [];
  for (let iv = 0; iv < vSegs; iv++) {
    for (let iu = 0; iu < uSegs; iu++) {
      const a = iv * ringVerts + iu;
      const b = a + ringVerts;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const colorAttr = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute('color', colorAttr);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const primColor = new THREE.Color(0xff5212);
  const primPulseColor = new THREE.Color(0xff7d3b);
  const secColor = new THREE.Color(0xff9d5c);
  const tmpColor = new THREE.Color();
  const activePrim = new THREE.Color();

  const recolor = (primary: Set<MuscleId>, secondary: Set<MuscleId>, pulse: number) => {
    activePrim.copy(primColor).lerp(primPulseColor, THREE.MathUtils.clamp(pulse, 0, 1));
    for (let i = 0; i < totalVerts; i++) {
      const wMap = vertexWeights[i];
      let pWeight = 0;
      let sWeight = 0;
      for (const mId in wMap) {
        const w = wMap[mId as MuscleId] ?? 0;
        if (primary.has(mId as MuscleId)) pWeight = Math.max(pWeight, w);
        else if (secondary.has(mId as MuscleId)) sWeight = Math.max(sWeight, w);
      }
      tmpColor.copy(baseColor);
      if (sWeight > 0.01) {
        tmpColor.lerp(secColor, Math.min(0.82, sWeight * 0.85));
      }
      if (pWeight > 0.01) {
        tmpColor.lerp(activePrim, Math.min(0.95, pWeight * (0.88 + pulse * 0.12)));
      }
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    colorAttr.needsUpdate = true;
  };

  return { mesh, geometry, recolor };
}

/**
 * Coloca un segmento entre `start` y `end` usando un vector `frontHint`
 * para fijar la orientación anatómica (evita que bíceps, rodillas o pantorrillas giren de lado).
 */
function placeOrientedSegment(
  obj: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  nominalLen: number,
  frontHint: THREE.Vector3
) {
  const dir = end.clone().sub(start);
  const len = Math.max(0.02, dir.length());
  const up = dir.clone().divideScalar(len);

  // Proyectar frontHint perpendicular a `up`
  const fwd = frontHint.clone().addScaledVector(up, -frontHint.dot(up));
  if (fwd.lengthSq() < 1e-6) {
    fwd.set(0, 0, 1).addScaledVector(up, -up.z);
    if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0);
  }
  fwd.normalize();
  const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const orthoFwd = new THREE.Vector3().crossVectors(right, up).normalize();

  obj.position.copy(start);
  const m = new THREE.Matrix4().makeBasis(right, up, orthoFwd);
  obj.quaternion.setFromRotationMatrix(m);
  obj.scale.set(1, len / nominalLen, 1);
}

export function createMannequin3D(sex: Sex): Mannequin3D {
  const f = sex === 'female';
  const root = new THREE.Group();
  const segments: SculptedSegment[] = [];

  // Color base arcilla ZBrush mate de alto contraste (idéntico a las dos referencias)
  const baseClayColor = new THREE.Color(f ? 0xdde0e6 : 0xcfd3db);
  const skinMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: f ? 0.5 : 0.55,
    metalness: 0.05,
  });

  // ─────────────── 1. TORSO ESCULPIDO CONTINUO (Pelvis → Cintura → Pecho → Hombros) ───────────────
  const torsoSeg = buildSculptedLoft(
    BONE_LEN_3D.torso,
    -0.14,
    1.05,
    52,
    56,
    (theta, v) => {
      // Base anatómica de ancho (rx) y profundidad (rz) según altura v (0=cadera inferior, 1=base cuello)
      const hipFlare = Math.exp(-Math.pow((v - 0.14) / 0.16, 2));
      const waistIndent = Math.exp(-Math.pow((v - 0.42) / 0.15, 2));
      const chestExpand = Math.exp(-Math.pow((v - 0.76) / 0.22, 2));
      const shoulderTaper = v > 0.88 ? Math.pow((v - 0.88) / 0.12, 1.6) : 0;

      let rx = f
        ? 0.128 + 0.036 * hipFlare - 0.032 * waistIndent + 0.022 * chestExpand - 0.075 * shoulderTaper
        : 0.132 + 0.014 * hipFlare - 0.012 * waistIndent + 0.056 * chestExpand - 0.095 * shoulderTaper;

      let rz = f
        ? 0.092 + 0.024 * hipFlare - 0.018 * waistIndent + 0.018 * chestExpand - 0.042 * shoulderTaper
        : 0.096 + 0.012 * hipFlare - 0.008 * waistIndent + 0.034 * chestExpand - 0.052 * shoulderTaper;

      // Relieves musculares esculpidos en la superficie continua:
      // 1) Pectorales / Busto (theta ≈ ±0.48, v ≈ 0.72)
      const wPec = symGauss(theta, v, f ? 0.46 : 0.5, f ? 0.71 : 0.74, f ? 0.36 : 0.42, f ? 0.1 : 0.11);
      // Surco esternal central (linea media del pecho)
      const sternumGroove = gauss(theta, v, 0, 0.73, 0.12, 0.14);

      // 2) Abdomen (6-pack con surco central linea alba e intersecciones tendinosas)
      const wAbs =
        symGauss(theta, v, 0.24, 0.56, 0.2, 0.055) +
        symGauss(theta, v, 0.23, 0.44, 0.19, 0.055) +
        symGauss(theta, v, 0.21, 0.31, 0.18, 0.065);
      const lineaAlba = gauss(theta, v, 0, 0.45, 0.08, 0.22);

      // 3) Oblicuos laterales (theta ≈ ±1.25, v ≈ 0.38)
      const wObl = symGauss(theta, v, 1.25, 0.39, 0.35, 0.14);

      // 4) Dorsales en V (theta ≈ ±2.15, v ≈ 0.66)
      const wLats = symGauss(theta, v, 2.15, 0.66, 0.45, 0.16);

      // 5) Espalda media / romboides (theta ≈ ±2.65, v ≈ 0.76)
      const wMidBack = symGauss(theta, v, 2.65, 0.76, 0.35, 0.11);

      // 6) Trapecio superior y medio (theta ≈ PI, v ≈ 0.88)
      const wTraps =
        symGauss(theta, v, 1.65, 0.93, 0.45, 0.07) +
        gauss(theta, v, Math.PI, 0.84, 0.55, 0.1);

      // 7) Lumbares + surco espinal (theta ≈ ±2.82, v ≈ 0.42)
      const wLumb = symGauss(theta, v, 2.82, 0.42, 0.24, 0.14);
      const spineFurrow = gauss(theta, v, Math.PI, 0.58, 0.12, 0.28);

      // 8) Glúteo mayor con hendidura interglútea + Glúteo medio
      const wGluteMax = symGauss(theta, v, 2.68, 0.14, 0.42, 0.11);
      const gluteCleft = gauss(theta, v, Math.PI, 0.12, 0.11, 0.12);
      const wGluteMed = symGauss(theta, v, 1.85, 0.22, 0.35, 0.09);

      // Aplicar desplazamientos suaves sobre rx y rz
      const pecAmp = f ? 0.044 : 0.026;
      const absAmp = f ? 0.006 : 0.011;
      const gluteAmp = f ? 0.046 : 0.034;
      const latAmp = f ? 0.014 : 0.026;

      rz +=
        wPec * pecAmp -
        sternumGroove * (f ? 0.012 : 0.009) +
        wAbs * absAmp -
        lineaAlba * (f ? 0.004 : 0.007) +
        wGluteMax * gluteAmp -
        gluteCleft * 0.024 +
        wMidBack * 0.014 +
        wLumb * 0.011 -
        spineFurrow * 0.012 +
        wTraps * 0.014;

      rx +=
        wLats * latAmp +
        wObl * (f ? 0.006 : 0.011) +
        wGluteMed * (f ? 0.022 : 0.014) +
        wTraps * 0.012;

      // Curva lordótica natural S de la columna (pecho ligeramente adelante, glúteo atrás)
      const zCurve = Math.sin(v * Math.PI) * 0.012 - (1 - v) * (f ? 0.016 : 0.01);

      return {
        rx,
        rz,
        zOffset: zCurve,
        weights: {
          pectorales: Math.min(1, wPec * 1.15),
          abdomen: Math.min(1, wAbs * 1.1),
          oblicuos: Math.min(1, wObl * 1.15),
          dorsales: Math.min(1, wLats * 1.2),
          espalda_media: Math.min(1, wMidBack * 1.2),
          trapecio: Math.min(1, wTraps * 1.15),
          lumbares: Math.min(1, wLumb * 1.2),
          gluteo_mayor: Math.min(1, wGluteMax * 1.2),
          gluteo_medio: Math.min(1, wGluteMed * 1.2),
        },
      };
    },
    skinMaterial,
    baseClayColor
  );
  segments.push(torsoSeg);
  root.add(torsoSeg.mesh);

  // ─────────────── 2. CUELLO + CABEZA ESCULPIDA CONTINUA (Sin esferas pegadas) ───────────────
  const headNeckLen = 0.24;
  const headSeg = buildSculptedLoft(
    headNeckLen,
    0.0,
    1.0,
    40,
    36,
    (theta, v) => {
      // v = 0..0.36 es el cuello, v = 0.36..1.0 es mandíbula -> rostro -> cráneo
      if (v < 0.34) {
        const neckR = f ? 0.048 : 0.058;
        const scm = symGauss(theta, v, 0.65, 0.18, 0.35, 0.15) * 0.004;
        return {
          rx: neckR + scm,
          rz: neckR * 1.05 + scm,
          zOffset: v * 0.01,
          weights: { trapecio: gauss(theta, v, Math.PI, 0.1, 0.8, 0.15) * 0.6 },
        };
      }
      const hv = (v - 0.34) / 0.66; // 0 = mentón/base cráneo, 1 = coronilla
      const skullProfile = Math.sin(Math.pow(hv, 0.82) * Math.PI);
      const baseRx = (f ? 0.076 : 0.082) * (0.35 + 0.65 * skullProfile);
      const baseRz = (f ? 0.09 : 0.096) * (0.38 + 0.62 * skullProfile);

      // Mentón/mandíbula (hv ≈ 0.18, theta ≈ 0), nariz (hv ≈ 0.45, theta ≈ 0), arco ciliar (hv ≈ 0.62)
      const chin = gauss(theta, hv, 0, 0.16, 0.38, 0.12) * (f ? 0.014 : 0.018);
      const jawSides = symGauss(theta, hv, 0.85, 0.24, 0.4, 0.14) * (f ? 0.005 : 0.011);
      const nose = gauss(theta, hv, 0, 0.44, 0.16, 0.11) * 0.015;
      const brow = gauss(theta, hv, 0, 0.62, 0.48, 0.08) * (f ? 0.006 : 0.01);
      const eyeSockets = symGauss(theta, hv, 0.32, 0.54, 0.18, 0.07) * 0.006;
      const occiput = gauss(theta, hv, Math.PI, 0.58, 0.65, 0.22) * 0.012;
      const ears = symGauss(theta, hv, 1.57, 0.46, 0.14, 0.11) * 0.009;

      return {
        rx: baseRx + jawSides + ears,
        rz: baseRz + chin + nose + brow - eyeSockets + occiput,
        zOffset: 0.012 + (hv < 0.5 ? (0.5 - hv) * 0.015 : 0),
        weights: {},
      };
    },
    skinMaterial,
    baseClayColor
  );
  segments.push(headSeg);
  root.add(headSeg.mesh);

  // ─────────────── 3. BRAZOS Y ANTEBRAZOS ESCULPIDOS CONTINUOS ───────────────
  function createSculptedArm(side: -1 | 1) {
    // side = -1 (derecho), +1 (izquierdo)
    const outTheta = side * (Math.PI / 2);

    const upperArm = buildSculptedLoft(
      BONE_LEN_3D.upperArm,
      -0.08,
      1.06,
      32,
      28,
      (theta, v) => {
        const taper = THREE.MathUtils.lerp(f ? 0.048 : 0.058, f ? 0.036 : 0.044, v);
        // Cabezas del deltoides en la parte alta (v ≈ 0.08..0.38)
        const wDeltLat = gauss(theta, v, outTheta, 0.18, 0.65, 0.16);
        const wDeltAnt = gauss(theta, v, 0.35 * side, 0.2, 0.55, 0.15);
        const wDeltPost = gauss(theta, v, (Math.PI - 0.35) * side, 0.2, 0.55, 0.15);
        // Vientre del bíceps al frente (theta = 0, v ≈ 0.56)
        const wBicep = gauss(theta, v, 0, 0.56, 0.62, 0.2);
        // Herradura del tríceps detrás (theta = PI, v ≈ 0.52)
        const wTricep = gauss(theta, v, Math.PI, 0.52, 0.68, 0.22);

        const s = f ? 0.75 : 1;
        const rx = taper + wDeltLat * 0.014 * s + (wBicep + wTricep) * 0.004 * s;
        const rz =
          taper +
          (wDeltAnt + wDeltPost) * 0.011 * s +
          wBicep * 0.011 * s +
          wTricep * 0.012 * s;

        return {
          rx,
          rz,
          weights: {
            deltoides_lateral: Math.min(1, wDeltLat * 1.25),
            deltoides_anterior: Math.min(1, wDeltAnt * 1.25),
            deltoides_posterior: Math.min(1, wDeltPost * 1.25),
            biceps: Math.min(1, wBicep * 1.25),
            triceps: Math.min(1, wTricep * 1.25),
          },
        };
      },
      skinMaterial,
      baseClayColor
    );

    // Antebrazo + mano integrada en una sola malla continua hasta los nudillos
    const forearm = buildSculptedLoft(
      BONE_LEN_3D.forearm,
      -0.06,
      1.18,
      28,
      28,
      (theta, v) => {
        if (v <= 0.86) {
          const fv = v / 0.86;
          const base = THREE.MathUtils.lerp(f ? 0.036 : 0.044, f ? 0.024 : 0.029, fv);
          const wFore =
            gauss(theta, fv, 0.25 * side, 0.28, 0.85, 0.2) +
            gauss(theta, fv, Math.PI, 0.3, 0.85, 0.22) * 0.8;
          const swell = wFore * (f ? 0.007 : 0.011);
          return {
            rx: base + swell * 0.9,
            rz: base * 1.06 + swell,
            weights: { antebrazos: Math.min(1, wFore * 1.1) },
          };
        }
        // Mano/puño esculpido en el extremo (v = 0.86..1.18)
        const hv = (v - 0.86) / 0.32;
        const handProfile = Math.sin(hv * Math.PI);
        return {
          rx: (f ? 0.026 : 0.031) * (0.75 + 0.45 * handProfile),
          rz: (f ? 0.022 : 0.026) * (0.75 + 0.35 * handProfile),
          weights: {},
        };
      },
      skinMaterial,
      baseClayColor
    );

    segments.push(upperArm, forearm);
    root.add(upperArm.mesh, forearm.mesh);
    return { upperArm, forearm };
  }

  // ─────────────── 4. MUSLOS, PANTORRILLAS Y PIES ESCULPIDOS CONTINUOS ───────────────
  function createSculptedLeg(side: -1 | 1) {
    const outTheta = side * (Math.PI / 2);
    const inTheta = -outTheta;

    const thigh = buildSculptedLoft(
      BONE_LEN_3D.thigh,
      -0.08,
      1.06,
      36,
      32,
      (theta, v) => {
        const base = THREE.MathUtils.lerp(f ? 0.084 : 0.082, f ? 0.048 : 0.052, Math.pow(v, 0.85));
        // Recto femoral + vasto lateral + vasto medial (lágrima sobre la rodilla)
        const wRectus = gauss(theta, v, 0, 0.46, 0.55, 0.24);
        const wVastusLat = gauss(theta, v, outTheta * 0.65, 0.48, 0.55, 0.25);
        const wVastusMed = gauss(theta, v, inTheta * 0.55, 0.72, 0.45, 0.14);
        const wQuad = Math.min(1, wRectus + wVastusLat * 0.85 + wVastusMed * 0.9);

        // Isquiotibiales detrás
        const wHam = gauss(theta, v, Math.PI, 0.5, 0.65, 0.25);
        // Aductores en cara interna superior
        const wAdd = gauss(theta, v, inTheta, 0.32, 0.55, 0.2);

        const rx =
          base +
          wVastusLat * (f ? 0.013 : 0.015) +
          wVastusMed * 0.009 +
          wAdd * (f ? 0.012 : 0.01);
        const rz =
          base * 1.06 +
          wRectus * (f ? 0.013 : 0.016) +
          wHam * (f ? 0.013 : 0.014);

        return {
          rx,
          rz,
          weights: {
            cuadriceps: Math.min(1, wQuad * 1.15),
            isquiotibiales: Math.min(1, wHam * 1.2),
            aductores: Math.min(1, wAdd * 1.25),
          },
        };
      },
      skinMaterial,
      baseClayColor
    );

    const shin = buildSculptedLoft(
      BONE_LEN_3D.shin,
      -0.06,
      1.05,
      32,
      30,
      (theta, v) => {
        // De rodilla (v=0) a tobillo fino (v=0.88) y maléolos (v=1)
        const base =
          v < 0.85
            ? THREE.MathUtils.lerp(f ? 0.047 : 0.051, f ? 0.028 : 0.031, v / 0.85)
            : THREE.MathUtils.lerp(f ? 0.028 : 0.031, f ? 0.032 : 0.035, (v - 0.85) / 0.15);

        // Cabezas medial y lateral del gastrocnemio (v ≈ 0.32, detrás)
        const wCalfMed = gauss(theta, v, Math.PI - 0.38 * side, 0.32, 0.48, 0.17);
        const wCalfLat = gauss(theta, v, Math.PI + 0.38 * side, 0.34, 0.48, 0.17);
        const wSoleus = gauss(theta, v, Math.PI, 0.56, 0.5, 0.16) * 0.55;
        const wCalf = Math.min(1, wCalfMed + wCalfLat + wSoleus);

        // Tibia anterior definida
        const shinBone = gauss(theta, v, 0, 0.45, 0.35, 0.3) * 0.004;

        return {
          rx: base + (wCalfMed + wCalfLat) * (f ? 0.009 : 0.011),
          rz: base * 1.05 + wCalf * (f ? 0.014 : 0.017) + shinBone,
          zOffset: -wCalf * 0.005,
          weights: { pantorrillas: Math.min(1, wCalf * 1.2) },
        };
      },
      skinMaterial,
      baseClayColor
    );

    // Pie anatómico esculpido (talón -> arco -> empeine -> dedos)
    const foot = buildSculptedLoft(
      0.16,
      -0.18,
      1.0,
      24,
      20,
      (theta, v) => {
        const arch = Math.sin(v * Math.PI);
        const rx = (f ? 0.036 : 0.04) * (0.72 + 0.35 * arch) * (v > 0.8 ? 1 - (v - 0.8) * 1.5 : 1);
        const rz = (f ? 0.026 : 0.029) * (1 - v * 0.42);
        return { rx: Math.max(0.01, rx), rz: Math.max(0.008, rz), weights: {} };
      },
      skinMaterial,
      baseClayColor
    );

    segments.push(thigh, shin, foot);
    root.add(thigh.mesh, shin.mesh, foot.mesh);
    return { thigh, shin, foot };
  }

  const armR = createSculptedArm(-1);
  const armL = createSculptedArm(1);
  const legR = createSculptedLeg(-1);
  const legL = createSculptedLeg(1);

  let activePrimary = new Set<MuscleId>();
  let activeSecondary = new Set<MuscleId>();
  let lastPulseBucket = -1;

  const applyColors = (pulse: number) => {
    for (const seg of segments) {
      seg.recolor(activePrimary, activeSecondary, pulse);
    }
  };

  const setActiveMuscles = (primary: MuscleId[], secondary: MuscleId[]) => {
    activePrimary = new Set(primary);
    activeSecondary = new Set(secondary.filter((m) => !activePrimary.has(m)));
    lastPulseBucket = -1;
    applyColors(0);
  };

  const update = (pose: Pose3D, concentricPulse: number) => {
    // Actualizar colores por vértice con pulso cuantizado suave (evita trabajo redundante si no cambia)
    const bucket = Math.round(concentricPulse * 12);
    if (bucket !== lastPulseBucket) {
      lastPulseBucket = bucket;
      applyColors(concentricPulse);
    }

    // 1. Torso orientado con su base ortonormal real (funciona de pie, tumbado boca arriba o boca abajo)
    placeOrientedSegment(
      torsoSeg.mesh,
      pose.pelvis,
      pose.neckBase,
      BONE_LEN_3D.torso,
      pose.torsoForward
    );

    // 2. Cuello + Cabeza desde `neckBase` en dirección a `head` mirando hacia `torsoForward`
    const headDir = pose.head.clone().sub(pose.neckBase).normalize();
    const headEnd = pose.neckBase.clone().addScaledVector(headDir, headNeckLen);
    placeOrientedSegment(headSeg.mesh, pose.neckBase, headEnd, headNeckLen, pose.torsoForward);

    // 3. Brazos: el frente del brazo (bíceps) mira hacia la dirección de flexión del codo
    const placeArm = (
      arm: ReturnType<typeof createSculptedArm>,
      sh: THREE.Vector3,
      el: THREE.Vector3,
      wr: THREE.Vector3
    ) => {
      const uDir = el.clone().sub(sh).normalize();
      const fDir = wr.clone().sub(el).normalize();
      // Vector hacia donde flexiona el antebrazo (cara del bíceps)
      const bendFront = fDir.clone().addScaledVector(uDir, -fDir.dot(uDir));
      const armFront =
        bendFront.lengthSq() > 0.02 ? bendFront.normalize() : pose.torsoForward;

      placeOrientedSegment(arm.upperArm.mesh, sh, el, BONE_LEN_3D.upperArm, armFront);
      placeOrientedSegment(arm.forearm.mesh, el, wr, BONE_LEN_3D.forearm, armFront);
    };

    placeArm(armR, pose.shoulderR, pose.elbowR, pose.wristR);
    placeArm(armL, pose.shoulderL, pose.elbowL, pose.wristL);

    // 4. Piernas: el frente del muslo/pierna (cuádriceps/rótula/tibia) mira hacia la dirección de la rodilla
    const placeLeg = (
      leg: ReturnType<typeof createSculptedLeg>,
      hp: THREE.Vector3,
      kn: THREE.Vector3,
      an: THREE.Vector3,
      to: THREE.Vector3
    ) => {
      const tDir = kn.clone().sub(hp).normalize();
      const sDir = an.clone().sub(kn).normalize();
      // La rodilla siempre flexiona hacia atrás, así que `tDir - sDir` apunta hacia la rótula (frente)
      const kneeBendFront = tDir.clone().sub(sDir);
      const footDir = to.clone().sub(an).normalize();
      const legFront =
        kneeBendFront.lengthSq() > 0.03 ? kneeBendFront.normalize() : footDir;

      placeOrientedSegment(leg.thigh.mesh, hp, kn, BONE_LEN_3D.thigh, legFront);
      placeOrientedSegment(leg.shin.mesh, kn, an, BONE_LEN_3D.shin, legFront);
      placeOrientedSegment(leg.foot.mesh, an, to, 0.16, sDir.clone().negate());
    };

    placeLeg(legR, pose.hipR, pose.kneeR, pose.ankleR, pose.toeR);
    placeLeg(legL, pose.hipL, pose.kneeL, pose.ankleL, pose.toeL);
  };

  const dispose = () => {
    segments.forEach((s) => s.geometry.dispose());
    skinMaterial.dispose();
  };

  return { root, update, setActiveMuscles, dispose };
}
