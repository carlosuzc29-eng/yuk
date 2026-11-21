export type Sex = 'male' | 'female';

export type ExperienceLevel = 'principiante' | 'intermedio' | 'avanzado';

export type EquipmentType =
  | 'gimnasio_completo'
  | 'casa_mancuernas'
  | 'peso_corporal'
  | 'bandas';

export type InjuryType =
  | 'hombro'
  | 'codo'
  | 'muneca'
  | 'espalda_baja'
  | 'rodilla'
  | 'tobillo'
  | 'cadera'
  | 'cuello'
  | 'ninguna';

export type FitnessGoal =
  | 'ganar_masa'
  | 'perder_grasa'
  | 'recomposicion'
  | 'fuerza'
  | 'tonificar_resistencia';

export type MuscleId =
  | 'pectorales'
  | 'deltoides_anterior'
  | 'deltoides_lateral'
  | 'deltoides_posterior'
  | 'biceps'
  | 'triceps'
  | 'antebrazos'
  | 'dorsales'
  | 'trapecio'
  | 'espalda_media'
  | 'lumbares'
  | 'abdomen'
  | 'oblicuos'
  | 'gluteo_mayor'
  | 'gluteo_medio'
  | 'cuadriceps'
  | 'isquiotibiales'
  | 'aductores'
  | 'pantorrillas';

export type PriorityLevel = 1 | 2;

export interface PriorityMuscle {
  muscle: MuscleId;
  level: PriorityLevel;
}

export interface NutritionEstimate {
  bmi: number;
  bmiCategory: string;
  bmr: number;
  tdee: number;
  targetCalories: number;
  calorieDelta: number;
  proteinG: number;
  proteinPerKg: number;
  fatG: number;
  carbsG: number;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  sex: Sex;
  birthDate: string; // YYYY-MM-DD
  weightKg: number;
  heightCm: number;
  bodyFatPct?: number | null;
  experience: ExperienceLevel;
  daysPerWeek: number; // 2-6
  sessionMinutes: 30 | 45 | 60 | 75 | 90;
  equipment: EquipmentType[];
  injuries: InjuryType[];
  goal: FitnessGoal;
  priorityMuscles: PriorityMuscle[];
  nutritionEstimate: NutritionEstimate;
  groupId?: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GroupRole = 'admin' | 'member';

export interface GroupInfo {
  id: string;
  name: string;
  inviteCode: string;
  adminUid: string;
  createdAt: string;
}

export interface GroupMember {
  uid: string;
  displayName: string;
  role: GroupRole;
  joinedAt: string;
  currentStreak: number;
  weeklyPlannedSessions: number;
  weeklyCompletedSessions: number;
  monthlyCompliancePct: number;
  lastWorkoutAt?: string | null;
}

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  pectorales: 'Pectorales',
  deltoides_anterior: 'Deltoides anterior',
  deltoides_lateral: 'Deltoides lateral',
  deltoides_posterior: 'Deltoides posterior',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebrazos: 'Antebrazos',
  dorsales: 'Dorsales',
  trapecio: 'Trapecio',
  espalda_media: 'Espalda media (romboides)',
  lumbares: 'Lumbares',
  abdomen: 'Abdomen',
  oblicuos: 'Oblicuos',
  gluteo_mayor: 'Glúteo mayor',
  gluteo_medio: 'Glúteo medio',
  cuadriceps: 'Cuádriceps',
  isquiotibiales: 'Isquiotibiales',
  aductores: 'Aductores',
  pantorrillas: 'Pantorrillas',
};

export const INJURY_LABELS: Record<InjuryType, string> = {
  hombro: 'Hombro',
  codo: 'Codo',
  muneca: 'Muñeca',
  espalda_baja: 'Espalda baja',
  rodilla: 'Rodilla',
  tobillo: 'Tobillo',
  cadera: 'Cadera',
  cuello: 'Cuello',
  ninguna: 'Ninguna',
};

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  gimnasio_completo: 'Gimnasio completo',
  casa_mancuernas: 'Casa con mancuernas',
  peso_corporal: 'Solo peso corporal',
  bandas: 'Bandas elásticas',
};

export const GOAL_LABELS: Record<FitnessGoal, { label: string; desc: string }> = {
  ganar_masa: {
    label: 'Ganar masa muscular',
    desc: 'Hipertrofia con superávit calórico moderado (+250 a +400 kcal).',
  },
  perder_grasa: {
    label: 'Perder grasa',
    desc: 'Déficit sostenible (-300 a -500 kcal) preservando tu músculo.',
  },
  recomposicion: {
    label: 'Recomposición corporal',
    desc: 'Calorías de mantenimiento y proteína alta para mejorar composición.',
  },
  fuerza: {
    label: 'Fuerza',
    desc: 'Cargas altas en básicos (3–6 reps) con soporte energético completo.',
  },
  tonificar_resistencia: {
    label: 'Tonificar y resistencia',
    desc: 'Mayor densidad de entrenamiento, 8–15 reps y descansos más cortos.',
  },
};
