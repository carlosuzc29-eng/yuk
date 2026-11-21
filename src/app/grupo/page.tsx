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
    <div className="min-h-dvh max-w-lg mx-auto px-5 py-10 space-y-8">
      <div>
        <p className="eyebrow">Tu equipo de entrenamiento</p>
        <h1 className="font-display text-[40px] mt-3">
          {group ? group.name : 'Crea o únete a un grupo'}
        </h1>
        <span className="accent-rule mt-4" aria-hidden="true" />
        <p className="text-base text-[var(--text-secondary)] mt-4 leading-relaxed">
          Comparte constancia, rachas y retos con tus amigos. Tu peso corporal, medidas y fotos
          nunca se muestran al grupo.
        </p>
      </div>

      {group ? (
        <div className="space-y-4">
          <Card featured className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow !text-[var(--text-secondary)]">
                  Código de invitación (6 caracteres)
                </p>
                <p className="font-display text-[40px] !tracking-[0.18em] tabular-nums mt-2">
                  {group.inviteCode}
                </p>
              </div>
              <Button variant="secondary" onClick={copyCode} aria-label="Copiar código de invitación">
                {copied ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Envía este código a tus amigos para que se unan como miembros.
            </p>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={1.6} />
              <h2 className="eyebrow">
                Miembros ({groupMembers.length})
              </h2>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {groupMembers.map((m) => (
                <li
                  key={m.uid}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <span className="font-medium">{m.displayName}</span>
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-[8px] text-[var(--text-secondary)] bg-[var(--surface-elevated)]">
                    {m.role === 'admin' && <Crown className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.8} />}
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
          <div className="grid grid-cols-2 gap-1 p-1 rounded-[24px] bg-[var(--surface-elevated)]">
            <button
              type="button"
              onClick={() => {
                setMode('create');
                setError('');
              }}
              data-active={mode === 'create'}
              className="segment py-2.5 text-sm min-h-[44px]"
            >
              Crear grupo
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('join');
                setError('');
              }}
              data-active={mode === 'join'}
              className="segment py-2.5 text-sm min-h-[44px]"
            >
              Unirme con código
            </button>
          </div>

          <Card className="p-6">
            {mode === 'create' ? (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="group-name" className="field-label pl-1">
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
                    className="field"
                  />
                  <p className="text-xs text-[var(--text-muted)] pl-1">
                    Serás el admin del grupo y podrás crear retos grupales.
                  </p>
                </div>
                {error && (
                  <p role="alert" className="alert alert-error">
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
                  <label htmlFor="invite-code" className="field-label pl-1">
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
                    className="field !min-h-[60px] text-center !text-[28px] font-light tracking-[0.25em] uppercase tabular-nums"
                  />
                </div>
                {error && (
                  <p role="alert" className="alert alert-error">
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
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] underline underline-offset-4"
            >
              Hacerlo después e ir a mi panel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
