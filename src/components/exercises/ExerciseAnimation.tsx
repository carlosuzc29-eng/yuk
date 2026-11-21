'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { Exercise } from '@/types/training';
import type { MuscleId } from '@/types/user';
import { PATTERNS, type Pad, type PatternDef } from '@/lib/exercises/poses';
import {
  add,
  buildFront,
  buildSide,
  capsulePath,
  lerpFront,
  lerpSide,
  limbFront,
  mul,
  muscleShapes,
  type MuscleShape,
  type Seg,
  type SegName,
  type Skeleton,
  type V,
} from '@/lib/exercises/rig';
import { cn } from '@/lib/utils/cn';

interface Props {
  exercise: Exercise;
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

function skeletonAt(def: PatternDef, t: number): Skeleton {
  return def.view === 'side' ? buildSide(lerpSide(def.a, def.b, t)) : buildFront(lerpFront(def.a, def.b, t));
}

/** Encuadre ajustado: recorre la animación y toma los límites del cuerpo, implementos y escenario. */
function computeViewBox(def: PatternDef, equipment: Exercise['equipment']): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const put = (p: V, r = 0) => {
    x0 = Math.min(x0, p[0] - r); y0 = Math.min(y0, p[1] - r);
    x1 = Math.max(x1, p[0] + r); y1 = Math.max(y1, p[1] + r);
  };
  const handR = equipment === 'barra' ? 16 : equipment === 'kettlebell' ? 17 : 8;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const sk = skeletonAt(def, t);
    Object.values(sk.segs).forEach((s) => { if (s) { put(s.a, s.wa / 2 + 1); put(s.b, s.wb / 2 + 1); } });
    put(sk.head, 11.5);
    put(sk.toe, 4); put(sk.toe2, 4);
    put(sk.hand, handR); put(sk.hand2, sk.view === 'front' ? handR : 4);
  }
  def.scene?.forEach((it) => {
    if (it.t === 'rect') { put([it.x, it.y]); put([it.x + it.w, it.y + it.h]); }
    else if (it.t === 'line') { put(it.a, it.w); put(it.b, it.w); }
    else put(it.c, it.r);
  });
  if (def.anchor && (equipment === 'polea' || equipment === 'banda')) put(def.anchor, 5);
  if (def.ground !== false) y1 = Math.max(y1, 184);
  const pad = 10;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  let w = x1 - x0;
  let h = y1 - y0;
  // Proporción estable entre 1:1 y 1,6:1 para que la figura no quede diminuta ni deformada.
  if (w / h < 1) { const nw = h; x0 -= (nw - w) / 2; w = nw; }
  if (w / h > 1.6) { const nh = w / 1.6; y0 -= nh - h; h = nh; }
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

function phaseAt(time: number, tm: Timing): { t: number; phase: 'holdA' | 'toB' | 'holdB' | 'toA' } {
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
  animate = true,
  staticT = 0.85,
  showControls = true,
  className,
  fill = false,
}: Props) {
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

  const sk = useMemo(() => skeletonAt(def, state.t), [def, state.t]);

  const phaseLabel =
    state.phase === 'toB' || state.phase === 'holdA'
      ? def.toB
      : def.toA;
  const isEccentricPhase =
    (state.phase === 'toB' && def.bIsEccentric) || (state.phase === 'toA' && !def.bIsEccentric);

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
        exercise={exercise}
        fill={fill}
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

// ───────────────────────── Dibujo ─────────────────────────

const SIDE_ORDER: { seg: SegName; layer: 'far' | 'near' }[] = [
  { seg: 'thigh2', layer: 'far' },
  { seg: 'shin2', layer: 'far' },
  { seg: 'upperArm2', layer: 'far' },
  { seg: 'forearm2', layer: 'far' },
];

function FigureSVG({
  def,
  sk,
  exercise,
  label,
  fill = false,
}: {
  def: PatternDef;
  sk: Skeleton;
  exercise: Exercise;
  label: string;
  fill?: boolean;
}) {
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
            fill="var(--amp-glow)"
            opacity={m.far ? 0.45 : 0.85}
          />
        ))}
      {muscles.prim
        .filter((m) => filter(m.key))
        .map((m) => (
          <ellipse
            key={m.key}
            cx={m.cx}
            cy={m.cy}
            rx={m.rx}
            ry={m.ry}
            transform={`rotate(${m.rot} ${m.cx} ${m.cy})`}
            fill="var(--accent)"
            opacity={m.far ? 0.5 : 0.95}
          />
        ))}
    </>
  );

  const limb = (name: SegName, far = false) => {
    const s = segOf(name);
    if (!s) return null;
    return (
      <path
        d={capsulePath(s)}
        fill={far ? 'var(--fig-far)' : 'var(--fig)'}
        stroke="var(--fig-line)"
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
    );
  };

  const foot = (a: V, b: V, far = false) => (
    <line
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke={far ? 'var(--fig-far)' : 'var(--fig)'}
      strokeWidth={5.5}
      strokeLinecap="round"
    />
  );

  const isSide = sk.view === 'side';
  const ground = def.ground !== false;
  const vb = useMemo(() => computeViewBox(def, exercise.equipment), [def, exercise.equipment]);
  const unilateral = Boolean(exercise.unilateral);

  return (
    <svg viewBox={vb.map((n) => n.toFixed(1)).join(' ')} role="img" aria-label={label} className={fill ? 'block w-full h-full select-none' : 'w-full h-auto select-none'}>
      {/* Suelo */}
      {ground && (
        <>
          <line x1={vb[0]} y1={182} x2={vb[0] + vb[2]} y2={182} stroke="var(--fig-scene)" strokeWidth={1.5} />
          <ellipse cx={(sk.ankle[0] + sk.ankle2[0]) / 2} cy={183} rx={30} ry={2.5} fill="var(--fig-line)" opacity={0.18} />
        </>
      )}

      {/* Escenario */}
      {def.scene?.map((it, i) =>
        it.t === 'rect' ? (
          <rect key={i} x={it.x} y={it.y} width={it.w} height={it.h} rx={it.r ?? 2} fill="var(--fig-scene)" stroke="var(--fig-line)" strokeWidth={0.6} />
        ) : it.t === 'line' ? (
          <line key={i} x1={it.a[0]} y1={it.a[1]} x2={it.b[0]} y2={it.b[1]} stroke="var(--fig-prop)" strokeWidth={it.w} strokeLinecap="round" opacity={0.75} />
        ) : (
          <circle key={i} cx={it.c[0]} cy={it.c[1]} r={it.r} fill="var(--fig-scene)" />
        )
      )}

      {/* Almohadillas dinámicas */}
      {def.pads?.map((p) => <PadShape key={p} pad={p} sk={sk} />)}

      {/* Cable o banda */}
      <Connector def={def} sk={sk} exercise={exercise} />

      {isSide ? (
        <>
          {/* Extremidades lejanas */}
          {SIDE_ORDER.map(({ seg }) => (
            <React.Fragment key={seg}>{limb(seg, true)}</React.Fragment>
          ))}
          {foot(sk.ankle2, sk.toe2, true)}
          {musclesFor((k) => k.endsWith('2'))}

          {/* Torso, cuello y cabeza */}
          <line x1={sk.neck[0][0]} y1={sk.neck[0][1]} x2={sk.neck[1][0]} y2={sk.neck[1][1]} stroke="var(--fig)" strokeWidth={8} strokeLinecap="round" />
          <path d={sk.torsoPath} fill="var(--fig)" stroke="var(--fig-line)" strokeWidth={0.8} />
          {musclesFor((k) => k.endsWith('-t'))}
          <circle cx={sk.head[0]} cy={sk.head[1]} r={10} fill="var(--fig)" stroke="var(--fig-line)" strokeWidth={0.8} />
          <FaceHint sk={sk} />

          {/* Pierna cercana */}
          {limb('thigh')}
          {limb('shin')}
          {foot(sk.ankle, sk.toe)}
          {musclesFor((k) => k.endsWith('-thigh') || k.endsWith('-shin'))}

          {/* Brazo cercano */}
          {limb('upperArm')}
          {limb('forearm')}
          {musclesFor((k) => k.endsWith('-upperArm') || k.endsWith('-forearm'))}
        </>
      ) : (
        <>
          {limb('thigh2')}
          {limb('shin2')}
          {limb('thigh')}
          {limb('shin')}
          {foot(sk.ankle, sk.toe)}
          {foot(sk.ankle2, sk.toe2)}
          <line x1={sk.neck[0][0]} y1={sk.neck[0][1]} x2={sk.neck[1][0]} y2={sk.neck[1][1]} stroke="var(--fig)" strokeWidth={9} strokeLinecap="round" />
          <path d={sk.torsoPath} fill="var(--fig)" stroke="var(--fig-line)" strokeWidth={0.8} />
          <circle cx={sk.head[0]} cy={sk.head[1]} r={10.5} fill="var(--fig)" stroke="var(--fig-line)" strokeWidth={0.8} />
          {limb('upperArm2')}
          {limb('forearm2')}
          {limb('upperArm')}
          {limb('forearm')}
          {musclesFor(() => true)}
        </>
      )}

      {/* Implementos en las manos */}
      <HandProps def={def} sk={sk} exercise={exercise} unilateral={unilateral} />
    </svg>
  );
}

function FaceHint({ sk }: { sk: Skeleton }) {
  // Pequeña marca de la cara: indica hacia dónde mira la figura.
  const d: V = [sk.head[0] - sk.neck[0][0], sk.head[1] - sk.neck[0][1]];
  const l = Math.hypot(d[0], d[1]) || 1;
  const u: V = [d[0] / l, d[1] / l];
  const front: V = [-u[1], u[0]];
  const nose = add(add(sk.head, mul(front, 9)), mul(u, -1));
  return <circle cx={nose[0]} cy={nose[1]} r={1.6} fill="var(--fig-line)" />;
}

function PadShape({ pad, sk }: { pad: Pad; sk: Skeleton }) {
  const torso = sk.segs.torso;
  const shin = sk.segs.shin;
  const thigh = sk.segs.thigh;
  const pill = (a: V, b: V, w: number) => (
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--fig-scene)" strokeWidth={w} strokeLinecap="round" />
  );
  const roller = (c: V, r = 5.5) => (
    <circle cx={c[0]} cy={c[1]} r={r} fill="var(--fig-scene)" stroke="var(--fig-line)" strokeWidth={0.6} />
  );
  switch (pad) {
    case 'backpad': {
      if (!torso) return null;
      const off = mul(sk.torsoFront, -15);
      return pill(add(add(sk.hip, off), mul(sk.torsoFront, 0)), add(add(sk.shoulder, off), [0, 0]), 9);
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

function Connector({ def, sk, exercise }: { def: PatternDef; sk: Skeleton; exercise: Exercise }) {
  const eq = exercise.equipment;
  if (eq !== 'polea' && eq !== 'banda') return null;
  const end = def.anchorAtAnkle ? sk.ankle : sk.hand;
  let anchor: V | undefined = def.anchor;
  if (sk.view === 'front') anchor = def.anchorAtAnkle || exercise.pattern === 'hip_abduction' ? [28, 178] : [40, 182];
  if (!anchor && eq === 'banda') anchor = add(sk.toe, [-4, 0]);
  if (!anchor) return null;
  if (eq === 'banda') {
    const mid: V = [(anchor[0] + end[0]) / 2 - 4, (anchor[1] + end[1]) / 2];
    return (
      <path
        d={`M ${anchor[0]} ${anchor[1]} Q ${mid[0]} ${mid[1]} ${end[0]} ${end[1]}`}
        fill="none"
        stroke="var(--fig-band)"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    );
  }
  return (
    <g>
      <line x1={anchor[0]} y1={anchor[1]} x2={end[0]} y2={end[1]} stroke="var(--fig-prop)" strokeWidth={1.1} opacity={0.8} />
      <circle cx={anchor[0]} cy={anchor[1]} r={4} fill="var(--fig-scene)" stroke="var(--fig-prop)" strokeWidth={1.2} />
    </g>
  );
}

function HandProps({
  def,
  sk,
  exercise,
  unilateral,
}: {
  def: PatternDef;
  sk: Skeleton;
  exercise: Exercise;
  unilateral: boolean;
}) {
  const eq = exercise.equipment;
  const p = exercise.pattern;
  if (p === 'ab_wheel') {
    return <circle cx={sk.hand[0]} cy={sk.hand[1] + 1} r={7} fill="none" stroke="var(--fig-prop)" strokeWidth={2.5} />;
  }
  if (eq === 'barra') {
    // Barra vista de frente: el disco tapa la mano.
    const c = sk.hand;
    return (
      <g>
        <circle cx={c[0]} cy={c[1]} r={15} fill="var(--fig-plate)" stroke="var(--fig-prop)" strokeWidth={1.2} opacity={0.92} />
        <circle cx={c[0]} cy={c[1]} r={10} fill="none" stroke="var(--fig-prop)" strokeWidth={0.6} opacity={0.5} />
        <circle cx={c[0]} cy={c[1]} r={2.6} fill="var(--fig-prop)" />
      </g>
    );
  }
  if (eq === 'mancuernas') {
    const db = (c: V, k: string) => (
      <g key={k}>
        <rect x={c[0] - 6.5} y={c[1] - 6.5} width={13} height={13} rx={3} fill="var(--fig-prop)" />
        <rect x={c[0] - 4} y={c[1] - 4} width={8} height={8} rx={2} fill="var(--fig-plate)" opacity={0.35} />
      </g>
    );
    if (sk.view === 'front') return <>{[db(sk.hand, 'r'), !unilateral && db(sk.hand2, 'l')]}</>;
    return db(sk.hand, 'n');
  }
  if (eq === 'kettlebell') {
    const c = sk.hand;
    return (
      <g>
        <path d={`M ${c[0] - 4} ${c[1]} Q ${c[0]} ${c[1] - 6} ${c[0] + 4} ${c[1]}`} fill="none" stroke="var(--fig-prop)" strokeWidth={2} />
        <circle cx={c[0]} cy={c[1] + 8} r={8} fill="var(--fig-prop)" />
      </g>
    );
  }
  if ((eq === 'polea' || eq === 'maquina') && !def.anchorAtAnkle) {
    const hs = sk.view === 'front' ? [sk.hand, sk.hand2] : [sk.hand];
    return (
      <>
        {hs.map((h, i) => (
          <circle key={i} cx={h[0]} cy={h[1]} r={3.2} fill="var(--fig-prop)" />
        ))}
      </>
    );
  }
  return null;
}
