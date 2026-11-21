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
        'flex items-start gap-3 rounded-[5px] border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-muted)]',
        compact ? 'p-3.5 text-xs' : 'p-4 text-xs sm:text-sm',
        className
      )}
    >
      <ShieldAlert
        className="h-4 w-4 shrink-0 text-[var(--text-secondary)] mt-0.5"
        strokeWidth={1.6}
        aria-hidden="true"
      />
      <p className="leading-relaxed">
        <span className="font-medium text-[var(--text)]">Aviso importante.</span> YUK no sustituye a
        un médico, fisioterapeuta ni a un entrenador presencial. Si tienes lesiones, dolor agudo o
        condiciones médicas previas, consulta con un profesional de la salud antes de entrenar.
      </p>
    </aside>
  );
}
