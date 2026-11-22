'use client';

import React, { useEffect, useState } from 'react';
import { CharacterViewer, type MorphValues } from '@/components/model3d/CharacterViewer';
import { LOOKS } from '@/components/model3d/looks';
import { cn } from '@/lib/utils/cn';

type LookId = keyof typeof LOOKS;

const NOTES: Record<LookId, string> = {
  femenino:
    'Fondo casi negro, luz principal arriba y lateral, relleno suave y cámaras de poca distorsión. Las animaciones de Mixamo (pose T) se adaptan a la pose A del modelo.',
  masculino:
    'Fondo gris carbón y luz grande superior, ligeramente frontal, para describir rostro, pectorales, abdomen y hombros. La vista «Referencia» encuadra rostro y torso como la imagen; piernas y espalda son reconstrucción anatómica.',
};

export function ModelComparison() {
  const [lookId, setLookId] = useState<LookId>('femenino');
  const look = LOOKS[lookId];
  const [override, setOverride] = useState(false);
  const [roughness, setRoughness] = useState(look.material.roughness);
  const [color, setColor] = useState(look.material.color);
  const [morphs, setMorphs] = useState<MorphValues>({ peso: 0, musculo: 0 });

  // Cada personaje arranca con su propio material de comparación.
  useEffect(() => {
    setRoughness(look.material.roughness);
    setColor(look.material.color);
  }, [look]);

  const bg = `#${look.background.toString(16).padStart(6, '0')}`;
  const [rMin, rMax] = look.material.roughnessRange;

  return (
    <main className="min-h-dvh text-white transition-colors" style={{ backgroundColor: bg }}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10 space-y-5">
        <header className="space-y-3">
          <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-white/45">Validación técnica</p>
          <h1 className="font-display text-[28px] sm:text-[36px]">Personaje 3D</h1>
          <div className="flex rounded-[24px] border border-white/15 overflow-hidden w-fit" role="tablist" aria-label="Personaje">
            {(Object.keys(LOOKS) as LookId[]).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={lookId === id}
                onClick={() => setLookId(id)}
                className={cn(
                  'h-10 px-4 text-xs font-medium cursor-pointer',
                  lookId === id ? 'bg-white text-black' : 'text-white/75 hover:bg-white/10'
                )}
              >
                {LOOKS[id].label}
              </button>
            ))}
          </div>
          <p className="text-sm text-white/55 max-w-2xl">{NOTES[lookId]}</p>
        </header>

        <CharacterViewer
          key={look.id}
          look={look}
          initialClip="reposo"
          comparisonMaterial={override ? { color, roughness } : null}
          morphs={morphs}
          className="border border-white/10"
        />

        <section className="rounded-[8px] border border-white/10 p-4 space-y-3" aria-labelledby="morph-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="morph-title" className="text-sm font-medium">
              Complexión
            </h2>
            <button
              type="button"
              onClick={() => setMorphs({ peso: 0, musculo: 0 })}
              className="text-xs text-white/55 underline underline-offset-4 cursor-pointer"
            >
              Restablecer
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                { key: 'peso', label: 'Peso', low: 'Menos', high: 'Más' },
                { key: 'musculo', label: 'Músculo', low: 'Menos', high: 'Más' },
              ] as const
            ).map((m) => (
              <label key={m.key} className="space-y-1.5 text-xs text-white/60">
                <span className="flex justify-between">
                  {m.label}
                  <span className="tabular-nums text-white/85">
                    {morphs[m.key] > 0 ? '+' : ''}
                    {morphs[m.key].toFixed(2)}
                  </span>
                </span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={morphs[m.key]}
                  onChange={(e) => setMorphs((prev) => ({ ...prev, [m.key]: Number(e.target.value) }))}
                  className="w-full"
                  aria-label={`${m.label}: de -1 (${m.low.toLowerCase()}) a +1 (${m.high.toLowerCase()})`}
                />
                <span className="flex justify-between text-[11px] text-white/40">
                  <span>{m.low}</span>
                  <span>Neutro</span>
                  <span>{m.high}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-white/45">
            Mezcla los morph targets del modelo: valores negativos activan <code>_menos</code> y positivos <code>_mas</code>. No
            se modifica la geometría base.
          </p>
        </section>

        <section className="rounded-[8px] border border-white/10 p-4 space-y-3" aria-labelledby="mat-title">
          <h2 id="mat-title" className="text-sm font-medium">
            Material de comparación
          </h2>
          <label className="flex items-center gap-2 text-sm text-white/75 cursor-pointer">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Sustituir el material del GLB (no metálico; conserva su mapa normal)
          </label>
          <div className={cn('grid gap-3 sm:grid-cols-2', !override && 'opacity-40 pointer-events-none')}>
            <label className="space-y-1 text-xs text-white/60">
              <span className="flex justify-between">
                Roughness <span className="tabular-nums text-white/85">{roughness.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={Math.max(0, rMin - 0.05)}
                max={Math.min(1, rMax + 0.05)}
                step={0.01}
                value={roughness}
                onChange={(e) => setRoughness(Number(e.target.value))}
                className="w-full"
              />
            </label>
            <label className="space-y-1 text-xs text-white/60">
              <span className="flex justify-between">
                Color base <span className="tabular-nums text-white/85">{color}</span>
              </span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-full bg-transparent" />
            </label>
          </div>
          <p className="text-xs text-white/45">
            Punto de partida: roughness {rMin.toFixed(2)}–{rMax.toFixed(2)}. Ajusta comparando con la referencia, no por el
            número.
          </p>
        </section>
      </div>
    </main>
  );
}
