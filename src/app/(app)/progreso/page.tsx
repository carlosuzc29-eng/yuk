'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, Table2, Trash2, Trophy } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTraining } from '@/components/providers/TrainingProvider';
import { getExercise } from '@/lib/exercises/catalog';
import {
  completedSetCount,
  estimate1RM,
  formatDuration,
  personalRecords,
  sessionsThisWeek,
  setsByMuscle,
  weekKey,
  weeklyStreak,
  workingSets,
  workoutVolume,
} from '@/lib/training/progression';
import type { Workout } from '@/types/training';
import { MUSCLE_LABELS, type MuscleId } from '@/types/user';
import { cn } from '@/lib/utils/cn';

const AXIS = { fontSize: 11, fill: 'var(--text-muted)' };
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
      <p className="text-[var(--text-muted)]">{label}</p>
      <p className="font-medium text-[var(--text)] tabular-nums">
        {payload[0].value.toLocaleString('es')} {unit}
      </p>
    </div>
  );
}

function TableToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={open}
      className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
    >
      <Table2 className="h-3.5 w-3.5" /> {open ? 'Ver gráfico' : 'Ver tabla'}
    </button>
  );
}

function DataTable({ rows, cols }: { rows: (string | number)[][]; cols: string[] }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="text-left text-[11px] text-[var(--text-muted)]">
          {cols.map((c) => (
            <th key={c} className="font-normal pb-2">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--border)]">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="py-1.5">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ProgresoPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const { workouts, routine, bodyWeight, logBodyWeight, deleteWorkout } = useTraining();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const done = useMemo(() => workouts.filter((w) => w.status === 'completed'), [workouts]);
  const planned = routine?.days.length ?? profile?.daysPerWeek ?? 3;

  // Volumen por semana (últimas 8)
  const weekly = useMemo(() => {
    const out: { key: string; label: string; volume: number; sessions: number }[] = [];
    const d = new Date();
    for (let i = 7; i >= 0; i--) {
      const x = new Date(d);
      x.setDate(d.getDate() - i * 7);
      const k = weekKey(x.toISOString());
      const ws = done.filter((w) => weekKey(w.completedAt ?? w.startedAt) === k);
      const [, m, day] = k.split('-');
      out.push({
        key: k,
        label: `${Number(day)}/${Number(m)}`,
        volume: ws.reduce((a, w) => a + workoutVolume(w), 0),
        sessions: ws.length,
      });
    }
    return out;
  }, [done]);

  const thisWeekWorkouts = useMemo(() => {
    const k = weekKey(new Date().toISOString());
    return done.filter((w) => weekKey(w.completedAt ?? w.startedAt) === k);
  }, [done]);
  const muscleSets = useMemo(() => setsByMuscle(thisWeekWorkouts), [thisWeekWorkouts]);

  const records = useMemo(
    () => Object.values(personalRecords(done)).sort((a, b) => b.e1rm - a.e1rm),
    [done]
  );

  const loggedExercises = useMemo(() => {
    const ids = new Set<string>();
    done.forEach((w) => w.exercises.forEach((l) => workingSets(l).some((s) => s.weightKg) && ids.add(l.exerciseId)));
    return [...ids].filter((id) => getExercise(id));
  }, [done]);
  const [exId, setExId] = useState<string>('');
  const selectedEx = exId || loggedExercises[0] || '';
  const exSeries = useMemo(() => {
    return done
      .slice()
      .reverse()
      .map((w) => {
        const log = w.exercises.find((l) => l.exerciseId === selectedEx);
        if (!log) return null;
        const best = Math.max(0, ...workingSets(log).map((s) => estimate1RM(s.weightKg ?? 0, s.reps ?? 0)));
        return best ? { label: fmtDate(w.completedAt ?? w.startedAt), e1rm: best } : null;
      })
      .filter((x): x is { label: string; e1rm: number } => Boolean(x));
  }, [done, selectedEx]);

  const [tables, setTables] = useState<Record<string, boolean>>({});
  const toggleTable = (k: string) => setTables((t) => ({ ...t, [k]: !t[k] }));

  const [weightInput, setWeightInput] = useState('');
  const [openWorkout, setOpenWorkout] = useState<string | null>(null);

  if (loading || !user) return null;

  const thisWeekVolume = weekly[weekly.length - 1]?.volume ?? 0;
  const tiles = [
    { label: 'Esta semana', value: `${sessionsThisWeek(done)}/${planned}` },
    { label: 'Racha (semanas)', value: String(weeklyStreak(done, planned)) },
    { label: 'Volumen semanal', value: `${(thisWeekVolume / 1000).toLocaleString('es', { maximumFractionDigits: 1 })} t` },
    { label: 'Entrenamientos', value: String(done.length) },
  ];

  const muscleRows = (Object.keys(MUSCLE_LABELS) as MuscleId[])
    .map((m) => ({ m, v: Math.round((muscleSets[m] ?? 0) * 2) / 2 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);

  return (
    <AppShell title="Progreso" subtitle="Tu historial, récords y constancia">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <Card key={t.label} className="p-4">
              <p className="text-xs text-[var(--text-muted)]">{t.label}</p>
              <p className="font-display text-[30px] tabular-nums mt-1 leading-none">{t.value}</p>
            </Card>
          ))}
        </div>

        {done.length === 0 && (
          <Card featured className="p-5 space-y-3">
            <p className="font-medium">Aún no hay entrenamientos registrados</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Completa tu primera sesión y aquí verás tu volumen, récords y la evolución de cada ejercicio.
            </p>
            <Link href="/hoy">
              <Button>Ir al entrenamiento de hoy</Button>
            </Link>
          </Card>
        )}

        {done.length > 0 && (
          <>
            {/* Volumen semanal */}
            <Card className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="eyebrow">Volumen por semana</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-1">kg × repeticiones, series efectivas · últimas 8 semanas</p>
                </div>
                <TableToggle open={!!tables.vol} onClick={() => toggleTable('vol')} />
              </div>
              {tables.vol ? (
                <DataTable
                  cols={['Semana del', 'Sesiones', 'Volumen (kg)']}
                  rows={weekly.map((w) => [w.label, w.sessions, w.volume.toLocaleString('es')])}
                />
              ) : (
                <div className="h-48 -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekly} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={AXIS}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                        tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))}
                      />
                      <Tooltip cursor={{ fill: 'var(--surface-elevated)' }} content={<ChartTooltip unit="kg" />} />
                      <Bar isAnimationActive={false} dataKey="volume" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24}>
                        <LabelList
                          dataKey="volume"
                          position="top"
                          content={(p) => {
                            const { x, y, width, index, value } = p as { x: number; y: number; width: number; index: number; value: number };
                            if (index !== weekly.length - 1 || !value) return null;
                            return (
                              <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="var(--text)">
                                {(value / 1000).toLocaleString('es', { maximumFractionDigits: 1 })} t
                              </text>
                            );
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Series por músculo */}
            <Card className="p-5 space-y-4">
              <div>
                <h2 className="eyebrow">Series por músculo esta semana</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">Zona marcada: 10–20 series semanales.</p>
              </div>
              {muscleRows.length ? (
                <ul className="space-y-2.5">
                  {muscleRows.map(({ m, v }) => (
                    <li key={m} className="grid grid-cols-[110px_1fr_36px] items-center gap-3" title={`${MUSCLE_LABELS[m]}: ${v} series`}>
                      <span className="text-xs text-[var(--text-secondary)] truncate">{MUSCLE_LABELS[m]}</span>
                      <div className="relative h-2.5 rounded-full bg-[var(--chart-track)] overflow-hidden">
                        <div aria-hidden="true" className="absolute inset-y-0 border-x border-[var(--text-muted)]/40" style={{ left: `${(10 / 24) * 100}%`, width: `${(10 / 24) * 100}%` }} />
                        <div className="absolute inset-y-0 left-0 rounded-r-[4px] bg-[var(--chart-1)]" style={{ width: `${Math.min(100, (v / 24) * 100)}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-right">{v}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">Sin series registradas esta semana.</p>
              )}
            </Card>

            {/* Progreso por ejercicio */}
            {loggedExercises.length > 0 && (
              <Card className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="eyebrow">Evolución por ejercicio</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Mejor 1RM estimado de cada sesión (Epley)</p>
                  </div>
                  <TableToggle open={!!tables.ex} onClick={() => toggleTable('ex')} />
                </div>
                <label className="relative block">
                  <span className="sr-only">Ejercicio</span>
                  <select value={selectedEx} onChange={(e) => setExId(e.target.value)} className="field appearance-none pr-10 text-[15px]">
                    {loggedExercises.map((id) => (
                      <option key={id} value={id}>
                        {getExercise(id)?.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ash)] pointer-events-none" />
                </label>
                {tables.ex ? (
                  <DataTable cols={['Fecha', '1RM est. (kg)']} rows={exSeries.map((p) => [p.label, p.e1rm])} />
                ) : exSeries.length < 2 ? (
                  <p className="text-sm text-[var(--text-muted)] py-6 text-center">
                    {exSeries.length === 1 ? `1RM estimado: ${exSeries[0].e1rm} kg. Registra otra sesión para ver la tendencia.` : 'Sin datos.'}
                  </p>
                ) : (
                  <div className="h-48 -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={exSeries} margin={{ top: 18, right: 28, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
                        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltip unit="kg" />} />
                        <Line
                          isAnimationActive={false}
                          type="monotone"
                          dataKey="e1rm"
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          strokeLinecap="round"
                          dot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: 'var(--chart-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
                        >
                          <LabelList
                            dataKey="e1rm"
                            content={(p) => {
                              const { x, y, index, value } = p as { x: number; y: number; index: number; value: number };
                              if (index !== exSeries.length - 1) return null;
                              return (
                                <text x={x} y={y - 10} textAnchor="middle" fontSize={11} fill="var(--text)">
                                  {value} kg
                                </text>
                              );
                            }}
                          />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            )}

            {/* Récords */}
            {records.length > 0 && (
              <Card className="p-5 space-y-3">
                <h2 className="eyebrow flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5" /> Récords personales
                </h2>
                <ul className="divide-y divide-[var(--border)]">
                  {records.slice(0, 10).map((r) => (
                    <li key={r.exerciseId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="truncate">{getExercise(r.exerciseId)?.name}</span>
                      <span className="shrink-0 tabular-nums text-right">
                        <span className="font-medium">{r.weightKg} kg × {r.reps}</span>
                        <span className="block text-[11px] text-[var(--text-muted)]">1RM est. {r.e1rm} kg · {fmtDate(r.date)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}

        {/* Peso corporal */}
        <Card className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="eyebrow">Peso corporal</h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">Privado: nunca se comparte con tu grupo.</p>
            </div>
            {bodyWeight.length > 1 && <TableToggle open={!!tables.bw} onClick={() => toggleTable('bw')} />}
          </div>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const n = Number(weightInput.replace(',', '.'));
              if (n >= 25 && n <= 350) {
                await logBodyWeight(Math.round(n * 10) / 10);
                setWeightInput('');
              }
            }}
          >
            <input
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder={profile ? `Hoy (kg) · último ${bodyWeight[bodyWeight.length - 1]?.weightKg ?? profile.weightKg}` : 'kg'}
              aria-label="Peso de hoy en kg"
              className="field flex-1"
            />
            <Button type="submit" variant="secondary">
              Guardar
            </Button>
          </form>
          {bodyWeight.length > 1 &&
            (tables.bw ? (
              <DataTable cols={['Fecha', 'Peso (kg)']} rows={bodyWeight.map((b) => [b.date, b.weightKg])} />
            ) : (
              <div className="h-40 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bodyWeight.map((b) => ({ label: fmtDate(b.date), kg: b.weightKg }))} margin={{ top: 18, right: 28, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltip unit="kg" />} />
                    <Line isAnimationActive={false} type="monotone" dataKey="kg" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--surface)', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
        </Card>

        {/* Historial */}
        {done.length > 0 && (
          <section className="space-y-3">
            <h2 className="eyebrow">Historial</h2>
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {done.map((w) => (
                <WorkoutRow
                  key={w.id}
                  w={w}
                  open={openWorkout === w.id}
                  onToggle={() => setOpenWorkout(openWorkout === w.id ? null : w.id)}
                  onDelete={async () => {
                    if (window.confirm('¿Eliminar este entrenamiento del historial?')) await deleteWorkout(w.id);
                  }}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function WorkoutRow({ w, open, onToggle, onDelete }: { w: Workout; open: boolean; onToggle: () => void; onDelete: () => void }) {
  const date = new Date(w.completedAt ?? w.startedAt);
  return (
    <li>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 py-3.5 text-left cursor-pointer">
        <div className="w-11 shrink-0 text-center">
          <p className="font-display text-[22px] leading-none tabular-nums">{date.getDate()}</p>
          <p className="text-[10px] uppercase text-[var(--text-muted)] mt-1">
            {date.toLocaleDateString('es', { month: 'short' })}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium truncate">{w.name}</p>
          <p className="text-xs text-[var(--text-muted)] tabular-nums">
            {formatDuration(w.durationSeconds)} · {completedSetCount(w)} series · {w.totalVolumeKg.toLocaleString('es')} kg
          </p>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-[var(--ash)] transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="pb-4 pl-14 space-y-3">
          {w.exercises.map((l) => (
            <div key={l.uid}>
              <p className="text-sm font-medium">{getExercise(l.exerciseId)?.name ?? l.exerciseId}</p>
              <p className="text-xs text-[var(--text-secondary)] tabular-nums">
                {workingSets(l)
                  .map((s) => (s.seconds ? `${s.seconds} s` : `${s.weightKg ?? 0} kg × ${s.reps ?? 0}`))
                  .join(' · ')}
              </p>
            </div>
          ))}
          {w.notes && <p className="text-xs text-[var(--text-muted)] italic">“{w.notes}”</p>}
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 text-xs text-[var(--danger)] cursor-pointer">
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </button>
        </div>
      )}
    </li>
  );
}
