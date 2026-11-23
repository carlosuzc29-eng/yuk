'use client';

import React, { useState } from 'react';
import { CalendarDays, Check, Dumbbell, Heart, Pencil, Play, Plus, Replace, Trash2 } from 'lucide-react';
import type { FavoriteRoutine, Routine, RoutineDay } from '@/types/training';
import { Button } from '@/components/ui/Button';
import { getExercise } from '@/lib/exercises/catalog';
import { SPLIT_LABELS } from '@/lib/training/generator';
import { MAX_FAVORITES } from '@/lib/training/favorites';
import { cn } from '@/lib/utils/cn';

/** Botón corazón: guardado (relleno) o no. */
export function FavoriteToggle({
  saved,
  onClick,
  label,
  compact = false,
}: {
  saved: boolean;
  onClick: () => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `${label}: guardada en favoritas (quitar)` : `${label}: guardar en favoritas`}
      title={saved ? 'Quitar de favoritas' : 'Guardar en favoritas'}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-[24px] border text-xs font-medium touch-target shrink-0 cursor-pointer transition-colors',
        compact ? 'h-9 w-9' : 'px-3.5 py-2',
        saved
          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]'
          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
      )}
    >
      <Heart
        className={cn('h-4 w-4 transition-transform', saved && 'scale-110')}
        strokeWidth={1.6}
        fill={saved ? 'var(--accent)' : 'none'}
        color={saved ? 'var(--accent)' : 'currentColor'}
      />
      {!compact && (saved ? 'Guardada' : 'Favorita')}
    </button>
  );
}

/** Formulario para nombrar la favorita antes de guardarla. */
export function SaveFavoriteForm({
  kind,
  defaultName,
  summary,
  full,
  onSave,
}: {
  kind: 'plan' | 'day';
  defaultName: string;
  summary: string;
  full: boolean;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (full) return;
        setSaving(true);
        setError(null);
        try {
          await onSave(name);
        } catch {
          setError('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
          setSaving(false);
        }
      }}
    >
      <p className="text-sm text-[var(--text-secondary)]">
        {kind === 'plan'
          ? 'Se guarda una copia de tu plan completo. Podrás volver a usarlo cuando quieras, aunque cambies tu rutina.'
          : 'Se guarda una copia de este día. Podrás entrenarlo directamente o añadirlo a cualquier plan.'}
      </p>
      <label className="block space-y-1.5">
        <span className="field-label">Nombre</span>
        <input
          className="field"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
      </label>
      <p className="text-xs text-[var(--text-muted)]">{summary}</p>
      {full && (
        <p className="alert alert-error">
          Tienes {MAX_FAVORITES} favoritas, el máximo. Borra alguna para guardar otra.
        </p>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      <Button type="submit" fullWidth disabled={saving || full || !name.trim()}>
        <Heart className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar en favoritas'}
      </Button>
    </form>
  );
}

function exerciseCount(days: RoutineDay[]) {
  return days.reduce((n, d) => n + d.exercises.length, 0);
}

function FavoriteCard({
  fav,
  currentDayName,
  canAddDay,
  onUsePlan,
  onTrainDay,
  onAddDay,
  onReplaceDay,
  onRename,
  onDelete,
}: {
  fav: FavoriteRoutine;
  currentDayName?: string;
  canAddDay: boolean;
  onUsePlan: () => void;
  onTrainDay: (day: RoutineDay) => void;
  onAddDay: () => void;
  onReplaceDay: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fav.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const preview = fav.days.flatMap((d) => d.exercises).slice(0, 4).map((e) => getExercise(e.exerciseId)?.name).filter(Boolean);

  return (
    <li className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-[var(--accent-soft)] inline-flex items-center justify-center">
          {fav.kind === 'plan' ? (
            <CalendarDays className="h-4 w-4 text-[var(--text)]" strokeWidth={1.6} />
          ) : (
            <Dumbbell className="h-4 w-4 text-[var(--text)]" strokeWidth={1.6} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onRename(name);
                setEditing(false);
              }}
            >
              <input
                className="field !min-h-[40px] !text-sm"
                value={name}
                maxLength={60}
                autoFocus
                aria-label="Nuevo nombre"
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit" aria-label="Guardar nombre" className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full border border-[var(--border)] cursor-pointer">
                <Check className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <p className="font-medium text-[15px] leading-snug break-words">{fav.name}</p>
          )}
          <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
            {fav.kind === 'plan'
              ? `Plan · ${fav.days.length} días · ${SPLIT_LABELS[fav.split]}`
              : `Día · ${fav.days[0]?.exercises.length ?? 0} ejercicios`}
            {fav.kind === 'plan' && ` · ${exerciseCount(fav.days)} ejercicios`}
          </p>
          {preview.length > 0 && (
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 line-clamp-2">{preview.join(' · ')}</p>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Cambiar nombre de ${fav.name}`}
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-elevated)] cursor-pointer"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {fav.kind === 'plan' ? (
        <div className="flex flex-wrap gap-1.5">
          {fav.days.map((d) => (
            <span key={d.id} className="text-[11px] rounded-[24px] bg-[var(--surface-elevated)] px-2.5 py-1 text-[var(--text-secondary)]">
              {d.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {fav.kind === 'plan' ? (
          <Button onClick={onUsePlan}>
            <Replace className="h-4 w-4" /> Usar este plan
          </Button>
        ) : (
          <>
            <Button onClick={() => onTrainDay(fav.days[0])}>
              <Play className="h-4 w-4" /> Entrenar ahora
            </Button>
            {canAddDay && (
              <Button variant="secondary" onClick={onAddDay}>
                <Plus className="h-4 w-4" /> Añadir a mi rutina
              </Button>
            )}
            {currentDayName && (
              <Button variant="secondary" onClick={onReplaceDay}>
                <Replace className="h-4 w-4" /> Reemplazar «{currentDayName}»
              </Button>
            )}
          </>
        )}
        {confirmDelete ? (
          <span className="inline-flex items-center gap-2 text-xs">
            <Button variant="danger" onClick={onDelete}>
              Borrar
            </Button>
            <button type="button" className="text-[var(--text-muted)] underline underline-offset-4 cursor-pointer" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </button>
          </span>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)} aria-label={`Borrar ${fav.name} de favoritas`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </li>
  );
}

/** Lista de favoritas con filtro Todas / Planes / Días. */
export function FavoritesList({
  favorites,
  routine,
  currentDay,
  onUsePlan,
  onTrainDay,
  onAddDay,
  onReplaceDay,
  onRename,
  onDelete,
}: {
  favorites: FavoriteRoutine[];
  routine: Routine | null;
  currentDay?: RoutineDay;
  onUsePlan: (fav: FavoriteRoutine) => void;
  onTrainDay: (fav: FavoriteRoutine, day: RoutineDay) => void;
  onAddDay: (fav: FavoriteRoutine) => void;
  onReplaceDay: (fav: FavoriteRoutine) => void;
  onRename: (fav: FavoriteRoutine, name: string) => void;
  onDelete: (fav: FavoriteRoutine) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'plan' | 'day'>('all');
  const list = favorites.filter((f) => filter === 'all' || f.kind === filter);

  if (!favorites.length) {
    return (
      <div className="text-center py-8 space-y-3">
        <span className="mx-auto h-12 w-12 rounded-full bg-[var(--accent-soft)] inline-flex items-center justify-center">
          <Heart className="h-5 w-5" color="var(--accent)" strokeWidth={1.6} />
        </span>
        <p className="font-medium">Aún no tienes favoritas</p>
        <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto">
          Toca el corazón en tu plan o en cualquier día para guardarlo y volver a él cuando quieras.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-[24px] border border-[var(--border)] p-0.5" role="group" aria-label="Filtrar favoritas">
        {(
          [
            ['all', `Todas (${favorites.length})`],
            ['plan', 'Planes'],
            ['day', 'Días'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            data-active={filter === k}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className="segment px-3.5 py-1.5 text-xs"
          >
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No hay {filter === 'plan' ? 'planes' : 'días'} guardados.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((fav) => (
            <FavoriteCard
              key={fav.id}
              fav={fav}
              currentDayName={currentDay?.name}
              canAddDay={!!routine && routine.days.length < 7}
              onUsePlan={() => onUsePlan(fav)}
              onTrainDay={(d) => onTrainDay(fav, d)}
              onAddDay={() => onAddDay(fav)}
              onReplaceDay={() => onReplaceDay(fav)}
              onRename={(n) => onRename(fav, n)}
              onDelete={() => onDelete(fav)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
