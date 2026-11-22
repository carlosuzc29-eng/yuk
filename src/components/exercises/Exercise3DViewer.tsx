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
import { cn } from '@/lib/utils/cn';

type CameraPreset = '3/4' | 'lateral' | 'frontal' | 'espalda';

const PRESET_ANGLES: Record<CameraPreset, { yaw: number; pitch: number }> = {
  '3/4': { yaw: -0.78, pitch: 0.24 },
  lateral: { yaw: -Math.PI / 2, pitch: 0.12 },
  frontal: { yaw: 0.0, pitch: 0.15 },
  espalda: { yaw: Math.PI, pitch: 0.18 },
};

const ease = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2;

interface Timing {
  holdA: number;
  toB: number;
  holdB: number;
  toA: number;
}

function timingFor(def: PatternDef): Timing {
  if (def.steady) return { holdA: 0.2, toB: 1.3, holdB: 0.2, toA: 1.3 };
  const ecc = 2.0;
  const con = 1.1;
  return {
    holdA: 0.35,
    toB: def.bIsEccentric ? ecc : con,
    holdB: 0.45,
    toA: def.bIsEccentric ? con : ecc,
  };
}

function phaseAt(
  time: number,
  tm: Timing
): { t: number; phase: 'holdA' | 'toB' | 'holdB' | 'toA' } {
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(animate);
  const [speed, setSpeed] = useState(1);
  const [preset, setPreset] = useState<CameraPreset>(def.view === 'front' ? 'frontal' : '3/4');
  const [uiState, setUiState] = useState<{ phase: string; progress: number }>({
    phase: 'holdA',
    progress: 0,
  });

  // Refs mutables para el bucle 60fps sin re-crear el WebGLRenderer
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const visibleRef = useRef(true);
  const clockRef = useRef(0);
  const camRef = useRef({
    yaw: PRESET_ANGLES[def.view === 'front' ? 'frontal' : '3/4'].yaw,
    pitch: PRESET_ANGLES[def.view === 'front' ? 'frontal' : '3/4'].pitch,
    targetYaw: PRESET_ANGLES[def.view === 'front' ? 'frontal' : '3/4'].yaw,
    targetPitch: PRESET_ANGLES[def.view === 'front' ? 'frontal' : '3/4'].pitch,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (m.matches) setPlaying(false);
  }, []);

  const selectPreset = (p: CameraPreset) => {
    setPreset(p);
    camRef.current.targetYaw = PRESET_ANGLES[p].yaw;
    camRef.current.targetPitch = PRESET_ANGLES[p].pitch;
  };

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      onWebGLFailed?.();
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    // Escena estilo estudio ZBrush oscuro con iluminación dramática de 3 puntos
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131519);
    scene.fog = new THREE.Fog(0x131519, 4.5, 9.5);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);

    // Luz ambiental hemisférica suave
    const hemi = new THREE.HemisphereLight(0xf1f4fa, 0x1e222a, 0.72);
    scene.add(hemi);

    // Luz clave principal (Key Light — esculpe los músculos como en las referencias ZBrush)
    const keyLight = new THREE.DirectionalLight(0xfff6eb, 2.05);
    keyLight.position.set(2.4, 3.6, 2.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 10;
    keyLight.shadow.camera.left = -2.2;
    keyLight.shadow.camera.right = 2.2;
    keyLight.shadow.camera.top = 2.6;
    keyLight.shadow.camera.bottom = -1.2;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Luz de relleno fría (Fill Light)
    const fillLight = new THREE.DirectionalLight(0xa9c0e6, 0.65);
    fillLight.position.set(-2.8, 1.8, 1.4);
    scene.add(fillLight);

    // Contraluz marcada (Rim Light — silueta nítida estilo estudio)
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.15);
    rimLight.position.set(-0.6, 2.4, -2.8);
    scene.add(rimLight);

    // Suelo de estudio oscuro mate + cuadrícula sutil
    const floorGeo = new THREE.CircleGeometry(4.2, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x181b21,
      roughness: 0.88,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(4.8, 16, 0x2b303a, 0x20242c);
    grid.position.y = 0.002;
    scene.add(grid);

    // Maniquí 3D + Equipamiento 3D
    const mannequin = createMannequin3D(sex);
    mannequin.setActiveMuscles(exercise.primary, exercise.secondary);
    scene.add(mannequin.root);

    const equipment = createEquipment3D(exercise, def);
    scene.add(equipment.root);

    // Calcular centro y distancia óptima de cámara según el volumen del ejercicio
    const sampleCenter = new THREE.Vector3();
    let minY = Infinity;
    let maxY = -Infinity;
    for (const st of [0, 0.5, 1]) {
      const { pose } = buildPose3D(exercise, st, sex);
      const pts = [pose.pelvis, pose.head, pose.wristL, pose.wristR, pose.ankleL, pose.ankleR];
      for (const p of pts) {
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      sampleCenter.add(pose.pelvis).add(pose.chest);
    }
    sampleCenter.divideScalar(6);
    sampleCenter.x = 0;
    sampleCenter.y = Math.max(0.42, (minY + maxY) / 2);
    const spanY = Math.max(1.15, maxY - minY + 0.35);
    const radius = Math.min(3.45, Math.max(2.35, spanY * 1.48));

    const resize = () => {
      const w = host.clientWidth || 320;
      const h = host.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            visibleRef.current = entry.isIntersecting;
          })
        : null;
    io?.observe(host);

    // Pose inicial inmediata
    const init = buildPose3D(exercise, animate ? 0 : 0.75, sex);
    mannequin.update(init.pose, 0);
    equipment.update(init.pose);

    let raf = 0;
    let last = performance.now();
    let uiTimer = 0;

    const renderLoop = (now: number) => {
      raf = requestAnimationFrame(renderLoop);
      if (!visibleRef.current) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (animate && playingRef.current) {
        clockRef.current += dt * speedRef.current;
      }

      const { t, phase } = phaseAt(clockRef.current, timing);
      const isEcc = (phase === 'toB' && def.bIsEccentric) || (phase === 'toA' && !def.bIsEccentric);
      const isCon = !def.steady && !isEcc && (phase === 'toA' || phase === 'toB');
      const pulse = isCon ? Math.sin(t * Math.PI) : 0;

      const { pose } = buildPose3D(exercise, animate ? t : 0.75, sex);
      mannequin.update(pose, pulse);
      equipment.update(pose);

      // Suavizado de cámara orbital
      const c = camRef.current;
      c.yaw += (c.targetYaw - c.yaw) * 0.14;
      c.pitch += (c.targetPitch - c.pitch) * 0.14;

      camera.position.set(
        sampleCenter.x + radius * Math.cos(c.pitch) * Math.sin(c.yaw),
        sampleCenter.y + radius * Math.sin(c.pitch),
        sampleCenter.z + radius * Math.cos(c.pitch) * Math.cos(c.yaw)
      );
      camera.lookAt(sampleCenter);
      renderer.render(scene, camera);

      uiTimer += dt;
      if (uiTimer > 0.08) {
        uiTimer = 0;
        setUiState({ phase, progress: (clockRef.current % total) / total });
      }
    };

    raf = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
      mannequin.dispose();
      equipment.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [exercise, sex, def, timing, total, animate, onWebGLFailed]);

  const onPointerDown = (e: React.PointerEvent) => {
    camRef.current.dragging = true;
    camRef.current.lastX = e.clientX;
    camRef.current.lastY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!camRef.current.dragging) return;
    const dx = e.clientX - camRef.current.lastX;
    const dy = e.clientY - camRef.current.lastY;
    camRef.current.lastX = e.clientX;
    camRef.current.lastY = e.clientY;
    camRef.current.targetYaw -= dx * 0.011;
    camRef.current.targetPitch = Math.max(
      -0.12,
      Math.min(0.85, camRef.current.targetPitch + dy * 0.008)
    );
  };

  const onPointerUp = () => {
    camRef.current.dragging = false;
  };

  const phaseLabel =
    uiState.phase === 'toB' || uiState.phase === 'holdA' ? def.toB : def.toA;
  const isEccentricPhase =
    (uiState.phase === 'toB' && def.bIsEccentric) || (uiState.phase === 'toA' && !def.bIsEccentric);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative rounded-[8px] overflow-hidden bg-[#131519] aspect-[4/3] w-full touch-none select-none">
        <div
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={`Modelo 3D animado de ${exercise.name}. Arrastra para rotar 360 grados.`}
        />

        {/* Insignia sutil de giro 360° */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium text-white/80">
          <RotateCw className="h-3 w-3 text-[#ff6105]" /> 3D · Arrastra para girar
        </div>

        {/* Selector rápido de ángulo de cámara */}
        {showControls && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-black/65 backdrop-blur-md p-1 border border-white/10">
            {(['3/4', 'lateral', 'frontal', 'espalda'] as CameraPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => selectPreset(p)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-colors cursor-pointer',
                  preset === p
                    ? 'bg-[#ff6105] text-white'
                    : 'text-white/75 hover:text-white'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

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
              <div
                className="h-full bg-[var(--accent)]"
                style={{ width: `${Math.round(uiState.progress * 100)}%` }}
              />
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
