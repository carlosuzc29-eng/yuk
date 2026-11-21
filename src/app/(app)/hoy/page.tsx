'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { GOAL_LABELS, MUSCLE_LABELS } from '@/types/user';
import { Flame, Users, Dumbbell, ArrowRight } from 'lucide-react';

export default function HoyPage() {
  const router = useRouter();
  const { user, profile, group, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (!profile?.onboardingCompleted) {
      router.replace('/onboarding');
    }
  }, [user, profile, loading, router]);

  if (loading || !profile) return null;

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
      <div className="space-y-4">
        <Card featured className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="rounded-[8px] bg-[var(--accent)] text-white text-xs font-medium px-2.5 py-1">
              Tu plan personalizado
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {profile.daysPerWeek} días/sem · {profile.sessionMinutes} min
            </span>
          </div>
          <h2 className="font-display text-[32px]">Tu perfil está listo</h2>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Tu perfil biométrico, disponibilidad y énfasis muscular ya están guardados. En las
            próximas fases activaremos el catálogo de 80+ ejercicios animados, el generador de
            rutinas y el modo entrenamiento offline.
          </p>
          <div className="pt-1 flex gap-2">
            <Link href="/grupo" className="flex-1">
              <Button fullWidth>
                {group ? 'Ver mi grupo' : 'Crear o unirte a un grupo'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Resumen rápido nutricional */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="eyebrow">
              Objetivo nutricional estimado
            </h3>
            <span className="text-[11px] text-[var(--ash)]">Estimación</span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-[var(--border)] text-center">
            <div className="px-1 py-1">
              <p className="font-display text-[26px] leading-none">
                {profile.nutritionEstimate.targetCalories}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">kcal</p>
            </div>
            <div className="px-1 py-1">
              <p className="font-display text-[26px] leading-none">
                {profile.nutritionEstimate.proteinG}g
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Prot</p>
            </div>
            <div className="px-1 py-1">
              <p className="font-display text-[26px] leading-none">
                {profile.nutritionEstimate.carbsG}g
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Carbos</p>
            </div>
            <div className="px-1 py-1">
              <p className="font-display text-[26px] leading-none">
                {profile.nutritionEstimate.fatG}g
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Grasas</p>
            </div>
          </div>
        </Card>

        {/* Músculos de énfasis */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={1.6} />
            <h3 className="eyebrow">
              Músculos prioritarios
            </h3>
          </div>
          {profile.priorityMuscles.length > 0 ? (
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
          ) : (
            <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
              <Dumbbell className="h-3.5 w-3.5" /> Entrenamiento equilibrado en todo el cuerpo.
            </p>
          )}
        </Card>

        <MedicalDisclaimer compact />
      </div>
    </AppShell>
  );
}
