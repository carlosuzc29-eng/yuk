import React from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Card({ elevated = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border)] p-4',
        elevated ? 'bg-[var(--surface-elevated)]' : 'bg-[var(--surface)]',
        className
      )}
      {...props}
    />
  );
}
