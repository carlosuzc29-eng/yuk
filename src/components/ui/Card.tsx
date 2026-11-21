import React from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Superficie alternativa (Linen / Charcoal en oscuro). */
  elevated?: boolean;
  /** Tarjeta destacada en Peach Wash — usar una sola por sección. */
  featured?: boolean;
}

export function Card({ elevated = false, featured = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[5px] border p-4',
        featured
          ? 'bg-[var(--accent-soft)] border-transparent'
          : elevated
            ? 'bg-[var(--surface-elevated)] border-[var(--border)]'
            : 'bg-[var(--surface)] border-[var(--border)]',
        className
      )}
      {...props}
    />
  );
}
