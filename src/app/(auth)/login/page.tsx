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
    <div className="min-h-dvh max-w-lg mx-auto px-5 py-8 flex flex-col justify-center">
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] touch-target"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <h1 className="font-display text-[40px] mt-6">
          Inicia sesión en YUK
        </h1>
        <span className="accent-rule mt-4" aria-hidden="true" />
        <p className="text-base text-[var(--text-secondary)] mt-4">
          Retoma tu rutina y el progreso de tu grupo.
        </p>
      </div>

      <Card className="p-6 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="field-label pl-1">
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
              className="field"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="current-password" className="field-label pl-1">
                Contraseña
              </label>
              <button
                type="button"
                onClick={handleForgot}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline underline-offset-2 cursor-pointer"
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
                className="field pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="alert alert-error">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="alert alert-success">
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
          <div className="relative flex justify-center">
            <span className="bg-[var(--surface)] px-3 eyebrow">o continúa con</span>
          </div>
        </div>

        <Button variant="secondary" size="lg" fullWidth onClick={handleGoogle} disabled={submitting}>
          Continuar con Google
        </Button>
      </Card>

      <p className="text-center text-sm text-[var(--text-muted)] mt-6">
        ¿Aún no tienes cuenta?{' '}
        <Link href="/registro" className="font-medium text-[var(--text)] underline underline-offset-4 decoration-[var(--accent)] decoration-2">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
