'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { signUpWithEmail, signInWithGoogle } from '@/lib/firebase/auth-service';

export default function RegistroPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Tu contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      await signUpWithEmail(email, password, displayName);
      router.replace('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear tu cuenta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al entrar con Google.');
    } finally {
      setSubmitting(false);
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
          Crea tu cuenta en YUK
        </h1>
        <span className="accent-rule mt-4" aria-hidden="true" />
        <p className="text-base text-[var(--text-secondary)] mt-4">
          En menos de 3 minutos tendrás tu plan personalizado listo.
        </p>
      </div>

      <Card className="p-6 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="full-name" className="field-label pl-1">
              Nombre
            </label>
            <input
              id="full-name"
              name="name"
              type="text"
              autoComplete="name"
              enterKeyHint="next"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ej. Valeria o Diego"
              className="field"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signup-email" className="field-label pl-1">
              Correo electrónico
            </label>
            <input
              id="signup-email"
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
            <label htmlFor="new-password" className="field-label pl-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="new-password"
                name="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                enterKeyHint="done"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
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

          <Button type="submit" size="lg" fullWidth disabled={submitting}>
            {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>
        </form>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[var(--surface)] px-3 eyebrow">o regístrate con</span>
          </div>
        </div>

        <Button variant="secondary" size="lg" fullWidth onClick={handleGoogle} disabled={submitting}>
          Continuar con Google
        </Button>
      </Card>

      <p className="text-center text-sm text-[var(--text-muted)] mt-6">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-[var(--text)] underline underline-offset-4 decoration-[var(--accent)] decoration-2">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
