'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Pause, Play } from 'lucide-react';
import type { Exercise } from '@/types/training';
import type { MuscleId, Sex } from '@/types/user';
import { useAuth } from '@/components/providers/AuthProvider';

/**
 * El visor 3D (three.js, ~230 KB) sólo se descarga cuando se muestra una demo interactiva
 * (detalle de ejercicio, modo entrenamiento). Las miniaturas usan el SVG y no lo necesitan.
 */
const Exercise3DViewer = dynamic(() => import('./Exercise3DViewer').then((m) => m.Exercise3DViewer), {
  ssr: false,
  loading: () => <StagePlaceholder />,
});

function StagePlaceholder() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando demostración 3D">
      <div
        className="relative aspect-[4/3] w-full rounded-[8px] border border-[var(--border)] overflow-hidden"
        style={{ background: 'var(--stage-bg)' }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="h-6 w-6 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
        </div>
      </div>
      <div className="h-9" />
    </div>
  );
}
import { PATTERNS, type Pad, type PatternDef } from '@/lib/exercises/poses';
import {
  add,
  anatomicalLimbPath,
  buildFront,
  buildSide,
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
}

const ease = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2;

function skeletonAt(def: PatternDef, t: number, sex: Sex): Skeleton {
  return def.view === 'side'
    ? buildSide(lerpSide(def.a, def.b, t), sex)
    : buildFront(lerpFront(def.a, def.b, t), sex);
}

/** Encuadre ajustado: recorre la animación y toma los límites del cuerpo, implementos y escenario. */
function computeViewBox(
  def: PatternDef,
  equipment: Exercise['equipment'],
  sex: Sex
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
  const handR = equipment === 'barra' ? 16 : equipment === 'kettlebell' ? 17 : 8;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const sk = skeletonAt(def, t, sex);
    Object.values(sk.segs).forEach((s) => {
      if (s) {
        put(s.a, s.wa / 2 + 1.5);
        put(s.b, s.wb / 2 + 1.5);
      }
    });
    put(sk.head, 12);
    put(sk.toe, 5);
    put(sk.toe2, 5);
    put(sk.hand, handR);
    put(sk.hand2, sk.view === 'front' ? handR : 4);
  }
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
  if (def.anchor && (equipment === 'polea' || equipment === 'banda')) put(def.anchor, 5);
  if (def.ground !== false) y1 = Math.max(y1, 185);
  const pad = 10;
  x0 -= pad;
  y0 -= pad;
  x1 += pad;
  y1 += pad;
  let w = x1 - x0;
  let h = y1 - y0;
  if (w / h < 1) {
    const nw = h;
    x0 -= (nw - w) / 2;
    w = nw;
  }
  if (w / h > 1.6) {
    const nh = w / 1.6;
    y0 -= nh - h;
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
}: Props) {
  const { profile } = useAuth();
  const sex: Sex = sexProp ?? profile?.sex ?? 'male';
  const [webglFailed, setWebglFailed] = useState(false);
  // Estable entre renders: si cambiara, el visor 3D reconstruiría toda la escena.
  const onWebGLFailed = useCallback(() => setWebglFailed(true), []);

  // En vistas interactivas (detalle, modo entrenamiento) usamos el motor 3D realista con máquinas y cámara 360°.
  // En miniaturas (`fill` o `animate={false}`) usamos el SVG anatómico ultrarrápido para no saturar contextos WebGL.
  const use3D = showControls && animate && !fill && !webglFailed && !exercise.videoUrl;
  if (use3D) {
    return (
      <Exercise3DViewer
        exercise={exercise}
        sex={sex}
        animate={animate}
        showControls={showControls}
        className={className}
        onWebGLFailed={onWebGLFailed}
      />
    );
  }

  return (
    <ExerciseAnimation2D
      exercise={exercise}
      sex={sex}
      animate={animate}
      staticT={staticT}
      showControls={showControls}
      className={className}
      fill={fill}
    />
  );
}

function ExerciseAnimation2D({
  exercise,
  sex,
  animate = true,
  staticT = 0.85,
  showControls = true,
  className,
  fill = false,
}: Omit<Props, 'sex'> & { sex: Sex }) {

  const def = PATTERNS[exercise.pattern];
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

  const sk = useMemo(() => skeletonAt(def, state.t, sex), [def, state.t, sex]);

  // Estela de trayectoria de la mano/barra para visualizar la técnica
  const trailPath = useMemo(() => {
    if (!showControls || !animate) return null;
    const pts: V[] = [];
    for (let i = 0; i <= 12; i++) {
      const s = skeletonAt(def, i / 12, sex);
      pts.push(def.anchorAtAnkle ? s.ankle : s.hand);
    }
    const dist = Math.hypot(
      pts[pts.length - 1][0] - pts[0][0],
      pts[pts.length - 1][1] - pts[0][1]
    );
    if (dist < 6) return null;
    return pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(' ');
  }, [def, sex, showControls, animate]);

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
      <FigureSVG
        def={def}
        sk={sk}
        sex={sex}
        exercise={exercise}
        fill={fill}
        trailPath={trailPath}
        concentricPulse={isConcentric}
        label={`Demostración animada: ${exercise.name}`}
      />
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

// ───────────────────────── Dibujo Anatómico 3D ─────────────────────────

const SIDE_FAR_ORDER: { seg: SegName; kind: LimbKind }[] = [
  { seg: 'thigh2', kind: 'thigh' },
  { seg: 'shin2', kind: 'shin' },
  { seg: 'upperArm2', kind: 'upperArm' },
  { seg: 'forearm2', kind: 'forearm' },
];

function FigureSVG({
  def,
  sk,
  sex,
  exercise,
  label,
  fill = false,
  trailPath = null,
  concentricPulse = false,
}: {
  def: PatternDef;
  sk: Skeleton;
  sex: Sex;
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
  const primOpacity = concentricPulse ? 0.96 : 0.78;
  const secOpacity = concentricPulse ? 0.72 : 0.52;

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

  const foot = (a: V, b: V, far = false) => (
    <path
      d={footPath(a, b)}
      fill={far ? `url(#${uid}-shoe-far)` : `url(#${uid}-shoe)`}
      stroke="var(--fig-line)"
      strokeWidth={0.7}
      strokeLinejoin="round"
    />
  );

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
  const ground = def.ground !== false;
  const vb = useMemo(() => computeViewBox(def, exercise.equipment, sex), [def, exercise.equipment, sex]);
  const unilateral = Boolean(exercise.unilateral);

  return (
    <svg
      viewBox={vb.map((n) => n.toFixed(1)).join(' ')}
      role="img"
      aria-label={label}
      className={fill ? 'block w-full h-full select-none' : 'w-full h-auto select-none'}
    >
      <defs>
        {/* Iluminación escultórica 3D estilo ZBrush Clay para cuerpo cercano */}
        <linearGradient id={`${uid}-near`} x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#e8ebf0" stopOpacity="1" />
          <stop offset="52%" stopColor="var(--fig)" stopOpacity="0.96" />
          <stop offset="100%" stopColor="var(--fig-far)" stopOpacity="0.98" />
        </linearGradient>

        {/* Profundidad para extremidades lejanas */}
        <linearGradient id={`${uid}-far`} x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="var(--fig)" stopOpacity="0.88" />
          <stop offset="100%" stopColor="var(--fig-far)" stopOpacity="0.72" />
        </linearGradient>

        {/* Torso con relieve de luz cenital */}
        <linearGradient id={`${uid}-torso`} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#eef1f6" stopOpacity="1" />
          <stop offset="50%" stopColor="var(--fig)" stopOpacity="0.97" />
          <stop offset="100%" stopColor="var(--fig-far)" stopOpacity="0.92" />
        </linearGradient>

        {/* Calzado deportivo */}
        <linearGradient id={`${uid}-shoe`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--fig-prop)" stopOpacity="0.72" />
          <stop offset="100%" stopColor="var(--fig-line)" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={`${uid}-shoe-far`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--fig-far)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--fig-line)" stopOpacity="0.6" />
        </linearGradient>

        {/* Mapa de calor muscular con gradiente radial suave */}
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

        {/* Resplandor muscular sutil */}
        <filter id={`${uid}-mglow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Disco olímpico metálico */}
        <radialGradient id={`${uid}-plate`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="var(--fig-prop)" stopOpacity="0.95" />
          <stop offset="65%" stopColor="var(--fig-plate)" stopOpacity="0.96" />
          <stop offset="100%" stopColor="var(--fig-line)" stopOpacity="1" />
        </radialGradient>
      </defs>

      {/* Suelo y sombra de contacto */}
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
          opacity={0.35}
        />
      )}

      {/* Escenario (bancos, racks, asientos) */}
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
              strokeWidth={0.7}
            />
            {/* Brillo superior del tapizado */}
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

      {/* Almohadillas dinámicas */}
      {def.pads?.map((p) => (
        <PadShape key={p} pad={p} sk={sk} />
      ))}

      {/* Cable o banda elástica */}
      <Connector def={def} sk={sk} exercise={exercise} />

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
          {limb('thigh2', 'thigh')}
          {limb('shin2', 'shin')}
          {limb('thigh', 'thigh')}
          {limb('shin', 'shin')}
          {foot(sk.ankle, sk.toe)}
          {foot(sk.ankle2, sk.toe2)}
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
          {/* Cabeza frontal esculpida (óvalo facial + mandíbula) */}
          <ellipse
            cx={sk.head[0]}
            cy={sk.head[1]}
            rx={sex === 'female' ? 9.2 : 10}
            ry={11}
            fill={`url(#${uid}-near)`}
            stroke="var(--fig-line)"
            strokeWidth={0.8}
          />
          {limb('upperArm2', 'upperArm')}
          {limb('forearm2', 'forearm')}
          {limb('upperArm', 'upperArm')}
          {limb('forearm', 'forearm')}
          {handFist(sk.hand2)}
          {handFist(sk.hand)}
          {musclesFor(() => true)}
        </>
      )}

      {/* Implementos en las manos */}
      <HandProps
        def={def}
        sk={sk}
        exercise={exercise}
        unilateral={unilateral}
        plateGradId={`${uid}-plate`}
      />
    </svg>
  );
}

function PadShape({ pad, sk }: { pad: Pad; sk: Skeleton }) {
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
  const end = def.anchorAtAnkle ? sk.ankle : sk.hand;
  let anchor: V | undefined = def.anchor;
  if (sk.view === 'front')
    anchor = def.anchorAtAnkle || exercise.pattern === 'hip_abduction' ? [28, 178] : [40, 182];
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
        strokeWidth={1.2}
        opacity={0.85}
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
    return (
      <g>
        <circle
          cx={sk.hand[0]}
          cy={sk.hand[1] + 1}
          r={7.5}
          fill="var(--fig-scene)"
          stroke="var(--fig-prop)"
          strokeWidth={2.6}
        />
        <circle cx={sk.hand[0]} cy={sk.hand[1] + 1} r={2} fill="var(--accent)" />
      </g>
    );
  }
  if (eq === 'barra') {
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
          y={c[1] - 6}
          width={14}
          height={12}
          rx={3.5}
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
    if (sk.view === 'front') return <>{[db(sk.hand, 'r'), !unilateral && db(sk.hand2, 'l')]}</>;
    return db(sk.hand, 'n');
  }
  if (eq === 'kettlebell') {
    const c = sk.hand;
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
    const hs = sk.view === 'front' ? [sk.hand, sk.hand2] : [sk.hand];
    return (
      <>
        {hs.map((h, i) => (
          <g key={i}>
            <circle
              cx={h[0]}
              cy={h[1]}
              r={3.5}
              fill="var(--fig-prop)"
              stroke="var(--fig-line)"
              strokeWidth={0.6}
            />
          </g>
        ))}
      </>
    );
  }
  return null;
}
