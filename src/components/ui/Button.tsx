'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  fullWidth?: boolean;
}

/**
 * Escalera de radios del sistema:
 * - primary: pill 50px con brillo naranja (única sombra del sistema)
 * - secondary / danger: 24px, borde hairline, sin sombra
 * - ghost: 24px, sin borde
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 touch-target select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.98]',
        size === 'md' && 'px-5 py-2.5 text-sm min-h-[44px]',
        size === 'lg' && 'px-8 py-4 text-base min-h-[54px]',
        fullWidth && 'w-full',
        variant === 'primary' &&
          'rounded-[50px] bg-[var(--accent)] text-white shadow-[var(--shadow-cta)] hover:bg-[var(--accent-hover)]',
        variant === 'secondary' &&
          'rounded-[24px] bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]',
        variant === 'ghost' &&
          'rounded-[24px] bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-elevated)]',
        variant === 'danger' &&
          'rounded-[24px] bg-[var(--surface)] text-[var(--danger)] border border-[var(--border)] hover:border-[var(--danger)]',
        className
      )}
      {...props}
    />
  );
}
