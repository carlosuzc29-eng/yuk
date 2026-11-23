'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTraining } from '@/components/providers/TrainingProvider';

/**
 * Pantalla de carga inicial.
 *
 * Se pinta ya en el HTML estático (aparece antes de que cargue el JavaScript) y se retira cuando
 * la app está lista de verdad: fuentes y página cargadas, sesión resuelta, rutina e historial
 * leídos y el modelo 3D del usuario descargado (con su porcentaje real). Nunca bloquea más de
 * MAX_WAIT ms; si algo tarda, la app se muestra y la descarga sigue en segundo plano.
 *
 * En recargas dentro de la misma sesión se muestra lo mínimo (los recursos ya están en caché).
 */

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const SEEN_KEY = 'yuk_preloaded_v1';
const MAX_WAIT = 5000;
const MODEL_WAIT = 2500;
/** Tamaño aproximado de un GLB, para estimar el progreso si el servidor no envía Content-Length. */
const APPROX_MODEL_BYTES = 1_700_000;

type StepId = 'page' | 'session' | 'data' | 'model';
const STEP_LABEL: Record<StepId, string> = {
  page: 'Cargando la app',
  session: 'Comprobando tu sesión',
  data: 'Preparando tu rutina',
  model: 'Cargando las demostraciones 3D',
};
// Peso de cada paso en la barra (suma 1)
const STEP_WEIGHT: Record<StepId, number> = { page: 0.25, session: 0.15, data: 0.25, model: 0.35 };

function seenThisSession(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Descarga el GLB con progreso real; queda en la caché HTTP / Service Worker para el visor 3D. */
async function warmModel(url: string, onProgress: (p: number) => void, signal: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok || !res.body) {
    onProgress(1);
    return;
  }
  const total = Number(res.headers.get('content-length')) || APPROX_MODEL_BYTES;
  const reader = res.body.getReader();
  let loaded = 0;
  let lastReport = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength;
    // Con red lenta llegan cientos de trozos pequeños: informar en cada uno saturaría el hilo
    // principal con re-renders. Como mucho, una actualización cada 120 ms.
    const now = performance.now();
    if (now - lastReport > 120) {
      lastReport = now;
      onProgress(Math.min(0.98, loaded / total));
    }
  }
  onProgress(1);
}

export function Preloader() {
  const { user, profile, loading: authLoading } = useAuth();
  const { loading: trainingLoading } = useTraining();
  const [progress, setProgress] = useState<Record<StepId, number>>({ page: 0, session: 0, data: 0, model: 0 });
  const [phase, setPhase] = useState<'visible' | 'leaving' | 'gone'>('visible');
  const startRef = useRef(0);
  const modelStarted = useRef(false);

  const set = (id: StepId, v: number) => setProgress((p) => (p[id] >= v ? p : { ...p, [id]: v }));

  // 1. Página y fuentes
  useEffect(() => {
    startRef.current = performance.now();
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve();
    const loaded =
      document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise<void>((r) => window.addEventListener('load', () => r(), { once: true }));
    set('page', 0.5);
    Promise.all([fonts, loaded]).then(() => set('page', 1));
  }, []);

  // 2. Sesión
  useEffect(() => {
    if (!authLoading) set('session', 1);
  }, [authLoading]);

  // 3. Datos de entrenamiento (sólo con sesión iniciada)
  useEffect(() => {
    if (authLoading) return;
    if (!user || !trainingLoading) set('data', 1);
  }, [authLoading, user, trainingLoading]);

  // 4. Modelo 3D del usuario (sólo si ya completó el perfil: es quien verá demostraciones)
  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile?.onboardingCompleted || seenThisSession()) {
      set('model', 1);
      return;
    }
    if (modelStarted.current) return;
    modelStarted.current = true;
    const file = profile.sex === 'female' ? 'mujer.glb' : 'hombre.glb';
    // Pasado MODEL_WAIT damos el paso por hecho; la descarga sigue en segundo plano (no se aborta).
    // El temporizador NO se cancela al re-ejecutarse el efecto (p. ej. si cambia el objeto perfil).
    window.setTimeout(() => set('model', 1), MODEL_WAIT);
    warmModel(`${basePath}/models/${file}`, (p) => set('model', p), new AbortController().signal).then(
      () => set('model', 1),
      () => set('model', 1)
    );
  }, [authLoading, user, profile]);

  // Tope de seguridad: nunca bloquear la app
  useEffect(() => {
    const id = window.setTimeout(() => setProgress({ page: 1, session: 1, data: 1, model: 1 }), MAX_WAIT);
    return () => window.clearTimeout(id);
  }, []);

  const total = (Object.keys(progress) as StepId[]).reduce((acc, k) => acc + progress[k] * STEP_WEIGHT[k], 0);
  const done = total >= 0.999;
  const current = (['page', 'session', 'data', 'model'] as StepId[]).find((k) => progress[k] < 1) ?? 'model';

  useEffect(() => {
    if (!done || phase !== 'visible') return;
    // Un mínimo breve en la primera visita evita un parpadeo; en recargas, casi nada.
    const min = seenThisSession() ? 150 : 700;
    const wait = Math.max(0, min - (performance.now() - startRef.current));
    const id = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* almacenamiento bloqueado: no pasa nada */
      }
      setPhase('leaving');
      // Precarga en segundo plano del visor 3D (three.js) para que la primera demo abra al instante.
      if (user) {
        const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
        const warm = () => void import('@/components/exercises/Exercise3DViewer').catch(() => undefined);
        if (idle) idle(warm);
        else window.setTimeout(warm, 1200);
      }
    }, wait);
    return () => window.clearTimeout(id);
  }, [done, phase, user]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const id = window.setTimeout(() => setPhase('gone'), 420);
    return () => window.clearTimeout(id);
  }, [phase]);

  // Bloquea el scroll del fondo mientras está visible
  useEffect(() => {
    if (phase === 'gone') return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [phase]);

  if (phase === 'gone') return null;

  const pct = Math.round(total * 100);

  return (
    <div
      id="yuk-preloader"
      role="status"
      aria-live="polite"
      aria-label={`Cargando YUK: ${pct}%`}
      className="yuk-preloader fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-[var(--bg)] px-6"
      data-leaving={phase === 'leaving'}
    >
      <div className="flex flex-col items-center gap-5">
        <svg viewBox="0 0 120 120" className="h-20 w-20" aria-hidden="true">
          <circle cx="60" cy="60" r="44" fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle
            cx="60"
            cy="60"
            r="44"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 44}
            strokeDashoffset={2 * Math.PI * 44 * (1 - total)}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 300ms ease' }}
          />
          <circle className="yuk-preloader-dot" cx="60" cy="60" r="11" fill="var(--accent)" />
        </svg>
        <p className="font-display text-[34px] leading-none tracking-tight">yuk</p>
      </div>

      <div className="w-full max-w-[240px] space-y-2.5 text-center">
        <p className="text-sm text-[var(--text-secondary)] min-h-[20px]">{done ? 'Listo' : STEP_LABEL[current]}</p>
        <div className="h-[3px] rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] origin-left"
            style={{ transform: `scaleX(${total})`, transition: 'transform 300ms ease' }}
          />
        </div>
        <p className="text-xs text-[var(--text-muted)] tabular-nums">{pct}%</p>
      </div>
    </div>
  );
}
