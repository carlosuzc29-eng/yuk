import { describe, expect, it } from 'vitest';
import { generateRoutine, type GeneratorProfile } from '@/lib/training/generator';
import {
  applyFavoriteDay,
  applyFavoritePlan,
  daySignature,
  favoriteFromDay,
  favoriteFromPlan,
  findFavoriteFor,
} from '@/lib/training/favorites';

const profile: GeneratorProfile = {
  daysPerWeek: 4,
  sessionMinutes: 60,
  experience: 'intermedio',
  goal: 'ganar_masa',
  equipment: ['gimnasio_completo'],
  injuries: ['ninguna'],
  priorityMuscles: [],
};

describe('rutinas favoritas', () => {
  it('guarda una copia del plan: editar la rutina no cambia la favorita', () => {
    const routine = generateRoutine(profile);
    const fav = favoriteFromPlan(routine, 'Mi torso/pierna');
    expect(fav.kind).toBe('plan');
    expect(fav.name).toBe('Mi torso/pierna');
    expect(fav.days).toHaveLength(4);
    routine.days[0].exercises[0].sets = 9;
    expect(fav.days[0].exercises[0].sets).not.toBe(9);
  });

  it('reconoce por contenido si el plan o el día ya están guardados', () => {
    const routine = generateRoutine(profile);
    const plan = favoriteFromPlan(routine);
    const day = favoriteFromDay(routine, routine.days[1]);
    const favs = [plan, day];
    expect(findFavoriteFor(favs, { kind: 'plan', days: routine.days })?.id).toBe(plan.id);
    expect(findFavoriteFor(favs, { kind: 'day', day: routine.days[1] })?.id).toBe(day.id);
    expect(findFavoriteFor(favs, { kind: 'day', day: routine.days[2] })).toBeUndefined();
    // Si cambia la prescripción, ya no es la misma favorita
    const changed = { ...routine.days[1], exercises: routine.days[1].exercises.map((e, i) => (i ? e : { ...e, sets: e.sets + 1 })) };
    expect(findFavoriteFor(favs, { kind: 'day', day: changed })).toBeUndefined();
  });

  it('usar un plan favorito lo copia con ids nuevos y marca la rutina como editada', () => {
    const a = generateRoutine(profile);
    const fav = favoriteFromPlan(a, 'Plan A');
    const b = generateRoutine({ ...profile, daysPerWeek: 3 });
    const next = applyFavoritePlan(b, fav);
    expect(next.id).toBe(b.id);
    expect(next.days).toHaveLength(4);
    expect(next.edited).toBe(true);
    expect(next.days.map(daySignature)).toEqual(fav.days.map(daySignature));
    const uids = next.days.flatMap((d) => d.exercises.map((e) => e.uid));
    expect(new Set(uids).size).toBe(uids.length);
    expect(uids.some((u) => fav.days.flatMap((d) => d.exercises.map((e) => e.uid)).includes(u))).toBe(false);
  });

  it('un día favorito se puede añadir o reemplazar un día', () => {
    const routine = generateRoutine(profile);
    const fav = favoriteFromDay(routine, routine.days[0], 'Pierna favorita');
    const added = applyFavoriteDay(routine, fav, { add: true });
    expect(added.routine.days).toHaveLength(5);
    expect(added.dayIdx).toBe(4);
    expect(daySignature(added.routine.days[4])).toBe(daySignature(routine.days[0]));

    const replaced = applyFavoriteDay(routine, fav, { replaceIdx: 2 });
    expect(replaced.routine.days).toHaveLength(4);
    expect(daySignature(replaced.routine.days[2])).toBe(daySignature(routine.days[0]));
    expect(replaced.routine.split).toBe('personalizada');
  });

  it('no permite más de 7 días', () => {
    const routine = generateRoutine({ ...profile, daysPerWeek: 6 });
    const fav = favoriteFromDay(routine, routine.days[0]);
    const r7 = applyFavoriteDay(routine, fav, { add: true }).routine;
    expect(() => applyFavoriteDay(r7, fav, { add: true })).toThrow();
  });

  it('limita el nombre a 60 caracteres y usa uno por defecto si está vacío', () => {
    const routine = generateRoutine(profile);
    expect(favoriteFromPlan(routine, 'x'.repeat(100)).name).toHaveLength(60);
    expect(favoriteFromDay(routine, routine.days[0], '   ').name).toBe(routine.days[0].name);
  });
});
