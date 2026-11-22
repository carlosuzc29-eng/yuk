'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';
import type { DayFocus } from '@/types/user';
import type { BodyWeightEntry, ModalityPreference, Routine, RoutineDay, Workout } from '@/types/training';
import {
  addBodyWeight,
  getActiveWorkout,
  getRoutine,
  listBodyWeight,
  listWorkouts,
  saveRoutine as persistRoutine,
  saveWorkout as persistWorkout,
  deleteWorkout as removeWorkout,
  setActiveWorkout,
  updateGroupStats,
} from '@/lib/training/storage';
import { GENERATOR_VERSION, generateRoutine, profileKey } from '@/lib/training/generator';
import { sessionsThisWeek, weekKey, weeklyStreak } from '@/lib/training/progression';

interface TrainingContextValue {
  routine: Routine | null;
  workouts: Workout[];
  bodyWeight: BodyWeightEntry[];
  active: Workout | null;
  loading: boolean;
  /** Día sugerido para hoy (rota según el último entrenamiento). */
  nextDay: RoutineDay | null;
  /** Guarda una rutina editada a mano por el usuario. */
  saveRoutine: (r: Routine) => Promise<void>;
  /** El perfil cambió pero la rutina tiene ediciones manuales: se ofrece actualizarla. */
  routineOutdated: boolean;
  regenerate: (modality?: ModalityPreference, dayFocusPlan?: DayFocus[]) => Promise<void>;
  startWorkout: (w: Workout) => void;
  updateActive: (w: Workout) => void;
  discardActive: () => void;
  finishWorkout: (w: Workout) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  logBodyWeight: (weightKg: number, date?: string) => Promise<void>;
}

const Ctx = createContext<TrainingContextValue | null>(null);

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [bodyWeight, setBodyWeight] = useState<BodyWeightEntry[]>([]);
  const [active, setActive] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoutine(null);
      setWorkouts([]);
      setBodyWeight([]);
      setActive(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const [r, w, bw] = await Promise.all([
          getRoutine(user.uid),
          listWorkouts(user.uid),
          listBodyWeight(user.uid),
        ]);
        let current = r;
        if (!current && profile?.onboardingCompleted) {
          current = await persistRoutine(user.uid, generateRoutine(profile));
        }
        if (cancelled) return;
        setRoutine(current);
        setWorkouts(w);
        setBodyWeight(bw);
        setActive(getActiveWorkout(user.uid));
      } catch {
        if (!cancelled) setActive(getActiveWorkout(user.uid));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // El perfil sólo importa para la generación inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, profile?.onboardingCompleted]);

  const store = useCallback(
    async (r: Routine) => {
      if (!user) return;
      setRoutine(r);
      const saved = await persistRoutine(user.uid, r);
      setRoutine(saved);
    },
    [user]
  );

  const saveRoutine = useCallback((r: Routine) => store({ ...r, edited: true }), [store]);

  const regenerate = useCallback(
    async (modality: ModalityPreference = 'mixto', dayFocusPlan?: DayFocus[]) => {
      if (!user || !profile) return;
      const nextProfile = dayFocusPlan
        ? { ...profile, daysPerWeek: dayFocusPlan.length, dayFocusPlan }
        : profile;
      await store(generateRoutine(nextProfile, modality));
    },
    [user, profile, store]
  );

  // Si cambian los datos del perfil (días, minutos, prioridades…) o mejora el generador,
  // la rutina se regenera sola salvo que el usuario la haya editado a mano.
  const currentKey = profile?.onboardingCompleted ? profileKey(profile) : null;
  const stale =
    !!routine &&
    !!currentKey &&
    ((routine.generatorVersion ?? 1) < GENERATOR_VERSION || routine.profileKey !== currentKey);
  const routineOutdated = stale && !!routine?.edited && routine.profileKey !== currentKey;

  useEffect(() => {
    if (loading || !stale || !routine || !profile) return;
    if (routine.edited) return; // con ediciones manuales se ofrece actualizar desde /rutina
    void store(generateRoutine(profile, routine.modalityPreference ?? 'mixto'));
  }, [loading, stale, routine, profile, currentKey, store]);

  const startWorkout = useCallback(
    (w: Workout) => {
      if (!user) return;
      setActive(w);
      setActiveWorkout(user.uid, w);
    },
    [user]
  );

  const updateActive = useCallback(
    (w: Workout) => {
      if (!user) return;
      setActive(w);
      setActiveWorkout(user.uid, w);
    },
    [user]
  );

  const discardActive = useCallback(() => {
    if (!user) return;
    setActive(null);
    setActiveWorkout(user.uid, null);
  }, [user]);

  const finishWorkout = useCallback(
    async (w: Workout) => {
      if (!user) return;
      const next = [w, ...workouts.filter((x) => x.id !== w.id)];
      setWorkouts(next);
      setActive(null);
      setActiveWorkout(user.uid, null);
      await persistWorkout(user.uid, w);

      if (profile?.groupId) {
        const planned = routine?.days.length ?? profile.daysPerWeek;
        const monthAgo = Date.now() - 28 * 24 * 3600 * 1000;
        const last4w = next.filter(
          (x) => x.status === 'completed' && new Date(x.completedAt ?? x.startedAt).getTime() >= monthAgo
        ).length;
        try {
          await updateGroupStats(profile.groupId, user.uid, {
            currentStreak: weeklyStreak(next, planned),
            weeklyPlannedSessions: planned,
            weeklyCompletedSessions: sessionsThisWeek(next),
            monthlyCompliancePct: Math.round((last4w / (planned * 4)) * 100),
            lastWorkoutAt: w.completedAt ?? new Date().toISOString(),
          });
        } catch {
          // Las estadísticas del grupo no deben bloquear el guardado del entrenamiento.
        }
      }
    },
    [user, workouts, profile, routine]
  );

  const deleteWorkout = useCallback(
    async (id: string) => {
      if (!user) return;
      setWorkouts((ws) => ws.filter((w) => w.id !== id));
      await removeWorkout(user.uid, id);
    },
    [user]
  );

  const logBodyWeight = useCallback(
    async (weightKg: number, date = todayIso()) => {
      if (!user) return;
      await addBodyWeight(user.uid, { date, weightKg });
      setBodyWeight((all) =>
        [...all.filter((e) => e.date !== date), { id: date, date, weightKg }].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      );
    },
    [user]
  );

  const nextDay = useMemo(() => {
    if (!routine?.days.length) return null;
    const lastDone = workouts.find((w) => w.status === 'completed' && w.dayId);
    if (!lastDone) return routine.days[0];
    const idx = routine.days.findIndex((d) => d.id === lastDone.dayId);
    // Si ya entrenó hoy ese día, seguimos mostrando el siguiente.
    return routine.days[(idx + 1) % routine.days.length] ?? routine.days[0];
  }, [routine, workouts]);

  const value = useMemo<TrainingContextValue>(
    () => ({
      routine,
      workouts,
      bodyWeight,
      active,
      loading,
      nextDay,
      saveRoutine,
      routineOutdated,
      regenerate,
      startWorkout,
      updateActive,
      discardActive,
      finishWorkout,
      deleteWorkout,
      logBodyWeight,
    }),
    [routine, workouts, bodyWeight, active, loading, nextDay, saveRoutine, routineOutdated, regenerate, startWorkout, updateActive, discardActive, finishWorkout, deleteWorkout, logBodyWeight]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTraining() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTraining debe usarse dentro de TrainingProvider');
  return ctx;
}

export { weekKey };
