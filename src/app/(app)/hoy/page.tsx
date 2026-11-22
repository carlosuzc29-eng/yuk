'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Dumbbell, Flame, Play, Users } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTraining } from '@/components/providers/TrainingProvider';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { ExerciseAnimation } from '@/components/exercises/ExerciseAnimation';
import { getExercise } from '@/lib/exercises/catalog';
import { createWorkoutFromDay } from '@/lib/training/session';
import { completedSetCount, sessionsThisWeek, weekKey, weeklyStreak } from '@/lib/training/progression';
import { GOAL_LABELS, MUSCLE_LABELS } from '@/types/user';
import { cn } from '@/lib/utils/cn';

const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function HoyPage() {
  const router = useRouter();
  const { user, profile, group, loading } = useAuth();
  const { routine, workouts, nextDay, active, startWorkout, loading: tLoading } = useTraining();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!profile?.onboardingCompleted) router.replace('/onboarding');
  }, [user, profile, loading, router]);

  const planned = routine?.days.length ?? profile?.daysPerWeek ?? 3;
  const weekDone = sessionsThisWeek(workouts);
  const streak = weeklyStreak(workouts, planned);
  const trainedDays = useMemo(() => {
    const thisWeek = weekKey(new Date().toISOString());
    const set = new Set<number>();
    workouts
      .filter((w) => w.status === 'completed' && weekKey(w.completedAt ?? w.startedAt) === thisWeek)
      .forEach((w) => set.add((new Date(w.completedAt ?? w.startedAt).getDay() + 6) % 7));
    return set;
  }, [workouts]);
  const todayIdx = (new Date().getDay() + 6) % 7;

  if (loading || !profile) return null;

  const begin = () => {
    if (!routine || !nextDay) return;
    startWorkout(createWorkoutFromDay(routine, nextDay, workouts));
    router.push('/entrenar');
  };

  const estMinutes = nextDay
    ? Math.round(
        nextDay.exercises.reduce((acc, rx) => acc + rx.sets * (45 + rx.restSec), 0) / 60 + 8
      )
    : 0;

  return (
    <AppShell
      title="Hoy"
      subtitle={`Hola, ${profile.displayName} · ${GOAL_LABELS[profile.goal].label}`}
      rightSlot={
        <Link
          href="/grupo"
          className="inline-flex items-center gap-1.5 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] touch-target shrink-0"
        >
          <Users className="h-4 w-4" strokeWidth={1.6} />
          {group ? group.name : 'Unirme'}
        </Link>
      }
    >
      <div className="space-y-5">
        {active ? (
          <Card featured className="p-6 space-y-4">
            <span className="rounded-[8px] bg-[var(--accent)] text-white text-xs font-medium px-2.5 py-1">
              En curso
            </span>
            <h2 className="font-display text-[30px]">{active.name}</h2>
            <p className="text-sm text-[var(--text-secondary)] tabular-nums">
              {completedSetCount(active)} series completadas · empezaste a las{' '}
              {new Date(active.startedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <Link href="/entrenar" className="block">
              <Button size="lg" fullWidth>
                Continuar entrenamiento <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>
        ) : nextDay ? (
          <Card featured className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="rounded-[8px] bg-[var(--accent)] text-white text-xs font-medium px-2.5 py-1">
                Hoy toca
              </span>
              <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                ~{estMinutes} min · {nextDay.exercises.length} ejercicios
              </span>
            </div>
            <div>
              <h2 className="font-display text-[32px]">{nextDay.name}</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {nextDay.focus.slice(0, 4).map((m) => MUSCLE_LABELS[m]).join(' · ')}
              </p>
            </div>
            <ul className="grid grid-cols-4 gap-2">
              {nextDay.exercises.slice(0, 4).map((rx) => {
                const ex = getExercise(rx.exerciseId);
                if (!ex) return null;
                return (
                  <li key={rx.uid} className="aspect-square rounded-[8px] bg-[var(--surface)] p-1" title={ex.name}>
                    <ExerciseAnimation exercise={ex} animate={false} staticT={0.9} showControls={false} fill />
                  </li>
                );
              })}
            </ul>
            <ol className="space-y-1 text-sm">
              {nextDay.exercises.map((rx, i) => {
                const ex = getExercise(rx.exerciseId);
                return (
                  <li key={rx.uid} className="flex justify-between gap-3">
                    <span className="truncate">
                      <span className="text-[var(--text-muted)] tabular-nums mr-2">{i + 1}</span>
                      {ex?.name}
                    </span>
                    <span className="shrink-0 text-[var(--text-secondary)] tabular-nums">
                      {rx.sets}×{rx.repMin}–{rx.repMax}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="space-y-2 pt-1">
              <Button size="lg" fullWidth onClick={begin}>
                <Play className="h-4 w-4" /> Empezar entrenamiento
              </Button>
              <div className="flex justify-between text-sm">
                <Link href="/entrenar" className="text-[var(--text-secondary)] underline underline-offset-4">
                  Elegir otro día
                </Link>
                <Link href="/rutina" className="text-[var(--text-secondary)] underline underline-offset-4">
                  Editar rutina
                </Link>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 space-y-3">
            <p className="text-sm text-[var(--text-muted)]">{tLoading ? 'Preparando tu rutina…' : 'Aún no tienes rutina.'}</p>
            {!tLoading && (
              <Link href="/rutina">
                <Button>Crear mi rutina</Button>
              </Link>
            )}
          </Card>
        )}

        {/* Semana */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="eyebrow">Esta semana</h3>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              {weekDone}/{planned} sesiones
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEK_LABELS.map((l, i) => (
              <div key={l} className="space-y-1.5">
                <div
                  className={cn(
                    'mx-auto h-9 w-9 rounded-full flex items-center justify-center text-xs',
                    trainedDays.has(i)
                      ? 'bg-[var(--accent)] text-white'
                      : i === todayIdx
                        ? 'border border-[var(--text)] text-[var(--text)]'
                        : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]'
                  )}
                  aria-label={`${l}${trainedDays.has(i) ? ', entrenado' : ''}`}
                >
                  {trainedDays.has(i) ? <Dumbbell className="h-4 w-4" /> : l}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 divide-x divide-[var(--border)] text-center pt-1">
            <div>
              <p className="font-display text-[26px] tabular-nums leading-none">{streak}</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Semanas de racha</p>
            </div>
            <div>
              <p className="font-display text-[26px] tabular-nums leading-none">
                {workouts.filter((w) => w.status === 'completed').length}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Entrenamientos</p>
            </div>
            <div>
              <p className="font-display text-[26px] tabular-nums leading-none">{planned}</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Días/semana</p>
            </div>
          </div>
        </Card>

        {/* Nutrición */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="eyebrow">Objetivo nutricional estimado</h3>
            <span className="text-[11px] text-[var(--ash)]">Estimación</span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-[var(--border)] text-center">
            {[
              { v: profile.nutritionEstimate.targetCalories, l: 'kcal' },
              { v: `${profile.nutritionEstimate.proteinG}g`, l: 'Proteína' },
              { v: `${profile.nutritionEstimate.carbsG}g`, l: 'Carbos' },
              { v: `${profile.nutritionEstimate.fatG}g`, l: 'Grasas' },
            ].map((x) => (
              <div key={x.l} className="px-1 py-1">
                <p className="font-display text-[24px] leading-none tabular-nums">{x.v}</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5">{x.l}</p>
              </div>
            ))}
          </div>
        </Card>

        {profile.priorityMuscles.length > 0 && (
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={1.6} />
              <h3 className="eyebrow">Músculos prioritarios</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.priorityMuscles.map((m) => (
                <span
                  key={m.muscle}
                  className="text-xs font-medium px-3 py-1.5 rounded-[24px] bg-[var(--surface-elevated)] text-[var(--text-secondary)]"
                >
                  {MUSCLE_LABELS[m.muscle]} · P{m.level}
                </span>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Tu rutina trabaja todo el cuerpo; estos músculos solo reciben énfasis: van primero, con series extra y algún ejercicio adicional.
            </p>
          </Card>
        )}

        <MedicalDisclaimer compact />
      </div>
    </AppShell>
  );
}
