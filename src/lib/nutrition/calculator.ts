import type { FitnessGoal, NutritionEstimate, Sex } from '@/types/user';

export interface NutritionInput {
  sex: Sex;
  birthDate: string; // YYYY-MM-DD
  weightKg: number;
  heightCm: number;
  daysPerWeek: number;
  sessionMinutes: number;
  goal: FitnessGoal;
  referenceDate?: Date;
}

export function calculateAge(birthDate: string, refDate = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day) return 28;
  let age = refDate.getFullYear() - year;
  const mDiff = refDate.getMonth() + 1 - month;
  if (mDiff < 0 || (mDiff === 0 && refDate.getDate() < day)) {
    age -= 1;
  }
  return Math.max(14, Math.min(95, age));
}

export function getBmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Bajo peso';
  if (bmi < 25) return 'Peso saludable';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidad';
}

/**
 * Fórmula Mifflin-St Jeor (kcal/día)
 * Hombre: 10 * peso(kg) + 6.25 * altura(cm) - 5 * edad + 5
 * Mujer:  10 * peso(kg) + 6.25 * altura(cm) - 5 * edad - 161
 */
export function calculateMifflinStJeorBMR(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

/**
 * Factor de actividad estimado según días/semana y duración por sesión
 */
export function getActivityFactor(daysPerWeek: number, sessionMinutes: number): number {
  const weeklyHours = (daysPerWeek * sessionMinutes) / 60;
  if (weeklyHours <= 2.5) return 1.375; // Ligero
  if (weeklyHours <= 5) return 1.55; // Moderado
  if (weeklyHours <= 7.5) return 1.675; // Activo
  return 1.75; // Muy activo
}

export function calculateNutritionEstimate(input: NutritionInput): NutritionEstimate {
  const age = calculateAge(input.birthDate, input.referenceDate);
  const heightM = input.heightCm / 100;
  const bmi = Number((input.weightKg / (heightM * heightM)).toFixed(1));
  const bmr = calculateMifflinStJeorBMR(input.sex, input.weightKg, input.heightCm, age);
  const factor = getActivityFactor(input.daysPerWeek, input.sessionMinutes);
  const tdee = Math.round(bmr * factor);

  // Ajuste calórico por objetivo:
  // Déficit: -300 a -500 | Superávit: +250 a +400 | Mantenimiento: 0
  let calorieDelta = 0;
  let proteinPerKg = 1.9;

  switch (input.goal) {
    case 'ganar_masa':
      calorieDelta = 300;
      proteinPerKg = 1.9;
      break;
    case 'fuerza':
      calorieDelta = 250;
      proteinPerKg = 1.8;
      break;
    case 'perder_grasa':
      calorieDelta = tdee > 2400 ? -450 : -350;
      proteinPerKg = 2.1;
      break;
    case 'recomposicion':
      calorieDelta = 0;
      proteinPerKg = 2.0;
      break;
    case 'tonificar_resistencia':
      calorieDelta = -300;
      proteinPerKg = 1.8;
      break;
  }

  // Piso de seguridad saludable
  const minSafeCalories = input.sex === 'male' ? 1500 : 1250;
  const targetCalories = Math.max(minSafeCalories, Math.round(tdee + calorieDelta));
  const effectiveDelta = targetCalories - tdee;

  const proteinG = Math.round(input.weightKg * proteinPerKg);
  const proteinKcal = proteinG * 4;

  // Grasas ~25% de calorías objetivo (mínimo 0.7 g/kg para salud hormonal)
  const fatG = Math.max(
    Math.round(input.weightKg * 0.7),
    Math.round((targetCalories * 0.25) / 9)
  );
  const fatKcal = fatG * 9;

  // Carbohidratos con el resto de calorías
  const carbsG = Math.max(50, Math.round((targetCalories - proteinKcal - fatKcal) / 4));

  return {
    bmi,
    bmiCategory: getBmiCategory(bmi),
    bmr,
    tdee,
    targetCalories,
    calorieDelta: effectiveDelta,
    proteinG,
    proteinPerKg,
    fatG,
    carbsG,
    updatedAt: (input.referenceDate ?? new Date()).toISOString(),
  };
}
