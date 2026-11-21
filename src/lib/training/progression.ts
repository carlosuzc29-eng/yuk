import type { Exercise, Workout, WorkoutExerciseLog, WorkoutSet } from '@/types/training';
import type { MuscleId } from '@/types/user';
import { getExercise } from '@/lib/exercises/catalog';

/** 1RM estimado (Epley). Fiable hasta ~12 repeticiones. */
export function estimate1RM(weightKg: number, reps: number): number {
  if (!weightKg || !reps) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + Math.min(reps, 12) / 30) * 10) / 10;
}

export function workingSets(log: WorkoutExerciseLog): WorkoutSet[] {
  return log.sets.filter((s) => s.done && !s.warmup);
}

export function setVolume(s: WorkoutSet): number {
  return (s.weightKg ?? 0) * (s.reps ?? 0);
}

export function workoutVolume(w: Pick<Workout, 'exercises'>): number {
  return Math.round(
    w.exercises.reduce((acc, ex) => acc + workingSets(ex).reduce((a, s) => a + setVolume(s), 0), 0)
  );
}

export function completedSetCount(w: Pick<Workout, 'exercises'>): number {
  return w.exercises.reduce((acc, ex) => acc + workingSets(ex).length, 0);
}

const LOWER_BODY: MuscleId[] = ['cuadriceps', 'gluteo_mayor', 'isquiotibiales', 'aductores'];

/** Incremento de carga razonable según implemento y región. */
export function weightStep(ex: Exercise): number {
  if (ex.equipment === 'peso_corporal' || ex.equipment === 'banda') return 0;
  const lower = ex.primary.some((m) => LOWER_BODY.includes(m));
  if (ex.equipment === 'mancuernas' || ex.equipment === 'kettlebell') return 2;
  if (ex.mechanics === 'aislamiento') return lower ? 2.5 : 1.25;
  return lower ? 5 : 2.5;
}

export function roundTo(x: number, step = 2.5): number {
  return Math.round(x / step) * step;
}

export interface Suggestion {
  weightKg: number | null;
  reps: number;
  message: string;
  kind: 'subir' | 'mantener' | 'primera' | 'bajar';
}

/**
 * Doble progresión: cuando todas las series llegan al tope del rango, se sube el peso;
 * si no, se mantiene el peso y se busca 1 repetición más.
 */
export function suggestNext(
  ex: Exercise,
  target: { repMin: number; repMax: number },
  last: WorkoutExerciseLog | null
): Suggestion {
  if (!last || !workingSets(last).length) {
    return {
      weightKg: null,
      reps: target.repMin,
      kind: 'primera',
      message:
        'Primera vez: elige un peso con el que completes el rango dejando 2–3 repeticiones en reserva, con técnica perfecta.',
    };
  }
  const sets = workingSets(last);
  const topWeight = Math.max(...sets.map((s) => s.weightKg ?? 0));
  const atTop = sets.filter((s) => (s.weightKg ?? 0) === topWeight);
  const allHitMax = atTop.length > 0 && atTop.every((s) => (s.reps ?? 0) >= target.repMax);
  const anyBelowMin = atTop.some((s) => (s.reps ?? 0) < target.repMin);
  const step = weightStep(ex);

  if (allHitMax) {
    if (step === 0) {
      return {
        weightKg: topWeight || null,
        reps: target.repMax + 1,
        kind: 'subir',
        message: 'Llegaste al tope del rango: suma 1–2 repeticiones o pasa a una variante más difícil.',
      };
    }
    return {
      weightKg: topWeight + step,
      reps: target.repMin,
      kind: 'subir',
      message: `¡Completaste el rango! Sube a ${topWeight + step} kg y vuelve a empezar desde ${target.repMin} repeticiones.`,
    };
  }
  if (anyBelowMin && topWeight > 0 && step > 0) {
    const lower = Math.max(0, roundTo(topWeight * 0.92, step >= 2.5 ? 2.5 : 1));
    return {
      weightKg: lower,
      reps: target.repMin,
      kind: 'bajar',
      message: `La última vez quedaste por debajo del rango. Baja a ${lower} kg y cuida la técnica.`,
    };
  }
  const bestReps = Math.max(...atTop.map((s) => s.reps ?? 0));
  return {
    weightKg: topWeight || null,
    reps: Math.min(target.repMax, bestReps + 1),
    kind: 'mantener',
    message: `Mantén ${topWeight ? `${topWeight} kg` : 'la carga'} e intenta 1 repetición más en cada serie.`,
  };
}

/** Series de aproximación para el primer ejercicio compuesto con carga. */
export function warmupSets(ex: Exercise, workingWeight: number | null): { weightKg: number; reps: number }[] {
  if (ex.mechanics !== 'compuesto' || !workingWeight || workingWeight < 20) return [];
  const step = ex.equipment === 'mancuernas' ? 2 : 2.5;
  return [
    { weightKg: roundTo(workingWeight * 0.5, step), reps: 8 },
    { weightKg: roundTo(workingWeight * 0.7, step), reps: 5 },
    { weightKg: roundTo(workingWeight * 0.85, step), reps: 2 },
  ].filter((s, i, arr) => s.weightKg > 0 && (i === 0 || s.weightKg !== arr[i - 1].weightKg));
}

/** Último registro de un ejercicio dentro del historial (ordenado del más reciente al más antiguo). */
export function lastLogFor(exerciseId: string, history: Workout[]): WorkoutExerciseLog | null {
  for (const w of history) {
    if (w.status !== 'completed') continue;
    const log = w.exercises.find((e) => e.exerciseId === exerciseId && workingSets(e).length);
    if (log) return log;
  }
  return null;
}

export interface PersonalRecord {
  exerciseId: string;
  e1rm: number;
  weightKg: number;
  reps: number;
  date: string;
}

export function personalRecords(history: Workout[]): Record<string, PersonalRecord> {
  const out: Record<string, PersonalRecord> = {};
  for (const w of history) {
    if (w.status !== 'completed') continue;
    for (const log of w.exercises) {
      for (const s of workingSets(log)) {
        const e = estimate1RM(s.weightKg ?? 0, s.reps ?? 0);
        if (!e) continue;
        const cur = out[log.exerciseId];
        if (!cur || e > cur.e1rm) {
          out[log.exerciseId] = {
            exerciseId: log.exerciseId,
            e1rm: e,
            weightKg: s.weightKg ?? 0,
            reps: s.reps ?? 0,
            date: w.completedAt ?? w.startedAt,
          };
        }
      }
    }
  }
  return out;
}

/** Récords batidos en un entrenamiento respecto al historial previo. */
export function newRecordsIn(workout: Workout, previous: Workout[]): PersonalRecord[] {
  const before = personalRecords(previous);
  const now = personalRecords([{ ...workout, status: 'completed' }]);
  return Object.values(now).filter((r) => !before[r.exerciseId] || r.e1rm > before[r.exerciseId].e1rm);
}

/** Lunes (00:00 local) de la semana de una fecha, como clave YYYY-MM-DD. */
export function weekKey(dateIso: string): string {
  const d = new Date(dateIso);
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Racha de semanas consecutivas cumpliendo al menos `target` sesiones (la semana actual cuenta si ya cumple). */
export function weeklyStreak(history: Workout[], target: number, now = new Date()): number {
  const counts = new Map<string, number>();
  history
    .filter((w) => w.status === 'completed')
    .forEach((w) => {
      const k = weekKey(w.completedAt ?? w.startedAt);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
  let streak = 0;
  const cursor = new Date(now);
  const thisWeek = weekKey(cursor.toISOString());
  if ((counts.get(thisWeek) ?? 0) >= target) streak += 1;
  cursor.setDate(cursor.getDate() - 7);
  for (let i = 0; i < 520; i++) {
    const k = weekKey(cursor.toISOString());
    if ((counts.get(k) ?? 0) >= target) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    } else break;
  }
  return streak;
}

export function sessionsThisWeek(history: Workout[], now = new Date()): number {
  const k = weekKey(now.toISOString());
  return history.filter((w) => w.status === 'completed' && weekKey(w.completedAt ?? w.startedAt) === k)
    .length;
}

/** Series efectivas por músculo en un conjunto de entrenamientos. */
export function setsByMuscle(workouts: Workout[]): Partial<Record<MuscleId, number>> {
  const out: Partial<Record<MuscleId, number>> = {};
  for (const w of workouts) {
    for (const log of w.exercises) {
      const ex = getExercise(log.exerciseId);
      if (!ex) continue;
      const n = workingSets(log).length;
      ex.primary.forEach((m) => (out[m] = (out[m] ?? 0) + n));
      ex.secondary.forEach((m) => (out[m] = (out[m] ?? 0) + n * 0.5));
    }
  }
  return out;
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min${s && m < 10 ? ` ${s} s` : ''}`;
  return `${s} s`;
}
