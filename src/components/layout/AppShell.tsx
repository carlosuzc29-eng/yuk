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
  children,
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
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
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[var(--bg)]/90 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
              <h1 className="font-display text-2xl font-extrabold uppercase tracking-wide leading-none">
                {title}
              </h1>
            </div>
            {subtitle && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
            )}
          </div>
          {rightSlot}
        </div>
        {offline && (
          <div
            role="status"
            className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs text-[var(--warning)]"
          >
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            <span>Sin conexión. Tus cambios se guardarán y sincronizarán al volver.</span>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">{children}</main>

      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md"
      >
        <div className="max-w-lg mx-auto grid grid-cols-6 px-1 py-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl touch-target text-[11px] font-medium transition-colors',
                  active
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
