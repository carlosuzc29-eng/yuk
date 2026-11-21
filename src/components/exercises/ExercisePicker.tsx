'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import type { Exercise, ExerciseEquipment, Modality } from '@/types/training';
import type { InjuryType, MuscleId } from '@/types/user';
import { MUSCLE_LABELS } from '@/types/user';
import {
  EXERCISE_EQUIPMENT_LABELS,
  MODALITY_LABELS,
  filterExercises,
  modalityOf,
} from '@/lib/exercises/catalog';
import { ExerciseAnimation } from './ExerciseAnimation';
import { cn } from '@/lib/utils/cn';

export const MODALITY_ORDER: Modality[] = ['maquina', 'polea', 'peso_libre', 'peso_corporal', 'banda'];

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-[24px] border px-3.5 py-1.5 text-[13px] whitespace-nowrap transition-colors cursor-pointer min-h-[36px]',
        active
          ? 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]'
          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--ash)]'
      )}
    >
      {children}
    </button>
  );
}

export function ExerciseRow({
  exercise,
  onClick,
  right,
  subtitle,
}: {
  exercise: Exercise;
  onClick?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  const body = (
    <>
      <div className="h-16 w-16 shrink-0 rounded-[8px] bg-[var(--surface-elevated)] overflow-hidden p-1">
        <ExerciseAnimation exercise={exercise} animate={false} staticT={0.9} showControls={false} fill />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[15px] font-medium leading-snug text-[var(--text)]">{exercise.name}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
          {subtitle ??
            `${exercise.primary.map((m) => MUSCLE_LABELS[m]).join(', ')} · ${EXERCISE_EQUIPMENT_LABELS[exercise.equipment]}`}
        </p>
      </div>
    </>
  );
  return (
    <div className="flex items-center gap-3">
      {onClick ? (
        <button type="button" onClick={onClick} className="flex-1 min-w-0 flex items-center gap-3 py-3 cursor-pointer">
          {body}
        </button>
      ) : (
        <div className="flex-1 min-w-0 flex items-center gap-3 py-3">{body}</div>
      )}
      {right ?? (onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ash)]" /> : null)}
    </div>
  );
}

interface PickerProps {
  initialMuscle?: MuscleId | null;
  initialModality?: Modality | null;
  allowedEquipment?: ExerciseEquipment[] | null;
  injuries?: InjuryType[];
  excludeIds?: string[];
  onPick: (ex: Exercise) => void;
  onPreview?: (ex: Exercise) => void;
}

const MUSCLE_OPTIONS = Object.keys(MUSCLE_LABELS) as MuscleId[];

export function ExercisePicker({
  initialMuscle = null,
  initialModality = null,
  allowedEquipment = null,
  injuries = [],
  excludeIds = [],
  onPick,
  onPreview,
}: PickerProps) {
  const [muscle, setMuscle] = useState<MuscleId | null>(initialMuscle);
  const [modality, setModality] = useState<Modality | null>(initialModality);
  const [search, setSearch] = useState('');
  const [showAllEquipment, setShowAllEquipment] = useState(false);

  const results = useMemo(
    () =>
      filterExercises({
        muscle,
        modality,
        search,
        allowedEquipment: showAllEquipment ? null : allowedEquipment,
        excludeInjuries: injuries.filter((i) => i !== 'ninguna'),
      }).filter((x) => !excludeIds.includes(x.id)),
    [muscle, modality, search, allowedEquipment, injuries, excludeIds, showAllEquipment]
  );

  const availableModalities = MODALITY_ORDER.filter(
    (m) => showAllEquipment || !allowedEquipment || allowedEquipment.some((e) => modalityOf(e) === m)
  );

  return (
    <div className="space-y-4">
      <label className="relative block">
        <span className="sr-only">Buscar ejercicio</span>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ash)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ejercicio"
          className="field pl-11"
        />
      </label>

      <div>
        <p className="eyebrow mb-2">Tipo de equipo</p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <FilterChip active={modality === null} onClick={() => setModality(null)}>
            Todos
          </FilterChip>
          {availableModalities.map((m) => (
            <FilterChip key={m} active={modality === m} onClick={() => setModality(m)}>
              {MODALITY_LABELS[m]}
            </FilterChip>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-2">Músculo</p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <FilterChip active={muscle === null} onClick={() => setMuscle(null)}>
            Todos
          </FilterChip>
          {MUSCLE_OPTIONS.map((m) => (
            <FilterChip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
              {MUSCLE_LABELS[m]}
            </FilterChip>
          ))}
        </div>
      </div>

      {allowedEquipment && (
        <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={showAllEquipment}
            onChange={(e) => setShowAllEquipment(e.target.checked)}
          />
          Mostrar también equipo que no marqué en mi perfil
        </label>
      )}

      <p className="text-xs text-[var(--text-muted)]">{results.length} ejercicios</p>
      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {results.map((x) => (
          <li key={x.id}>
            <ExerciseRow
              exercise={x}
              onClick={() => (onPreview ? onPreview(x) : onPick(x))}
              right={
                <button
                  type="button"
                  onClick={() => onPick(x)}
                  aria-label={`Elegir ${x.name}`}
                  className="shrink-0 rounded-[24px] border border-[var(--border)] px-3.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-elevated)] cursor-pointer min-h-[36px]"
                >
                  Elegir
                </button>
              }
            />
          </li>
        ))}
        {results.length === 0 && (
          <li className="py-8 text-center text-sm text-[var(--text-muted)]">
            No hay ejercicios con esos filtros. Prueba con otro tipo de equipo.
          </li>
        )}
      </ul>
    </div>
  );
}
