import { describe, it, expect } from 'vitest';
import {
  calculateMifflinStJeorBMR,
  calculateNutritionEstimate,
} from '@/lib/nutrition/calculator';

describe('Calculadora nutricional Mifflin-St Jeor', () => {
  it('calcula correctamente el BMR para hombre y mujer', () => {
    // Hombre: 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calculateMifflinStJeorBMR('male', 80, 180, 30)).toBe(1780);
    // Mujer: 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 -> 1330
    expect(calculateMifflinStJeorBMR('female', 60, 165, 28)).toBe(1330);
  });

  it('aplica superávit, déficit y mantenimiento dentro de los rangos requeridos', () => {
    const refDate = new Date('2026-11-21T12:00:00Z');

    const bulk = calculateNutritionEstimate({
      sex: 'male',
      birthDate: '1996-01-10',
      weightKg: 78,
      heightCm: 178,
      daysPerWeek: 4,
      sessionMinutes: 60,
      goal: 'ganar_masa',
      referenceDate: refDate,
    });
    expect(bulk.calorieDelta).toBeGreaterThanOrEqual(250);
    expect(bulk.calorieDelta).toBeLessThanOrEqual(400);
    expect(bulk.proteinPerKg).toBeGreaterThanOrEqual(1.6);
    expect(bulk.proteinPerKg).toBeLessThanOrEqual(2.2);

    const cut = calculateNutritionEstimate({
      sex: 'female',
      birthDate: '1998-06-20',
      weightKg: 64,
      heightCm: 165,
      daysPerWeek: 4,
      sessionMinutes: 60,
      goal: 'perder_grasa',
      referenceDate: refDate,
    });
    expect(cut.calorieDelta).toBeLessThanOrEqual(-300);
    expect(cut.calorieDelta).toBeGreaterThanOrEqual(-500);
    expect(cut.proteinPerKg).toBeGreaterThanOrEqual(1.6);
    expect(cut.proteinPerKg).toBeLessThanOrEqual(2.2);

    const recomp = calculateNutritionEstimate({
      sex: 'male',
      birthDate: '1995-03-15',
      weightKg: 75,
      heightCm: 175,
      daysPerWeek: 3,
      sessionMinutes: 60,
      goal: 'recomposicion',
      referenceDate: refDate,
    });
    expect(recomp.calorieDelta).toBe(0);
  });
});
