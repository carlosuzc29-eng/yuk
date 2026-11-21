'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Dumbbell,
  CalendarDays,
  BookOpen,
  TrendingUp,
  Users,
  User,
  WifiOff,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const NAV_ITEMS = [
  { href: '/hoy', label: 'Hoy', icon: Dumbbell },
  { href: '/rutina', label: 'Rutina', icon: CalendarDays },
  { href: '/ejercicios', label: 'Ejercicios', icon: BookOpen },
  { href: '/progreso', label: 'Progreso', icon: TrendingUp },
  { href: '/comunidad', label: 'Grupo', icon: Users },
  { href: '/perfil', label: 'Perfil', icon: User },
];

export function AppShell({
  title,
  subtitle,
  rightSlot,
  backHref,
  children,
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  /** Muestra un enlace "Volver" encima del título. */
  backHref?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto bg-[var(--bg)]">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[var(--bg)]/85 border-b border-[var(--border)] px-5 pt-5 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] mb-2"
              >
                <ArrowLeft className="h-4 w-4" /> Volver
              </Link>
            )}
            <h1 className="font-display text-[32px] leading-none tracking-[-0.03em] text-[var(--text)]">
              {title}
            </h1>
            <span className="accent-rule mt-3" aria-hidden="true" />
            {subtitle && (
              <p className="text-[13px] text-[var(--text-muted)] mt-2.5 truncate">{subtitle}</p>
            )}
          </div>
          {rightSlot}
        </div>
        {offline && (
          <div
            role="status"
            className="mt-3 flex items-center gap-2 rounded-[8px] bg-[var(--surface-elevated)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)]"
          >
            <WifiOff className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
            <span>Sin conexión. Tus cambios se guardarán y sincronizarán al volver.</span>
          </div>
        )}
      </header>

      <main className="flex-1 px-5 pt-6 pb-28">{children}</main>

      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-lg mx-auto grid grid-cols-6 px-1 py-1.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1 py-1.5 touch-target text-[11px] transition-colors',
                  active
                    ? 'text-[var(--text)] font-medium'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-0 h-[2px] w-6 rounded-full bg-[var(--accent)] transition-opacity',
                    active ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
