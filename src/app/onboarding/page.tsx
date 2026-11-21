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
import { cn } from '@/lib/utils/cn';
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
    <div className="min-h-dvh max-w-lg mx-auto px-4 py-5 flex flex-col">
      {/* Cabecera y barra de progreso */}
      <header className="space-y-3 mb-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-xl font-extrabold uppercase tracking-wider text-[var(--accent)]">
            YUK
          </span>
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            Paso {step + 1} de {TOTAL_STEPS}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso del onboarding"
          className="h-2 w-full rounded-full bg-[var(--surface-elevated)] overflow-hidden"
        >
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide">
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
              <Card className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="ob-name" className="block text-sm font-medium">
                    ¿Cómo quieres que te llamemos?
                  </label>
                  <input
                    id="ob-name"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full min-h-[46px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 text-sm"
                  />
                </div>

                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium">Sexo biológico (para silueta y fórmulas)</legend>
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
                        className={cn(
                          'min-h-[48px] rounded-xl border font-bold text-sm transition-colors cursor-pointer',
                          sex === opt.id
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'bg-[var(--surface-elevated)] text-[var(--text)] border-[var(--border)]'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-1.5">
                  <label htmlFor="ob-birth" className="block text-sm font-medium">
                    Fecha de nacimiento
                  </label>
                  <input
                    id="ob-birth"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="ob-weight" className="block text-sm font-medium">
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
                      className="w-full min-h-[46px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="ob-height" className="block text-sm font-medium">
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
                      className="w-full min-h-[46px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="ob-bf" className="block text-sm font-medium">
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
                    className="w-full min-h-[46px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 text-sm"
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
                    className={cn(
                      'w-full text-left rounded-2xl border p-4 transition-all cursor-pointer min-h-[64px]',
                      experience === opt.id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--border)] bg-[var(--surface)]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base">{opt.label}</span>
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
                  <p className="text-sm font-semibold">¿Cuántos días por semana puedes entrenar?</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[2, 3, 4, 5, 6].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDaysPerWeek(d)}
                        className={cn(
                          'min-h-[48px] rounded-xl border font-display text-2xl font-extrabold cursor-pointer',
                          daysPerWeek === d
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'bg-[var(--surface-elevated)] border-[var(--border)]'
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <p className="text-sm font-semibold">Minutos disponibles por sesión</p>
                  <div className="grid grid-cols-5 gap-2">
                    {SESSION_MINUTES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSessionMinutes(m)}
                        className={cn(
                          'min-h-[46px] rounded-xl border text-sm font-bold cursor-pointer',
                          sessionMinutes === m
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'bg-[var(--surface-elevated)] border-[var(--border)]'
                        )}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <p className="text-sm font-semibold">¿Con qué equipo cuentas? (puedes elegir varios)</p>
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(EQUIPMENT_LABELS) as EquipmentType[]).map((eq) => {
                      const active = equipment.includes(eq);
                      return (
                        <button
                          key={eq}
                          type="button"
                          onClick={() => toggleEquipment(eq)}
                          className={cn(
                            'flex items-center justify-between min-h-[48px] rounded-xl border px-4 text-sm font-semibold cursor-pointer',
                            active
                              ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text)]'
                              : 'border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-muted)]'
                          )}
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
                        className={cn(
                          'min-h-[48px] rounded-xl border px-3 text-sm font-semibold transition-colors cursor-pointer',
                          active
                            ? inj === 'ninguna'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)]'
                        )}
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
                    className={cn(
                      'w-full text-left rounded-2xl border p-4 transition-all cursor-pointer min-h-[68px]',
                      goal === g
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--border)] bg-[var(--surface)]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base">{GOAL_LABELS[g].label}</span>
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
                  Elige hasta <strong>4 músculos prioritarios</strong>. Recibirán volumen extra y
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
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-[var(--text)]">
                  <Info className="h-4 w-4 text-[var(--warning)] shrink-0 mt-0.5" />
                  <span>
                    <strong>Estas cifras son estimaciones</strong> basadas en la ecuación Mifflin-St
                    Jeor y tu nivel de actividad declarado. Las iremos ajustando cada 2 semanas según
                    tu progreso real.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3.5">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                      IMC estimado
                    </p>
                    <p className="font-display text-3xl font-extrabold mt-0.5">
                      {nutritionEstimate.bmi}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {nutritionEstimate.bmiCategory}
                    </p>
                  </Card>
                  <Card className="p-3.5">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                      Metabolismo basal
                    </p>
                    <p className="font-display text-3xl font-extrabold mt-0.5">
                      {nutritionEstimate.bmr}{' '}
                      <span className="text-sm font-sans font-normal text-[var(--text-muted)]">
                        kcal
                      </span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Mifflin-St Jeor</p>
                  </Card>
                  <Card className="p-3.5">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                      Gasto diario (TDEE)
                    </p>
                    <p className="font-display text-3xl font-extrabold mt-0.5">
                      {nutritionEstimate.tdee}{' '}
                      <span className="text-sm font-sans font-normal text-[var(--text-muted)]">
                        kcal
                      </span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {daysPerWeek} días · {sessionMinutes} min
                    </p>
                  </Card>
                  <Card className="p-3.5 border-[var(--accent)]/60">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--accent)] font-bold">
                      Calorías objetivo
                    </p>
                    <p className="font-display text-3xl font-extrabold text-[var(--accent)] mt-0.5">
                      {nutritionEstimate.targetCalories}{' '}
                      <span className="text-sm font-sans font-normal text-[var(--text-muted)]">
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

                <Card className="p-4 space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Macros diarios estimados
                  </h2>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-[var(--surface-elevated)] p-3">
                      <p className="text-xs text-[var(--text-muted)]">Proteína</p>
                      <p className="font-display text-2xl font-extrabold text-[var(--accent)]">
                        {nutritionEstimate.proteinG}g
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {nutritionEstimate.proteinPerKg} g/kg
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-elevated)] p-3">
                      <p className="text-xs text-[var(--text-muted)]">Carbos</p>
                      <p className="font-display text-2xl font-extrabold">
                        {nutritionEstimate.carbsG}g
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">Energía</p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-elevated)] p-3">
                      <p className="text-xs text-[var(--text-muted)]">Grasas</p>
                      <p className="font-display text-2xl font-extrabold">
                        {nutritionEstimate.fatG}g
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">Hormonal</p>
                    </div>
                  </div>
                </Card>

                {priorityMuscles.length > 0 && (
                  <Card className="p-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Énfasis muscular seleccionado
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {priorityMuscles.map((m) => (
                        <span
                          key={m.muscle}
                          className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]"
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
        <p role="alert" className="mt-3 text-xs font-medium text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl p-3">
          {error}
        </p>
      )}

      {/* Navegación inferior del wizard */}
      <footer className="mt-6 pt-3 border-t border-[var(--border)] flex items-center gap-3">
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
