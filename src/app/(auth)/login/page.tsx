'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  signInWithEmail,
  signInWithGoogle,
  requestPasswordReset,
} from '@/lib/firebase/auth-service';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al entrar con Google.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    if (!email.trim()) {
      setError('Escribe primero tu correo para enviarte el enlace de recuperación.');
      return;
    }
    try {
      await requestPasswordReset(email);
      setInfo('Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.');
    } catch {
      setError('No pudimos enviar el correo de recuperación.');
    }
  };

  return (
    <div className="min-h-dvh max-w-lg mx-auto px-5 py-6 flex flex-col justify-center">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] touch-target"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <h1 className="font-display text-4xl font-extrabold uppercase mt-2">
          Inicia sesión en <span className="text-[var(--accent)]">YUK</span>
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Retoma tu rutina y el progreso de tu grupo.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="next"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full min-h-[46px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="current-password" className="block text-sm font-medium">
                Contraseña
              </label>
              <button
                type="button"
                onClick={handleForgot}
                className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="relative">
              <input
                id="current-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                enterKeyHint="done"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                className="w-full min-h-[46px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 pr-12 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl p-3">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3">
              {info}
            </p>
          )}

          <Button type="submit" size="lg" fullWidth disabled={submitting}>
            {submitting ? 'Ingresando...' : 'Iniciar sesión'}
          </Button>
        </form>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[var(--surface)] px-2 text-[var(--text-muted)]">o continúa con</span>
          </div>
        </div>

        <Button variant="secondary" size="lg" fullWidth onClick={handleGoogle} disabled={submitting}>
          Continuar con Google
        </Button>
      </Card>

      <p className="text-center text-sm text-[var(--text-muted)] mt-5">
        ¿Aún no tienes cuenta?{' '}
        <Link href="/registro" className="font-semibold text-[var(--accent)] hover:underline">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
