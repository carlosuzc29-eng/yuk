'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { ArrowRight, Dumbbell, ShieldCheck, Users, WifiOff } from 'lucide-react';

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
        <div className="h-10 w-10 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
        <p className="mt-5 eyebrow">Cargando YUK</p>
      </div>
    );
  }

  const features = [
    {
      icon: Dumbbell,
      title: 'Rutina a tu medida en 3 minutos',
      desc: 'Mapa muscular interactivo, progresión doble y guías animadas paso a paso.',
    },
    {
      icon: Users,
      title: 'Grupo privado con código de 6 caracteres',
      desc: 'Retos, rachas y muro compartido. Tu peso, medidas y fotos siempre son privados.',
    },
    {
      icon: WifiOff,
      title: 'Funciona sin señal en el gimnasio',
      desc: 'Registra tus series offline y sincroniza automáticamente al volver la conexión.',
    },
  ];

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto px-5 pt-6 pb-8">
      <header className="flex items-center justify-between h-12">
        <div className="flex items-center gap-2.5">
          <span className="relative h-7 w-7 rounded-full border-[2.5px] border-[var(--accent)] flex items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="text-[22px] font-light tracking-[-0.04em]">yuk</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] touch-target inline-flex items-center px-2"
        >
          Iniciar sesión
        </Link>
      </header>

      <main className="flex-1 flex flex-col pt-14 pb-10">
        <p className="eyebrow">Entrenamiento personalizado en grupo</p>
        <h1 className="font-display text-[44px] sm:text-[56px] leading-[1.05] tracking-[-0.036em] mt-4">
          Entrena con precisión. Construye constancia.
        </h1>
        <span className="accent-rule w-20 mt-6" aria-hidden="true" />
        <p className="text-base leading-[1.56] text-[var(--text-secondary)] mt-6">
          Rutinas adaptadas a tu cuerpo, equipo, lesiones y músculos prioritarios. Compite con tus
          amigos por constancia, nunca por ego.
        </p>

        <div className="mt-8 space-y-3">
          <Link href="/registro" className="block">
            <Button size="lg" fullWidth>
              Crear mi cuenta gratis <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login" className="block">
            <Button variant="secondary" size="lg" fullWidth>
              Ya tengo cuenta
            </Button>
          </Link>
        </div>

        <section className="mt-14" aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="eyebrow">
            Cómo funciona
          </h2>
          <ol className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="flex items-start gap-4 py-5">
                <span
                  className={
                    i === 0
                      ? 'shrink-0 w-[60px] text-center rounded-[8px] bg-[var(--accent)] text-white text-xs font-medium py-1'
                      : 'shrink-0 w-[60px] text-center rounded-[8px] text-[var(--text-muted)] text-xs py-1 border border-[var(--border)]'
                  }
                >
                  Paso {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-medium tracking-[-0.01em] flex items-center gap-2">
                    {title}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">{desc}</p>
                </div>
                <Icon
                  className="ml-auto h-5 w-5 shrink-0 text-[var(--text-secondary)] mt-0.5"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="space-y-4">
        <MedicalDisclaimer compact />
        <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.6} />
          Privacidad estricta: tus datos biométricos solo los ves tú.
        </p>
      </footer>
    </div>
  );
}
