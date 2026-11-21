'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, GraduationCap, XCircle } from 'lucide-react';
import type { Exercise } from '@/types/training';
import type { InjuryType, Sex } from '@/types/user';
import { INJURY_LABELS } from '@/types/user';
import {
  BEGINNER_PRINCIPLE,
  EXERCISE_EQUIPMENT_LABELS,
  LEVEL_LABELS,
  MODALITY_LABELS,
  modalityOf,
} from '@/lib/exercises/catalog';
import { ExerciseAnimation } from './ExerciseAnimation';
import { MuscleHighlightMap, MuscleLegend } from './MuscleHighlightMap';

export function ExerciseMeta({ exercise }: { exercise: Exercise }) {
  const chips = [
    MODALITY_LABELS[modalityOf(exercise.equipment)],
    EXERCISE_EQUIPMENT_LABELS[exercise.equipment],
    exercise.mechanics === 'compuesto' ? 'Compuesto' : 'Aislamiento',
    LEVEL_LABELS[exercise.level],
    exercise.unilateral ? 'Unilateral' : null,
  ].filter((c, i, a): c is string => Boolean(c) && a.indexOf(c) === i);
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c}
          className="text-xs px-2.5 py-1 rounded-[8px] bg-[var(--surface-elevated)] text-[var(--text-secondary)]"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

/** Recomendación para principiantes: se muestra siempre en cada ejercicio. */
export function BeginnerTip({ exercise, compact = false }: { exercise: Exercise; compact?: boolean }) {
  return (
    <div className="rounded-[5px] bg-[var(--accent-soft)] p-4">
      <div className="flex items-start gap-3">
        <GraduationCap className="h-5 w-5 shrink-0 text-[var(--text)]" strokeWidth={1.6} />
        <div className="space-y-1.5 text-sm leading-relaxed">
          <p className="font-medium text-[var(--text)]">Si estás empezando: técnica antes que peso</p>
          {!compact && <p className="text-[var(--text-secondary)]">{BEGINNER_PRINCIPLE}</p>}
          <p className="text-[var(--text-secondary)]">{exercise.beginnerTip}</p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  exercise: Exercise;
  sex?: Sex;
  injuries?: InjuryType[];
  /** Acciones extra al final (p. ej. "Usar este ejercicio"). */
  actions?: React.ReactNode;
}

export function ExerciseDetail({ exercise, sex = 'male', injuries = [], actions }: Props) {
  const conflicts = exercise.avoidIf.filter((i) => injuries.includes(i));

  return (
    <div className="space-y-6">
      <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
        <ExerciseAnimation exercise={exercise} />
      </div>

      <ExerciseMeta exercise={exercise} />

      {conflicts.length > 0 && (
        <div role="note" className="alert alert-error flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Declaraste molestias en {conflicts.map((c) => INJURY_LABELS[c].toLowerCase()).join(', ')}. Este
            ejercicio puede sobrecargar esa zona: elige una alternativa o consúltalo con un profesional.
          </span>
        </div>
      )}

      <BeginnerTip exercise={exercise} />

      <section aria-labelledby="tecnica">
        <h3 id="tecnica" className="eyebrow">
          Técnica paso a paso
        </h3>
        <ol className="mt-3 space-y-3">
          {exercise.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="h-6 w-6 shrink-0 rounded-full border border-[var(--border)] text-xs tabular-nums flex items-center justify-center text-[var(--text-secondary)]">
                {i + 1}
              </span>
              <p className="text-[15px] leading-relaxed text-[var(--text)]">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="errores">
        <h3 id="errores" className="eyebrow">
          Errores frecuentes
        </h3>
        <ul className="mt-3 space-y-2">
          {exercise.mistakes.map((m, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-[var(--text-secondary)]">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--danger)]" strokeWidth={1.6} />
              {m}
            </li>
          ))}
          <li className="flex gap-2.5 text-sm text-[var(--text-secondary)]">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[var(--success)]" strokeWidth={1.6} />
            Controla la bajada (2–3 s) y detén la serie si la técnica se rompe.
          </li>
        </ul>
      </section>

      <section aria-labelledby="musculos" className="space-y-3">
        <h3 id="musculos" className="eyebrow">
          Músculos que trabaja
        </h3>
        <MuscleLegend primary={exercise.primary} secondary={exercise.secondary} />
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
          <MuscleHighlightMap primary={exercise.primary} secondary={exercise.secondary} sex={sex} />
        </div>
      </section>

      {actions}
    </div>
  );
}
