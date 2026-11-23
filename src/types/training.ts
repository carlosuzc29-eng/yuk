import type { ExperienceLevel, InjuryType, MuscleId } from './user';

/** Implemento concreto con el que se ejecuta un ejercicio. */
export type ExerciseEquipment =
  | 'barra'
  | 'mancuernas'
  | 'maquina'
  | 'polea'
  | 'peso_corporal'
  | 'kettlebell'
  | 'banda';

/** Agrupación que ve el usuario al personalizar ("¿máquina, polea o peso corporal?"). */
export type Modality = 'maquina' | 'polea' | 'peso_libre' | 'peso_corporal' | 'banda';

export type Mechanics = 'compuesto' | 'aislamiento';

/** Claves de animación (ver src/lib/exercises/poses.ts). */
export type MovementPattern =
  | 'squat_back'
  | 'squat_front'
  | 'squat_machine'
  | 'leg_press'
  | 'lunge'
  | 'split_squat_rear'
  | 'step_up'
  | 'hinge'
  | 'good_morning'
  | 'hip_thrust'
  | 'glute_bridge'
  | 'leg_extension'
  | 'leg_curl_seated'
  | 'leg_curl_lying'
  | 'nordic_curl'
  | 'calf_raise'
  | 'calf_raise_seated'
  | 'bench_press'
  | 'incline_press'
  | 'chest_press_machine'
  | 'push_up'
  | 'dip'
  | 'fly_cable'
  | 'fly_lying'
  | 'overhead_press'
  | 'overhead_press_seated'
  | 'pike_push_up'
  | 'lateral_raise'
  | 'rear_delt_fly'
  | 'face_pull'
  | 'shrug'
  | 'row_seated'
  | 'row_bent'
  | 'row_chest_supported'
  | 'inverted_row'
  | 'pulldown'
  | 'pull_up'
  | 'straight_arm_pulldown'
  | 'curl'
  | 'curl_preacher'
  | 'curl_bayesian'
  | 'pushdown'
  | 'triceps_overhead'
  | 'skull_crusher'
  | 'wrist_curl'
  | 'crunch'
  | 'cable_crunch'
  | 'hanging_leg_raise'
  | 'plank'
  | 'side_plank'
  | 'dead_bug'
  | 'pallof_press'
  | 'ab_wheel'
  | 'back_extension'
  | 'kb_swing'
  | 'farmer_carry'
  | 'hip_abduction'
  | 'hip_adduction'
  | 'glute_kickback';

export interface Exercise {
  id: string;
  name: string;
  primary: MuscleId[];
  secondary: MuscleId[];
  equipment: ExerciseEquipment;
  pattern: MovementPattern;
  mechanics: Mechanics;
  level: ExperienceLevel;
  /** Pasos de ejecución en orden: preparación → ejecución → vuelta. */
  steps: string[];
  /** Errores frecuentes a evitar. */
  mistakes: string[];
  /** Consejo específico para quien está empezando. */
  beginnerTip: string;
  /** Evitar si el usuario declaró estas lesiones. */
  avoidIf: InjuryType[];
  unilateral?: boolean;
  /** Se mide en segundos (planchas, cargadas) en lugar de repeticiones. */
  timed?: boolean;
  /** URL opcional de vídeo real (mp4/webm) para reemplazar la animación. */
  videoUrl?: string;
}

export interface RoutineExercise {
  /** Id único dentro de la rutina (permite repetir ejercicio en días distintos). */
  uid: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  /** Repeticiones en reserva objetivo (0–4). */
  rir: number;
  notes?: string;
}

export interface RoutineDay {
  id: string;
  name: string;
  /** Músculos principales del día (para mostrar y regenerar). */
  focus: MuscleId[];
  exercises: RoutineExercise[];
}

export type SplitType = 'full_body' | 'torso_pierna' | 'ppl' | 'hibrida' | 'personalizada';

export type ModalityPreference = 'mixto' | Modality;

export interface Routine {
  id: string;
  name: string;
  split: SplitType;
  modalityPreference: ModalityPreference;
  days: RoutineDay[];
  /** Versión del generador que creó la rutina. */
  generatorVersion?: number;
  /** Huella del perfil con el que se generó (para detectar cambios). */
  profileKey?: string;
  /** true si el usuario la modificó a mano. */
  edited?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Rutina guardada en favoritos: un plan completo (todos sus días) o un único día.
 * Es una copia: editar la rutina actual no cambia la favorita, y viceversa.
 */
export interface FavoriteRoutine {
  id: string;
  kind: 'plan' | 'day';
  name: string;
  split: SplitType;
  modalityPreference: ModalityPreference;
  days: RoutineDay[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSet {
  weightKg: number | null;
  reps: number | null;
  /** Segundos, para ejercicios cronometrados. */
  seconds?: number | null;
  rir?: number | null;
  done: boolean;
  warmup?: boolean;
}

export interface WorkoutExerciseLog {
  uid: string;
  exerciseId: string;
  target: { sets: number; repMin: number; repMax: number; restSec: number; rir: number };
  sets: WorkoutSet[];
  notes?: string;
}

export interface Workout {
  id: string;
  routineId: string | null;
  dayId: string | null;
  name: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  totalVolumeKg: number;
  exercises: WorkoutExerciseLog[];
  /** Sensación general 1–5. */
  feeling?: number | null;
  notes?: string | null;
  status: 'in_progress' | 'completed';
}

export interface BodyWeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
}
