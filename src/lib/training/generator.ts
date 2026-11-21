import type {
  Exercise,
  ExerciseEquipment,
  Mechanics,
  ModalityPreference,
  Routine,
  RoutineDay,
  RoutineExercise,
  SplitType,
} from '@/types/training';
import type {
  EquipmentType,
  ExperienceLevel,
  FitnessGoal,
  InjuryType,
  MuscleId,
  PriorityMuscle,
  UserProfile,
} from '@/types/user';
import { EXERCISES, getExercise, modalityOf } from '@/lib/exercises/catalog';

export type GeneratorProfile = Pick<
  UserProfile,
  'daysPerWeek' | 'sessionMinutes' | 'experience' | 'goal' | 'equipment' | 'injuries' | 'priorityMuscles'
>;

interface Slot {
  muscle: MuscleId;
  kind: Mechanics | 'any';
}

const C = (muscle: MuscleId): Slot => ({ muscle, kind: 'compuesto' });
const I = (muscle: MuscleId): Slot => ({ muscle, kind: 'aislamiento' });

interface Template {
  name: string;
  slots: Slot[];
}

const T: Record<string, Template> = {
  fullA: {
    name: 'Full body A',
    slots: [C('cuadriceps'), C('pectorales'), C('dorsales'), C('isquiotibiales'), I('deltoides_lateral'), I('biceps'), I('triceps'), I('abdomen')],
  },
  fullB: {
    name: 'Full body B',
    slots: [C('gluteo_mayor'), C('espalda_media'), C('deltoides_anterior'), C('cuadriceps'), I('isquiotibiales'), I('pectorales'), I('pantorrillas'), I('oblicuos')],
  },
  fullC: {
    name: 'Full body C',
    slots: [C('isquiotibiales'), C('pectorales'), C('dorsales'), I('cuadriceps'), I('deltoides_posterior'), I('triceps'), I('biceps'), I('abdomen')],
  },
  torsoA: {
    name: 'Torso A',
    slots: [C('pectorales'), C('dorsales'), C('espalda_media'), C('deltoides_anterior'), I('deltoides_lateral'), I('triceps'), I('biceps'), I('deltoides_posterior')],
  },
  torsoB: {
    name: 'Torso B',
    slots: [C('espalda_media'), C('pectorales'), C('dorsales'), I('deltoides_lateral'), I('pectorales'), I('biceps'), I('triceps'), I('abdomen')],
  },
  piernaA: {
    name: 'Pierna A',
    slots: [C('cuadriceps'), C('isquiotibiales'), C('cuadriceps'), I('isquiotibiales'), I('pantorrillas'), I('abdomen'), I('gluteo_medio'), I('aductores')],
  },
  piernaB: {
    name: 'Pierna B',
    slots: [C('gluteo_mayor'), C('cuadriceps'), I('isquiotibiales'), I('cuadriceps'), I('aductores'), I('pantorrillas'), I('oblicuos'), I('gluteo_medio')],
  },
  empuje: {
    name: 'Empuje',
    slots: [C('pectorales'), C('deltoides_anterior'), C('pectorales'), I('deltoides_lateral'), I('triceps'), I('triceps'), I('pectorales'), I('abdomen')],
  },
  tiron: {
    name: 'Tirón',
    slots: [C('dorsales'), C('espalda_media'), I('dorsales'), I('deltoides_posterior'), I('biceps'), I('biceps'), I('trapecio'), I('antebrazos')],
  },
};

const SPLITS: Record<number, { split: SplitType; days: string[] }> = {
  2: { split: 'full_body', days: ['fullA', 'fullB'] },
  3: { split: 'full_body', days: ['fullA', 'fullB', 'fullC'] },
  4: { split: 'torso_pierna', days: ['torsoA', 'piernaA', 'torsoB', 'piernaB'] },
  5: { split: 'hibrida', days: ['torsoA', 'piernaA', 'empuje', 'tiron', 'piernaB'] },
  6: { split: 'ppl', days: ['empuje', 'tiron', 'piernaA', 'empuje', 'tiron', 'piernaB'] },
};

export const SPLIT_LABELS: Record<SplitType, string> = {
  full_body: 'Cuerpo completo',
  torso_pierna: 'Torso / Pierna',
  ppl: 'Empuje / Tirón / Pierna',
  hibrida: 'Híbrida (Torso-Pierna + PPL)',
  personalizada: 'Personalizada',
};

const UPPER: MuscleId[] = [
  'pectorales', 'deltoides_anterior', 'deltoides_lateral', 'deltoides_posterior', 'biceps',
  'triceps', 'antebrazos', 'dorsales', 'trapecio', 'espalda_media',
];
const LOWER: MuscleId[] = [
  'gluteo_mayor', 'gluteo_medio', 'cuadriceps', 'isquiotibiales', 'aductores', 'pantorrillas', 'lumbares',
];

function regionOf(m: MuscleId): 'upper' | 'lower' | 'core' {
  if (UPPER.includes(m)) return 'upper';
  if (LOWER.includes(m)) return 'lower';
  return 'core';
}

export function slotsForMinutes(minutes: number): number {
  if (minutes <= 30) return 4;
  if (minutes <= 45) return 5;
  if (minutes <= 60) return 6;
  if (minutes <= 75) return 7;
  return 8;
}

export function allowedEquipmentFor(equipment: EquipmentType[]): ExerciseEquipment[] {
  const set = new Set<ExerciseEquipment>(['peso_corporal']);
  for (const e of equipment) {
    if (e === 'gimnasio_completo') {
      ['barra', 'mancuernas', 'maquina', 'polea', 'kettlebell', 'banda'].forEach((x) =>
        set.add(x as ExerciseEquipment)
      );
    }
    if (e === 'casa_mancuernas') set.add('mancuernas');
    if (e === 'bandas') set.add('banda');
  }
  return [...set];
}

const LEVEL_RANK: Record<ExperienceLevel, number> = { principiante: 0, intermedio: 1, avanzado: 2 };

export interface PickContext {
  allowed: ExerciseEquipment[];
  injuries: InjuryType[];
  experience: ExperienceLevel;
  modality: ModalityPreference;
  usedInDay: Set<string>;
  usedInWeek: Map<string, number>;
  variant: number;
}

function scoreExercise(x: Exercise, slot: Slot, ctx: PickContext): number {
  let s = 0;
  if (x.primary[0] === slot.muscle) s += 6;
  else if (x.primary.includes(slot.muscle)) s += 3;
  if (slot.kind !== 'any' && x.mechanics === slot.kind) s += 4;
  if (ctx.modality !== 'mixto' && modalityOf(x.equipment) === ctx.modality) s += 8;
  const lvl = LEVEL_RANK[x.level];
  const me = LEVEL_RANK[ctx.experience];
  if (lvl > me) s -= 10;
  else if (lvl === me) s += 1;
  // Para principiantes, máquinas y poleas dan estabilidad mientras se aprende la técnica.
  if (ctx.experience === 'principiante' && (x.equipment === 'maquina' || x.equipment === 'polea')) s += 2;
  if (x.timed && slot.kind === 'compuesto') s -= 3;
  s -= (ctx.usedInWeek.get(x.id) ?? 0) * 3;
  return s;
}

export function pickExercise(slot: Slot, ctx: PickContext): Exercise | null {
  const candidates = EXERCISES.filter(
    (x) =>
      x.primary.includes(slot.muscle) &&
      ctx.allowed.includes(x.equipment) &&
      !x.avoidIf.some((i) => ctx.injuries.includes(i)) &&
      !ctx.usedInDay.has(x.id)
  );
  if (!candidates.length) return null;
  const ranked = candidates
    .map((x) => ({ x, s: scoreExercise(x, slot, ctx) }))
    .sort((a, b) => b.s - a.s || a.x.id.localeCompare(b.x.id));
  // Variante: rota entre las mejores opciones con puntuación cercana para dar variedad A/B.
  const top = ranked.filter((r) => r.s >= ranked[0].s - 2).slice(0, 3);
  return top[ctx.variant % top.length].x;
}

interface Prescription {
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  rir: number;
}

export function prescribe(
  goal: FitnessGoal,
  experience: ExperienceLevel,
  ex: Exercise,
  isFirst: boolean
): Prescription {
  const compound = ex.mechanics === 'compuesto';
  let p: Prescription;
  switch (goal) {
    case 'fuerza':
      p = compound
        ? isFirst
          ? { sets: 4, repMin: 3, repMax: 6, restSec: 180, rir: 2 }
          : { sets: 3, repMin: 6, repMax: 8, restSec: 150, rir: 2 }
        : { sets: 3, repMin: 8, repMax: 12, restSec: 90, rir: 2 };
      break;
    case 'ganar_masa':
      p = compound
        ? { sets: 3, repMin: 6, repMax: 10, restSec: 150, rir: 2 }
        : { sets: 3, repMin: 10, repMax: 15, restSec: 75, rir: 1 };
      break;
    case 'perder_grasa':
      p = compound
        ? { sets: 3, repMin: 8, repMax: 12, restSec: 105, rir: 2 }
        : { sets: 3, repMin: 12, repMax: 15, restSec: 60, rir: 1 };
      break;
    case 'tonificar_resistencia':
      p = compound
        ? { sets: 3, repMin: 10, repMax: 15, restSec: 75, rir: 2 }
        : { sets: 3, repMin: 12, repMax: 20, restSec: 45, rir: 1 };
      break;
    case 'recomposicion':
    default:
      p = compound
        ? { sets: 3, repMin: 8, repMax: 12, restSec: 120, rir: 2 }
        : { sets: 3, repMin: 10, repMax: 15, restSec: 75, rir: 1 };
  }
  if (experience === 'principiante') {
    p = { ...p, sets: compound ? Math.min(p.sets, 3) : 2, rir: 3 };
    if (goal === 'fuerza' && compound) p = { ...p, repMin: 6, repMax: 8 };
  } else if (experience === 'avanzado' && isFirst && compound) {
    p = { ...p, sets: p.sets + 1 };
  }
  if (ex.timed) {
    p = experience === 'principiante'
      ? { ...p, repMin: 20, repMax: 30, restSec: 60 }
      : { ...p, repMin: 30, repMax: 45, restSec: 60 };
  }
  return p;
}

let uidCounter = 0;
export function newUid(prefix = 'rx'): string {
  uidCounter += 1;
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}${uidCounter}`;
}

export function toRoutineExercise(
  ex: Exercise,
  goal: FitnessGoal,
  experience: ExperienceLevel,
  isFirst: boolean,
  extraSets = 0
): RoutineExercise {
  const p = prescribe(goal, experience, ex, isFirst);
  return { uid: newUid(), exerciseId: ex.id, ...p, sets: p.sets + extraSets };
}

/** Ordena y amplía las ranuras del día según los músculos prioritarios. */
function applyPriorities(slots: Slot[], cap: number, priorities: PriorityMuscle[], dayMuscles: Set<MuscleId>): Slot[] {
  let base = slots.slice(0, cap);
  const relevant = priorities.filter((p) => {
    if (dayMuscles.has(p.muscle)) return true;
    const r = regionOf(p.muscle);
    return r === 'core' ? false : [...dayMuscles].some((m) => regionOf(m) === r);
  });
  if (!relevant.length) return base;

  const extra: Slot[] = [];
  for (const p of relevant) {
    const inBase = base.some((s) => s.muscle === p.muscle);
    if (!inBase) extra.push(C(p.muscle));
    if (p.level === 2) extra.push(I(p.muscle));
  }
  // Los prioritarios van al inicio, cuando hay más energía.
  const prioritySet = new Set(relevant.map((p) => p.muscle));
  const first = base.filter((s) => prioritySet.has(s.muscle));
  const rest = base.filter((s) => !prioritySet.has(s.muscle));
  base = [...first, ...extra, ...rest];
  // Permitimos hasta +2 ejercicios sobre el límite por tiempo.
  return base.slice(0, cap + Math.min(2, extra.length));
}

export interface BuildDayOptions {
  slots: Slot[];
  name: string;
  profile: GeneratorProfile;
  modality: ModalityPreference;
  variant: number;
  usedInWeek: Map<string, number>;
  applyPriority?: boolean;
}

export function buildDay(opts: BuildDayOptions): RoutineDay {
  const { profile } = opts;
  const cap = slotsForMinutes(profile.sessionMinutes);
  const dayMuscles = new Set(opts.slots.map((s) => s.muscle));
  const slots =
    opts.applyPriority === false
      ? opts.slots.slice(0, cap)
      : applyPriorities(opts.slots, cap, profile.priorityMuscles ?? [], dayMuscles);

  const ctx: PickContext = {
    allowed: allowedEquipmentFor(profile.equipment),
    injuries: profile.injuries.filter((i): i is InjuryType => i !== 'ninguna'),
    experience: profile.experience,
    modality: opts.modality,
    usedInDay: new Set(),
    usedInWeek: opts.usedInWeek,
    variant: opts.variant,
  };

  const exercises: RoutineExercise[] = [];
  for (const slot of slots) {
    let ex = pickExercise(slot, ctx);
    if (!ex && slot.kind !== 'any') ex = pickExercise({ ...slot, kind: 'any' }, ctx);
    if (!ex) continue;
    ctx.usedInDay.add(ex.id);
    opts.usedInWeek.set(ex.id, (opts.usedInWeek.get(ex.id) ?? 0) + 1);
    const pr = profile.priorityMuscles?.find((p) => ex!.primary.includes(p.muscle));
    const extraSets = pr ? (pr.level === 2 ? 1 : exercises.some((e) => getExercise(e.exerciseId)?.primary.includes(pr.muscle)) ? 0 : 1) : 0;
    exercises.push(
      toRoutineExercise(ex, profile.goal, profile.experience, exercises.length === 0, extraSets)
    );
  }

  return {
    id: newUid('day'),
    name: opts.name,
    focus: [...new Set(slots.map((s) => s.muscle))].slice(0, 6),
    exercises,
  };
}

export function generateRoutine(
  profile: GeneratorProfile,
  modality: ModalityPreference = 'mixto'
): Routine {
  const days = Math.min(6, Math.max(2, profile.daysPerWeek));
  const plan = SPLITS[days];
  const usedInWeek = new Map<string, number>();
  const seen: Record<string, number> = {};
  const routineDays = plan.days.map((key, i) => {
    seen[key] = (seen[key] ?? 0) + 1;
    const tpl = T[key];
    const suffix = seen[key] > 1 ? ' (variante)' : '';
    return buildDay({
      slots: tpl.slots,
      name: `${tpl.name}${suffix}`,
      profile,
      modality,
      variant: seen[key] - 1 + i,
      usedInWeek,
    });
  });
  const now = new Date().toISOString();
  return {
    id: 'current',
    name: `Plan ${SPLIT_LABELS[plan.split]}`,
    split: plan.split,
    modalityPreference: modality,
    days: routineDays,
    createdAt: now,
    updatedAt: now,
  };
}

/** Construye un día personalizado a partir de los músculos elegidos por el usuario. */
export function buildCustomDay(
  muscles: MuscleId[],
  profile: GeneratorProfile,
  modality: ModalityPreference,
  name: string
): RoutineDay {
  const cap = slotsForMinutes(profile.sessionMinutes);
  const slots: Slot[] = [];
  // Un compuesto por músculo y luego aislamientos hasta llenar el tiempo disponible.
  muscles.forEach((m) => slots.push(C(m)));
  let i = 0;
  while (slots.length < cap && muscles.length) {
    slots.push(I(muscles[i % muscles.length]));
    i += 1;
    if (i > cap * 2) break;
  }
  return buildDay({
    slots,
    name,
    profile,
    modality,
    variant: 0,
    usedInWeek: new Map(),
    applyPriority: false,
  });
}

/** Alternativas para cambiar un ejercicio: mismo músculo, filtradas por modalidad. */
export function alternativesFor(
  exerciseId: string,
  profile: Pick<GeneratorProfile, 'equipment' | 'injuries'>,
  muscle?: MuscleId
): Exercise[] {
  const ex = getExercise(exerciseId);
  if (!ex) return [];
  const target = muscle ?? ex.primary[0];
  const allowed = allowedEquipmentFor(profile.equipment);
  const injuries: InjuryType[] = profile.injuries.filter((i) => i !== 'ninguna');
  return EXERCISES.filter(
    (x) =>
      x.id !== exerciseId &&
      x.primary.includes(target) &&
      allowed.includes(x.equipment) &&
      !x.avoidIf.some((i) => injuries.includes(i))
  );
}

/** Series semanales efectivas por músculo (principal = 1, secundario = 0,5). */
export function weeklySetsByMuscle(routine: Routine): Partial<Record<MuscleId, number>> {
  const out: Partial<Record<MuscleId, number>> = {};
  for (const day of routine.days) {
    for (const rx of day.exercises) {
      const ex = getExercise(rx.exerciseId);
      if (!ex) continue;
      ex.primary.forEach((m) => (out[m] = (out[m] ?? 0) + rx.sets));
      ex.secondary.forEach((m) => (out[m] = (out[m] ?? 0) + rx.sets * 0.5));
    }
  }
  return out;
}
