'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Pause, Play, RotateCw } from 'lucide-react';
import type { Exercise } from '@/types/training';
import type { Sex } from '@/types/user';
import { PATTERNS, type PatternDef } from '@/lib/exercises/poses';
import { buildPose3D } from '@/lib/exercises/kinematics3d';
import { createMannequin3D } from '@/lib/exercises/mannequin3d';
import { createEquipment3D } from '@/lib/exercises/equipment3d';
import {
  createDrivenGLBCharacter,
  preloadGLBCharacter,
  type DrivenGLBCharacter,
} from '@/lib/model3d/driveExercisePose';
import { cn } from '@/lib/utils/cn';

type CameraPreset = '3/4' | 'lateral' | 'frontal' | 'espalda';

const PRESET_ANGLES: Record<CameraPreset, { yaw: number; pitch: number }> = {
  '3/4': { yaw: -0.78, pitch: 0.22 },
  lateral: { yaw: -Math.PI / 2, pitch: 0.1 },
  frontal: { yaw: 0.0, pitch: 0.14 },
  espalda: { yaw: Math.PI, pitch: 0.16 },
};

/**
 * Ángulo "3/4" por ejercicio cuando el de frente queda tapado por la máquina.
 * Prensa: desde atrás y por encima del hombro, para ver piernas y plataforma.
 */
const PATTERN_34: Partial<Record<Exercise['pattern'], { yaw: number; pitch: number }>> = {
  leg_press: { yaw: -2.25, pitch: 0.42 },
};

/** FOV vertical moderado: poca distorsión sin alejar demasiado la cámara. */
const FOV = 30;

/**
 * Curva de mínimo tirón (smootherstep): velocidad y aceleración nulas en los extremos,
 * como un movimiento humano controlado. Evita los "arranques" bruscos de una interpolación coseno.
 */
const ease = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

interface Timing {
  holdA: number;
  toB: number;
  holdB: number;
  toA: number;
}

function timingFor(def: PatternDef): Timing {
  if (def.steady) return { holdA: 0.2, toB: 1.3, holdB: 0.2, toA: 1.3 };
  // Tempo de técnica: excéntrica controlada (~2 s), concéntrica decidida (~1,2 s) y pausas breves.
  const ecc = 2.0;
  const con = 1.2;
  return {
    holdA: 0.45,
    toB: def.bIsEccentric ? ecc : con,
    holdB: 0.4,
    toA: def.bIsEccentric ? con : ecc,
  };
}

type Phase = 'holdA' | 'toB' | 'holdB' | 'toA';

function phaseAt(time: number, tm: Timing): { t: number; phase: Phase } {
  const total = tm.holdA + tm.toB + tm.holdB + tm.toA;
  let x = time % total;
  if (x < tm.holdA) return { t: 0, phase: 'holdA' };
  x -= tm.holdA;
  if (x < tm.toB) return { t: ease(x / tm.toB), phase: 'toB' };
  x -= tm.toB;
  if (x < tm.holdB) return { t: 1, phase: 'holdB' };
  x -= tm.holdB;
  return { t: 1 - ease(x / tm.toA), phase: 'toA' };
}

interface Exercise3DViewerProps {
  exercise: Exercise;
  sex: Sex;
  animate?: boolean;
  showControls?: boolean;
  className?: string;
  onWebGLFailed?: () => void;
}

export function Exercise3DViewer({
  exercise,
  sex,
  animate = true,
  showControls = true,
  className,
  onWebGLFailed,
}: Exercise3DViewerProps) {
  const def = PATTERNS[exercise.pattern];
  const timing = useMemo(() => timingFor(def), [def]);
  const total = timing.holdA + timing.toB + timing.holdB + timing.toA;
  const initialPreset: CameraPreset = def.view === 'front' ? 'frontal' : '3/4';

  const containerRef = useRef<HTMLDivElement>(null);
  const failRef = useRef(onWebGLFailed);
  failRef.current = onWebGLFailed;
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(animate);
  const [speed, setSpeed] = useState(1);
  const [preset, setPreset] = useState<CameraPreset>(initialPreset);
  const [phase, setPhase] = useState<Phase>('holdA');
  const [ready, setReady] = useState(false);

  // Refs mutables para el bucle de animación sin re-crear el WebGLRenderer
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const clockRef = useRef(0);
  const wakeRef = useRef<() => void>(() => {});
  const initialAngles = (initialPreset === '3/4' && PATTERN_34[exercise.pattern]) || PRESET_ANGLES[initialPreset];
  const camRef = useRef({
    yaw: initialAngles.yaw,
    pitch: initialAngles.pitch,
    targetYaw: initialAngles.yaw,
    targetPitch: initialAngles.pitch,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    playingRef.current = playing;
    wakeRef.current();
  }, [playing]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (m.matches) setPlaying(false);
  }, []);

  const anglesFor = (p: CameraPreset) => (p === '3/4' && PATTERN_34[exercise.pattern]) || PRESET_ANGLES[p];

  const selectPreset = (p: CameraPreset) => {
    setPreset(p);
    camRef.current.targetYaw = anglesFor(p).yaw;
    camRef.current.targetPitch = anglesFor(p).pitch;
    wakeRef.current();
  };

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      failRef.current?.();
      return;
    }

    const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0); // el fondo de estudio lo pinta el CSS (claro/oscuro)
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    // Estudio fotográfico claro: fondo infinito (CSS), luz principal grande arriba-delante,
    // relleno suave y contraluz discreto. El suelo sólo recibe la sombra de contacto.
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 40);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9dad9, 1.05));

    const keyLight = new THREE.DirectionalLight(0xfff7ee, 2.1);
    keyLight.position.set(1.6, 4.2, 2.6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
    keyLight.shadow.radius = 5;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight, keyLight.target);

    const fillLight = new THREE.DirectionalLight(0xeef2ff, 0.55);
    fillLight.position.set(-2.6, 1.6, 1.8);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.7);
    rimLight.position.set(-0.8, 2.6, -2.8);
    scene.add(rimLight);

    const floorGeo = new THREE.PlaneGeometry(14, 14);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.2 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Maniquí 3D: arranca al instante con la malla paramétrica y en cuanto carga
    // el modelo Blender real (`/models/hombre.glb` o `/models/mujer.glb`) lo sustituye.
    const mannequin = createMannequin3D(sex);
    mannequin.setActiveMuscles(exercise.primary, exercise.secondary);
    scene.add(mannequin.root);

    let glbCharacter: DrivenGLBCharacter | null = null;
    let disposed = false;

    const equipment = createEquipment3D(exercise, def);
    scene.add(equipment.root);

    // Encuadre: caja que contiene cuerpo + máquina a lo largo de TODO el recorrido.
    const bounds = new THREE.Box3();
    const tmp = new THREE.Box3();
    for (const st of [0, 0.25, 0.5, 0.75, 1]) {
      const { pose } = buildPose3D(exercise, st, sex);
      equipment.update(pose);
      equipment.root.updateMatrixWorld(true);
      tmp.setFromObject(equipment.root);
      if (!tmp.isEmpty()) bounds.union(tmp);
      for (const p of [pose.pelvis, pose.chest, pose.wristL, pose.wristR, pose.ankleL, pose.ankleR, pose.toeL, pose.toeR, pose.kneeL, pose.kneeR, pose.elbowL, pose.elbowR]) {
        bounds.expandByPoint(tmp.min.copy(p).subScalar(0.08));
        bounds.expandByPoint(tmp.max.copy(p).addScalar(0.08));
      }
      // Cabeza (radio ~12 cm)
      bounds.expandByPoint(tmp.min.copy(pose.head).subScalar(0.13));
      bounds.expandByPoint(tmp.max.copy(pose.head).addScalar(0.13));
    }
    bounds.min.y = Math.min(bounds.min.y, 0);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());

    // Sombra ajustada a la escena
    const reach = Math.max(size.x, size.y, size.z) * 0.75 + 0.3;
    const sc = keyLight.shadow.camera as THREE.OrthographicCamera;
    sc.left = -reach;
    sc.right = reach;
    sc.top = reach;
    sc.bottom = -reach;
    sc.near = 0.1;
    sc.far = 14;
    sc.updateProjectionMatrix();
    keyLight.target.position.copy(center);
    keyLight.position.copy(center).add(new THREE.Vector3(1.6, 4.2, 2.6));

    let radius = 3;
    const fitCamera = () => {
      // Distancia para que quepa la escena desde cualquier ángulo de giro (horizontal = diagonal XZ).
      const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const halfH = (size.y / 2) * 1.1;
      const halfW = (Math.hypot(size.x, size.z) / 2) * 0.92;
      const depth = Math.hypot(size.x, size.z) / 2;
      radius = Math.max(halfH / tanV, halfW / (tanV * camera.aspect)) + depth * 0.35;
      radius = THREE.MathUtils.clamp(radius, 1.8, 9);
    };

    const resize = () => {
      const w = host.clientWidth || 320;
      const h = host.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      fitCamera();
      wake();
    };

    // ---------- Bucle: sólo dibuja cuando hay movimiento ----------
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let needsRender = true;
    let lastPhase: Phase | null = null;

    const wake = () => {
      needsRender = true;
      if (!raf && visible && !disposed) {
        last = performance.now();
        raf = requestAnimationFrame(renderLoop);
      }
    };
    wakeRef.current = wake;

    const drawPose = (t: number, pulse: number) => {
      const { pose } = buildPose3D(exercise, t, sex);
      if (glbCharacter) glbCharacter.applyPose(pose);
      else mannequin.update(pose, pulse);
      equipment.update(pose);
    };

    function renderLoop(now: number) {
      raf = 0;
      if (!visible || disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const animating = animate && playingRef.current;
      if (animating) clockRef.current += dt * speedRef.current;

      const { t, phase: ph } = phaseAt(clockRef.current, timing);
      if (animating || needsRender) {
        const isEcc = (ph === 'toB' && def.bIsEccentric) || (ph === 'toA' && !def.bIsEccentric);
        const isCon = !def.steady && !isEcc && (ph === 'toA' || ph === 'toB');
        drawPose(animate ? t : 0.75, isCon ? Math.sin(t * Math.PI) : 0);
      }

      // Suavizado exponencial de la órbita, independiente de los fps
      const c = camRef.current;
      const k = 1 - Math.exp(-dt * 10);
      c.yaw += (c.targetYaw - c.yaw) * k;
      c.pitch += (c.targetPitch - c.pitch) * k;
      const orbiting = Math.abs(c.targetYaw - c.yaw) > 1e-4 || Math.abs(c.targetPitch - c.pitch) > 1e-4;

      camera.position.set(
        center.x + radius * Math.cos(c.pitch) * Math.sin(c.yaw),
        center.y + radius * Math.sin(c.pitch),
        center.z + radius * Math.cos(c.pitch) * Math.cos(c.yaw)
      );
      camera.lookAt(center);
      renderer.render(scene, camera);
      needsRender = false;

      // Progreso por DOM directo (sin re-render de React); la fase sólo cuando cambia.
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${(clockRef.current % total) / total})`;
      if (ph !== lastPhase) {
        lastPhase = ph;
        setPhase(ph);
      }

      if (animating || orbiting || c.dragging) raf = requestAnimationFrame(renderLoop);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) wake();
          })
        : null;
    io?.observe(host);

    // Pose inicial inmediata
    drawPose(animate ? 0 : 0.75, 0);
    wake();
    setReady(true);

    preloadGLBCharacter(sex)
      .then((template) => {
        if (disposed) return;
        glbCharacter = createDrivenGLBCharacter(template, sex);
        scene.add(glbCharacter.root);
        mannequin.root.visible = false;
        wake();
      })
      .catch(() => {
        // Si no se puede cargar el GLB, se mantiene la escultura paramétrica 3D.
      });

    return () => {
      disposed = true;
      wakeRef.current = () => {};
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
      glbCharacter?.dispose();
      mannequin.dispose();
      equipment.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [exercise, sex, def, timing, total, animate]);

  const onPointerDown = (e: React.PointerEvent) => {
    camRef.current.dragging = true;
    camRef.current.lastX = e.clientX;
    camRef.current.lastY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    wakeRef.current();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!camRef.current.dragging) return;
    const dx = e.clientX - camRef.current.lastX;
    const dy = e.clientY - camRef.current.lastY;
    camRef.current.lastX = e.clientX;
    camRef.current.lastY = e.clientY;
    camRef.current.targetYaw -= dx * 0.011;
    camRef.current.targetPitch = Math.max(-0.05, Math.min(0.85, camRef.current.targetPitch + dy * 0.008));
    wakeRef.current();
  };

  const onPointerUp = () => {
    camRef.current.dragging = false;
    wakeRef.current();
  };

  const phaseLabel = phase === 'toB' || phase === 'holdA' ? def.toB : def.toA;
  const isEccentricPhase = (phase === 'toB' && def.bIsEccentric) || (phase === 'toA' && !def.bIsEccentric);

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className="relative rounded-[8px] overflow-hidden aspect-[4/3] w-full touch-none select-none border border-[var(--border)]"
        style={{ background: 'var(--stage-bg)' }}
      >
        <div
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn('h-full w-full cursor-grab active:cursor-grabbing transition-opacity duration-300', ready ? 'opacity-100' : 'opacity-0')}
          role="img"
          aria-label={`Modelo 3D animado de ${exercise.name}. Arrastra para rotar 360 grados.`}
        />

        <div className="pointer-events-none absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-[var(--surface)]/80 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] border border-[var(--border)]">
          <RotateCw className="h-3 w-3 text-[var(--accent)]" /> 3D · Arrastra para girar
        </div>
      </div>

      {showControls && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5" role="group" aria-label="Ángulo de cámara">
            {(['3/4', 'lateral', 'frontal', 'espalda'] as CameraPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => selectPreset(p)}
                aria-pressed={preset === p}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[11px] font-medium capitalize transition-colors cursor-pointer',
                  preset === p ? 'bg-[var(--text)] text-[var(--bg)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controles de reproducción y fase */}
      {showControls && animate && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pausar demostración' : 'Reproducir demostración'}
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-elevated)] cursor-pointer"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[var(--text)] truncate" aria-live="off">
              {playing ? phaseLabel : 'Pausado'}
              {playing && !def.steady && isEccentricPhase && (
                <span className="text-[var(--text-muted)] font-normal"> · 2 s</span>
              )}
            </p>
            <div className="mt-1.5 h-[2px] rounded-full bg-[var(--border)] overflow-hidden">
              <div ref={progressRef} className="h-full w-full origin-left bg-[var(--accent)]" style={{ transform: 'scaleX(0)' }} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSpeed((s) => (s === 1 ? 0.5 : 1))}
            className="shrink-0 rounded-[24px] border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] tabular-nums cursor-pointer hover:bg-[var(--surface-elevated)]"
            aria-label="Cambiar velocidad"
          >
            {speed === 1 ? '1×' : '0,5×'}
          </button>
        </div>
      )}
    </div>
  );
}
