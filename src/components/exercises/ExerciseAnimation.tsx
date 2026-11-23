'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { Exercise, View2DMode } from '@/types/training';
import type { MuscleId, Sex } from '@/types/user';
import { useAuth } from '@/components/providers/AuthProvider';
import { PATTERNS, type Pad, type PatternDef } from '@/lib/exercises/poses';
import {
  add,
  anatomicalLimbPath,
  buildFront,
  buildProjectedFrontBack,
  buildSide,
  buildSideFromFront,
  footPath,
  lerpFront,
  lerpSide,
  limbFront,
  mul,
  muscleShapes,
  sideHeadPath,
  type LimbKind,
  type MuscleShape,
  type Seg,
  type SegName,
  type Skeleton,
  type V,
} from '@/lib/exercises/rig';
import { cn } from '@/lib/utils/cn';

interface Props {
  exercise: Exercise;
  /** Silueta masculina o femenina (si se omite, usa el perfil del usuario). */
  sex?: Sex;
  /** Reproduce la animación (si no, muestra una postura fija). */
  animate?: boolean;
  /** Postura fija (0 = inicio, 1 = final) cuando no se anima. */
  staticT?: number;
  showControls?: boolean;
  className?: string;
  /** Ocupa toda la caja contenedora (miniaturas): la figura se ajusta sin recortarse. */
  fill?: boolean;
  /** Vista 2D forzada opcional ('lateral' | 'frontal' | 'espalda'). */
  initialView?: View2DMode;
}

const VIEW_LABELS: { id: View2DMode; label: string }[] = [
  { id: 'lateral', label: 'Lateral' },
  { id: 'frontal', label: 'Frontal' },
  { id: 'espalda', label: 'Espalda' },
];

const ease = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2;

/**
 * Construye el esqueleto 2D del ejercicio en el instante `t` (0..1) para cualquiera de las
 * tres vistas anatómicas ('lateral' | 'frontal' | 'espalda').
 */
export function skeletonForView(
  def: PatternDef,
  t: number,
  sex: Sex,
  viewMode: View2DMode,
  exercise: Exercise
): Skeleton {
  if (def.view === 'side') {
    const skSide = buildSide(lerpSide(def.a, def.b, t), sex);
    if (viewMode === 'lateral') return skSide;
    return buildProjectedFrontBack(
      skSide,
      t,
      sex,
      viewMode === 'espalda' ? 'back' : 'front',
      exercise.pattern,
      exercise.equipment
    );
  }

  // Patrón nativo frontal (elevaciones laterales, encogimientos, abducción, aducción)
  const fPose = lerpFront(def.a, def.b, t);
  if (viewMode === 'lateral') {
    return buildSideFromFront(fPose, sex, exercise.pattern);
  }
  return buildFront(fPose, sex, viewMode === 'espalda' ? 'back' : 'front');
}

/** Encuadre ajustado: recorre la animación en la vista activa y toma los límites del cuerpo, implementos y máquina. */
export function computeViewBox(
  def: PatternDef,
  exercise: Exercise,
  sex: Sex,
  viewMode: View2DMode
): [number, number, number, number] {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  const put = (p: V, r = 0) => {
    x0 = Math.min(x0, p[0] - r);
    y0 = Math.min(y0, p[1] - r);
    x1 = Math.max(x1, p[0] + r);
    y1 = Math.max(y1, p[1] + r);
  };
  const equipment = exercise.equipment;
  const handR = equipment === 'barra' ? 18 : equipment === 'kettlebell' ? 17 : 10;

  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const sk = skeletonForView(def, t, sex, viewMode, exercise);
    Object.values(sk.segs).forEach((s) => {
      if (s) {
        put(s.a, s.wa / 2 + 2);
        put(s.b, s.wb / 2 + 2);
      }
    });
    put(sk.head, 13);
    put(sk.toe, 6);
    put(sk.toe2, 6);
    put(sk.hand, handR);
    put(sk.hand2, sk.view !== 'side' ? handR : 6);
  }

  if (viewMode === 'lateral') {
    def.scene?.forEach((it) => {
      if (it.t === 'rect') {
        put([it.x, it.y]);
        put([it.x + it.w, it.y + it.h]);
      } else if (it.t === 'line') {
        put(it.a, it.w);
        put(it.b, it.w);
      } else {
        put(it.c, it.r);
      }
    });
    if (def.anchor && (equipment === 'polea' || equipment === 'banda')) put(def.anchor, 8);
  } else {
    // En vista frontal o de espalda, el eje de simetría es CX = 120; reservar espacio para barras/máquinas
    const spanHalf =
      equipment === 'barra' ||
      equipment === 'maquina' ||
      equipment === 'polea' ||
      exercise.pattern === 'pull_up'
        ? 56
        : 44;
    put([120 - spanHalf, 80]);
    put([120 + spanHalf, 80]);
    if (
      exercise.pattern === 'pull_up' ||
      exercise.pattern === 'hanging_leg_raise' ||
      exercise.pattern === 'pulldown'
    ) {
      put([120, -26], 6);
    }
  }

  if (def.ground !== false) y1 = Math.max(y1, 186);
  const pad = 11;
  x0 -= pad;
  y0 -= pad;
  x1 += pad;
  y1 += pad;
  let w = x1 - x0;
  let h = y1 - y0;
  if (w / h < 1.05) {
    const nw = h * 1.05;
    x0 -= (nw - w) / 2;
    w = nw;
  }
  if (w / h > 1.55) {
    const nh = w / 1.55;
    y0 -= (nh - h) / 2;
    h = nh;
  }
  return [x0, y0, w, h];
}

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

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function ExerciseAnimation({
  exercise,
  sex: sexProp,
  animate = true,
  staticT = 0.85,
  showControls = true,
  className,
  fill = false,
  initialView,
}: Props) {
  const { profile } = useAuth();
  const sex: Sex = sexProp ?? profile?.sex ?? 'male';
  const def = PATTERNS[exercise.pattern];

  const defaultView: View2DMode =
    initialView ?? exercise.defaultView ?? (def.view === 'front' ? 'frontal' : 'lateral');
  const [viewMode, setViewMode] = useState<View2DMode>(defaultView);

  useEffect(() => {
    setViewMode(initialView ?? exercise.defaultView ?? (def.view === 'front' ? 'frontal' : 'lateral'));
  }, [exercise.id, exercise.defaultView, def.view, initialView]);

  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(animate);
  const [speed, setSpeed] = useState(1);
  const [state, setState] = useState<{ t: number; phase: string; progress: number }>({
    t: staticT,
    phase: 'holdB',
    progress: 0,
  });
  const [visible, setVisible] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const clock = useRef(0);

  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.1,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const timing = useMemo(() => timingFor(def), [def]);
  const total = timing.holdA + timing.toB + timing.holdB + timing.toA;

  useEffect(() => {
    if (!animate || !playing || !visible) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      clock.current += ((now - last) / 1000) * speed;
      last = now;
      const { t, phase } = phaseAt(clock.current, timing);
      setState({ t, phase, progress: (clock.current % total) / total });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, playing, visible, speed, timing, total]);

  const sk = useMemo(
    () => skeletonForView(def, state.t, sex, viewMode, exercise),
    [def, state.t, sex, viewMode, exercise]
  );

  // Estela de trayectoria de la mano/barra/tobillo en la vista activa
  const trailPath = useMemo(() => {
    if (!showControls || !animate) return null;
    const pts: V[] = [];
    for (let i = 0; i <= 12; i++) {
      const s = skeletonForView(def, i / 12, sex, viewMode, exercise);
      pts.push(def.anchorAtAnkle ? s.ankle : s.hand);
    }
    const dist = Math.hypot(
      pts[pts.length - 1][0] - pts[0][0],
      pts[pts.length - 1][1] - pts[0][1]
    );
    if (dist < 5) return null;
    return pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(' ');
  }, [def, sex, viewMode, exercise, showControls, animate]);

  const phaseLabel =
    state.phase === 'toB' || state.phase === 'holdA' ? def.toB : def.toA;
  const isEccentricPhase =
    (state.phase === 'toB' && def.bIsEccentric) || (state.phase === 'toA' && !def.bIsEccentric);
  const isConcentric = !def.steady && !isEccentricPhase && (state.phase === 'toA' || state.phase === 'toB');

  if (exercise.videoUrl) {
    return (
      <div className={cn('rounded-[8px] overflow-hidden bg-[var(--surface-elevated)]', className)}>
        <video
          src={exercise.videoUrl}
          autoPlay={!reduced}
          loop
          muted
          playsInline
          controls={showControls}
          className="w-full h-auto"
        />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn('relative', fill && 'h-full w-full', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-[8px]',
          fill ? 'h-full w-full' : 'border border-[var(--border)] bg-[var(--surface-elevated)]/60 p-2'
        )}
      >
        {/* Selector superior de vista 2D (Lateral · Frontal · Espalda) y etiqueta de máquina */}
        {showControls && !fill && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)] truncate max-w-[62%]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />
              <span className="truncate" title={exercise.machineName}>
                {exercise.machineName}
              </span>
            </span>
            <div
              role="group"
              aria-label="Cambiar ángulo de vista 2D"
              className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5"
            >
              {VIEW_LABELS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewMode(v.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer',
                    viewMode === v.id
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <FigureSVG
          def={def}
          sk={sk}
          sex={sex}
          viewMode={viewMode}
          exercise={exercise}
          fill={fill}
          trailPath={trailPath}
          concentricPulse={isConcentric}
          label={`Demostración 2D (${viewMode}): ${exercise.name} en ${exercise.machineName}`}
        />
      </div>

      {showControls && animate && (
        <div className="mt-3 space-y-2">
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
                  style={{ width: `${Math.round(state.progress * 100)}%` }}
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
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Estudio Anatómico 2D Multi-Ángulo ─────────────────────────

const SIDE_FAR_ORDER: { seg: SegName; kind: LimbKind }[] = [
  { seg: 'thigh2', kind: 'thigh' },
  { seg: 'shin2', kind: 'shin' },
  { seg: 'upperArm2', kind: 'upperArm' },
  { seg: 'forearm2', kind: 'forearm' },
];

export function FigureSVG({
  def,
  sk,
  sex,
  viewMode,
  exercise,
  label,
  fill = false,
  trailPath = null,
  concentricPulse = false,
}: {
  def: PatternDef;
  sk: Skeleton;
  sex: Sex;
  viewMode: View2DMode;
  exercise: Exercise;
  label: string;
  fill?: boolean;
  trailPath?: string | null;
  concentricPulse?: boolean;
}) {
  const uid = useId().replace(/:/g, '');

  const muscles = useMemo(() => {
    const prim: MuscleShape[] = exercise.primary.flatMap((m) =>
      muscleShapes(sk, m).map((s) => ({ ...s, key: `p-${s.key}` }))
    );
    const sec: MuscleShape[] = exercise.secondary
      .filter((m) => !exercise.primary.includes(m))
      .flatMap((m: MuscleId) => muscleShapes(sk, m).map((s) => ({ ...s, key: `s-${s.key}` })));
    return { prim, sec };
  }, [sk, exercise.primary, exercise.secondary]);

  const segOf = (name: SegName) => sk.segs[name];
  const primOpacity = concentricPulse ? 0.96 : 0.8;
  const secOpacity = concentricPulse ? 0.72 : 0.54;

  const musclesFor = (filter: (key: string) => boolean) => (
    <>
      {muscles.sec
        .filter((m) => filter(m.key))
        .map((m) => (
          <ellipse
            key={m.key}
            cx={m.cx}
            cy={m.cy}
            rx={m.rx}
            ry={m.ry}
            transform={`rotate(${m.rot} ${m.cx} ${m.cy})`}
            fill={`url(#${uid}-msec)`}
            opacity={m.far ? secOpacity * 0.5 : secOpacity}
          />
        ))}
      {muscles.prim
        .filter((m) => filter(m.key))
        .map((m) => (
          <ellipse
            key={m.key}
            cx={m.cx}
            cy={m.cy}
            rx={m.rx * (concentricPulse ? 1.06 : 1)}
            ry={m.ry * (concentricPulse ? 1.06 : 1)}
            transform={`rotate(${m.rot} ${m.cx} ${m.cy})`}
            fill={`url(#${uid}-mprim)`}
            filter={m.far ? undefined : `url(#${uid}-mglow)`}
            opacity={m.far ? primOpacity * 0.5 : primOpacity}
          />
        ))}
    </>
  );

  const limb = (name: SegName, kind: LimbKind, far = false) => {
    const s = segOf(name);
    if (!s) return null;
    const fillUrl = far ? `url(#${uid}-far)` : `url(#${uid}-near)`;
    return (
      <g>
        <circle cx={s.a[0]} cy={s.a[1]} r={s.wa * 0.44} fill={fillUrl} />
        <path
          d={anatomicalLimbPath(s, kind)}
          fill={fillUrl}
          stroke="var(--fig-line)"
          strokeWidth={far ? 0.55 : 0.75}
          strokeLinejoin="round"
        />
        <circle cx={s.b[0]} cy={s.b[1]} r={s.wb * 0.46} fill={fillUrl} />
      </g>
    );
  };

  const foot = (a: V, b: V, far = false) => {
    if (sk.view !== 'side') {
      // Calzado visto de frente (puntera) o de espalda (talón y suela)
      const isBack = sk.view === 'back';
      return (
        <g>
          <rect
            x={a[0] - 4.6}
            y={a[1] - 2.5}
            width={9.2}
            height={7.4}
            rx={3.4}
            fill={`url(#${uid}-shoe)`}
            stroke="var(--fig-line)"
            strokeWidth={0.7}
          />
          <rect
            x={a[0] - 4.8}
            y={a[1] + 3.1}
            width={9.6}
            height={2.1}
            rx={1}
            fill="var(--fig-prop)"
            opacity={0.85}
          />
          {isBack && (
            <line
              x1={a[0]}
              y1={a[1] - 2}
              x2={a[0]}
              y2={a[1] + 2.5}
              stroke="var(--accent)"
              strokeWidth={0.9}
              opacity={0.7}
            />
          )}
        </g>
      );
    }
    return (
      <path
        d={footPath(a, b)}
        fill={far ? `url(#${uid}-shoe-far)` : `url(#${uid}-shoe)`}
        stroke="var(--fig-line)"
        strokeWidth={0.7}
        strokeLinejoin="round"
      />
    );
  };

  const handFist = (c: V, far = false) => (
    <circle
      cx={c[0]}
      cy={c[1]}
      r={3.4}
      fill={far ? `url(#${uid}-far)` : `url(#${uid}-near)`}
      stroke="var(--fig-line)"
      strokeWidth={0.7}
    />
  );

  const isSide = sk.view === 'side';
  const isBack = sk.view === 'back';
  const ground = def.ground !== false;
  const vb = useMemo(
    () => computeViewBox(def, exercise, sex, viewMode),
    [def, exercise, sex, viewMode]
  );
  const unilateral = Boolean(exercise.unilateral);

  // Determinar si el implemento (barra, polea, mancuernas) está detrás del torso o delante
  const barBehindNeck =
    exercise.pattern === 'squat_back' || exercise.pattern === 'good_morning';
  const propsInBackLayer =
    (sk.view === 'front' && barBehindNeck) ||
    (sk.view === 'back' && !barBehindNeck && exercise.equipment !== 'polea');

  const shY = sk.shoulder[1];
  const hipY = sk.hip[1];
  const torsoH = Math.max(20, hipY - shY);

  return (
    <svg
      viewBox={vb.map((n) => n.toFixed(1)).join(' ')}
      role="img"
      aria-label={label}
      className={fill ? 'block w-full h-full select-none' : 'w-full h-auto select-none'}
    >
      <defs>
        <linearGradient id={`${uid}-near`} x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#e8ebf0" stopOpacity="1" />
          <stop offset="52%" stopColor="var(--fig)" stopOpacity="0.96" />
          <stop offset="100%" stopColor="var(--fig-far)" stopOpacity="0.98" />
        </linearGradient>

        <linearGradient id={`${uid}-far`} x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="var(--fig)" stopOpacity="0.88" />
          <stop offset="100%" stopColor="var(--fig-far)" stopOpacity="0.72" />
        </linearGradient>

        <linearGradient id={`${uid}-torso`} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#eef1f6" stopOpacity="1" />
          <stop offset="50%" stopColor="var(--fig)" stopOpacity="0.97" />
          <stop offset="100%" stopColor="var(--fig-far)" stopOpacity="0.92" />
        </linearGradient>

        <linearGradient id={`${uid}-shoe`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--fig-prop)" stopOpacity="0.72" />
          <stop offset="100%" stopColor="var(--fig-line)" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={`${uid}-shoe-far`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--fig-far)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--fig-line)" stopOpacity="0.6" />
        </linearGradient>

        <radialGradient id={`${uid}-mprim`} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ff8a4c" stopOpacity="1" />
          <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id={`${uid}-msec`} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffc299" stopOpacity="0.95" />
          <stop offset="65%" stopColor="var(--amp-glow)" stopOpacity="0.78" />
          <stop offset="100%" stopColor="var(--amp-glow)" stopOpacity="0.15" />
        </radialGradient>

        <filter id={`${uid}-mglow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id={`${uid}-plate`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="var(--fig-prop)" stopOpacity="0.95" />
          <stop offset="65%" stopColor="var(--fig-plate)" stopOpacity="0.96" />
          <stop offset="100%" stopColor="var(--fig-line)" stopOpacity="1" />
        </radialGradient>
      </defs>

      {/* Suelo técnico y sombra de contacto */}
      {ground && (
        <>
          <line
            x1={vb[0]}
            y1={182.5}
            x2={vb[0] + vb[2]}
            y2={182.5}
            stroke="var(--fig-scene)"
            strokeWidth={1.4}
          />
          <ellipse
            cx={(sk.ankle[0] + sk.ankle2[0]) / 2}
            cy={183.5}
            rx={34}
            ry={3}
            fill="var(--fig-line)"
            opacity={0.18}
          />
        </>
      )}

      {/* Estela fantasma de trayectoria */}
      {trailPath && (
        <path
          d={trailPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.2}
          strokeDasharray="2.5 3.5"
          strokeLinecap="round"
          opacity={0.38}
        />
      )}

      {/* Estructura trasera de la máquina comercial / rack / banco / torre de placas */}
      <MachineBackdrop2D def={def} sk={sk} exercise={exercise} />

      {/* Cable o banda elástica (capa trasera si corresponde) */}
      {isBack && <Connector def={def} sk={sk} exercise={exercise} />}

      {/* Implementos detrás del cuerpo (ej. barra frontal vista desde la espalda, o barra tras nuca vista de frente) */}
      {!isSide && propsInBackLayer && (
        <HandProps
          def={def}
          sk={sk}
          exercise={exercise}
          unilateral={unilateral}
          plateGradId={`${uid}-plate`}
        />
      )}

      {isSide ? (
        <>
          {/* Extremidades lejanas */}
          {SIDE_FAR_ORDER.map(({ seg, kind }) => (
            <React.Fragment key={seg}>{limb(seg, kind, true)}</React.Fragment>
          ))}
          {foot(sk.ankle2, sk.toe2, true)}
          {handFist(sk.hand2, true)}
          {musclesFor((k) => k.endsWith('2'))}

          {/* Cuello anatómico, torso esculpido y cabeza con perfil facial */}
          <line
            x1={sk.neck[0][0]}
            y1={sk.neck[0][1]}
            x2={sk.neck[1][0]}
            y2={sk.neck[1][1]}
            stroke={`url(#${uid}-near)`}
            strokeWidth={sex === 'female' ? 6.8 : 7.8}
            strokeLinecap="round"
          />
          <path
            d={sk.torsoPath}
            fill={`url(#${uid}-torso)`}
            stroke="var(--fig-line)"
            strokeWidth={0.85}
          />
          {musclesFor((k) => k.endsWith('-t'))}
          <path
            d={sideHeadPath(sk.head, sk.neck[0])}
            fill={`url(#${uid}-near)`}
            stroke="var(--fig-line)"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />

          {/* Pierna cercana */}
          {limb('thigh', 'thigh')}
          {limb('shin', 'shin')}
          {foot(sk.ankle, sk.toe)}
          {musclesFor((k) => k.endsWith('-thigh') || k.endsWith('-shin'))}

          {/* Brazo cercano + mano */}
          {limb('upperArm', 'upperArm')}
          {limb('forearm', 'forearm')}
          {handFist(sk.hand)}
          {musclesFor((k) => k.endsWith('-upperArm') || k.endsWith('-forearm'))}
        </>
      ) : (
        <>
          {/* Piernas izquierda y derecha */}
          {limb('thigh2', 'thigh')}
          {limb('shin2', 'shin')}
          {limb('thigh', 'thigh')}
          {limb('shin', 'shin')}
          {foot(sk.ankle, sk.toe)}
          {foot(sk.ankle2, sk.toe2)}

          {/* Cuello y Torso (Frontal o Espalda) */}
          <line
            x1={sk.neck[0][0]}
            y1={sk.neck[0][1]}
            x2={sk.neck[1][0]}
            y2={sk.neck[1][1]}
            stroke={`url(#${uid}-near)`}
            strokeWidth={sex === 'female' ? 7.5 : 8.8}
            strokeLinecap="round"
          />
          <path
            d={sk.torsoPath}
            fill={`url(#${uid}-torso)`}
            stroke="var(--fig-line)"
            strokeWidth={0.85}
          />

          {/* Líneas de referencia anatómica: Frontal (clavículas, pectorales, línea alba) vs Espalda (columna, escápulas, pliegue glúteo) */}
          {isBack ? (
            <g stroke="var(--fig-line)" strokeLinecap="round" fill="none" opacity={0.35}>
              {/* Surco vertebral dorsal y lumbar */}
              <line x1={120} y1={shY + 2} x2={120} y2={hipY - 1} strokeWidth={0.75} />
              {/* Borde inferior de las escápulas (omóplatos) */}
              <path
                d={`M 111 ${shY + torsoH * 0.14} Q 108 ${shY + torsoH * 0.34} 115 ${shY + torsoH * 0.38}`}
                strokeWidth={0.7}
              />
              <path
                d={`M 129 ${shY + torsoH * 0.14} Q 132 ${shY + torsoH * 0.34} 125 ${shY + torsoH * 0.38}`}
                strokeWidth={0.7}
              />
              {/* Contorno inferior de glúteos */}
              <path
                d={`M 105 ${hipY + 5} Q 112 ${hipY + 11} 120 ${hipY + 4} Q 128 ${hipY + 11} 135 ${hipY + 5}`}
                strokeWidth={0.75}
              />
            </g>
          ) : (
            <g stroke="var(--fig-line)" strokeLinecap="round" fill="none" opacity={0.32}>
              {/* Clavículas */}
              <path d={`M 103 ${shY + 2} Q 112 ${shY + 5} 118 ${shY + 3}`} strokeWidth={0.7} />
              <path d={`M 137 ${shY + 2} Q 128 ${shY + 5} 122 ${shY + 3}`} strokeWidth={0.7} />
              {/* Borde pectoral inferior */}
              <path
                d={`M 104 ${shY + torsoH * 0.28} Q 112 ${shY + torsoH * 0.35} 119 ${shY + torsoH * 0.28}`}
                strokeWidth={0.75}
              />
              <path
                d={`M 136 ${shY + torsoH * 0.28} Q 128 ${shY + torsoH * 0.35} 121 ${shY + torsoH * 0.28}`}
                strokeWidth={0.75}
              />
              {/* Línea alba abdominal */}
              <line
                x1={120}
                y1={shY + torsoH * 0.32}
                x2={120}
                y2={hipY - 4}
                strokeWidth={0.65}
              />
            </g>
          )}

          {/* Músculos del torso y piernas en vista frontal/espalda */}
          {musclesFor(
            (k) =>
              !k.includes('upperArm') &&
              !k.includes('forearm')
          )}

          {/* Cabeza frontal o nuca dorsal */}
          <g>
            <ellipse
              cx={sk.head[0]}
              cy={sk.head[1]}
              rx={sex === 'female' ? 9.2 : 10}
              ry={11}
              fill={`url(#${uid}-near)`}
              stroke="var(--fig-line)"
              strokeWidth={0.8}
            />
            {isBack ? (
              <path
                d={`M ${sk.head[0] - 7} ${sk.head[1] + 5} Q ${sk.head[0]} ${sk.head[1] + 8} ${sk.head[0] + 7} ${sk.head[1] + 5}`}
                fill="none"
                stroke="var(--fig-line)"
                strokeWidth={0.7}
                opacity={0.4}
              />
            ) : (
              <path
                d={`M ${sk.head[0] - 4} ${sk.head[1] - 1} L ${sk.head[0] - 1.5} ${sk.head[1] - 1} M ${sk.head[0] + 1.5} ${sk.head[1] - 1} L ${sk.head[0] + 4} ${sk.head[1] - 1} M ${sk.head[0]} ${sk.head[1] - 1} L ${sk.head[0]} ${sk.head[1] + 3}`}
                fill="none"
                stroke="var(--fig-line)"
                strokeWidth={0.65}
                opacity={0.35}
              />
            )}
          </g>

          {/* Brazos y manos */}
          {limb('upperArm2', 'upperArm')}
          {limb('forearm2', 'forearm')}
          {limb('upperArm', 'upperArm')}
          {limb('forearm', 'forearm')}
          {handFist(sk.hand2)}
          {handFist(sk.hand)}
          {musclesFor((k) => k.includes('upperArm') || k.includes('forearm'))}
        </>
      )}

      {/* Almohadillas de contacto de la máquina en primer plano */}
      {def.pads?.map((p) => (
        <PadShape key={p} pad={p} sk={sk} />
      ))}

      {/* Cable o banda elástica (capa frontal) */}
      {!isBack && <Connector def={def} sk={sk} exercise={exercise} />}

      {/* Implementos en las manos (en primer plano si no se dibujaron detrás) */}
      {(isSide || !propsInBackLayer) && (
        <HandProps
          def={def}
          sk={sk}
          exercise={exercise}
          unilateral={unilateral}
          plateGradId={`${uid}-plate`}
        />
      )}
    </svg>
  );
}

/**
 * Dibuja la estructura real de la máquina comercial de gimnasio, banco, rack o torre de placas
 * adaptada a la vista actual ('side' | 'front' | 'back').
 */
function MachineBackdrop2D({
  def,
  sk,
  exercise,
}: {
  def: PatternDef;
  sk: Skeleton;
  exercise: Exercise;
}) {
  const eq = exercise.equipment;
  const p = exercise.pattern;

  if (sk.view === 'side') {
    const anchor = def.anchor;
    const showWeightStack =
      eq === 'polea' ||
      (eq === 'maquina' &&
        (p === 'leg_extension' ||
          p === 'leg_curl_seated' ||
          p === 'leg_curl_lying' ||
          p === 'pulldown' ||
          p === 'row_seated' ||
          p === 'chest_press_machine' ||
          p === 'overhead_press_seated' ||
          p === 'row_chest_supported' ||
          p === 'fly_cable' ||
          p === 'rear_delt_fly'));

    const stackX = anchor
      ? anchor[0] > 120
        ? anchor[0] + 6
        : anchor[0] - 18
      : p === 'leg_extension' || p === 'leg_curl_seated'
        ? 44
        : 38;

    return (
      <g>
        {/* Torre de placas de peso comercial (Weight Stack) */}
        {showWeightStack && (
          <g opacity={0.85}>
            <rect
              x={stackX}
              y={26}
              width={14}
              height={156}
              rx={2}
              fill="var(--fig-scene)"
              stroke="var(--fig-line)"
              strokeWidth={0.7}
            />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
              <rect
                key={idx}
                x={stackX + 1.5}
                y={96 + idx * 8.5}
                width={11}
                height={6.5}
                rx={1}
                fill="var(--fig-prop)"
                opacity={idx < 4 ? 0.78 : 0.42}
              />
            ))}
          </g>
        )}

        {/* Rieles inclinados y plataforma de Prensa 45° o Hack Squat */}
        {p === 'leg_press' && (
          <g>
            <line
              x1={76}
              y1={178}
              x2={170}
              y2={74}
              stroke="var(--fig-prop)"
              strokeWidth={2.4}
              opacity={0.65}
            />
            <line
              x1={82}
              y1={182}
              x2={176}
              y2={78}
              stroke="var(--fig-prop)"
              strokeWidth={1.6}
              opacity={0.45}
            />
            {/* Plataforma del trineo que acompaña a los pies */}
            <line
              x1={sk.ankle[0] - 8}
              y1={sk.ankle[1] - 18}
              x2={sk.ankle[0] + 18}
              y2={sk.ankle[1] + 12}
              stroke="var(--fig-prop)"
              strokeWidth={4.5}
              strokeLinecap="round"
            />
          </g>
        )}

        {p === 'squat_machine' && (
          <g>
            <line
              x1={52}
              y1={42}
              x2={112}
              y2={182}
              stroke="var(--fig-prop)"
              strokeWidth={2.4}
              opacity={0.65}
            />
            <line
              x1={98}
              y1={182}
              x2={134}
              y2={166}
              stroke="var(--fig-prop)"
              strokeWidth={4}
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Jaula Power Rack / Multipower en sentadilla con barra o press militar */}
        {(p === 'squat_back' || p === 'squat_front' || p === 'overhead_press' || p === 'good_morning') &&
          (eq === 'barra' || eq === 'maquina') && (
            <g opacity={0.65}>
              <line
                x1={116}
                y1={16}
                x2={116}
                y2={182}
                stroke="var(--fig-prop)"
                strokeWidth={3}
              />
              {/* J-cup y barra de seguridad */}
              <line
                x1={108}
                y1={46}
                x2={116}
                y2={46}
                stroke="var(--accent)"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
              <line
                x1={66}
                y1={116}
                x2={116}
                y2={116}
                stroke="var(--fig-prop)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </g>
          )}

        {/* Escenario original (bancos, asientos, postes) */}
        {def.scene?.map((it, i) =>
          it.t === 'rect' ? (
            <g key={i}>
              <rect
                x={it.x}
                y={it.y}
                width={it.w}
                height={it.h}
                rx={it.r ?? 2.5}
                fill="var(--fig-scene)"
                stroke="var(--fig-line)"
                strokeWidth={0.75}
              />
              <line
                x1={it.x + 2}
                y1={it.y + 1.2}
                x2={it.x + it.w - 2}
                y2={it.y + 1.2}
                stroke="var(--bg)"
                strokeWidth={0.8}
                opacity={0.28}
              />
            </g>
          ) : it.t === 'line' ? (
            <line
              key={i}
              x1={it.a[0]}
              y1={it.a[1]}
              x2={it.b[0]}
              y2={it.b[1]}
              stroke="var(--fig-prop)"
              strokeWidth={it.w}
              strokeLinecap="round"
              opacity={0.78}
            />
          ) : (
            <circle
              key={i}
              cx={it.c[0]}
              cy={it.c[1]}
              r={it.r}
              fill="var(--fig-scene)"
              stroke="var(--fig-line)"
              strokeWidth={0.6}
            />
          )
        )}
      </g>
    );
  }

  // ───────── Vistas Frontal ('front') y de Espalda ('back') centradas en CX = 120 ─────────
  const shY = sk.shoulder[1];
  const hipY = sk.hip[1];

  return (
    <g>
      {/* Jaula de potencia (Power Rack / Multipower) o Torre de Dominadas */}
      {(eq === 'barra' ||
        p === 'pull_up' ||
        p === 'hanging_leg_raise' ||
        p === 'squat_machine' ||
        exercise.id.includes('smith')) && (
        <g opacity={0.7}>
          <line x1={72} y1={-22} x2={72} y2={182} stroke="var(--fig-prop)" strokeWidth={3} />
          <line x1={168} y1={-22} x2={168} y2={182} stroke="var(--fig-prop)" strokeWidth={3} />
          <line
            x1={68}
            y1={-22}
            x2={172}
            y2={-22}
            stroke="var(--fig-prop)"
            strokeWidth={3.2}
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Barras paralelas en estación de fondos */}
      {p === 'dip' && (
        <g opacity={0.82}>
          <line x1={94} y1={sk.hand[1]} x2={94} y2={182} stroke="var(--fig-prop)" strokeWidth={3} />
          <line x1={146} y1={sk.hand[1]} x2={146} y2={182} stroke="var(--fig-prop)" strokeWidth={3} />
          <circle cx={95} cy={sk.hand[1]} r={3.8} fill="var(--fig-scene)" stroke="var(--fig-prop)" strokeWidth={1.4} />
          <circle cx={145} cy={sk.hand[1]} r={3.8} fill="var(--fig-scene)" stroke="var(--fig-prop)" strokeWidth={1.4} />
        </g>
      )}

      {/* Torre central de placas de peso en ejercicios de polea y máquinas selectorizadas */}
      {(eq === 'polea' || eq === 'maquina') && (
        <g opacity={0.65}>
          <rect
            x={104}
            y={18}
            width={32}
            height={164}
            rx={3}
            fill="var(--fig-scene)"
            stroke="var(--fig-line)"
            strokeWidth={0.7}
          />
          {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
            <rect
              key={idx}
              x={108}
              y={104 + idx * 9}
              width={24}
              height={6.5}
              rx={1}
              fill="var(--fig-prop)"
              opacity={idx < 4 ? 0.72 : 0.35}
            />
          ))}
        </g>
      )}

      {/* Respaldo y asiento tapizado en ejercicios sentados o en banco */}
      {(def.scene?.length || def.pads?.includes('backpad') || def.pads?.includes('chestpad')) && (
        <g opacity={0.85}>
          <rect
            x={101}
            y={shY - 4}
            width={38}
            height={Math.max(28, hipY - shY + 14)}
            rx={4}
            fill="var(--fig-scene)"
            stroke="var(--fig-line)"
            strokeWidth={0.8}
          />
          <rect
            x={96}
            y={hipY + 2}
            width={48}
            height={8}
            rx={3}
            fill="var(--fig-scene)"
            stroke="var(--fig-line)"
            strokeWidth={0.8}
          />
          <line x1={120} y1={hipY + 10} x2={120} y2={182} stroke="var(--fig-prop)" strokeWidth={4} />
        </g>
      )}

      {/* Plataforma de pies en Prensa 45° / Hack Squat vista frontal/espalda */}
      {(p === 'leg_press' || p === 'squat_machine') && (
        <rect
          x={86}
          y={Math.min(sk.ankle[1], sk.ankle2[1]) - 10}
          width={68}
          height={22}
          rx={3}
          fill="var(--fig-scene)"
          stroke="var(--fig-prop)"
          strokeWidth={1.2}
          opacity={0.75}
        />
      )}
    </g>
  );
}

function PadShape({ pad, sk }: { pad: Pad; sk: Skeleton }) {
  if (sk.view !== 'side') {
    // En vista frontal o espalda, dibujar los rodillos horizontales de tobillo/muslo/cadera
    const yRoller =
      pad === 'anklepad' || pad === 'anklepad_back'
        ? (sk.ankle[1] + sk.ankle2[1]) / 2 - 3
        : pad === 'thighpad'
          ? (sk.hip[1] + (sk.segs.thigh?.b[1] ?? sk.hip[1])) / 2
          : pad === 'hippad'
            ? sk.hip[1] + 2
            : null;
    if (yRoller === null) return null;
    return (
      <g>
        <rect
          x={92}
          y={yRoller - 3.8}
          width={56}
          height={7.6}
          rx={3.8}
          fill="var(--fig-scene)"
          stroke="var(--fig-line)"
          strokeWidth={0.8}
        />
        <circle cx={95} cy={yRoller} r={2} fill="var(--accent)" />
        <circle cx={145} cy={yRoller} r={2} fill="var(--accent)" />
      </g>
    );
  }

  const torso = sk.segs.torso;
  const shin = sk.segs.shin;
  const thigh = sk.segs.thigh;
  const pill = (a: V, b: V, w: number) => (
    <g>
      <line
        x1={a[0]}
        y1={a[1]}
        x2={b[0]}
        y2={b[1]}
        stroke="var(--fig-scene)"
        strokeWidth={w}
        strokeLinecap="round"
      />
      <line
        x1={a[0]}
        y1={a[1]}
        x2={b[0]}
        y2={b[1]}
        stroke="var(--fig-line)"
        strokeWidth={w}
        strokeLinecap="round"
        opacity={0.14}
      />
    </g>
  );
  const roller = (c: V, r = 5.5) => (
    <g>
      <circle
        cx={c[0]}
        cy={c[1]}
        r={r}
        fill="var(--fig-scene)"
        stroke="var(--fig-line)"
        strokeWidth={0.75}
      />
      <circle cx={c[0]} cy={c[1]} r={r * 0.35} fill="var(--fig-prop)" opacity={0.65} />
    </g>
  );
  switch (pad) {
    case 'backpad': {
      if (!torso) return null;
      const off = mul(sk.torsoFront, -15);
      return pill(add(sk.hip, off), add(sk.shoulder, off), 9);
    }
    case 'chestpad': {
      if (!torso) return null;
      const off = mul(sk.torsoFront, 17);
      return pill(add(sk.hip, off), add(sk.shoulder, off), 8);
    }
    case 'anklepad':
      return shin ? roller(add(sk.ankle, mul(limbFront(shin), 8))) : null;
    case 'anklepad_back':
      return shin ? roller(add(sk.ankle, mul(limbFront(shin), -8))) : null;
    case 'thighpad':
      return thigh ? roller(add(thigh.b, mul(limbFront(thigh), 11)), 5) : null;
    case 'hippad':
      return thigh ? roller(add(sk.hip, mul(limbFront(thigh as Seg), 12)), 7) : null;
    default:
      return null;
  }
}

function Connector({
  def,
  sk,
  exercise,
}: {
  def: PatternDef;
  sk: Skeleton;
  exercise: Exercise;
}) {
  const eq = exercise.equipment;
  if (eq !== 'polea' && eq !== 'banda') return null;
  const end: V = def.anchorAtAnkle
    ? sk.ankle
    : sk.view !== 'side' && !exercise.unilateral
      ? [(sk.hand[0] + sk.hand2[0]) / 2, (sk.hand[1] + sk.hand2[1]) / 2]
      : sk.hand;

  let anchor: V | undefined = def.anchor;
  if (sk.view !== 'side') {
    if (def.anchorAtAnkle || exercise.pattern === 'hip_abduction') {
      anchor = [42, 176];
    } else if (
      exercise.pattern === 'pulldown' ||
      exercise.pattern === 'straight_arm_pulldown' ||
      exercise.pattern === 'pushdown' ||
      exercise.pattern === 'face_pull' ||
      exercise.pattern === 'cable_crunch'
    ) {
      anchor = [120, -18];
    } else if (exercise.pattern === 'fly_cable') {
      return (
        <g>
          <line x1={62} y1={34} x2={sk.hand2[0]} y2={sk.hand2[1]} stroke="var(--fig-prop)" strokeWidth={1.2} />
          <line x1={178} y1={34} x2={sk.hand[0]} y2={sk.hand[1]} stroke="var(--fig-prop)" strokeWidth={1.2} />
          <circle cx={62} cy={34} r={4} fill="var(--fig-scene)" stroke="var(--fig-prop)" strokeWidth={1.2} />
          <circle cx={178} cy={34} r={4} fill="var(--fig-scene)" stroke="var(--fig-prop)" strokeWidth={1.2} />
        </g>
      );
    } else {
      anchor = [120, 178];
    }
  }
  if (!anchor && eq === 'banda') anchor = add(sk.toe, [-4, 0]);
  if (!anchor) return null;
  if (eq === 'banda') {
    const mid: V = [(anchor[0] + end[0]) / 2 - 4, (anchor[1] + end[1]) / 2];
    return (
      <path
        d={`M ${anchor[0]} ${anchor[1]} Q ${mid[0]} ${mid[1]} ${end[0]} ${end[1]}`}
        fill="none"
        stroke="var(--fig-band)"
        strokeWidth={2.8}
        strokeLinecap="round"
      />
    );
  }
  return (
    <g>
      <line
        x1={anchor[0]}
        y1={anchor[1]}
        x2={end[0]}
        y2={end[1]}
        stroke="var(--fig-prop)"
        strokeWidth={1.3}
        opacity={0.88}
      />
      <circle
        cx={anchor[0]}
        cy={anchor[1]}
        r={4.5}
        fill="var(--fig-scene)"
        stroke="var(--fig-prop)"
        strokeWidth={1.3}
      />
      <circle cx={anchor[0]} cy={anchor[1]} r={1.4} fill="var(--fig-prop)" />
    </g>
  );
}

function HandProps({
  def,
  sk,
  exercise,
  unilateral,
  plateGradId,
}: {
  def: PatternDef;
  sk: Skeleton;
  exercise: Exercise;
  unilateral: boolean;
  plateGradId: string;
}) {
  const eq = exercise.equipment;
  const p = exercise.pattern;
  if (p === 'ab_wheel') {
    const cx = sk.view === 'side' ? sk.hand[0] : (sk.hand[0] + sk.hand2[0]) / 2;
    const cy = sk.hand[1] + 1;
    return (
      <g>
        {sk.view !== 'side' && (
          <line
            x1={sk.hand2[0] - 4}
            y1={cy}
            x2={sk.hand[0] + 4}
            y2={cy}
            stroke="var(--fig-prop)"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        )}
        <circle
          cx={cx}
          cy={cy}
          r={7.5}
          fill="var(--fig-scene)"
          stroke="var(--fig-prop)"
          strokeWidth={2.6}
        />
        <circle cx={cx} cy={cy} r={2} fill="var(--accent)" />
      </g>
    );
  }
  if (eq === 'barra' || exercise.id.includes('smith')) {
    if (sk.view !== 'side') {
      // Barra olímpica vista de frente o de espalda: eje horizontal entre ambas manos + discos calibrados a los lados
      const yBar = (sk.hand[1] + sk.hand2[1]) / 2;
      const xL = Math.min(sk.hand[0], sk.hand2[0]) - 18;
      const xR = Math.max(sk.hand[0], sk.hand2[0]) + 18;
      return (
        <g>
          <line
            x1={xL - 8}
            y1={yBar}
            x2={xR + 8}
            y2={yBar}
            stroke="var(--fig-prop)"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          {/* Discos olímpicos de perfil en ambos extremos */}
          {[xL, xR].map((px, idx) => (
            <g key={idx}>
              <rect
                x={px - 2.6}
                y={yBar - 14}
                width={5.2}
                height={28}
                rx={1.8}
                fill={`url(#${plateGradId})`}
                stroke="var(--fig-prop)"
                strokeWidth={0.9}
              />
              <rect
                x={px + (idx === 0 ? -6.5 : 3.2)}
                y={yBar - 10.5}
                width={3.3}
                height={21}
                rx={1.2}
                fill="var(--accent)"
                opacity={0.85}
              />
            </g>
          ))}
        </g>
      );
    }
    const c = sk.hand;
    return (
      <g>
        <circle
          cx={c[0]}
          cy={c[1]}
          r={15.5}
          fill={`url(#${plateGradId})`}
          stroke="var(--fig-prop)"
          strokeWidth={1.2}
          opacity={0.94}
        />
        <circle
          cx={c[0]}
          cy={c[1]}
          r={12}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.1}
          opacity={0.7}
        />
        <circle
          cx={c[0]}
          cy={c[1]}
          r={6.5}
          fill="none"
          stroke="var(--fig-prop)"
          strokeWidth={0.7}
          opacity={0.55}
        />
        <circle cx={c[0]} cy={c[1]} r={2.8} fill="var(--fig-prop)" />
      </g>
    );
  }
  if (eq === 'mancuernas') {
    const db = (c: V, k: string) => (
      <g key={k}>
        <rect
          x={c[0] - 7}
          y={c[1] - 5.5}
          width={14}
          height={11}
          rx={3}
          fill={`url(#${plateGradId})`}
          stroke="var(--fig-prop)"
          strokeWidth={0.9}
        />
        <line
          x1={c[0] - 3}
          y1={c[1]}
          x2={c[0] + 3}
          y2={c[1]}
          stroke="var(--bg)"
          strokeWidth={1.8}
          strokeLinecap="round"
          opacity={0.65}
        />
      </g>
    );
    if (sk.view !== 'side') return <>{[db(sk.hand, 'r'), !unilateral && db(sk.hand2, 'l')]}</>;
    return db(sk.hand, 'n');
  }
  if (eq === 'kettlebell') {
    const c: V =
      sk.view === 'side'
        ? sk.hand
        : [(sk.hand[0] + sk.hand2[0]) / 2, (sk.hand[1] + sk.hand2[1]) / 2];
    return (
      <g>
        <path
          d={`M ${c[0] - 4.5} ${c[1] + 1} Q ${c[0]} ${c[1] - 6.5} ${c[0] + 4.5} ${c[1] + 1}`}
          fill="none"
          stroke="var(--fig-prop)"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <circle
          cx={c[0]}
          cy={c[1] + 8.5}
          r={8.2}
          fill={`url(#${plateGradId})`}
          stroke="var(--fig-prop)"
          strokeWidth={1}
        />
      </g>
    );
  }
  if ((eq === 'polea' || eq === 'maquina') && !def.anchorAtAnkle) {
    const hs = sk.view !== 'side' ? [sk.hand, sk.hand2] : [sk.hand];
    return (
      <g>
        {/* Barra de jalón o maneral que conecta ambas manos en vista frontal o espalda */}
        {sk.view !== 'side' && !unilateral && (
          <line
            x1={sk.hand2[0] - 4}
            y1={sk.hand2[1]}
            x2={sk.hand[0] + 4}
            y2={sk.hand[1]}
            stroke="var(--fig-prop)"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        )}
        {hs.map((h, i) => (
          <circle
            key={i}
            cx={h[0]}
            cy={h[1]}
            r={3.5}
            fill="var(--fig-prop)"
            stroke="var(--fig-line)"
            strokeWidth={0.6}
          />
        ))}
      </g>
    );
  }
  return null;
}
