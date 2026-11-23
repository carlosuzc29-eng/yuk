'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/components/providers/AuthProvider';
import { ExerciseAnimation } from '@/components/exercises/ExerciseAnimation';
import { FilterChip, MODALITY_ORDER } from '@/components/exercises/ExercisePicker';
import {
  EXERCISES,
  EXERCISE_EQUIPMENT_LABELS,
  MODALITY_LABELS,
  MUSCLE_GROUPS,
  modalityOf,
} from '@/lib/exercises/catalog';
import type { Modality } from '@/types/training';
import { MUSCLE_LABELS, type InjuryType } from '@/types/user';

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function EjerciciosPage() {
  const { profile } = useAuth();
  const [group, setGroup] = useState<string | null>(null);
  const [modality, setModality] = useState<Modality | null>(null);
  const [search, setSearch] = useState('');

  const injuries: InjuryType[] = profile?.injuries.filter((i) => i !== 'ninguna') ?? [];

  const results = useMemo(() => {
    const q = normalize(search.trim());
    const g = MUSCLE_GROUPS.find((x) => x.id === group);
    return EXERCISES.filter(
      (x) =>
        (!g || x.primary.some((m) => g.muscles.includes(m))) &&
        (!modality || modalityOf(x.equipment) === modality) &&
        (!q ||
          normalize(x.name).includes(q) ||
          normalize(x.machineName).includes(q) ||
          x.primary.some((m) => normalize(MUSCLE_LABELS[m]).includes(q)))
    );
  }, [group, modality, search]);

  return (
    <AppShell
      title="Ejercicios"
      subtitle={`${EXERCISES.length} ejercicios en 2D (Lateral · Frontal · Espalda)`}
    >
      <div className="space-y-5">
        <label className="relative block">
          <span className="sr-only">Buscar ejercicio, máquina o músculo</span>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ash)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ejercicio, máquina o músculo"
            className="field pl-11"
          />
        </label>

        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
            <FilterChip active={group === null} onClick={() => setGroup(null)}>
              Todo el cuerpo
            </FilterChip>
            {MUSCLE_GROUPS.map((g) => (
              <FilterChip key={g.id} active={group === g.id} onClick={() => setGroup(g.id)}>
                {g.label}
              </FilterChip>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
            <FilterChip active={modality === null} onClick={() => setModality(null)}>
              Cualquier equipo
            </FilterChip>
            {MODALITY_ORDER.map((m) => (
              <FilterChip key={m} active={modality === m} onClick={() => setModality(m)}>
                {MODALITY_LABELS[m]}
              </FilterChip>
            ))}
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)]">{results.length} resultados</p>

        <ul className="grid grid-cols-2 gap-3">
          {results.map((x) => {
            const caution = x.avoidIf.some((i) => injuries.includes(i));
            return (
              <li key={x.id}>
                <Link
                  href={`/ejercicios/${x.id}`}
                  className="group block h-full rounded-[5px] border border-[var(--border)] bg-[var(--surface)] p-2.5 hover:border-[var(--ash)] transition-colors"
                >
                  <div className="aspect-[5/4] rounded-[8px] bg-[var(--surface-elevated)] overflow-hidden p-1.5">
                    <ExerciseAnimation exercise={x} animate={false} staticT={0.9} showControls={false} fill />
                  </div>
                  <p className="mt-2.5 text-sm font-medium leading-snug">{x.name}</p>
                  <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)] line-clamp-1" title={x.machineName}>
                    {x.machineName}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-snug">
                    {x.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-[8px] bg-[var(--surface-elevated)] text-[var(--text-secondary)]">
                      {EXERCISE_EQUIPMENT_LABELS[x.equipment]}
                    </span>
                    {caution && (
                      <span className="text-[11px] px-2 py-0.5 rounded-[8px] border border-[var(--danger)] text-[var(--danger)]">
                        Precaución
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        {results.length === 0 && (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">
            No hay ejercicios con esos filtros.
          </p>
        )}
      </div>
    </AppShell>
  );
}
