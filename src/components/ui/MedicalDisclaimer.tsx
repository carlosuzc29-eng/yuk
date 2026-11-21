import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface MedicalDisclaimerProps {
  compact?: boolean;
  className?: string;
}

export function MedicalDisclaimer({ compact = false, className }: MedicalDisclaimerProps) {
  return (
    <aside
      role="note"
      aria-label="Aviso de salud y seguridad"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-muted)]',
        compact ? 'p-3 text-xs' : 'p-4 text-xs sm:text-sm',
        className
      )}
    >
      <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--warning)] mt-0.5" aria-hidden="true" />
      <p className="leading-relaxed">
        <strong className="text-[var(--text)]">Aviso importante:</strong> YUK no sustituye a un
        médico, fisioterapeuta ni a un entrenador presencial. Si tienes lesiones, dolor agudo o
        condiciones médicas previas, consulta con un profesional de la salud antes de entrenar.
      </p>
    </aside>
  );
}
