'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { createGroup, joinGroupByCode } from '@/lib/firebase/auth-service';
import { normalizeInviteCode } from '@/lib/utils/invite-code';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Check, Copy, Crown, Users, ArrowRight } from 'lucide-react';

export default function GrupoPage() {
  const router = useRouter();
  const { user, profile, group, groupMembers, refreshProfile } = useAuth();
  const [mode, setMode] = useState<'join' | 'create'>('create');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSubmitting(true);
    try {
      await createGroup(groupName, {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName,
        daysPerWeek: profile?.daysPerWeek ?? 4,
      });
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear el grupo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSubmitting(true);
    try {
      await joinGroupByCode(inviteCode, {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName,
        daysPerWeek: profile?.daysPerWeek ?? 4,
      });
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="min-h-dvh max-w-lg mx-auto px-5 py-8 space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
          Tu equipo de entrenamiento
        </span>
        <h1 className="font-display text-4xl font-extrabold uppercase mt-1">
          {group ? group.name : 'Crea o únete a un grupo'}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Comparte constancia, rachas y retos con tus amigos. Tu peso corporal, medidas y fotos
          nunca se muestran al grupo.
        </p>
      </div>

      {group ? (
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  Código de invitación (6 caracteres)
                </p>
                <p className="font-display text-4xl font-extrabold tracking-[0.2em] text-[var(--accent)] mt-1">
                  {group.inviteCode}
                </p>
              </div>
              <Button variant="secondary" onClick={copyCode} aria-label="Copiar código de invitación">
                {copied ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Envía este código a tus amigos para que se unan como miembros.
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Miembros ({groupMembers.length})
              </h2>
            </div>
            <ul className="space-y-2">
              {groupMembers.map((m) => (
                <li
                  key={m.uid}
                  className="flex items-center justify-between rounded-xl bg-[var(--surface-elevated)] px-3 py-2.5 text-sm"
                >
                  <span className="font-semibold">{m.displayName}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)]">
                    {m.role === 'admin' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                    {m.role === 'admin' ? 'Admin' : 'Miembro'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Button size="lg" fullWidth onClick={() => router.push('/hoy')}>
            Ir a mi entrenamiento <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]">
            <button
              type="button"
              onClick={() => {
                setMode('create');
                setError('');
              }}
              className={`py-2.5 rounded-lg text-sm font-bold transition-colors min-h-[44px] cursor-pointer ${
                mode === 'create'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Crear grupo
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('join');
                setError('');
              }}
              className={`py-2.5 rounded-lg text-sm font-bold transition-colors min-h-[44px] cursor-pointer ${
                mode === 'join'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Unirme con código
            </button>
          </div>

          <Card className="p-5">
            {mode === 'create' ? (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="group-name" className="block text-sm font-medium">
                    Nombre de tu grupo
                  </label>
                  <input
                    id="group-name"
                    name="group-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={60}
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ej. Team Hierro 7AM"
                    className="w-full min-h-[46px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 text-sm"
                  />
                  <p className="text-xs text-[var(--text-muted)]">
                    Serás el admin del grupo y podrás crear retos grupales.
                  </p>
                </div>
                {error && (
                  <p role="alert" className="text-xs text-red-400">
                    {error}
                  </p>
                )}
                <Button type="submit" size="lg" fullWidth disabled={submitting}>
                  {submitting ? 'Creando grupo...' : 'Crear grupo y generar código'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="invite-code" className="block text-sm font-medium">
                    Código de invitación (6 caracteres)
                  </label>
                  <input
                    id="invite-code"
                    name="invite-code"
                    type="text"
                    required
                    maxLength={6}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(normalizeInviteCode(e.target.value))}
                    placeholder="Ej. F7K9Q2"
                    className="w-full min-h-[52px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 text-center font-display text-2xl font-extrabold tracking-[0.25em] uppercase"
                  />
                </div>
                {error && (
                  <p role="alert" className="text-xs text-red-400">
                    {error}
                  </p>
                )}
                <Button type="submit" size="lg" fullWidth disabled={submitting || inviteCode.length < 6}>
                  {submitting ? 'Uniéndome...' : 'Unirme al grupo'}
                </Button>
              </form>
            )}
          </Card>

          <div className="text-center">
            <Link
              href="/hoy"
              className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] underline"
            >
              Hacerlo después e ir a mi panel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
