'use client';

import React from 'react';
import {
  DAY_FOCUS_LABELS,
  defaultDayFocusPlan,
  type DayFocus,
  type Sex,
} from '@/types/user';
import { cn } from '@/lib/utils/cn';

interface DayFocusPickerProps {
  daysPerWeek: number;
  sex: Sex;
  value: DayFocus[];
  onChange: (next: DayFocus[]) => void;
}

const OPTIONS: DayFocus[] = ['pierna', 'superior', 'completo'];

function makePreset(days: number, kind: 'mas_pierna' | 'equilibrado' | 'mas_superior'): DayFocus[] {
  if (kind === 'mas_pierna') return defaultDayFocusPlan(days, 'female');
  if (kind === 'mas_superior') return defaultDayFocusPlan(days, 'male');
  return Array.from({ length: days }, (_, i) => (i % 2 === 0 ? 'superior' : 'pierna'));
}

export function DayFocusPicker({ daysPerWeek, sex, value, onChange }: DayFocusPickerProps) {
  const plan: DayFocus[] =
    value.length === daysPerWeek ? value : defaultDayFocusPlan(daysPerWeek, sex);

  const legCount = plan.filter((d) => d === 'pierna').length;
  const upperCount = plan.filter((d) => d === 'superior').length;
  const fullCount = plan.filter((d) => d === 'completo').length;

  const setDay = (idx: number, focus: DayFocus) => {
    const next = [...plan];
    next[idx] = focus;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Elige qué trabajas cada día</p>
        <span className="text-xs text-[var(--text-muted)] tabular-nums">
          {[
            legCount > 0 && `${legCount} pierna`,
            upperCount > 0 && `${upperCount} superior`,
            fullCount > 0 && `${fullCount} completo`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>

      {/* Atajos rápidos */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: 'mas_pierna', label: 'Énfasis pierna/glúteo' },
            { id: 'equilibrado', label: 'Equilibrado' },
            { id: 'mas_superior', label: 'Énfasis tren superior' },
          ] as const
        ).map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(makePreset(daysPerWeek, preset.id))}
            className="px-3 py-1.5 rounded-[24px] text-xs font-medium border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors cursor-pointer min-h-[34px]"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Selector día por día */}
      <div className="space-y-2">
        {plan.map((focus, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)]/60 px-3 py-2"
          >
            <span className="text-xs font-semibold text-[var(--text)] shrink-0 tabular-nums">
              Día {idx + 1}
            </span>
            <div className="grid grid-cols-3 gap-1 flex-1 max-w-[240px]">
              {OPTIONS.map((opt) => {
                const active = focus === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDay(idx, opt)}
                    className={cn(
                      'min-h-[36px] px-2 rounded-[6px] text-xs font-medium transition-colors cursor-pointer',
                      active
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                    )}
                  >
                    {DAY_FOCUS_LABELS[opt].short}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
