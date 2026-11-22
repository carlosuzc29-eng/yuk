'use client';

/**
 * Visor de personaje GLB (malla + materiales + esqueleto + clips horneados).
 *
 * - Carga un GLB real con GLTFLoader (+ MeshoptDecoder para archivos optimizados con gltfpack/gltf-transform).
 * - Escena de comparación: fondo casi negro, luz principal grande arriba-lateral, relleno suave
 *   y contraluz sutil. Cámaras con FOV estrecho (poca distorsión de perspectiva).
 * - Animación con AnimationMixer: reproducir/pausar, reiniciar, velocidad y selector de clip.
 * - Se pausa fuera de pantalla o con la pestaña oculta; respeta prefers-reduced-motion
 *   (no arranca solo) y limita la resolución de render en móviles.
 * - Renderiza bajo demanda: si no hay animación ni cámara en movimiento, no gasta GPU.
 * - Morph targets peso/músculo controlados con dos deslizadores (-1..+1).
 * - Animaciones de Mixamo (pose T) adaptadas a la pose A del modelo con SkeletonUtils.retargetClip
 *   (ver src/lib/model3d/retarget.ts). Se cargan desde public/models/animaciones/index.json
 *   o desde un archivo local (.fbx / .glb). El FBXLoader sólo se descarga si hace falta.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Gauge, Pause, Play, RotateCcw, Scan, SkipBack, Upload } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { captureRestPose, findSkinnedMesh, morphWeights, restPose, retargetMixamoClips } from '@/lib/model3d/retarget';
import type { CharacterLook } from './looks';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** Animaciones publicadas junto a los modelos: { "animaciones": [{ "nombre": "...", "archivo": "x.fbx" }] } */
const ANIMATIONS_MANIFEST = `${basePath}/models/animaciones/index.json`;

export interface MorphValues {
  /** -1 = peso_menos, +1 = peso_mas */
  peso: number;
  /** -1 = musculo_menos, +1 = musculo_mas */
  musculo: number;
}

function applyMorphs(root: THREE.Object3D, values: MorphValues) {
  const w = morphWeights(values.peso, values.musculo);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
    for (const [name, value] of Object.entries(w)) {
      const i = mesh.morphTargetDictionary[name];
      if (i !== undefined) mesh.morphTargetInfluences[i] = value;
    }
  });
}

/** Carga un archivo de animación (FBX de Mixamo o GLB) y devuelve su escena y clips. */
async function loadAnimationFile(
  input: { url: string } | { file: File }
): Promise<{ root: THREE.Object3D; clips: THREE.AnimationClip[] }> {
  const name = 'file' in input ? input.file.name : input.url;
  const isFbx = /\.fbx($|\?)/i.test(name);
  const buffer = 'file' in input ? await input.file.arrayBuffer() : await (await fetch(input.url)).arrayBuffer();
  if (isFbx) {
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
    const root = new FBXLoader().parse(buffer, '');
    return { root, clips: root.animations };
  }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(buffer, '');
  return { root: gltf.scene, clips: gltf.animations };
}

const SPEEDS = [0.25, 0.5, 1] as const;

/** FOV vertical estrecho: perspectiva casi ortográfica para comparar proporciones. */
const FOV = 18;

/** Material de comparación (no metálico). Color y rugosidad los ajusta la página. */
export interface ComparisonMaterialOptions {
  color: string;
  roughness: number;
}

type Status =
  | { kind: 'loading'; progress: number | null }
  | { kind: 'ready' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

interface CharacterViewerProps {
  /** Personaje: archivo, escena, vistas y material (ver looks.ts). */
  look: CharacterLook;
  /** Clip inicial (por nombre). Si no existe se usa el primero. */
  initialClip?: string;
  /** Sustituye los materiales del GLB por el material de comparación. */
  comparisonMaterial?: ComparisonMaterialOptions | null;
  /** Morph targets peso/músculo (-1..+1). */
  morphs?: MorphValues;
  className?: string;
}

interface Framing {
  center: THREE.Vector3;
  size: THREE.Vector3;
  head: THREE.Object3D | null;
}

function findHead(root: THREE.Object3D): THREE.Object3D | null {
  let head: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (head) return;
    if ((o as THREE.Bone).isBone && /(^|[^a-z])head($|[^a-z])|head$/i.test(o.name) && !/end|top|nub/i.test(o.name)) head = o;
  });
  return head;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (!m) return;
      Object.values(m).forEach((v) => {
        if (v && typeof v === 'object' && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      });
      m.dispose();
    });
  });
}

const NEUTRAL: MorphValues = { peso: 0, musculo: 0 };

export function CharacterViewer({
  look,
  initialClip,
  comparisonMaterial = null,
  morphs = NEUTRAL,
  className,
}: CharacterViewerProps) {
  const src = `${basePath}${look.file}`;
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading', progress: null });
  const [clips, setClips] = useState<string[]>([]);
  const [clip, setClip] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [view, setView] = useState<string>(look.initialView);
  useEffect(() => setView(look.initialView), [look]);
  const [perf, setPerf] = useState<{ fps: number; ms: number; pr: number; tris: number } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [animMsg, setAnimMsg] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const morphsRef = useRef(morphs);
  morphsRef.current = morphs;

  // Estado mutable de la escena (no provoca renders de React).
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    scene: THREE.Scene;
    mixer: THREE.AnimationMixer | null;
    actions: Map<string, THREE.AnimationAction>;
    model: THREE.Object3D | null;
    skinned: THREE.SkinnedMesh | null;
    originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
    framing: Framing | null;
    invalidate: () => void;
    setActive: (v: boolean) => void;
    triangles: number;
  } | null>(null);
  const playingRef = useRef(false);
  const measuringRef = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  /**
   * Importa un archivo de animación y lo adapta al esqueleto del modelo (pose T de Mixamo → pose A).
   * Ref para poder llamarlo desde el efecto de montaje sin re-crearlo.
   */
  const importRef = useRef(async (_input: { url: string } | { file: File }, _name?: string, _select?: boolean) => {});
  importRef.current = async (input, name, select = true) => {
    const s = sceneRef.current;
    if (!s?.skinned || !s.mixer) {
      setAnimMsg({ kind: 'error', text: 'El modelo no tiene esqueleto con skin: no se pueden aplicar animaciones.' });
      return;
    }
    setImporting(true);
    try {
      const { root, clips: srcClips } = await loadAnimationFile(input);
      if (!srcClips.length) throw new Error('El archivo no contiene animaciones.');
      const { clips: adapted, unmatched } = retargetMixamoClips(s.skinned, root, srcClips);
      if (sceneRef.current !== s) return; // el visor cambió de modelo mientras cargaba
      const base = name || ('file' in input ? input.file.name : input.url.split('/').pop() || 'animación').replace(/\.(fbx|glb)$/i, '');
      const added: string[] = [];
      adapted.forEach((c, i) => {
        let n = adapted.length > 1 ? `${base} · ${c.name || i + 1}` : base;
        while (s.actions.has(n)) n += ' (2)';
        c.name = n;
        s.actions.set(n, s.mixer!.clipAction(c));
        added.push(n);
      });
      setClips((prev) => [...prev, ...added]);
      if (select || added[0] === initialClip) setClip(added[0]);
      const missing = unmatched.filter((b) => !/end$/i.test(b));
      setAnimMsg({
        kind: 'info',
        text:
          `Adaptada a la pose A: ${added.join(', ')}.` +
          (missing.length ? ` ${missing.length} huesos sin equivalente quedan en reposo.` : ''),
      });
    } catch (e) {
      setAnimMsg({ kind: 'error', text: `No se pudo importar la animación: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setImporting(false);
    }
  };

  /** Coloca la cámara para una vista; poca distorsión gracias al FOV estrecho y mayor distancia. */
  const applyView = useCallback((viewId: string) => {
    const s = sceneRef.current;
    if (!s?.framing) return;
    const kind = look.views.find((v) => v.id === viewId)?.kind ?? 'full';
    const { center, size, head } = s.framing;
    const fovRad = THREE.MathUtils.degToRad(FOV);
    let target = center.clone();
    let height = size.y * 1.12;
    const top = center.y + size.y / 2;
    if (kind === 'torso') {
      // Busto como la referencia: de la coronilla al ombligo (~45 % de la altura).
      target = new THREE.Vector3(center.x, top - size.y * 0.215, center.z);
      height = size.y * 0.47;
    } else if (kind === 'face') {
      const hp = new THREE.Vector3();
      if (head) {
        head.updateWorldMatrix(true, false);
        head.getWorldPosition(hp);
        hp.y += size.y * 0.045; // el hueso de la cabeza suele estar en la base del cráneo
      } else {
        hp.set(center.x, center.y + size.y * 0.43, center.z);
      }
      // El centro del rostro queda ~6,5 % de la altura bajo la coronilla: limitamos por si el
      // hueso de la cabeza de un rig está colocado más arriba de lo habitual.
      hp.y = Math.min(hp.y, top - size.y * 0.065);
      target = hp;
      height = size.y * 0.2;
    }
    const aspect = s.camera.aspect || 1;
    const fitH = height / 2 / Math.tan(fovRad / 2);
    // En el busto, el ancho relevante son los hombros (~26 % de la altura), no los brazos en A.
    const width = kind === 'torso' ? size.y * 0.3 : Math.max(size.x, size.z) * 1.25;
    const fitW = width / 2 / Math.tan(fovRad / 2) / aspect;
    const dist = Math.max(fitH, kind === 'face' ? 0 : fitW);
    const dir =
      kind === 'side' ? new THREE.Vector3(1, 0, 0) : kind === 'back' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
    s.camera.position.copy(target).addScaledVector(dir, dist);
    s.camera.near = Math.max(0.01, dist / 50);
    s.camera.far = dist * 20;
    s.camera.updateProjectionMatrix();
    s.controls.target.copy(target);
    s.controls.minDistance = size.y * 0.12;
    s.controls.maxDistance = dist * 3;
    s.controls.update();
    s.invalidate();
  }, [look]);

  // ---------- Montaje de la escena (una vez por src) ----------
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    setStatus({ kind: 'loading', progress: null });
    setClips([]);
    setClip(null);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setStatus({ kind: 'error', message: 'Tu navegador no pudo iniciar WebGL.' });
      return;
    }
    const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping; // conserva volumen en blancos sin quemarlos
    renderer.toneMappingExposure = look.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(look.background);

    // Reflejos amplios y suaves: entorno de estudio a baja intensidad.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = look.envIntensity;

    // Luces del personaje (principal, relleno y separación). Se orientan hacia el modelo al cargarlo.
    const lights = look.lights.map((l) => {
      const light = new THREE.DirectionalLight(l.color, l.intensity);
      light.position.set(...l.dir);
      if (l.shadow) {
        light.castShadow = true;
        light.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
        light.shadow.radius = 6;
        light.shadow.bias = -0.0004;
        light.shadow.normalBias = 0.02;
      }
      scene.add(light, light.target);
      return { light, def: l };
    });
    const h = look.hemisphere;
    scene.add(new THREE.HemisphereLight(h.sky, h.ground, h.intensity));

    // Suelo que sólo recibe sombra (no compite con la figura).
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: look.groundShadow }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.62;

    let needsRender = true;
    const invalidate = () => {
      needsRender = true;
      if (!rafId && active) rafId = requestAnimationFrame(tick);
    };
    controls.addEventListener('change', invalidate);

    const timer = new THREE.Timer();
    let rafId = 0;
    let active = true; // visible en pantalla y pestaña activa
    let frames = 0;
    let frameMsAcc = 0;
    let perfStart = 0;

    const state = {
      renderer,
      camera,
      controls,
      scene,
      mixer: null as THREE.AnimationMixer | null,
      actions: new Map<string, THREE.AnimationAction>(),
      model: null as THREE.Object3D | null,
      skinned: null as THREE.SkinnedMesh | null,
      originalMaterials: new Map<THREE.Mesh, THREE.Material | THREE.Material[]>(),
      framing: null as Framing | null,
      invalidate,
      setActive: (v: boolean) => {
        active = v;
        if (v) {
          timer.reset();
          invalidate();
        } else if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      },
      triangles: 0,
    };
    sceneRef.current = state;

    function tick(now: number) {
      rafId = 0;
      if (!active) return;
      timer.update(now);
      const dt = Math.min(timer.getDelta(), 1 / 20);
      const animating = playingRef.current && !!state.mixer;
      if (animating) state.mixer!.update(dt);
      const moving = controls.update();
      if (animating || moving || needsRender || measuringRef.current) {
        const t0 = performance.now();
        renderer.render(scene, camera);
        needsRender = false;
        if (measuringRef.current) {
          frames += 1;
          frameMsAcc += performance.now() - t0;
          if (!perfStart) perfStart = now;
          if (now - perfStart >= 2000) {
            setPerf({
              fps: Math.round((frames * 1000) / (now - perfStart)),
              ms: +(frameMsAcc / frames).toFixed(2),
              pr: pixelRatio,
              tris: state.triangles,
            });
            frames = 0;
            frameMsAcc = 0;
            perfStart = now;
          }
        }
      }
      if (animating || moving || measuringRef.current) rafId = requestAnimationFrame(tick);
    }

    // Tamaño adaptable.
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (state.framing) applyView(viewRef.current);
      invalidate();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Pausa fuera de pantalla y con la pestaña oculta.
    let onScreen = true;
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      state.setActive(onScreen && !document.hidden);
    });
    io.observe(host);
    const onVis = () => state.setActive(onScreen && !document.hidden);
    document.addEventListener('visibilitychange', onVis);

    // Animaciones publicadas (opcional). Se adaptan a este modelo al terminar de cargarlo.
    const loadManifest = async () => {
      try {
        const res = await fetch(ANIMATIONS_MANIFEST, { cache: 'no-cache' });
        if (!res.ok) return;
        const data = (await res.json()) as { animaciones?: { nombre?: string; archivo: string }[] };
        for (const a of data.animaciones ?? []) {
          if (disposed) return;
          const base = ANIMATIONS_MANIFEST.slice(0, ANIMATIONS_MANIFEST.lastIndexOf('/') + 1);
          await importRef.current({ url: base + a.archivo }, a.nombre, false);
        }
      } catch {
        /* sin manifiesto o JSON inválido: el visor sigue funcionando sin animaciones extra */
      }
    };

    // Carga del GLB. Primero comprobamos si existe para distinguir "falta el archivo" de "archivo roto".
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    (async () => {
      try {
        const head = await fetch(src, { method: 'HEAD' });
        if (disposed) return;
        if (head.status === 404) {
          setStatus({ kind: 'missing' });
          return;
        }
      } catch {
        /* algunos servidores no aceptan HEAD: seguimos con la carga normal */
      }
      loader.load(
        src,
        (gltf: GLTF) => {
          if (disposed) {
            disposeObject(gltf.scene);
            return;
          }
          const model = gltf.scene;
          let tris = 0;
          let hasSkin = false;
          model.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
              hasSkin = true;
              // Las mallas con skin se deforman fuera de su caja original.
              mesh.frustumCulled = false;
            }
            state.originalMaterials.set(mesh, mesh.material);
            const idx = mesh.geometry.index;
            tris += (idx ? idx.count : mesh.geometry.attributes.position.count) / 3;
          });
          state.triangles = Math.round(tris);
          // Los morph targets se exportaron con peso 1: partimos del neutro (o de los deslizadores).
          applyMorphs(model, morphsRef.current);
          scene.add(model);
          state.model = model;
          state.skinned = findSkinnedMesh(model);
          if (state.skinned) captureRestPose(state.skinned); // pose A del GLB, antes de animar
          // Caja de la malla deformada (esqueleto + morphs), no la de la geometría original.
          model.traverse((o) => {
            if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).computeBoundingBox();
          });

          // Encuadre en la pose de reposo: pies en y = 0.
          const box = new THREE.Box3().setFromObject(model);
          model.position.y -= box.min.y;
          box.setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          state.framing = { center, size, head: findHead(model) };
          const r = Math.max(size.x, size.y, size.z);
          for (const { light, def } of lights) {
            light.target.position.copy(center);
            light.position.copy(center).addScaledVector(new THREE.Vector3(...def.dir).normalize(), r * 3);
            if (!def.shadow) continue;
            const sc = light.shadow.camera as THREE.OrthographicCamera;
            sc.left = -r;
            sc.right = r;
            sc.top = r;
            sc.bottom = -r;
            sc.near = 0.1;
            sc.far = r * 10;
            sc.updateProjectionMatrix();
          }

          // El mixer siempre existe: las animaciones importadas se añaden después.
          const mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((c) => state.actions.set(c.name, mixer.clipAction(c)));
          state.mixer = mixer;
          const names = gltf.animations.map((c) => c.name);
          setClips(names);
          setClip(names.find((n) => n === initialClip) ?? names[0] ?? null);
          if (!hasSkin && names.length) console.warn('[CharacterViewer] El GLB tiene clips pero ninguna malla con esqueleto.');
          if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
            (window as unknown as { __yukViewer?: unknown }).__yukViewer = { state, THREE };
          }

          resize();
          applyView(viewRef.current);
          setStatus({ kind: 'ready' });
          void loadManifest();
        },
        (ev) => {
          if (disposed) return;
          setStatus({ kind: 'loading', progress: ev.lengthComputable ? ev.loaded / ev.total : null });
        },
        (err) => {
          if (disposed) return;
          const msg = err instanceof Error ? err.message : String(err);
          setStatus({
            kind: 'error',
            message: `El archivo no es un GLB válido o está dañado. Vuelve a exportarlo desde Blender. ${msg ? `(${msg})` : ''}`.trim(),
          });
        }
      );
    })();

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      controls.dispose();
      state.mixer?.stopAllAction();
      if (state.model) disposeObject(state.model);
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
    // initialClip sólo se usa en la carga inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, look, applyView]);

  // ---------- Clip activo ----------
  useEffect(() => {
    const s = sceneRef.current;
    if (!s?.mixer) return;
    if (!clip) {
      // Pose A del rig: sin animación.
      s.mixer.stopAllAction();
      if (s.skinned) restPose(s.skinned);
      setPlaying(false);
      s.invalidate();
      return;
    }
    const next = s.actions.get(clip);
    if (!next) return;
    s.actions.forEach((a, name) => {
      if (name !== clip) a.fadeOut(0.25);
    });
    next.reset().fadeIn(0.25).play();
    // Con reduced motion se muestra el primer fotograma y no arranca sola.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      s.mixer.update(0);
      setPlaying(false);
    } else {
      setPlaying(true);
    }
    s.invalidate();
  }, [clip]);

  useEffect(() => {
    playingRef.current = playing;
    sceneRef.current?.invalidate();
  }, [playing]);

  useEffect(() => {
    const s = sceneRef.current;
    if (s?.mixer) s.mixer.timeScale = speed;
  }, [speed, status.kind]);

  // Morph targets peso/músculo.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s?.model) return;
    applyMorphs(s.model, morphs);
    s.invalidate();
  }, [morphs.peso, morphs.musculo, status.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status.kind === 'ready') applyView(view);
  }, [view, status.kind, applyView]);

  useEffect(() => {
    measuringRef.current = measuring;
    if (!measuring) setPerf(null);
    sceneRef.current?.invalidate();
  }, [measuring]);

  // ---------- Material de comparación ----------
  useEffect(() => {
    const s = sceneRef.current;
    if (!s?.model) return;
    let mat: THREE.MeshStandardMaterial | null = null;
    if (comparisonMaterial) {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(comparisonMaterial.color),
        roughness: comparisonMaterial.roughness,
        metalness: 0,
      });
    }
    s.originalMaterials.forEach((orig, mesh) => {
      if (!mat) {
        mesh.material = orig;
        return;
      }
      // Conservamos el mapa normal del GLB (detalle sin geometría).
      const origMat = (Array.isArray(orig) ? orig[0] : orig) as THREE.MeshStandardMaterial;
      if (origMat?.normalMap) {
        const m = mat.clone();
        m.normalMap = origMat.normalMap;
        m.normalScale = origMat.normalScale.clone().multiplyScalar(look.material.normalScale);
        mesh.material = m;
      } else {
        mesh.material = mat;
      }
    });
    s.invalidate();
    return () => {
      s.originalMaterials.forEach((orig, mesh) => {
        if (mesh.material !== orig) {
          (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
        }
      });
      mat?.dispose();
    };
  }, [comparisonMaterial?.color, comparisonMaterial?.roughness, status.kind, look]); // eslint-disable-line react-hooks/exhaustive-deps

  const restart = () => {
    const s = sceneRef.current;
    if (!s?.mixer || !clip) return;
    s.actions.get(clip)?.reset().play();
    s.mixer.update(0);
    s.invalidate();
  };

  const ready = status.kind === 'ready';
  const btn =
    'inline-flex items-center justify-center gap-1.5 h-10 min-w-10 px-3 rounded-[24px] text-xs font-medium border border-white/15 text-white/85 hover:bg-white/10 disabled:opacity-35 disabled:pointer-events-none cursor-pointer';

  return (
    <div
      className={cn('rounded-[8px] overflow-hidden text-white', className)}
      style={{ backgroundColor: `#${look.background.toString(16).padStart(6, '0')}` }}
    >
      <div className="relative aspect-[3/4] sm:aspect-[4/3] w-full">
        <div ref={hostRef} className="absolute inset-0" aria-label="Visor 3D del personaje" role="img" />

        {status.kind !== 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            {status.kind === 'loading' && (
              <div className="space-y-3 w-48" role="status">
                <p className="text-sm text-white/70">Cargando modelo…</p>
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn('h-full bg-[var(--accent)]', status.progress === null && 'w-1/3 animate-pulse')}
                    style={status.progress !== null ? { width: `${Math.round(status.progress * 100)}%` } : undefined}
                  />
                </div>
              </div>
            )}
            {status.kind === 'missing' && (
              <div className="max-w-sm space-y-2" role="alert">
                <p className="text-sm font-medium">Falta el archivo del personaje</p>
                <p className="text-xs text-white/60 leading-relaxed">
                  El visor está listo, pero no hay ningún GLB en <code className="text-white/80">{src}</code>. Exporta el
                  personaje desde Blender siguiendo <code className="text-white/80">{look.doc}</code> y colócalo en
                  esa ruta.
                </p>
              </div>
            )}
            {status.kind === 'error' && (
              <div className="max-w-sm space-y-2" role="alert">
                <p className="text-sm font-medium">No se pudo cargar el modelo</p>
                <p className="text-xs text-white/60 break-words">{status.message}</p>
              </div>
            )}
          </div>
        )}

        {perf && (
          <div className="absolute top-3 left-3 rounded-[6px] bg-black/60 px-2.5 py-1.5 text-[11px] tabular-nums text-white/80 leading-relaxed">
            {perf.fps} fps · {perf.ms} ms/frame (CPU)
            <br />
            {perf.tris.toLocaleString('es')} triángulos · resolución ×{perf.pr}
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="border-t border-white/10 p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} disabled={!ready || !clip} onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pausar' : 'Reproducir'}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" className={btn} disabled={!ready || !clip} onClick={restart} aria-label="Reiniciar animación">
            <SkipBack className="h-4 w-4" />
          </button>
          <div className="flex rounded-[24px] border border-white/15 overflow-hidden" role="group" aria-label="Velocidad">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!ready || !clip}
                onClick={() => setSpeed(s)}
                aria-pressed={speed === s}
                className={cn(
                  'h-10 px-3 text-xs font-medium tabular-nums cursor-pointer disabled:opacity-35',
                  speed === s ? 'bg-white text-black' : 'text-white/75 hover:bg-white/10'
                )}
              >
                {s}×
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <span className="sr-only sm:not-sr-only">Animación</span>
            <select
              value={clip ?? ''}
              disabled={!ready}
              onChange={(e) => setClip(e.target.value || null)}
              className="h-10 max-w-[12rem] rounded-[24px] bg-transparent border border-white/15 px-3 text-xs text-white/90 cursor-pointer disabled:opacity-35"
            >
              <option value="" className="text-black">
                Pose A (reposo)
              </option>
              {clips.map((c) => (
                <option key={c} value={c} className="text-black">
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={btn}
            disabled={!ready || importing}
            onClick={() => fileRef.current?.click()}
            title="Animación de Mixamo en pose T (.fbx o .glb); se adapta a la pose A del modelo"
          >
            <Upload className="h-4 w-4" /> {importing ? 'Adaptando…' : 'Importar Mixamo'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".fbx,.glb"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void importRef.current({ file });
            }}
          />
        </div>

        {animMsg && (
          <p role={animMsg.kind === 'error' ? 'alert' : 'status'} className={cn('text-xs', animMsg.kind === 'error' ? 'text-[#ff8a65]' : 'text-white/55')}>
            {animMsg.text}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[24px] border border-white/15 overflow-hidden" role="group" aria-label="Vista de cámara">
            {look.views.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!ready}
                onClick={() => setView(p.id)}
                aria-pressed={view === p.id}
                className={cn(
                  'h-10 px-3 text-xs font-medium cursor-pointer disabled:opacity-35',
                  view === p.id ? 'bg-white text-black' : 'text-white/75 hover:bg-white/10'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" className={btn} disabled={!ready} onClick={() => applyView(view)} aria-label="Volver a la vista inicial">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(btn, measuring && 'bg-white text-black hover:bg-white')}
            disabled={!ready}
            onClick={() => setMeasuring((m) => !m)}
            aria-pressed={measuring}
          >
            <Gauge className="h-4 w-4" /> Medir
          </button>
          <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 text-[11px] text-white/40">
            <Scan className="h-3.5 w-3.5" /> Arrastra para rotar · rueda o pellizco para acercar
          </span>
        </div>
      </div>
    </div>
  );
}
