'use client';

import React from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { ExerciseDetail } from '@/components/exercises/ExerciseDetail';
import { ExerciseRow } from '@/components/exercises/ExercisePicker';
import { EXERCISES, MODALITY_LABELS, getExercise, modalityOf } from '@/lib/exercises/catalog';
import { MODALITY_ORDER } from '@/components/exercises/ExercisePicker';
import { MUSCLE_LABELS } from '@/types/user';

export function ExerciseDetailView({ id }: { id: string }) {
  const { profile } = useAuth();
  const exercise = getExercise(id);

  if (!exercise) {
    return (
      <AppShell title="Ejercicio" backHref="/ejercicios">
        <p className="text-sm text-[var(--text-muted)]">No encontramos este ejercicio.</p>
      </AppShell>
    );
  }

  const main = exercise.primary[0];
  const alternatives = EXERCISES.filter((x) => x.id !== exercise.id && x.primary.includes(main));
  const byModality = MODALITY_ORDER.map((m) => ({
    modality: m,
    items: alternatives.filter((x) => modalityOf(x.equipment) === m),
  })).filter((g) => g.items.length);

  return (
    <AppShell title="Ejercicio" backHref="/ejercicios">
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-[30px]">{exercise.name}</h2>
          <span className="accent-rule mt-3" aria-hidden="true" />
        </div>

        <ExerciseDetail
          exercise={exercise}
          sex={profile?.sex}
          injuries={profile?.injuries.filter((i) => i !== 'ninguna')}
        />

        {byModality.length > 0 && (
          <section aria-labelledby="alternativas" className="space-y-3">
            <h3 id="alternativas" className="eyebrow">
              Alternativas para {MUSCLE_LABELS[main].toLowerCase()}
            </h3>
            {byModality.map((g) => (
              <div key={g.modality}>
                <p className="text-xs font-medium text-[var(--text-secondary)] mt-3">
                  {MODALITY_LABELS[g.modality]}
                </p>
                <ul className="divide-y divide-[var(--border)]">
                  {g.items.map((x) => (
                    <li key={x.id}>
                      <Link href={`/ejercicios/${x.id}`} className="block">
                        <ExerciseRow exercise={x} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
