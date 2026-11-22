import { describe, expect, it } from 'vitest';
import { BONE_LEN_3D, buildPose3D } from '@/lib/exercises/kinematics3d';
import {
  alternativesFor,
  allowedEquipmentFor,
  buildCustomDay,
  generateRoutine,
  profileKey,
  type GeneratorProfile,
} from '@/lib/training/generator';
import { estimate1RM, suggestNext, warmupSets, weeklyStreak } from '@/lib/training/progression';
import { EXERCISES, getExercise } from '@/lib/exercises/catalog';
import { PATTERNS } from '@/lib/exercises/poses';
import type { Workout } from '@/types/training';

const base: GeneratorProfile = {
  daysPerWeek: 4,
  sessionMinutes: 60,
  experience: 'intermedio',
  goal: 'ganar_masa',
  equipment: ['gimnasio_completo'],
  injuries: ['ninguna'],
  priorityMuscles: [],
};

describe('catálogo', () => {
  it('tiene ids únicos, animación y técnica para cada ejercicio', () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    expect(ids.size).toBe(EXERCISES.length);
    expect(EXERCISES.length).toBeGreaterThanOrEqual(80);
    for (const e of EXERCISES) {
      expect(PATTERNS[e.pattern], e.id).toBeDefined();
      expect(e.steps.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.beginnerTip.length, e.id).toBeGreaterThan(10);
      expect(e.primary.length, e.id).toBeGreaterThan(0);
    }
  });
});

describe('generador de rutinas', () => {
  it('crea un día por cada día disponible con ejercicios', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const r = generateRoutine({ ...base, daysPerWeek: days });
      expect(r.days).toHaveLength(days);
      r.days.forEach((d) => expect(d.exercises.length).toBeGreaterThanOrEqual(4));
    }
  });

  it('respeta el equipo disponible', () => {
    const r = generateRoutine({ ...base, equipment: ['peso_corporal'] });
    const allowed = allowedEquipmentFor(['peso_corporal']);
    r.days.flatMap((d) => d.exercises).forEach((rx) => {
      expect(allowed).toContain(getExercise(rx.exerciseId)!.equipment);
    });
  });

  it('excluye ejercicios contraindicados por lesión', () => {
    const r = generateRoutine({ ...base, injuries: ['hombro', 'espalda_baja'] });
    r.days.flatMap((d) => d.exercises).forEach((rx) => {
      const ex = getExercise(rx.exerciseId)!;
      expect(ex.avoidIf).not.toContain('hombro');
      expect(ex.avoidIf).not.toContain('espalda_baja');
    });
  });

  it('no repite ejercicio dentro del mismo día', () => {
    const r = generateRoutine({ ...base, daysPerWeek: 6, sessionMinutes: 90 });
    r.days.forEach((d) => {
      const ids = d.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it('prioriza la modalidad elegida (máquina)', () => {
    const r = generateRoutine(base, 'maquina');
    const all = r.days.flatMap((d) => d.exercises).map((rx) => getExercise(rx.exerciseId)!);
    const machine = all.filter((e) => e.equipment === 'maquina').length;
    expect(machine / all.length).toBeGreaterThan(0.5);
  });

  it('da énfasis a los prioritarios: antes que otros aislamientos y con series extra', () => {
    const r = generateRoutine({ ...base, priorityMuscles: [{ muscle: 'deltoides_lateral', level: 2 }] });
    const torso = r.days[0].exercises.map((rx) => ({ rx, ex: getExercise(rx.exerciseId)! }));
    const firstIso = torso.find((t) => t.ex.mechanics === 'aislamiento')!;
    expect(firstIso.ex.primary).toContain('deltoides_lateral');
    expect(firstIso.rx.sets).toBeGreaterThan(3);
  });

  it('la rutina sigue siendo completa aunque haya 4 músculos prioritarios', () => {
    const priorityMuscles = [
      { muscle: 'biceps', level: 2 },
      { muscle: 'triceps', level: 2 },
      { muscle: 'gluteo_mayor', level: 2 },
      { muscle: 'abdomen', level: 2 },
    ] as GeneratorProfile['priorityMuscles'];
    const majors = ['cuadriceps', 'pectorales', 'dorsales', 'isquiotibiales'] as const;
    const muscles = (r: ReturnType<typeof generateRoutine>, i: number) =>
      new Set(r.days[i].exercises.flatMap((rx) => getExercise(rx.exerciseId)!.primary));
    for (const daysPerWeek of [2, 3, 4, 5, 6]) {
      for (const sessionMinutes of [30, 45, 60, 90] as const) {
        const plain = generateRoutine({ ...base, daysPerWeek, sessionMinutes });
        const r = generateRoutine({ ...base, daysPerWeek, sessionMinutes, priorityMuscles });
        r.days.forEach((d, i) => {
          const label = `${daysPerWeek}d ${sessionMinutes}min ${d.name}`;
          // Ningún grupo muscular de la plantilla desaparece por tener prioritarios.
          const withP = muscles(r, i);
          for (const m of plain.days[i].exercises.map((rx) => getExercise(rx.exerciseId)!.primary[0])) {
            expect(withP.has(m), `${label}: falta ${m}`).toBe(true);
          }
          // Como mucho 2 ejercicios extra por día.
          expect(d.exercises.length, label).toBeLessThanOrEqual(plain.days[i].exercises.length + 2);
        });
      }
    }
    // En torso/pierna también se trabajan todos los grupos a lo largo de la semana.
    const tp = generateRoutine({ ...base, priorityMuscles });
    const week = new Set(tp.days.flatMap((d) => d.exercises.flatMap((rx) => getExercise(rx.exerciseId)!.primary)));
    for (const m of [...majors, 'espalda_media', 'deltoides_lateral', 'pantorrillas'] as const) expect(week.has(m), m).toBe(true);
  });

  it('marca la rutina con la huella del perfil para regenerarla si cambia', () => {
    const r = generateRoutine(base);
    expect(r.profileKey).toBe(profileKey(base));
    expect(r.edited).toBe(false);
    expect(profileKey({ ...base, priorityMuscles: [{ muscle: 'biceps', level: 1 }] })).not.toBe(r.profileKey);
  });

  it('principiantes reciben menos series y más repeticiones en reserva', () => {
    const r = generateRoutine({ ...base, experience: 'principiante' });
    r.days.flatMap((d) => d.exercises).forEach((rx) => {
      expect(rx.sets).toBeLessThanOrEqual(4);
      expect(rx.rir).toBeGreaterThanOrEqual(3);
    });
  });

  it('construye un día personalizado por músculo y modalidad', () => {
    const d = buildCustomDay(['biceps', 'triceps'], base, 'polea', 'Brazos');
    expect(d.exercises.length).toBeGreaterThan(0);
    d.exercises.forEach((rx) => {
      const ex = getExercise(rx.exerciseId)!;
      expect(ex.primary.some((m) => m === 'biceps' || m === 'triceps')).toBe(true);
    });
    expect(d.exercises.some((rx) => getExercise(rx.exerciseId)!.equipment === 'polea')).toBe(true);
  });

  it('ofrece alternativas del mismo músculo', () => {
    const alts = alternativesFor('press-banca-barra', base);
    expect(alts.length).toBeGreaterThan(3);
    alts.forEach((a) => expect(a.primary).toContain('pectorales'));
  });

  it('respeta la distribución personalizada de días de pierna y tren superior', () => {
    const r = generateRoutine({
      ...base,
      daysPerWeek: 4,
      dayFocusPlan: ['pierna', 'superior', 'pierna', 'pierna'],
    });
    expect(r.split).toBe('personalizada');
    expect(r.days).toHaveLength(4);
    expect(r.days[0].name).toMatch(/Pierna/i);
    expect(r.days[1].name).toMatch(/Torso|Empuje|Tirón/i);
    expect(r.days[2].name).toMatch(/Pierna/i);
    expect(r.days[3].name).toMatch(/Pierna/i);
  });

  it('genera poses 3D válidas, longitudes óseas constantes y orientación correcta en todos los ejercicios', () => {
    for (const ex of EXERCISES) {
      for (const sex of ['male', 'female'] as const) {
        for (const t of [0, 0.5, 1]) {
          const { pose } = buildPose3D(ex, t, sex);
          const pts = [
            pose.pelvis,
            pose.chest,
            pose.head,
            pose.shoulderL,
            pose.shoulderR,
            pose.elbowL,
            pose.elbowR,
            pose.wristL,
            pose.wristR,
            pose.kneeL,
            pose.kneeR,
            pose.ankleL,
            pose.ankleR,
          ];
          for (const p of pts) {
            expect(Number.isFinite(p.x), `${ex.id} ${sex} x`).toBe(true);
            expect(Number.isFinite(p.y), `${ex.id} ${sex} y`).toBe(true);
            expect(Number.isFinite(p.z), `${ex.id} ${sex} z`).toBe(true);
          }
          if (pose.isSidePattern) {
            // Ningún hueso se estira ni aplasta en IK 3D
            expect(pose.shoulderR.distanceTo(pose.elbowR)).toBeCloseTo(BONE_LEN_3D.upperArm, 2);
            expect(pose.elbowR.distanceTo(pose.wristR)).toBeCloseTo(BONE_LEN_3D.forearm, 2);
            expect(pose.hipR.distanceTo(pose.kneeR)).toBeCloseTo(BONE_LEN_3D.thigh, 2);
            expect(pose.kneeR.distanceTo(pose.ankleR)).toBeCloseTo(BONE_LEN_3D.shin, 2);
          }
        }
      }
    }

    // Orientación biomecánica del torso en ejercicios tumbados boca arriba, boca abajo y de pie
    const bench = buildPose3D(getExercise('press-banca-barra')!, 0.5, 'male').pose;
    expect(bench.torsoForward.y).toBeGreaterThan(0.8); // Pecho mira hacia el techo (+Y)

    const pushup = buildPose3D(getExercise('flexiones')!, 0.5, 'male').pose;
    expect(pushup.torsoForward.y).toBeLessThan(-0.8); // Pecho mira hacia el suelo (-Y)

    const squat = buildPose3D(getExercise('sentadilla-barra')!, 0, 'male').pose;
    expect(squat.torsoForward.z).toBeGreaterThan(0.8); // Pecho mira al frente (+Z)
  });
});

describe('progresión', () => {
  const ex = getExercise('press-banca-barra')!;
  const log = (reps: number[], w = 60) => ({
    uid: 'x',
    exerciseId: ex.id,
    target: { sets: 3, repMin: 6, repMax: 10, restSec: 120, rir: 2 },
    sets: reps.map((r) => ({ weightKg: w, reps: r, done: true })),
  });

  it('sube el peso al completar el rango', () => {
    const s = suggestNext(ex, { repMin: 6, repMax: 10 }, log([10, 10, 10]));
    expect(s.kind).toBe('subir');
    expect(s.weightKg).toBe(62.5);
  });

  it('mantiene el peso y pide una repetición más si no completó', () => {
    const s = suggestNext(ex, { repMin: 6, repMax: 10 }, log([9, 8, 7]));
    expect(s.kind).toBe('mantener');
    expect(s.weightKg).toBe(60);
    expect(s.reps).toBe(10);
  });

  it('recomienda priorizar la técnica la primera vez', () => {
    expect(suggestNext(ex, { repMin: 6, repMax: 10 }, null).kind).toBe('primera');
  });

  it('calcula 1RM y series de aproximación', () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(116.7, 1);
    expect(warmupSets(ex, 80).map((s) => s.weightKg)).toEqual([40, 55, 67.5]);
  });

  it('cuenta la racha semanal', () => {
    const now = new Date('2026-11-20T12:00:00');
    const mk = (iso: string): Workout => ({
      id: iso, routineId: null, dayId: null, name: '', startedAt: iso, completedAt: iso,
      durationSeconds: 0, totalVolumeKg: 0, exercises: [], status: 'completed',
    });
    const hist = [
      mk('2026-11-17T10:00:00'), mk('2026-11-19T10:00:00'),
      mk('2026-11-10T10:00:00'), mk('2026-11-12T10:00:00'),
    ];
    expect(weeklyStreak(hist, 2, now)).toBe(2);
  });
});
