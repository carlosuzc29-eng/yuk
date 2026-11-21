'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/components/providers/AuthProvider';
import { saveUserProfile } from '@/lib/firebase/auth-service';
import { calculateNutritionEstimate } from '@/lib/nutrition/calculator';
import { MuscleMapSVG } from '@/components/onboarding/MuscleMapSVG';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import {
  EQUIPMENT_LABELS,
  GOAL_LABELS,
  INJURY_LABELS,
  MUSCLE_LABELS,
  type EquipmentType,
  type ExperienceLevel,
  type FitnessGoal,
  type InjuryType,
  type PriorityMuscle,
  type Sex,
  type UserProfile,
} from '@/types/user';
import { ArrowLeft, ArrowRight, CheckCircle2, Info } from 'lucide-react';

const TOTAL_STEPS = 7; // 6 pasos de entrada + pantalla de resumen

const STEP_TITLES = [
  'Tus datos básicos',
  'Tu experiencia',
  'Disponibilidad y equipo',
  'Lesiones o limitaciones',
  'Tu objetivo principal',
  'Mapa muscular de énfasis',
  'Tu resumen estimado',
];

const EXPERIENCE_OPTIONS: { id: ExperienceLevel; label: string; desc: string }[] = [
  { id: 'principiante', label: 'Principiante', desc: 'Menos de 6 meses entrenando fuerza de forma constante.' },
  { id: 'intermedio', label: 'Intermedio', desc: 'Entre 6 meses y 2 años entrenando con técnica sólida.' },
  { id: 'avanzado', label: 'Avanzado', desc: 'Más de 2 años entrenando y manejando progresión de cargas.' },
];

const SESSION_MINUTES: (30 | 45 | 60 | 75 | 90)[] = [30, 45, 60, 75, 90];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Paso 1: Datos
  const [displayName, setDisplayName] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [birthDate, setBirthDate] = useState('1998-05-15');
  const [weightKg, setWeightKg] = useState('72');
  const [heightCm, setHeightCm] = useState('174');
  const [bodyFatPct, setBodyFatPct] = useState('');

  // Paso 2: Experiencia
  const [experience, setExperience] = useState<ExperienceLevel>('intermedio');

  // Paso 3: Disponibilidad
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [sessionMinutes, setSessionMinutes] = useState<30 | 45 | 60 | 75 | 90>(60);
  const [equipment, setEquipment] = useState<EquipmentType[]>(['gimnasio_completo']);

  // Paso 4: Lesiones
  const [injuries, setInjuries] = useState<InjuryType[]>(['ninguna']);

  // Paso 5: Objetivo
  const [goal, setGoal] = useState<FitnessGoal>('ganar_masa');

  // Paso 6: Músculos de énfasis
  const [priorityMuscles, setPriorityMuscles] = useState<PriorityMuscle[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    if (profile) {
      setDisplayName(profile.displayName || user?.displayName || '');
      setSex(profile.sex);
      setBirthDate(profile.birthDate);
      setWeightKg(String(profile.weightKg));
      setHeightCm(String(profile.heightCm));
      setBodyFatPct(profile.bodyFatPct ? String(profile.bodyFatPct) : '');
      setExperience(profile.experience);
      setDaysPerWeek(profile.daysPerWeek);
      setSessionMinutes(profile.sessionMinutes);
      setEquipment(profile.equipment.length ? profile.equipment : ['gimnasio_completo']);
      setInjuries(profile.injuries.length ? profile.injuries : ['ninguna']);
      setGoal(profile.goal);
      setPriorityMuscles(profile.priorityMuscles || []);
    } else if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [loading, user, profile, router]);

  const parsedWeight = Number(weightKg) || 70;
  const parsedHeight = Number(heightCm) || 170;

  const nutritionEstimate = useMemo(
    () =>
      calculateNutritionEstimate({
        sex,
        birthDate,
        weightKg: Math.max(30, Math.min(250, parsedWeight)),
        heightCm: Math.max(120, Math.min(230, parsedHeight)),
        daysPerWeek,
        sessionMinutes,
        goal,
      }),
    [sex, birthDate, parsedWeight, parsedHeight, daysPerWeek, sessionMinutes, goal]
  );

  const toggleEquipment = (item: EquipmentType) => {
    setEquipment((prev) => {
      if (prev.includes(item)) {
        return prev.length > 1 ? prev.filter((x) => x !== item) : prev;
      }
      return [...prev, item];
    });
  };

  const toggleInjury = (item: InjuryType) => {
    if (item === 'ninguna') {
      setInjuries(['ninguna']);
      return;
    }
    setInjuries((prev) => {
      const withoutNone = prev.filter((x) => x !== 'ninguna');
      if (withoutNone.includes(item)) {
        const next = withoutNone.filter((x) => x !== item);
        return next.length === 0 ? ['ninguna'] : next;
      }
      return [...withoutNone, item];
    });
  };

  const validateCurrentStep = (): boolean => {
    setError('');
    if (step === 0) {
      if (displayName.trim().length < 2) {
        setError('Escribe tu nombre (al menos 2 caracteres).');
        return false;
      }
      if (!birthDate) {
        setError('Selecciona tu fecha de nacimiento.');
        return false;
      }
      if (parsedWeight < 30 || parsedWeight > 250) {
        setError('Ingresa un peso válido entre 30 y 250 kg.');
        return false;
      }
      if (parsedHeight < 120 || parsedHeight > 230) {
        setError('Ingresa una altura válida entre 120 y 230 cm.');
        return false;
      }
    }
    if (step === 2 && equipment.length === 0) {
      setError('Selecciona al menos un tipo de equipo.');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateCurrentStep()) return;
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  };

  const prevStep = () => {
    setError('');
    setStep((s) => Math.max(0, s - 1));
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    const now = new Date().toISOString();
    const nextProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: displayName.trim(),
      sex,
      birthDate,
      weightKg: Number(parsedWeight.toFixed(1)),
      heightCm: Math.round(parsedHeight),
      bodyFatPct: bodyFatPct ? Number(bodyFatPct) : null,
      experience,
      daysPerWeek,
      sessionMinutes,
      equipment,
      injuries,
      goal,
      priorityMuscles,
      nutritionEstimate,
      groupId: profile?.groupId ?? null,
      onboardingCompleted: true,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await saveUserProfile(nextProfile);
      await refreshProfile();
      router.replace(nextProfile.groupId ? '/hoy' : '/grupo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos guardar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const progressPct = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  return (
    <div className="min-h-dvh max-w-lg mx-auto px-5 py-6 flex flex-col">
      {/* Cabecera y barra de progreso */}
      <header className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-[20px] font-light tracking-[-0.04em]">yuk</span>
          <span className="rounded-[8px] bg-[var(--accent)] text-white text-xs font-medium px-2.5 py-1">
            Paso {step + 1} de {TOTAL_STEPS}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso del onboarding"
          className="h-[2px] w-full rounded-full bg-[var(--border)] overflow-hidden"
        >
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <h1 className="font-display text-[34px] pt-2">
          {STEP_TITLES[step]}
        </h1>
      </header>

      {/* Contenido por paso */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* PASO 1: Datos */}
            {step === 0 && (
              <Card className="p-5 space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="ob-name" className="field-label pl-1">
                    ¿Cómo quieres que te llamemos?
                  </label>
                  <input
                    id="ob-name"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Tu nombre"
                    className="field"
                  />
                </div>

                <fieldset className="space-y-1.5">
                  <legend className="field-label pl-1 mb-1.5">Sexo biológico (para silueta y fórmulas)</legend>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        { id: 'male', label: 'Hombre' },
                        { id: 'female', label: 'Mujer' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSex(opt.id)}
                        data-active={sex === opt.id}
                        className="choice min-h-[48px] font-medium text-sm"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-1.5">
                  <label htmlFor="ob-birth" className="field-label pl-1">
                    Fecha de nacimiento
                  </label>
                  <input
                    id="ob-birth"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="ob-weight" className="field-label pl-1">
                      Peso (kg)
                    </label>
                    <input
                      id="ob-weight"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={30}
                      max={250}
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="ob-height" className="field-label pl-1">
                      Altura (cm)
                    </label>
                    <input
                      id="ob-height"
                      type="number"
                      inputMode="numeric"
                      min={120}
                      max={230}
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      className="field"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="ob-bf" className="field-label pl-1">
                    % de grasa corporal <span className="text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <input
                    id="ob-bf"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min={5}
                    max={55}
                    value={bodyFatPct}
                    onChange={(e) => setBodyFatPct(e.target.value)}
                    placeholder="Ej. 18"
                    className="field"
                  />
                </div>
              </Card>
            )}

            {/* PASO 2: Experiencia */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-muted)]">
                  Esto define tu volumen semanal inicial de series por grupo muscular.
                </p>
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExperience(opt.id)}
                    data-active={experience === opt.id}
                    className="choice !rounded-[5px] w-full text-left p-4 min-h-[64px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-base text-[var(--text)]">{opt.label}</span>
                      {experience === opt.id && (
                        <CheckCircle2 className="h-5 w-5 text-[var(--accent)]" />
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
            )}

            {/* PASO 3: Disponibilidad y equipo */}
            {step === 2 && (
              <div className="space-y-4">
                <Card className="p-4 space-y-3">
                  <p className="text-sm font-medium">¿Cuántos días por semana puedes entrenar?</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[2, 3, 4, 5, 6].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDaysPerWeek(d)}
                        data-active={daysPerWeek === d}
                        className="choice min-h-[52px] text-2xl font-light tabular-nums"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <p className="text-sm font-medium">Minutos disponibles por sesión</p>
                  <div className="grid grid-cols-5 gap-2">
                    {SESSION_MINUTES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSessionMinutes(m)}
                        data-active={sessionMinutes === m}
                        className="choice min-h-[46px] text-sm font-medium tabular-nums"
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <p className="text-sm font-medium">¿Con qué equipo cuentas? (puedes elegir varios)</p>
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(EQUIPMENT_LABELS) as EquipmentType[]).map((eq) => {
                      const active = equipment.includes(eq);
                      return (
                        <button
                          key={eq}
                          type="button"
                          onClick={() => toggleEquipment(eq)}
                          data-active={active}
                          className="choice flex items-center justify-between min-h-[48px] px-4 text-sm font-medium"
                        >
                          <span>{EQUIPMENT_LABELS[eq]}</span>
                          {active && <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* PASO 4: Lesiones */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--text-muted)]">
                  Marca cualquier molestia o lesión actual. Excluiremos ejercicios contraindicados y
                  te mostraremos cuáles se reemplazaron.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.keys(INJURY_LABELS) as InjuryType[]).map((inj) => {
                    const active = injuries.includes(inj);
                    return (
                      <button
                        key={inj}
                        type="button"
                        onClick={() => toggleInjury(inj)}
                        data-active={active}
                        className="choice min-h-[48px] px-3 text-sm font-medium"
                      >
                        {INJURY_LABELS[inj]}
                      </button>
                    );
                  })}
                </div>
                <MedicalDisclaimer compact />
              </div>
            )}

            {/* PASO 5: Objetivo */}
            {step === 4 && (
              <div className="space-y-2.5">
                {(Object.keys(GOAL_LABELS) as FitnessGoal[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGoal(g)}
                    data-active={goal === g}
                    className="choice !rounded-[5px] w-full text-left p-4 min-h-[68px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-base text-[var(--text)]">{GOAL_LABELS[g].label}</span>
                      {goal === g && <CheckCircle2 className="h-5 w-5 text-[var(--accent)]" />}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{GOAL_LABELS[g].desc}</p>
                  </button>
                ))}
              </div>
            )}

            {/* PASO 6: Mapa muscular interactivo */}
            {step === 5 && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-muted)]">
                  Elige hasta <span className="font-medium text-[var(--text)]">4 músculos prioritarios</span>. Recibirán volumen extra y
                  aparecerán al inicio de tus sesiones.
                </p>
                <MuscleMapSVG
                  sex={sex}
                  selected={priorityMuscles}
                  onChange={setPriorityMuscles}
                  maxSelection={4}
                />
              </div>
            )}

            {/* PASO 7: Pantalla de resumen */}
            {step === 6 && (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5 rounded-[5px] bg-[var(--surface-elevated)] border border-[var(--border)] p-3.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                  <Info className="h-4 w-4 text-[var(--text-muted)] shrink-0 mt-0.5" strokeWidth={1.6} />
                  <span>
                    <span className="font-medium text-[var(--text)]">Estas cifras son estimaciones</span> basadas en la ecuación Mifflin-St
                    Jeor y tu nivel de actividad declarado. Las iremos ajustando cada 2 semanas según
                    tu progreso real.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-4">
                    <p className="eyebrow !text-[11px] !tracking-[0.06em]">
                      IMC estimado
                    </p>
                    <p className="font-display text-[30px] mt-2 tabular-nums">
                      {nutritionEstimate.bmi}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {nutritionEstimate.bmiCategory}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <p className="eyebrow !text-[11px] !tracking-[0.06em]">
                      Metabolismo basal
                    </p>
                    <p className="font-display text-[30px] mt-2 tabular-nums">
                      {nutritionEstimate.bmr}{' '}
                      <span className="text-sm tracking-normal text-[var(--text-muted)]">
                        kcal
                      </span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Mifflin-St Jeor</p>
                  </Card>
                  <Card className="p-4">
                    <p className="eyebrow !text-[11px] !tracking-[0.06em]">
                      Gasto diario (TDEE)
                    </p>
                    <p className="font-display text-[30px] mt-2 tabular-nums">
                      {nutritionEstimate.tdee}{' '}
                      <span className="text-sm tracking-normal text-[var(--text-muted)]">
                        kcal
                      </span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {daysPerWeek} días · {sessionMinutes} min
                    </p>
                  </Card>
                  <Card featured className="p-4">
                    <p className="eyebrow !text-[11px] !tracking-[0.06em] !text-[var(--text-secondary)]">
                      Calorías objetivo
                    </p>
                    <p className="font-display text-[30px] mt-2 tabular-nums">
                      {nutritionEstimate.targetCalories}{' '}
                      <span className="text-sm tracking-normal text-[var(--text-muted)]">
                        kcal
                      </span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {nutritionEstimate.calorieDelta > 0
                        ? `Superávit +${nutritionEstimate.calorieDelta} kcal`
                        : nutritionEstimate.calorieDelta < 0
                          ? `Déficit ${nutritionEstimate.calorieDelta} kcal`
                          : 'Mantenimiento'}
                    </p>
                  </Card>
                </div>

                <Card className="p-5 space-y-4">
                  <h2 className="eyebrow">
                    Macros diarios estimados
                  </h2>
                  <div className="grid grid-cols-3 divide-x divide-[var(--border)] text-center">
                    <div className="px-2">
                      <p className="text-xs text-[var(--text-muted)]">Proteína</p>
                      <p className="font-display text-[26px] mt-1 tabular-nums">
                        {nutritionEstimate.proteinG}g
                      </p>
                      <p className="text-[11px] text-[var(--ash)] mt-0.5">
                        {nutritionEstimate.proteinPerKg} g/kg
                      </p>
                    </div>
                    <div className="px-2">
                      <p className="text-xs text-[var(--text-muted)]">Carbos</p>
                      <p className="font-display text-[26px] mt-1 tabular-nums">
                        {nutritionEstimate.carbsG}g
                      </p>
                      <p className="text-[11px] text-[var(--ash)] mt-0.5">Energía</p>
                    </div>
                    <div className="px-2">
                      <p className="text-xs text-[var(--text-muted)]">Grasas</p>
                      <p className="font-display text-[26px] mt-1 tabular-nums">
                        {nutritionEstimate.fatG}g
                      </p>
                      <p className="text-[11px] text-[var(--ash)] mt-0.5">Hormonal</p>
                    </div>
                  </div>
                </Card>

                {priorityMuscles.length > 0 && (
                  <Card className="p-5 space-y-3">
                    <p className="eyebrow">
                      Énfasis muscular seleccionado
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {priorityMuscles.map((m) => (
                        <span
                          key={m.muscle}
                          className="text-xs font-medium px-3 py-1.5 rounded-[24px] bg-[var(--surface-elevated)] text-[var(--text-secondary)]"
                        >
                          {MUSCLE_LABELS[m.muscle]} (P{m.level})
                        </span>
                      ))}
                    </div>
                  </Card>
                )}

                <MedicalDisclaimer compact />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && (
        <p role="alert" className="mt-4 alert alert-error">
          {error}
        </p>
      )}

      {/* Navegación inferior del wizard */}
      <footer className="mt-8 pt-4 border-t border-[var(--border)] flex items-center gap-3">
        {step > 0 && (
          <Button variant="secondary" size="lg" onClick={prevStep} className="shrink-0">
            <ArrowLeft className="h-4 w-4" /> Atrás
          </Button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <Button size="lg" fullWidth onClick={nextStep}>
            Continuar <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="lg" fullWidth onClick={handleFinish} disabled={saving}>
            {saving ? 'Guardando perfil...' : 'Confirmar y continuar'}
          </Button>
        )}
      </footer>
    </div>
  );
}
