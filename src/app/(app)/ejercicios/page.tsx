'use client';

import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';

export default function EjerciciosPlaceholderPage() {
  return (
    <AppShell title="Ejercicios" subtitle="Catálogo técnico">
      <Card className="p-5">
        <p className="text-sm text-[var(--text-muted)]">
          La base de datos de 80+ ejercicios con guías de postura y animaciones se habilitará en las
          Fases 2 y 3.
        </p>
      </Card>
    </AppShell>
  );
}
