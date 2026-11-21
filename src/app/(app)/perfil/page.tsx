'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme, type ThemePreference } from '@/components/providers/ThemeProvider';
import { signOutUser } from '@/lib/firebase/auth-service';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { LogOut, Moon, Sun, Monitor, SlidersHorizontal, Users } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export default function PerfilPage() {
  const router = useRouter();
  const { user, profile, group, loading } = useAuth();
  const { preference, resolvedTheme, setPreference } = useTheme();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) return null;

  const handleSignOut = async () => {
    await signOutUser();
    router.replace('/');
  };

  const themeOptions: { id: ThemePreference; label: string; icon: React.ElementType }[] = [
    {
      id: 'system',
      label: `Sistema (${resolvedTheme === 'dark' ? 'Oscuro' : 'Claro'})`,
      icon: Monitor,
    },
    { id: 'dark', label: 'Oscuro', icon: Moon },
    { id: 'light', label: 'Claro', icon: Sun },
  ];

  return (
    <AppShell title="Perfil" subtitle={user.email}>
      <div className="space-y-4">
        <Card className="p-4 space-y-2">
          <p className="font-display text-2xl font-extrabold uppercase">
            {profile?.displayName || user.displayName}
          </p>
          {profile && (
            <p className="text-xs text-[var(--text-muted)]">
              {profile.weightKg} kg · {profile.heightCm} cm · IMC {profile.nutritionEstimate.bmi} ·{' '}
              {profile.daysPerWeek} días/semana
            </p>
          )}
          <div className="pt-2 flex flex-wrap gap-2">
            <Link href="/onboarding">
              <Button variant="secondary">
                <SlidersHorizontal className="h-4 w-4" /> Editar perfil y mapa muscular
              </Button>
            </Link>
            <Link href="/grupo">
              <Button variant="secondary">
                <Users className="h-4 w-4" /> {group ? `Grupo: ${group.name}` : 'Gestionar grupo'}
              </Button>
            </Link>
          </div>
        </Card>

        {/* Control de tema 3 estados (Sistema / Oscuro / Claro) */}
        <Card className="p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Apariencia
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreference(id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold min-h-[58px] cursor-pointer transition-colors',
                  preference === id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-muted)]'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </Card>

        <MedicalDisclaimer />

        <Button variant="danger" size="lg" fullWidth onClick={handleSignOut}>
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </Button>
      </div>
    </AppShell>
  );
}
