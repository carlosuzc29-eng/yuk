'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';

export default function ComunidadPlaceholderPage() {
  return (
    <AppShell title="Grupo" subtitle="Constancia y retos">
      <Card className="p-6">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          El muro compartido, ranking de constancia y retos grupales se habilitarán en la Fase 7.
        </p>
      </Card>
    </AppShell>
  );
}
