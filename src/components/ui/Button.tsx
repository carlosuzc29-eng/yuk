'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  fullWidth?: boolean;
}

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
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 touch-target select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
        size === 'md' && 'px-4 py-2.5 text-sm min-h-[44px]',
        size === 'lg' && 'px-5 py-3.5 text-base min-h-[52px]',
        fullWidth && 'w-full',
        variant === 'primary' &&
          'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-sm',
        variant === 'secondary' &&
          'bg-[var(--surface-elevated)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--accent)]',
        variant === 'ghost' &&
          'bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-elevated)]',
        variant === 'danger' &&
          'bg-red-950/50 text-red-400 border border-red-800/60 hover:bg-red-900/50',
        className
      )}
      {...props}
    />
  );
}
