'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Info,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTraining } from '@/components/providers/TrainingProvider';
import { ExerciseDetail } from '@/components/exercises/ExerciseDetail';
import { ExercisePicker, ExerciseRow, FilterChip, MODALITY_ORDER } from '@/components/exercises/ExercisePicker';
import { MODALITY_LABELS, getExercise } from '@/lib/exercises/catalog';
import {
  SPLIT_LABELS,
  allowedEquipmentFor,
  buildCustomDay,
  newUid,
  toRoutineExercise,
  weeklySetsByMuscle,
} from '@/lib/training/generator';
import { createWorkoutFromDay } from '@/lib/training/session';
import type { Exercise, ModalityPreference, Routine, RoutineDay, RoutineExercise } from '@/types/training';
import { MUSCLE_LABELS, type InjuryType, type MuscleId } from '@/types/user';

type SheetState =
  | { kind: 'none' }
  | { kind: 'detail'; exercise: Exercise }
  | { kind: 'swap'; uid: string }
  | { kind: 'add' }
  | { kind: 'edit'; uid: string }
  | { kind: 'customize' }
  | { kind: 'regenerate' };

const MUSCLE_ORDER = Object.keys(MUSCLE_LABELS) as MuscleId[];

export default function RutinaPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { routine, loading, saveRoutine, regenerate, startWorkout, active, workouts } = useTraining();
  const [dayIdx, setDayIdx] = useState(0);
  const [sheet, setSheet] = useState<SheetState>({ kind: 'none' });

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login');
    else if (!profile?.onboardingCompleted) router.replace('/onboarding');
  }, [authLoading, user, profile, router]);

  useEffect(() => {
    if (routine && dayIdx >= routine.days.length) setDayIdx(Math.max(0, routine.days.length - 1));
  }, [routine, dayIdx]);

  const injuries: InjuryType[] = profile?.injuries.filter((i) => i !== 'ninguna') ?? [];
  const allowed = profile ? allowedEquipmentFor(profile.equipment) : null;
  const day = routine?.days[dayIdx];

  const close = () => setSheet({ kind: 'none' });

  const commit = async (next: Routine) => {
    await saveRoutine(next);
  };

  const updateDay = async (fn: (d: RoutineDay) => RoutineDay, markCustom = true) => {
    if (!routine || !day) return;
    const days = routine.days.map((d, i) => (i === dayIdx ? fn(d) : d));
    await commit({ ...routine, days, split: markCustom ? 'personalizada' : routine.split });
  };

  const updateRx = (uid: string, fn: (rx: RoutineExercise) => RoutineExercise) =>
    updateDay((d) => ({ ...d, exercises: d.exercises.map((rx) => (rx.uid === uid ? fn(rx) : rx)) }));

  const move = (uid: string, delta: number) =>
    updateDay((d) => {
      const list = [...d.exercises];
      const i = list.findIndex((x) => x.uid === uid);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, exercises: list };
    });

  const remove = (uid: string) =>
    updateDay((d) => ({ ...d, exercises: d.exercises.filter((x) => x.uid !== uid) }));

  const swap = async (uid: string, ex: Exercise) => {
    if (!profile) return;
    await updateRx(uid, (rx) => {
      const fresh = toRoutineExercise(ex, profile.goal, profile.experience, false);
      // Mantiene el volumen elegido, ajusta rango si cambia de compuesto a aislamiento.
      return { ...fresh, uid: rx.uid, sets: rx.sets };
    });
    close();
  };

  const add = async (ex: Exercise) => {
    if (!profile) return;
    await updateDay((d) => ({
      ...d,
      exercises: [...d.exercises, toRoutineExercise(ex, profile.goal, profile.experience, d.exercises.length === 0)],
    }));
    close();
  };

  const addDay = async () => {
    if (!routine || routine.days.length >= 7) return;
    const newDay: RoutineDay = { id: newUid('day'), name: `Día ${routine.days.length + 1}`, focus: [], exercises: [] };
    await commit({ ...routine, days: [...routine.days, newDay], split: 'personalizada' });
    setDayIdx(routine.days.length);
    setSheet({ kind: 'customize' });
  };

  const removeDay = async () => {
    if (!routine || routine.days.length <= 1) return;
    if (!window.confirm(`¿Eliminar "${day?.name}" de tu rutina?`)) return;
    await commit({ ...routine, days: routine.days.filter((_, i) => i !== dayIdx), split: 'personalizada' });
    setDayIdx(Math.max(0, dayIdx - 1));
  };

  const start = () => {
    if (!routine || !day) return;
    if (active && !window.confirm('Tienes un entrenamiento en curso. ¿Quieres reemplazarlo por este día?')) return;
    startWorkout(createWorkoutFromDay(routine, day, workouts));
    router.push('/entrenar');
  };

  if (authLoading || !profile) return null;

  return (
    <AppShell
      title="Rutina"
      subtitle={routine ? `${SPLIT_LABELS[routine.split]} · ${routine.days.length} días/semana` : 'Tu plan semanal'}
      rightSlot={
        <button
          type="button"
          onClick={() => setSheet({ kind: 'regenerate' })}
          className="inline-flex items-center gap-1.5 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] touch-target shrink-0 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.6} /> Regenerar
        </button>
      }
    >
      {loading || !routine ? (
        <p className="text-sm text-[var(--text-muted)]">Preparando tu rutina…</p>
      ) : (
        <div className="space-y-6">
          {/* Selector de días */}
          <div role="tablist" aria-label="Días de la rutina" className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
            {routine.days.map((d, i) => (
              <button
                key={d.id}
                role="tab"
                aria-selected={i === dayIdx}
                onClick={() => setDayIdx(i)}
                className={`shrink-0 text-left rounded-[8px] border px-3.5 py-2.5 min-w-[112px] cursor-pointer transition-colors ${
                  i === dayIdx
                    ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--ash)]'
                }`}
              >
                <span className="block text-[11px] opacity-70">Día {i + 1}</span>
                <span className="block text-sm font-medium truncate max-w-[140px]">{d.name}</span>
              </button>
            ))}
            {routine.days.length < 7 && (
              <button
                type="button"
                onClick={addDay}
                aria-label="Añadir día"
                className="shrink-0 rounded-[8px] border border-dashed border-[var(--border)] px-4 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          {day && (
            <section aria-label={day.name} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <input
                    aria-label="Nombre del día"
                    value={day.name}
                    onChange={(e) => {
                      const name = e.target.value.slice(0, 40);
                      void updateDay((d) => ({ ...d, name }), false);
                    }}
                    className="w-full bg-transparent font-display text-[26px] outline-none border-b border-transparent focus:border-[var(--border)]"
                  />
                  {day.focus.length > 0 && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {day.focus.map((m) => MUSCLE_LABELS[m]).join(' · ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setSheet({ kind: 'customize' })}>
                  <SlidersHorizontal className="h-4 w-4" /> Personalizar día
                </Button>
                <Button variant="secondary" onClick={() => setSheet({ kind: 'add' })}>
                  <Plus className="h-4 w-4" /> Añadir ejercicio
                </Button>
                {routine.days.length > 1 && (
                  <Button variant="ghost" onClick={removeDay} aria-label="Eliminar día">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <ol className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {day.exercises.map((rx, i) => {
                  const ex = getExercise(rx.exerciseId);
                  if (!ex) return null;
                  const conflict = ex.avoidIf.some((x) => injuries.includes(x));
                  return (
                    <li key={rx.uid} className="py-1">
                      <ExerciseRow
                        exercise={ex}
                        onClick={() => setSheet({ kind: 'detail', exercise: ex })}
                        subtitle={`${rx.sets} × ${rx.repMin}–${rx.repMax}${ex.timed ? ' s' : ''} · ${rx.restSec} s descanso · RIR ${rx.rir}${conflict ? ' · ⚠ precaución' : ''}`}
                        right={<span className="text-xs tabular-nums text-[var(--ash)] w-5 text-right">{i + 1}</span>}
                      />
                      <div className="flex items-center gap-1 pb-2 pl-[76px]">
                        <IconBtn label="Cambiar ejercicio" onClick={() => setSheet({ kind: 'swap', uid: rx.uid })}>
                          <Repeat className="h-4 w-4" /> <span className="text-xs">Cambiar</span>
                        </IconBtn>
                        <IconBtn label="Editar series y repeticiones" onClick={() => setSheet({ kind: 'edit', uid: rx.uid })}>
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn label="Subir" onClick={() => move(rx.uid, -1)} disabled={i === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn label="Bajar" onClick={() => move(rx.uid, 1)} disabled={i === day.exercises.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn label="Quitar ejercicio" onClick={() => remove(rx.uid)}>
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    </li>
                  );
                })}
                {day.exercises.length === 0 && (
                  <li className="py-8 text-center text-sm text-[var(--text-muted)]">
                    Este día no tiene ejercicios. Usa “Personalizar día” o “Añadir ejercicio”.
                  </li>
                )}
              </ol>

              <Button size="lg" fullWidth onClick={start} disabled={!day.exercises.length}>
                <Play className="h-4 w-4" /> Empezar este día
              </Button>
            </section>
          )}

          <WeeklyVolume routine={routine} priorities={profile.priorityMuscles.map((p) => p.muscle)} />
        </div>
      )}

      {/* Hojas */}
      <Sheet open={sheet.kind === 'detail'} onClose={close} title={sheet.kind === 'detail' ? sheet.exercise.name : ''}>
        {sheet.kind === 'detail' && (
          <ExerciseDetail exercise={sheet.exercise} sex={profile.sex} injuries={injuries} />
        )}
      </Sheet>

      <Sheet open={sheet.kind === 'swap'} onClose={close} title="Cambiar ejercicio">
        {sheet.kind === 'swap' && day && (() => {
          const rx = day.exercises.find((x) => x.uid === sheet.uid);
          const ex = rx && getExercise(rx.exerciseId);
          return (
            <ExercisePicker
              initialMuscle={ex?.primary[0] ?? null}
              allowedEquipment={allowed}
              injuries={injuries}
              excludeIds={day.exercises.map((x) => x.exerciseId)}
              onPick={(picked) => swap(sheet.uid, picked)}
            />
          );
        })()}
      </Sheet>

      <Sheet open={sheet.kind === 'add'} onClose={close} title="Añadir ejercicio">
        {sheet.kind === 'add' && day && (
          <ExercisePicker
            initialMuscle={day.focus[0] ?? null}
            allowedEquipment={allowed}
            injuries={injuries}
            excludeIds={day.exercises.map((x) => x.exerciseId)}
            onPick={add}
          />
        )}
      </Sheet>

      <Sheet open={sheet.kind === 'edit'} onClose={close} title="Series y repeticiones">
        {sheet.kind === 'edit' && day && (() => {
          const rx = day.exercises.find((x) => x.uid === sheet.uid);
          if (!rx) return null;
          return <PrescriptionEditor rx={rx} timed={Boolean(getExercise(rx.exerciseId)?.timed)} onSave={async (next) => { await updateRx(rx.uid, () => next); close(); }} />;
        })()}
      </Sheet>

      <Sheet open={sheet.kind === 'customize'} onClose={close} title="Personalizar día">
        {sheet.kind === 'customize' && day && (
          <CustomizeDay
            initialMuscles={day.focus}
            onBuild={async (muscles, modality) => {
              const built = buildCustomDay(muscles, profile, modality, day.name.startsWith('Día ') ? muscles.slice(0, 2).map((m) => MUSCLE_LABELS[m]).join(' y ') : day.name);
              await updateDay(() => ({ ...built, id: day.id }));
              close();
            }}
          />
        )}
      </Sheet>

      <Sheet open={sheet.kind === 'regenerate'} onClose={close} title="Regenerar rutina">
        {sheet.kind === 'regenerate' && (
          <RegenerateForm
            current={routine?.modalityPreference ?? 'mixto'}
            onConfirm={async (m) => {
              await regenerate(m);
              setDayIdx(0);
              close();
            }}
          />
        )}
      </Sheet>
    </AppShell>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1.5 h-9 min-w-9 px-2 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-elevated)] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="space-y-1.5">
      <p className="field-label pl-1">{label}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(clamp(value - step))} aria-label={`Restar ${label}`} className="h-11 w-11 rounded-full border border-[var(--border)] text-lg cursor-pointer hover:bg-[var(--surface-elevated)]">−</button>
        <div className="flex-1 text-center">
          <span className="font-display text-[28px] tabular-nums">{value}</span>
          {suffix && <span className="text-sm text-[var(--text-muted)] ml-1">{suffix}</span>}
        </div>
        <button type="button" onClick={() => onChange(clamp(value + step))} aria-label={`Sumar ${label}`} className="h-11 w-11 rounded-full border border-[var(--border)] text-lg cursor-pointer hover:bg-[var(--surface-elevated)]">+</button>
      </div>
    </div>
  );
}

function PrescriptionEditor({
  rx,
  timed,
  onSave,
}: {
  rx: RoutineExercise;
  timed: boolean;
  onSave: (rx: RoutineExercise) => void;
}) {
  const [v, setV] = useState(rx);
  const unit = timed ? 's' : 'reps';
  return (
    <div className="space-y-5">
      <NumberField label="Series" value={v.sets} min={1} max={10} onChange={(sets) => setV({ ...v, sets })} />
      <div className="grid grid-cols-2 gap-4">
        <NumberField label={`Mínimo (${unit})`} value={v.repMin} min={1} max={v.repMax} step={timed ? 5 : 1} onChange={(repMin) => setV({ ...v, repMin })} />
        <NumberField label={`Máximo (${unit})`} value={v.repMax} min={v.repMin} max={timed ? 180 : 30} step={timed ? 5 : 1} onChange={(repMax) => setV({ ...v, repMax })} />
      </div>
      <NumberField label="Descanso" value={v.restSec} min={15} max={300} step={15} suffix="s" onChange={(restSec) => setV({ ...v, restSec })} />
      <NumberField label="Repeticiones en reserva (RIR)" value={v.rir} min={0} max={4} onChange={(rir) => setV({ ...v, rir })} />
      <p className="flex gap-2 text-xs text-[var(--text-muted)] leading-relaxed">
        <Info className="h-4 w-4 shrink-0" />
        RIR = repeticiones que podrías hacer de más al terminar la serie. Si estás empezando, deja 2–3 en reserva: técnica antes que peso.
      </p>
      <Button size="lg" fullWidth onClick={() => onSave(v)}>
        Guardar cambios
      </Button>
    </div>
  );
}

function CustomizeDay({
  initialMuscles,
  onBuild,
}: {
  initialMuscles: MuscleId[];
  onBuild: (muscles: MuscleId[], modality: ModalityPreference) => void;
}) {
  const [muscles, setMuscles] = useState<MuscleId[]>(initialMuscles.slice(0, 4));
  const [modality, setModality] = useState<ModalityPreference>('mixto');
  const toggle = (m: MuscleId) =>
    setMuscles((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : cur.length >= 5 ? cur : [...cur, m]));
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">¿Qué músculos quieres trabajar?</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Elige hasta 5. El primero recibe el ejercicio principal.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MUSCLE_ORDER.map((m) => (
            <FilterChip key={m} active={muscles.includes(m)} onClick={() => toggle(m)}>
              {muscles.includes(m) ? `${muscles.indexOf(m) + 1}. ` : ''}
              {MUSCLE_LABELS[m]}
            </FilterChip>
          ))}
        </div>
      </div>
      <div>
        <p className="eyebrow">¿Con qué equipo?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterChip active={modality === 'mixto'} onClick={() => setModality('mixto')}>
            Mixto
          </FilterChip>
          {MODALITY_ORDER.map((m) => (
            <FilterChip key={m} active={modality === m} onClick={() => setModality(m)}>
              {MODALITY_LABELS[m]}
            </FilterChip>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Si no hay ejercicios de ese tipo para un músculo, usaremos la mejor alternativa disponible.
        </p>
      </div>
      <Button size="lg" fullWidth disabled={!muscles.length} onClick={() => onBuild(muscles, modality)}>
        Crear día
      </Button>
    </div>
  );
}

function RegenerateForm({
  current,
  onConfirm,
}: {
  current: ModalityPreference;
  onConfirm: (m: ModalityPreference) => void;
}) {
  const [m, setM] = useState<ModalityPreference>(current);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
        Creamos un plan nuevo con tus días, minutos, objetivo, lesiones y músculos prioritarios. Los cambios manuales
        de la rutina actual se perderán (tu historial de entrenamientos se conserva).
      </p>
      <div>
        <p className="eyebrow">Preferencia de equipo</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterChip active={m === 'mixto'} onClick={() => setM('mixto')}>
            Mixto (recomendado)
          </FilterChip>
          {MODALITY_ORDER.map((x) => (
            <FilterChip key={x} active={m === x} onClick={() => setM(x)}>
              {MODALITY_LABELS[x]}
            </FilterChip>
          ))}
        </div>
      </div>
      <Button
        size="lg"
        fullWidth
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onConfirm(m);
          setBusy(false);
        }}
      >
        {busy ? 'Generando…' : 'Generar rutina nueva'}
      </Button>
    </div>
  );
}

/** Series semanales por músculo frente al rango orientativo 10–20. */
function WeeklyVolume({ routine, priorities }: { routine: Routine; priorities: MuscleId[] }) {
  const data = useMemo(() => {
    const sets = weeklySetsByMuscle(routine);
    return MUSCLE_ORDER.map((m) => ({ m, v: Math.round((sets[m] ?? 0) * 2) / 2 }))
      .filter((d) => d.v > 0 || priorities.includes(d.m))
      .sort((a, b) => b.v - a.v);
  }, [routine, priorities]);
  const max = 24;

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="eyebrow">Series semanales por músculo</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Directas cuentan 1, indirectas 0,5. Zona marcada: 10–20 series, rango orientativo para hipertrofia.
        </p>
      </div>
      <ul className="space-y-2.5">
        {data.map(({ m, v }) => {
          const pct = Math.min(100, (v / max) * 100);
          return (
            <li key={m} className="grid grid-cols-[110px_1fr_36px] items-center gap-3" title={`${MUSCLE_LABELS[m]}: ${v} series/semana`}>
              <span className="text-xs text-[var(--text-secondary)] truncate">
                {MUSCLE_LABELS[m]}
                {priorities.includes(m) && <span className="text-[var(--text-muted)]"> ★</span>}
              </span>
              <div className="relative h-2.5 rounded-full bg-[var(--chart-track)] overflow-hidden">
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 border-x border-[var(--text-muted)]/40"
                  style={{ left: `${(10 / max) * 100}%`, width: `${(10 / max) * 100}%` }}
                />
                <div className="absolute inset-y-0 left-0 rounded-r-[4px] bg-[var(--chart-1)]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs tabular-nums text-right text-[var(--text)]">{v}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
