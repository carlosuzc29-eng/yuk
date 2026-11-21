'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { Dumbbell, ShieldCheck, Users, WifiOff } from 'lucide-react';

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (!profile?.onboardingCompleted) {
        router.replace('/onboarding');
      } else {
        router.replace('/hoy');
      }
    }
  }, [user, profile, loading, router]);

  if (loading || user) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[var(--bg)]">
        <div className="h-12 w-12 rounded-full border-4 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
        <p className="mt-4 font-display text-xl uppercase tracking-widest text-[var(--text-muted)]">
          Cargando YUK...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col justify-between max-w-lg mx-auto px-5 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white font-display font-extrabold text-xl">
            Y
          </div>
          <span className="font-display text-2xl font-extrabold tracking-wider uppercase">
            YUK
          </span>
        </div>
        <Link
          href="/login"
          className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)] touch-target inline-flex items-center px-2"
        >
          Iniciar sesión
        </Link>
      </header>

      <main className="my-8 space-y-6">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1 rounded-full">
            Entrenamiento personalizado en grupo
          </span>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight">
            Entrena con precisión. <span className="text-[var(--accent)]">Forja</span> constancia.
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
            Rutinas adaptadas a tu cuerpo, equipo, lesiones y músculos prioritarios. Compite con tus
            amigos por constancia, nunca por ego.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <Dumbbell className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold">Rutina a tu medida en 3 minutos</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Mapa muscular interactivo, progresión doble y guías animadas paso a paso.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <Users className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold">Grupo privado con código de 6 caracteres</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Retos, rachas y muro compartido. Tu peso, medidas y fotos siempre son privados.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <WifiOff className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold">Funciona sin señal en el gimnasio</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Registra tus series offline y sincroniza automáticamente al volver la conexión.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Link href="/registro" className="block">
            <Button size="lg" fullWidth>
              Crear mi cuenta gratis
            </Button>
          </Link>
          <Link href="/login" className="block">
            <Button variant="secondary" size="lg" fullWidth>
              Ya tengo cuenta
            </Button>
          </Link>
        </div>
      </main>

      <footer className="space-y-3">
        <MedicalDisclaimer compact />
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--success)]" />
          Privacidad estricta: tus datos biométricos solo los ves tú.
        </p>
      </footer>
    </div>
  );
}
