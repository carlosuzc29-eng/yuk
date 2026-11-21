'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';

export default function RutinaPlaceholderPage() {
  return (
    <AppShell title="Rutina" subtitle="Bloque de entrenamiento">
      <Card className="p-6">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          El generador determinista de rutinas y el editor de días se habilitarán en la Fase 4.
        </p>
      </Card>
    </AppShell>
  );
}
