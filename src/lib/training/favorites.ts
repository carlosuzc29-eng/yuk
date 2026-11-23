import type { FavoriteRoutine, Routine, RoutineDay } from '@/types/training';
import { newUid, SPLIT_LABELS } from './generator';

/** Máximo de favoritas por usuario (lista manejable y documentos pequeños). */
export const MAX_FAVORITES = 30;

/** Huella del contenido de un día: ejercicios y prescripción, sin ids internos. */
export function daySignature(day: RoutineDay): string {
  return JSON.stringify(day.exercises.map((e) => [e.exerciseId, e.sets, e.repMin, e.repMax, e.restSec, e.rir]));
}

/** Huella de un plan completo. */
export function planSignature(days: RoutineDay[]): string {
  return JSON.stringify(days.map(daySignature));
}

/** Copia profunda de un día con ids nuevos (los uid deben ser únicos dentro de la rutina activa). */
export function cloneDay(day: RoutineDay): RoutineDay {
  return {
    ...day,
    id: newUid('day'),
    focus: [...day.focus],
    exercises: day.exercises.map((e) => ({ ...e, uid: newUid() })),
  };
}

function monthLabel(d = new Date()): string {
  return d.toLocaleDateString('es', { month: 'short', year: 'numeric' }).replace('.', '');
}

export function defaultPlanName(routine: Routine): string {
  return `${SPLIT_LABELS[routine.split]} · ${monthLabel()}`;
}

export function favoriteFromPlan(routine: Routine, name?: string): FavoriteRoutine {
  const now = new Date().toISOString();
  return {
    id: newUid('fav'),
    kind: 'plan',
    name: (name?.trim() || defaultPlanName(routine)).slice(0, 60),
    split: routine.split,
    modalityPreference: routine.modalityPreference,
    days: routine.days.map(cloneDay),
    createdAt: now,
    updatedAt: now,
  };
}

export function favoriteFromDay(routine: Routine, day: RoutineDay, name?: string): FavoriteRoutine {
  const now = new Date().toISOString();
  return {
    id: newUid('fav'),
    kind: 'day',
    name: (name?.trim() || day.name).slice(0, 60),
    split: routine.split,
    modalityPreference: routine.modalityPreference,
    days: [cloneDay(day)],
    createdAt: now,
    updatedAt: now,
  };
}

/** ¿Este plan o día ya está guardado? Compara contenido, no ids. */
export function findFavoriteFor(
  favorites: FavoriteRoutine[],
  target: { kind: 'plan'; days: RoutineDay[] } | { kind: 'day'; day: RoutineDay }
): FavoriteRoutine | undefined {
  if (target.kind === 'plan') {
    const sig = planSignature(target.days);
    return favorites.find((f) => f.kind === 'plan' && planSignature(f.days) === sig);
  }
  const sig = daySignature(target.day);
  return favorites.find((f) => f.kind === 'day' && daySignature(f.days[0]) === sig);
}

/** Sustituye la rutina activa por un plan favorito (copiado con ids nuevos). */
export function applyFavoritePlan(current: Routine, fav: FavoriteRoutine): Routine {
  return {
    ...current,
    name: fav.name,
    split: fav.split,
    modalityPreference: fav.modalityPreference,
    days: fav.days.map(cloneDay),
    edited: true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Lleva un día favorito a la rutina activa: lo añade como día nuevo o reemplaza el día `replaceIdx`.
 * Devuelve la rutina nueva y el índice del día resultante.
 */
export function applyFavoriteDay(
  current: Routine,
  fav: FavoriteRoutine,
  mode: { add: true } | { replaceIdx: number }
): { routine: Routine; dayIdx: number } {
  const day = cloneDay(fav.days[0]);
  if ('add' in mode) {
    if (current.days.length >= 7) throw new Error('La rutina ya tiene 7 días.');
    return {
      routine: { ...current, days: [...current.days, day], split: 'personalizada', edited: true },
      dayIdx: current.days.length,
    };
  }
  const days = current.days.map((d, i) => (i === mode.replaceIdx ? day : d));
  return { routine: { ...current, days, split: 'personalizada', edited: true }, dayIdx: mode.replaceIdx };
}
