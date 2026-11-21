import type { Routine, RoutineDay, Workout, WorkoutExerciseLog } from '@/types/training';
import { getExercise } from '@/lib/exercises/catalog';
import { lastLogFor, suggestNext } from './progression';
import { newUid } from './generator';

/** Crea una sesión lista para registrar, con el peso sugerido por la doble progresión. */
export function createWorkoutFromDay(routine: Routine, day: RoutineDay, history: Workout[] = []): Workout {
  const exercises: WorkoutExerciseLog[] = day.exercises.map((rx) => {
    const ex = getExercise(rx.exerciseId);
    const last = lastLogFor(rx.exerciseId, history);
    const sug = ex ? suggestNext(ex, rx, last) : null;
    return {
      uid: rx.uid,
      exerciseId: rx.exerciseId,
      target: { sets: rx.sets, repMin: rx.repMin, repMax: rx.repMax, restSec: rx.restSec, rir: rx.rir },
      sets: Array.from({ length: rx.sets }, () => ({
        weightKg: sug?.weightKg ?? null,
        reps: null,
        done: false,
      })),
    };
  });
  return {
    id: newUid('w'),
    routineId: routine.id,
    dayId: day.id,
    name: day.name,
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationSeconds: 0,
    totalVolumeKg: 0,
    exercises,
    status: 'in_progress',
  };
}

export function createEmptyWorkout(): Workout {
  return {
    id: newUid('w'),
    routineId: null,
    dayId: null,
    name: 'Entrenamiento libre',
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationSeconds: 0,
    totalVolumeKg: 0,
    exercises: [],
    status: 'in_progress',
  };
}
