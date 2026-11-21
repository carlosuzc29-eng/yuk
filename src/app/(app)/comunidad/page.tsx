'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Crown, Flame, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils/cn';

export default function ComunidadPage() {
  const router = useRouter();
  const { user, group, groupMembers, loading, refreshProfile } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    // Refresca las estadísticas del grupo al entrar.
    if (user && group) void refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, group?.id]);

  if (loading || !user) return null;

  if (!group) {
    return (
      <AppShell title="Grupo" subtitle="Constancia compartida">
        <Card featured className="p-6 space-y-3">
          <p className="font-medium">Entrena con tus amigos</p>
          <p className="text-sm text-[var(--text-secondary)]">
            Crea un grupo o únete con un código para ver quién está cumpliendo su plan esta semana.
          </p>
          <Link href="/grupo">
            <Button>Crear o unirme a un grupo</Button>
          </Link>
        </Card>
      </AppShell>
    );
  }

  const ranked = [...groupMembers]
    .map((m) => ({
      ...m,
      pct: m.weeklyPlannedSessions ? Math.min(100, Math.round((m.weeklyCompletedSessions / m.weeklyPlannedSessions) * 100)) : 0,
    }))
    .sort((a, b) => b.pct - a.pct || b.currentStreak - a.currentStreak);

  return (
    <AppShell title="Grupo" subtitle={`${group.name} · ${groupMembers.length} miembros`}>
      <div className="space-y-5">
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="eyebrow">Constancia esta semana</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Sesiones completadas frente a las planificadas.</p>
          </div>
          <ol className="space-y-4">
            {ranked.map((m, i) => (
              <li key={m.uid} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-5 text-[var(--text-muted)] tabular-nums">{i + 1}</span>
                    <span className={cn('truncate', m.uid === user.uid && 'font-medium')}>
                      {m.displayName}
                      {m.uid === user.uid && ' (tú)'}
                    </span>
                    {m.role === 'admin' && <Crown className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-label="Admin" />}
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">
                    {m.weeklyCompletedSessions}/{m.weeklyPlannedSessions}
                    {m.currentStreak > 0 && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-[var(--text)]">
                        <Flame className="h-3.5 w-3.5 text-[var(--accent)]" /> {m.currentStreak}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--chart-track)] overflow-hidden" title={`${m.pct}% del plan semanal`}>
                  <div className="h-full rounded-r-[4px] bg-[var(--chart-1)]" style={{ width: `${m.pct}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-[var(--text-muted)]">
            <Flame className="inline h-3 w-3 text-[var(--accent)]" /> = semanas seguidas cumpliendo el plan.
          </p>
        </Card>

        <p className="flex items-start gap-2 text-xs text-[var(--text-muted)] leading-relaxed">
          <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.6} />
          El grupo solo ve tus sesiones y tu racha. Tu peso, medidas, fotos y cargas son siempre privados.
        </p>

        <Link href="/grupo" className="block">
          <Button variant="secondary" fullWidth>
            Código de invitación y miembros
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}
