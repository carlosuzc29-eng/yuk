'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Flame,
  Info,
  Minus,
  Plus,
  Repeat,
  Timer,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTraining } from '@/components/providers/TrainingProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { ExerciseAnimation } from '@/components/exercises/ExerciseAnimation';
import { BeginnerTip, ExerciseDetail } from '@/components/exercises/ExerciseDetail';
import { ExercisePicker } from '@/components/exercises/ExercisePicker';
import { getExercise } from '@/lib/exercises/catalog';
import { allowedEquipmentFor, prescribe } from '@/lib/training/generator';
import {
  completedSetCount,
  formatDuration,
  lastLogFor,
  newRecordsIn,
  suggestNext,
  warmupSets,
  workoutVolume,
} from '@/lib/training/progression';
import { createEmptyWorkout, createWorkoutFromDay } from '@/lib/training/session';
import type { Exercise, Workout, WorkoutExerciseLog, WorkoutSet } from '@/types/training';
import { MUSCLE_LABELS, type InjuryType } from '@/types/user';
import { cn } from '@/lib/utils/cn';

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio no disponible
  }
}

export default function EntrenarPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { active, routine, workouts, nextDay, startWorkout, updateActive, discardActive, finishWorkout, loading } =
    useTraining();

  const [openIdx, setOpenIdx] = useState(0);
  const [rest, setRest] = useState<{ endAt: number; total: number } | null>(null);
  const [sheet, setSheet] = useState<
    { kind: 'none' } | { kind: 'detail'; ex: Exercise } | { kind: 'swap'; uid: string } | { kind: 'add' } | { kind: 'finish' }
  >({ kind: 'none' });
  const restDoneRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const now = useNow(Boolean(active));
  const elapsed = active ? (now - new Date(active.startedAt).getTime()) / 1000 : 0;
  const restLeft = rest ? (rest.endAt - now) / 1000 : 0;

  useEffect(() => {
    if (!rest) return;
    if (restLeft <= 0 && !restDoneRef.current) {
      restDoneRef.current = true;
      if ('vibrate' in navigator) navigator.vibrate?.([180, 80, 180]);
      beep();
      window.setTimeout(() => setRest(null), 2500);
    }
  }, [rest, restLeft]);

  const injuries: InjuryType[] = profile?.injuries.filter((i) => i !== 'ninguna') ?? [];
  const isBeginner = profile?.experience === 'principiante';

  const patch = useCallback(
    (fn: (w: Workout) => Workout) => {
      if (!active) return;
      updateActive(fn(active));
    },
    [active, updateActive]
  );

  const patchLog = (uid: string, fn: (l: WorkoutExerciseLog) => WorkoutExerciseLog) =>
    patch((w) => ({ ...w, exercises: w.exercises.map((l) => (l.uid === uid ? fn(l) : l)) }));

  const patchSet = (uid: string, i: number, fn: (s: WorkoutSet) => WorkoutSet) =>
    patchLog(uid, (l) => ({ ...l, sets: l.sets.map((s, j) => (j === i ? fn(s) : s)) }));

  const toggleDone = (log: WorkoutExerciseLog, i: number) => {
    const s = log.sets[i];
    const ex = getExercise(log.exerciseId);
    const willBeDone = !s.done;
    patchSet(log.uid, i, (x) => ({
      ...x,
      done: willBeDone,
      // Si no escribió reps, asumimos el mínimo objetivo al marcar.
      reps: willBeDone && x.reps == null && !ex?.timed ? log.target.repMin : x.reps,
      seconds: willBeDone && ex?.timed && x.seconds == null ? log.target.repMin : x.seconds,
    }));
    if (willBeDone) {
      restDoneRef.current = false;
      setRest({ endAt: Date.now() + (s.warmup ? 60 : log.target.restSec) * 1000, total: s.warmup ? 60 : log.target.restSec });
      const remaining = log.sets.filter((x, j) => j !== i && !x.done).length;
      if (remaining === 0) {
        const idx = active!.exercises.findIndex((l) => l.uid === log.uid);
        setOpenIdx(Math.min(idx + 1, active!.exercises.length - 1));
      }
    }
  };

  const totalSets = active?.exercises.reduce((a, l) => a + l.sets.filter((s) => !s.warmup).length, 0) ?? 0;
  const doneSets = active ? completedSetCount(active) : 0;

  if (authLoading || loading) return null;

  // ───────── Sin sesión activa: elegir qué entrenar ─────────
  if (!active) {
    return (
      <div className="min-h-dvh max-w-lg mx-auto px-5 py-8 space-y-6">
        <Link href="/hoy" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div>
          <h1 className="font-display text-[36px]">¿Qué entrenas hoy?</h1>
          <span className="accent-rule mt-4" aria-hidden="true" />
        </div>
        {routine?.days.map((d) => (
          <Card key={d.id} featured={d.id === nextDay?.id} className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[17px] font-medium">{d.name}</p>
              {d.id === nextDay?.id && (
                <span className="rounded-[8px] bg-[var(--accent)] text-white text-xs font-medium px-2.5 py-1">Toca hoy</span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {d.exercises.length} ejercicios · {d.focus.slice(0, 4).map((m) => MUSCLE_LABELS[m]).join(', ')}
            </p>
            <Button
              fullWidth
              variant={d.id === nextDay?.id ? 'primary' : 'secondary'}
              onClick={() => startWorkout(createWorkoutFromDay(routine, d, workouts))}
            >
              Empezar
            </Button>
          </Card>
        ))}
        <Button variant="ghost" fullWidth onClick={() => startWorkout(createEmptyWorkout())}>
          Entrenamiento libre (sin rutina)
        </Button>
      </div>
    );
  }

  const handleDiscard = () => {
    if (window.confirm('¿Descartar este entrenamiento? No se guardará nada.')) {
      discardActive();
      router.push('/hoy');
    }
  };

  return (
    <div className="min-h-dvh max-w-lg mx-auto flex flex-col">
      {/* Cabecera fija */}
      <header className="sticky top-0 z-30 bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--border)] px-5 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Entrenando</p>
            <h1 className="text-[20px] font-light tracking-[-0.02em] truncate">{active.name}</h1>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-[26px] tabular-nums leading-none">{mmss(elapsed)}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 tabular-nums">
              {doneSets}/{totalSets} series
            </p>
          </div>
        </div>
        <div className="mt-3 h-[2px] rounded-full bg-[var(--border)] overflow-hidden" role="progressbar" aria-valuenow={doneSets} aria-valuemax={totalSets} aria-label="Series completadas">
          <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>
      </header>

      <main className="flex-1 px-5 pt-5 pb-40 space-y-3">
        {active.exercises.map((log, idx) => {
          const ex = getExercise(log.exerciseId);
          if (!ex) return null;
          return (
            <ExerciseLogCard
              key={log.uid}
              log={log}
              exercise={ex}
              open={openIdx === idx}
              isFirst={idx === 0}
              onToggle={() => setOpenIdx(openIdx === idx ? -1 : idx)}
              history={workouts}
              isBeginner={isBeginner}
              onSet={(i, fn) => patchSet(log.uid, i, fn)}
              onDone={(i) => toggleDone(log, i)}
              onAddSet={() =>
                patchLog(log.uid, (l) => ({
                  ...l,
                  sets: [...l.sets, { ...(l.sets[l.sets.length - 1] ?? { weightKg: null, reps: null }), done: false, warmup: false }],
                }))
              }
              onRemoveSet={(i) => patchLog(log.uid, (l) => ({ ...l, sets: l.sets.filter((_, j) => j !== i) }))}
              onAddWarmups={(ws) =>
                patchLog(log.uid, (l) => ({
                  ...l,
                  sets: [...ws.map((w) => ({ weightKg: w.weightKg, reps: w.reps, done: false, warmup: true })), ...l.sets.filter((s) => !s.warmup)],
                }))
              }
              onDetail={() => setSheet({ kind: 'detail', ex })}
              onSwap={() => setSheet({ kind: 'swap', uid: log.uid })}
              onRemove={() => {
                if (window.confirm(`¿Quitar ${ex.name} de esta sesión?`))
                  patch((w) => ({ ...w, exercises: w.exercises.filter((l) => l.uid !== log.uid) }));
              }}
            />
          );
        })}

        <Button variant="secondary" fullWidth onClick={() => setSheet({ kind: 'add' })}>
          <Plus className="h-4 w-4" /> Añadir ejercicio
        </Button>

        <div className="pt-4 space-y-2">
          <Button size="lg" fullWidth onClick={() => setSheet({ kind: 'finish' })} disabled={doneSets === 0}>
            Terminar entrenamiento
          </Button>
          <Button variant="ghost" fullWidth onClick={handleDiscard}>
            <Trash2 className="h-4 w-4" /> Descartar
          </Button>
        </div>
      </main>

      {/* Temporizador de descanso */}
      {rest && (
        <div className="fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-lg mx-auto m-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-4">
            <div className="flex items-center gap-3">
              <Timer className="h-5 w-5 text-[var(--text-muted)] shrink-0" strokeWidth={1.6} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-muted)]" aria-live="polite">
                  {restLeft > 0 ? 'Descanso' : '¡A por la siguiente serie!'}
                </p>
                <p className="font-display text-[30px] tabular-nums leading-none mt-0.5">{mmss(restLeft)}</p>
              </div>
              <button type="button" onClick={() => setRest((r) => (r ? { ...r, endAt: r.endAt - 15000 } : r))} className="h-10 px-3 rounded-[24px] border border-[var(--border)] text-xs font-medium cursor-pointer" aria-label="Restar 15 segundos">
                −15
              </button>
              <button type="button" onClick={() => { restDoneRef.current = false; setRest((r) => (r ? { endAt: r.endAt + 15000, total: r.total + 15 } : r)); }} className="h-10 px-3 rounded-[24px] border border-[var(--border)] text-xs font-medium cursor-pointer" aria-label="Sumar 15 segundos">
                +15
              </button>
              <button type="button" onClick={() => setRest(null)} className="h-10 px-3.5 rounded-[24px] bg-[var(--text)] text-[var(--bg)] text-xs font-medium cursor-pointer">
                Saltar
              </button>
            </div>
            <div className="mt-3 h-[3px] rounded-full bg-[var(--border)] overflow-hidden">
              <div className="h-full bg-[var(--accent)] transition-[width] duration-1000 ease-linear" style={{ width: `${Math.max(0, Math.min(100, (restLeft / rest.total) * 100))}%` }} />
            </div>
          </div>
        </div>
      )}

      <Sheet open={sheet.kind === 'detail'} onClose={() => setSheet({ kind: 'none' })} title={sheet.kind === 'detail' ? sheet.ex.name : ''}>
        {sheet.kind === 'detail' && <ExerciseDetail exercise={sheet.ex} sex={profile?.sex} injuries={injuries} />}
      </Sheet>

      <Sheet open={sheet.kind === 'swap' || sheet.kind === 'add'} onClose={() => setSheet({ kind: 'none' })} title={sheet.kind === 'add' ? 'Añadir ejercicio' : 'Cambiar ejercicio'}>
        {(sheet.kind === 'swap' || sheet.kind === 'add') && profile && (
          <ExercisePicker
            initialMuscle={
              sheet.kind === 'swap'
                ? getExercise(active.exercises.find((l) => l.uid === sheet.uid)?.exerciseId ?? '')?.primary[0] ?? null
                : null
            }
            allowedEquipment={allowedEquipmentFor(profile.equipment)}
            injuries={injuries}
            excludeIds={active.exercises.map((l) => l.exerciseId)}
            onPick={(ex) => {
              const p = prescribe(profile.goal, profile.experience, ex, false);
              const sug = suggestNext(ex, p, lastLogFor(ex.id, workouts));
              if (sheet.kind === 'swap') {
                patchLog(sheet.uid, (l) => ({
                  ...l,
                  exerciseId: ex.id,
                  target: { ...l.target, repMin: p.repMin, repMax: p.repMax },
                  sets: l.sets.filter((s) => !s.warmup).map(() => ({ weightKg: sug.weightKg, reps: null, done: false })),
                }));
              } else {
                patch((w) => ({
                  ...w,
                  exercises: [
                    ...w.exercises,
                    {
                      uid: `${ex.id}_${Date.now().toString(36)}`,
                      exerciseId: ex.id,
                      target: { sets: p.sets, repMin: p.repMin, repMax: p.repMax, restSec: p.restSec, rir: p.rir },
                      sets: Array.from({ length: p.sets }, () => ({ weightKg: sug.weightKg, reps: null, done: false })),
                    },
                  ],
                }));
                setOpenIdx(active.exercises.length);
              }
              setSheet({ kind: 'none' });
            }}
          />
        )}
      </Sheet>

      <Sheet open={sheet.kind === 'finish'} onClose={() => setSheet({ kind: 'none' })} title="Resumen del entrenamiento">
        {sheet.kind === 'finish' && (
          <FinishSummary
            workout={active}
            history={workouts}
            elapsed={elapsed}
            onSave={async (feeling, notes) => {
              const completedAt = new Date().toISOString();
              const cleaned: Workout = {
                ...active,
                exercises: active.exercises
                  .map((l) => ({ ...l, sets: l.sets.filter((s) => s.done) }))
                  .filter((l) => l.sets.length),
                status: 'completed',
                completedAt,
                durationSeconds: Math.round(elapsed),
                totalVolumeKg: workoutVolume(active),
                feeling,
                notes: notes.trim() || null,
              };
              await finishWorkout(cleaned);
              setSheet({ kind: 'none' });
              router.push('/progreso');
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function ExerciseLogCard({
  log,
  exercise: ex,
  open,
  isFirst,
  onToggle,
  history,
  isBeginner,
  onSet,
  onDone,
  onAddSet,
  onRemoveSet,
  onAddWarmups,
  onDetail,
  onSwap,
  onRemove,
}: {
  log: WorkoutExerciseLog;
  exercise: Exercise;
  open: boolean;
  isFirst: boolean;
  onToggle: () => void;
  history: Workout[];
  isBeginner: boolean;
  onSet: (i: number, fn: (s: WorkoutSet) => WorkoutSet) => void;
  onDone: (i: number) => void;
  onAddSet: () => void;
  onRemoveSet: (i: number) => void;
  onAddWarmups: (ws: { weightKg: number; reps: number }[]) => void;
  onDetail: () => void;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const [showDemo, setShowDemo] = useState(true);
  const last = useMemo(() => lastLogFor(ex.id, history), [ex.id, history]);
  const sug = useMemo(() => suggestNext(ex, log.target, last), [ex, log.target, last]);
  const working = log.sets.filter((s) => !s.warmup);
  const done = working.filter((s) => s.done).length;
  const allDone = working.length > 0 && done === working.length;
  const lastWorking = last?.sets.filter((s) => !s.warmup) ?? [];
  const hasWarmups = log.sets.some((s) => s.warmup);
  const warmups = isFirst && !hasWarmups ? warmupSets(ex, sug.weightKg) : [];
  const unit = ex.timed ? 's' : 'reps';
  let workIdx = 0;

  return (
    <Card className={cn('p-0 overflow-hidden', allDone && !open && 'opacity-70')}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 p-4 text-left cursor-pointer">
        <span
          className={cn(
            'h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs tabular-nums border',
            allDone ? 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]' : 'border-[var(--border)] text-[var(--text-secondary)]'
          )}
        >
          {allDone ? <Check className="h-4 w-4" /> : `${done}/${working.length}`}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-medium leading-snug">{ex.name}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {log.target.sets} × {log.target.repMin}–{log.target.repMax} {unit} · RIR {log.target.rir} · {log.target.restSec} s
          </p>
        </div>
        <ChevronDown className={cn('h-5 w-5 text-[var(--ash)] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {showDemo && (
            <div className="rounded-[8px] bg-[var(--surface-elevated)] p-2">
              <ExerciseAnimation exercise={ex} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <SmallBtn onClick={() => setShowDemo((v) => !v)}>
              {showDemo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showDemo ? 'Ocultar demo' : 'Ver demo'}
            </SmallBtn>
            <SmallBtn onClick={onDetail}>
              <Info className="h-3.5 w-3.5" /> Técnica
            </SmallBtn>
            <SmallBtn onClick={onSwap}>
              <Repeat className="h-3.5 w-3.5" /> Cambiar
            </SmallBtn>
            <SmallBtn onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" /> Quitar
            </SmallBtn>
          </div>

          {(isBeginner || !last) && <BeginnerTip exercise={ex} compact />}

          <div className="rounded-[5px] border border-[var(--border)] p-3.5 text-sm space-y-1.5">
            <p className="flex items-center gap-2 font-medium">
              <Flame className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.8} />
              {sug.kind === 'subir' ? 'Toca progresar' : sug.kind === 'primera' ? 'Primera vez' : sug.kind === 'bajar' ? 'Ajusta la carga' : 'Objetivo de hoy'}
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed">{sug.message}</p>
            {lastWorking.length > 0 && (
              <p className="text-xs text-[var(--text-muted)] tabular-nums">
                Última vez:{' '}
                {lastWorking
                  .map((s) => (ex.timed ? `${s.seconds ?? s.reps ?? 0} s` : `${s.weightKg ?? 0} kg × ${s.reps ?? 0}`))
                  .join(' · ')}
              </p>
            )}
          </div>

          {warmups.length > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-[5px] bg-[var(--surface-elevated)] p-3.5">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                <span className="font-medium text-[var(--text)]">Aproximación:</span>{' '}
                {warmups.map((w) => `${w.weightKg} kg × ${w.reps}`).join(' · ')}
              </p>
              <SmallBtn onClick={() => onAddWarmups(warmups)}>Añadir</SmallBtn>
            </div>
          )}

          {/* Tabla de series */}
          <div>
            <div className="grid grid-cols-[34px_1fr_1fr_1fr_44px] gap-2 px-1 pb-2 text-[11px] text-[var(--text-muted)]">
              <span>Serie</span>
              <span>Anterior</span>
              <span className="text-center">{ex.timed ? '—' : 'kg'}</span>
              <span className="text-center">{unit}</span>
              <span />
            </div>
            <ul className="space-y-1.5">
              {log.sets.map((s, i) => {
                const label = s.warmup ? 'A' : String(++workIdx);
                const prev = s.warmup ? null : lastWorking[workIdx - 1];
                return (
                  <li
                    key={i}
                    className={cn(
                      'grid grid-cols-[34px_1fr_1fr_1fr_44px] gap-2 items-center rounded-[8px] px-1 py-1 transition-colors',
                      s.done && 'bg-[var(--accent-soft)]'
                    )}
                  >
                    <span
                      className={cn('text-sm tabular-nums text-center', s.warmup ? 'text-[var(--text-muted)]' : 'text-[var(--text)]')}
                      title={s.warmup ? 'Serie de aproximación' : undefined}
                    >
                      {label}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] tabular-nums truncate">
                      {prev ? (ex.timed ? `${prev.seconds ?? prev.reps} s` : `${prev.weightKg ?? 0}×${prev.reps ?? 0}`) : '—'}
                    </span>
                    {ex.timed ? (
                      <span className="text-center text-[var(--ash)]">—</span>
                    ) : (
                      <NumInput
                        value={s.weightKg}
                        placeholder={sug.weightKg != null ? String(sug.weightKg) : 'kg'}
                        step={0.5}
                        decimal
                        label={`Peso serie ${label}`}
                        onChange={(v) => onSet(i, (x) => ({ ...x, weightKg: v }))}
                      />
                    )}
                    <NumInput
                      value={ex.timed ? s.seconds ?? null : s.reps}
                      placeholder={s.warmup ? String(s.reps ?? '') : `${log.target.repMin}–${log.target.repMax}`}
                      label={`${ex.timed ? 'Segundos' : 'Repeticiones'} serie ${label}`}
                      onChange={(v) => onSet(i, (x) => (ex.timed ? { ...x, seconds: v } : { ...x, reps: v }))}
                    />
                    <button
                      type="button"
                      onClick={() => onDone(i)}
                      aria-pressed={s.done}
                      aria-label={s.done ? `Desmarcar serie ${label}` : `Completar serie ${label}`}
                      className={cn(
                        'h-11 w-11 rounded-full flex items-center justify-center border transition-colors cursor-pointer',
                        s.done
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--ash)]'
                      )}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex gap-2">
              <SmallBtn onClick={onAddSet}>
                <Plus className="h-3.5 w-3.5" /> Serie
              </SmallBtn>
              {working.length > 1 && (
                <SmallBtn onClick={() => onRemoveSet(log.sets.length - 1)}>
                  <Minus className="h-3.5 w-3.5" /> Serie
                </SmallBtn>
              )}
            </div>
          </div>

          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            {MUSCLE_LABELS[ex.primary[0]]}: detén la serie si la técnica se rompe. Mejor una repetición menos que una lesión.
          </p>
        </div>
      )}
    </Card>
  );
}

function SmallBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-[24px] border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text)] cursor-pointer min-h-[34px]"
    >
      {children}
    </button>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
  label,
  step = 1,
  decimal = false,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  label: string;
  step?: number;
  decimal?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setText((t) => (Number(t.replace(',', '.')) === value ? t : value == null ? '' : String(value)));
  }, [value]);
  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      aria-label={label}
      value={text}
      placeholder={placeholder}
      step={step}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.,]/g, '');
        setText(raw);
        const n = Number(raw.replace(',', '.'));
        onChange(raw === '' || Number.isNaN(n) ? null : n);
      }}
      className="w-full min-h-[44px] rounded-[24px] border border-[var(--border)] bg-[var(--surface)] text-center text-[15px] tabular-nums placeholder:text-[var(--ash)] focus:outline-none focus:border-[var(--accent)]"
    />
  );
}

function FinishSummary({
  workout,
  history,
  elapsed,
  onSave,
}: {
  workout: Workout;
  history: Workout[];
  elapsed: number;
  onSave: (feeling: number | null, notes: string) => Promise<void>;
}) {
  const [feeling, setFeeling] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const records = useMemo(() => newRecordsIn(workout, history), [workout, history]);
  const stats = [
    { label: 'Duración', value: formatDuration(elapsed) },
    { label: 'Series', value: String(completedSetCount(workout)) },
    { label: 'Volumen', value: `${workoutVolume(workout).toLocaleString('es')} kg` },
  ];
  const FEEL = ['Muy duro', 'Duro', 'Normal', 'Bien', 'Excelente'];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 divide-x divide-[var(--border)] text-center">
        {stats.map((s) => (
          <div key={s.label} className="px-2">
            <p className="font-display text-[24px] tabular-nums">{s.value}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {records.length > 0 && (
        <Card featured className="p-4 space-y-2">
          <p className="flex items-center gap-2 font-medium">
            <Trophy className="h-4 w-4" /> ¡Nuevos récords!
          </p>
          <ul className="text-sm text-[var(--text-secondary)] space-y-1">
            {records.map((r) => (
              <li key={r.exerciseId} className="tabular-nums">
                {getExercise(r.exerciseId)?.name}: {r.weightKg} kg × {r.reps} (1RM est. {r.e1rm} kg)
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div>
        <p className="eyebrow mb-3">¿Cómo te sentiste?</p>
        <div className="grid grid-cols-5 gap-1.5">
          {FEEL.map((f, i) => (
            <button
              key={f}
              type="button"
              data-active={feeling === i + 1}
              onClick={() => setFeeling(i + 1)}
              className="choice min-h-[52px] text-[11px] px-1"
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="field-label pl-1">Notas (opcional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
          rows={3}
          placeholder="Molestias, sensaciones, ajustes para la próxima…"
          className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[15px] placeholder:text-[var(--ash)] focus:outline-none focus:border-[var(--accent)]"
        />
      </label>

      <Button
        size="lg"
        fullWidth
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave(feeling, notes);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Guardando…' : 'Guardar entrenamiento'}
      </Button>
    </div>
  );
}
