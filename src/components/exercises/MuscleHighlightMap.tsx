'use client';

import React from 'react';
import type { MuscleId, Sex } from '@/types/user';
import { MUSCLE_LABELS } from '@/types/user';
import {
  getBackZones,
  getBodySilhouette,
  getFrontZones,
} from '@/components/onboarding/MuscleMapSVG';

interface Props {
  primary: MuscleId[];
  secondary: MuscleId[];
  sex?: Sex;
  compact?: boolean;
}

/** Mapa anatómico de solo lectura: frontal + posterior con músculos principales y secundarios. */
export function MuscleHighlightMap({ primary, secondary, sex = 'male', compact = false }: Props) {
  const body = getBodySilhouette(sex);
  const views: { id: 'front' | 'back'; label: string; zones: ReturnType<typeof getFrontZones> }[] = [
    { id: 'front', label: 'Frontal', zones: getFrontZones(sex) },
    { id: 'back', label: 'Posterior', zones: getBackZones(sex) },
  ];

  const fillFor = (m: MuscleId) =>
    primary.includes(m) ? 'var(--accent)' : secondary.includes(m) ? 'var(--amp-glow)' : 'var(--fig)';
  const opacityFor = (m: MuscleId) => (primary.includes(m) ? 0.95 : secondary.includes(m) ? 0.8 : 0.55);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {views.map((v) => (
          <figure key={v.id} className="flex flex-col items-center">
            <svg
              viewBox="40 10 200 525"
              className={compact ? 'w-full max-w-[110px] h-auto' : 'w-full max-w-[150px] h-auto'}
              role="img"
              aria-label={`Vista ${v.label.toLowerCase()}: ${[...primary, ...secondary]
                .map((m) => MUSCLE_LABELS[m])
                .join(', ')}`}
            >
              <g fill="var(--surface-elevated)" stroke="var(--fig-line)" strokeWidth="1.4" strokeLinejoin="round">
                <path d={body.leftHalf} stroke="none" />
                <path d={body.rightHalf} stroke="none" />
                <path d={body.leftHalf.replace(/\s+Z$/, '')} fill="none" />
                <path d={body.rightHalf.replace(/\s+Z$/, '')} fill="none" />
                <path d={body.head} />
              </g>
              {v.zones.map((z) => (
                <g key={z.id} fill={fillFor(z.id)} opacity={opacityFor(z.id)}>
                  {z.paths.map((d, i) => (
                    <path key={i} d={d} stroke="var(--surface)" strokeWidth="0.8" />
                  ))}
                </g>
              ))}
            </svg>
            {!compact && (
              <figcaption className="mt-1 text-[11px] text-[var(--text-muted)]">{v.label}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}

export function MuscleLegend({ primary, secondary }: { primary: MuscleId[]; secondary: MuscleId[] }) {
  const sec = secondary.filter((m) => !primary.includes(m));
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] shrink-0" />
        <p>
          <span className="text-[var(--text-muted)]">Principal: </span>
          <span className="font-medium">{primary.map((m) => MUSCLE_LABELS[m]).join(', ')}</span>
        </p>
      </div>
      {sec.length > 0 && (
        <div className="flex items-start gap-2">
          <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--amp-glow)] shrink-0" />
          <p>
            <span className="text-[var(--text-muted)]">Secundario: </span>
            <span className="text-[var(--text-secondary)]">{sec.map((m) => MUSCLE_LABELS[m]).join(', ')}</span>
          </p>
        </div>
      )}
    </div>
  );
}
