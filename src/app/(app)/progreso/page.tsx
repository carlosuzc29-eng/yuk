'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';

export default function ProgresoPlaceholderPage() {
  return (
    <AppShell title="Progreso" subtitle="Métricas privadas">
      <Card className="p-6">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          Tus gráficas de 1RM, volumen, peso corporal y fotos privadas estarán disponibles en la
          Fase 6.
        </p>
      </Card>
    </AppShell>
  );
}
