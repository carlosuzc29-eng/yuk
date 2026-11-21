'use client';

import React, { useState } from 'react';
import { MUSCLE_LABELS, type MuscleId, type PriorityLevel, type PriorityMuscle, type Sex } from '@/types/user';
import { cn } from '@/lib/utils/cn';
import { Flame, RotateCcw, X } from 'lucide-react';

interface MuscleMapSVGProps {
  sex: Sex;
  selected: PriorityMuscle[];
  onChange: (next: PriorityMuscle[]) => void;
  maxSelection?: number;
}

interface MuscleZone {
  id: MuscleId;
  paths: string[];
}

function getFrontZones(sex: Sex): MuscleZone[] {
  const isF = sex === 'female';
  const shoulderOffset = isF ? 6 : 0;
  const waistInset = isF ? 5 : 0;
  const hipOutset = isF ? 5 : 0;

  return [
    {
      id: 'trapecio',
      paths: [
        `M 85 52 L ${72 + shoulderOffset} 62 L 88 64 L 94 52 Z`,
        `M 115 52 L ${128 - shoulderOffset} 62 L 112 64 L 106 52 Z`,
      ],
    },
    {
      id: 'deltoides_lateral',
      paths: [
        `M ${56 + shoulderOffset} 68 Q ${48 + shoulderOffset} 76 ${51 + shoulderOffset} 90 L ${60 + shoulderOffset} 86 Q ${60 + shoulderOffset} 74 ${64 + shoulderOffset} 65 Z`,
        `M ${144 - shoulderOffset} 68 Q ${152 - shoulderOffset} 76 ${149 - shoulderOffset} 90 L ${140 - shoulderOffset} 86 Q ${140 - shoulderOffset} 74 ${136 - shoulderOffset} 65 Z`,
      ],
    },
    {
      id: 'deltoides_anterior',
      paths: [
        `M ${64 + shoulderOffset} 64 Q ${72 + shoulderOffset} 64 ${74 + shoulderOffset} 74 L ${68 + shoulderOffset} 86 L ${58 + shoulderOffset} 84 Q ${58 + shoulderOffset} 72 ${64 + shoulderOffset} 64 Z`,
        `M ${136 - shoulderOffset} 64 Q ${128 - shoulderOffset} 64 ${126 - shoulderOffset} 74 L ${132 - shoulderOffset} 86 L ${142 - shoulderOffset} 84 Q ${142 - shoulderOffset} 72 ${136 - shoulderOffset} 64 Z`,
      ],
    },
    {
      id: 'pectorales',
      paths: [
        `M 99 66 L ${73 + shoulderOffset} 68 Q ${70 + shoulderOffset} 88 ${76 + waistInset} 96 Q 89 101 99 95 Z`,
        `M 101 66 L ${127 - shoulderOffset} 68 Q ${130 - shoulderOffset} 88 ${124 - waistInset} 96 Q 111 101 101 95 Z`,
      ],
    },
    {
      id: 'biceps',
      paths: [
        `M ${55 + shoulderOffset} 91 L ${66 + shoulderOffset} 91 Q ${69 + shoulderOffset} 110 ${64 + shoulderOffset} 128 L ${53 + shoulderOffset} 126 Q ${50 + shoulderOffset} 108 ${55 + shoulderOffset} 91 Z`,
        `M ${145 - shoulderOffset} 91 L ${134 - shoulderOffset} 91 Q ${131 - shoulderOffset} 110 ${136 - shoulderOffset} 128 L ${147 - shoulderOffset} 126 Q ${150 - shoulderOffset} 108 ${145 - shoulderOffset} 91 Z`,
      ],
    },
    {
      id: 'antebrazos',
      paths: [
        `M ${52 + shoulderOffset} 131 L ${64 + shoulderOffset} 132 L ${58 + shoulderOffset} 172 L ${48 + shoulderOffset} 170 Z`,
        `M ${148 - shoulderOffset} 131 L ${136 - shoulderOffset} 132 L ${142 - shoulderOffset} 172 L ${152 - shoulderOffset} 170 Z`,
      ],
    },
    {
      id: 'abdomen',
      paths: [
        `M 88 99 L 112 99 L ${110 - waistInset / 2} 152 L ${90 + waistInset / 2} 152 Z`,
      ],
    },
    {
      id: 'oblicuos',
      paths: [
        `M ${75 + waistInset} 99 L 86 100 L ${88 + waistInset / 2} 150 L ${74 + waistInset - hipOutset / 2} 145 Q ${72 + waistInset} 122 ${75 + waistInset} 99 Z`,
        `M ${125 - waistInset} 99 L 114 100 L ${112 - waistInset / 2} 150 L ${126 - waistInset + hipOutset / 2} 145 Q ${128 - waistInset} 122 ${125 - waistInset} 99 Z`,
      ],
    },
    {
      id: 'aductores',
      paths: [
        `M 98 164 L 88 172 L 91 224 L 98 220 Z`,
        `M 102 164 L 112 172 L 109 224 L 102 220 Z`,
      ],
    },
    {
      id: 'cuadriceps',
      paths: [
        `M ${72 - hipOutset} 162 L 88 166 L 90 236 L ${74 - hipOutset / 3} 236 Q ${65 - hipOutset} 200 ${72 - hipOutset} 162 Z`,
        `M ${128 + hipOutset} 162 L 112 166 L 110 236 L ${126 + hipOutset / 3} 236 Q ${135 + hipOutset} 200 ${128 + hipOutset} 162 Z`,
      ],
    },
    {
      id: 'pantorrillas',
      paths: [
        `M 75 256 L 89 256 Q 92 284 86 318 L 76 318 Q 70 284 75 256 Z`,
        `M 125 256 L 111 256 Q 108 284 114 318 L 124 318 Q 130 284 125 256 Z`,
      ],
    },
  ];
}

function getBackZones(sex: Sex): MuscleZone[] {
  const isF = sex === 'female';
  const shoulderOffset = isF ? 6 : 0;
  const waistInset = isF ? 5 : 0;
  const hipOutset = isF ? 6 : 0;

  return [
    {
      id: 'trapecio',
      paths: [
        `M 92 50 L 108 50 L ${128 - shoulderOffset} 64 L 100 84 L ${72 + shoulderOffset} 64 Z`,
      ],
    },
    {
      id: 'deltoides_posterior',
      paths: [
        `M ${68 + shoulderOffset} 64 L ${56 + shoulderOffset} 70 L ${58 + shoulderOffset} 86 L ${72 + shoulderOffset} 84 Z`,
        `M ${132 - shoulderOffset} 64 L ${144 - shoulderOffset} 70 L ${142 - shoulderOffset} 86 L ${128 - shoulderOffset} 84 Z`,
      ],
    },
    {
      id: 'deltoides_lateral',
      paths: [
        `M ${54 + shoulderOffset} 70 Q ${47 + shoulderOffset} 78 ${50 + shoulderOffset} 90 L ${57 + shoulderOffset} 87 Z`,
        `M ${146 - shoulderOffset} 70 Q ${153 - shoulderOffset} 78 ${150 - shoulderOffset} 90 L ${143 - shoulderOffset} 87 Z`,
      ],
    },
    {
      id: 'espalda_media',
      paths: [
        `M 85 78 L 115 78 L 112 108 L 88 108 Z`,
      ],
    },
    {
      id: 'dorsales',
      paths: [
        `M ${71 + shoulderOffset} 85 L 85 84 L 87 122 L ${76 + waistInset} 126 Q ${68 + shoulderOffset} 106 ${71 + shoulderOffset} 85 Z`,
        `M ${129 - shoulderOffset} 85 L 115 84 L 113 122 L ${124 - waistInset} 126 Q ${132 - shoulderOffset} 106 ${129 - shoulderOffset} 85 Z`,
      ],
    },
    {
      id: 'lumbares',
      paths: [
        `M ${84 + waistInset / 2} 113 L ${116 - waistInset / 2} 113 L ${114 - waistInset / 2} 146 L ${86 + waistInset / 2} 146 Z`,
      ],
    },
    {
      id: 'triceps',
      paths: [
        `M ${53 + shoulderOffset} 92 L ${65 + shoulderOffset} 92 L ${63 + shoulderOffset} 128 L ${52 + shoulderOffset} 127 Z`,
        `M ${147 - shoulderOffset} 92 L ${135 - shoulderOffset} 92 L ${137 - shoulderOffset} 128 L ${148 - shoulderOffset} 127 Z`,
      ],
    },
    {
      id: 'antebrazos',
      paths: [
        `M ${51 + shoulderOffset} 131 L ${63 + shoulderOffset} 131 L ${57 + shoulderOffset} 172 L ${47 + shoulderOffset} 170 Z`,
        `M ${149 - shoulderOffset} 131 L ${137 - shoulderOffset} 131 L ${143 - shoulderOffset} 172 L ${153 - shoulderOffset} 170 Z`,
      ],
    },
    {
      id: 'gluteo_medio',
      paths: [
        `M ${72 - hipOutset} 148 Q ${78 - hipOutset / 2} 142 86 148 L 82 162 L ${69 - hipOutset} 160 Z`,
        `M ${128 + hipOutset} 148 Q ${122 + hipOutset / 2} 142 114 148 L 118 162 L ${131 + hipOutset} 160 Z`,
      ],
    },
    {
      id: 'gluteo_mayor',
      paths: [
        `M ${72 - hipOutset} 162 L 99 156 L 99 188 Q ${82 - hipOutset / 2} 194 ${71 - hipOutset} 182 Z`,
        `M ${128 + hipOutset} 162 L 101 156 L 101 188 Q ${118 + hipOutset / 2} 194 ${129 + hipOutset} 182 Z`,
      ],
    },
    {
      id: 'isquiotibiales',
      paths: [
        `M ${73 - hipOutset / 2} 192 L 96 192 L 92 242 L 74 242 Z`,
        `M ${127 + hipOutset / 2} 192 L 104 192 L 108 242 L 126 242 Z`,
      ],
    },
    {
      id: 'pantorrillas',
      paths: [
        `M 74 252 L 91 252 Q 94 282 86 318 L 76 318 Q 69 282 74 252 Z`,
        `M 126 252 L 109 252 Q 106 282 114 318 L 124 318 Q 131 282 126 252 Z`,
      ],
    },
  ];
}

export function MuscleMapSVG({
  sex,
  selected,
  onChange,
  maxSelection = 4,
}: MuscleMapSVGProps) {
  const [view, setView] = useState<'front' | 'back'>('front');
  const [hovered, setHovered] = useState<MuscleId | null>(null);

  const selectedMap = new Map<MuscleId, PriorityLevel>(
    selected.map((s) => [s.muscle, s.level])
  );

  const handleToggleMuscle = (muscle: MuscleId) => {
    const current = selectedMap.get(muscle);
    if (!current) {
      if (selected.length >= maxSelection) return;
      onChange([...selected, { muscle, level: 1 }]);
    } else if (current === 1) {
      onChange(selected.map((s) => (s.muscle === muscle ? { ...s, level: 2 } : s)));
    } else {
      onChange(selected.filter((s) => s.muscle !== muscle));
    }
  };

  const setMuscleLevel = (muscle: MuscleId, level: PriorityLevel) => {
    onChange(selected.map((s) => (s.muscle === muscle ? { ...s, level } : s)));
  };

  const removeMuscle = (muscle: MuscleId) => {
    onChange(selected.filter((s) => s.muscle !== muscle));
  };

  const zones = view === 'front' ? getFrontZones(sex) : getBackZones(sex);
  const isF = sex === 'female';
  const shoulderOffset = isF ? 6 : 0;
  const waistInset = isF ? 5 : 0;
  const hipOutset = isF ? 6 : 0;

  return (
    <div className="space-y-4">
      {/* Selector de vista Frontal / Posterior + contador */}
      <div className="flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Vista del cuerpo"
          className="inline-flex rounded-[24px] bg-[var(--surface-elevated)] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'front'}
            onClick={() => setView('front')}
            data-active={view === 'front'}
            className="segment px-4 py-2 text-xs min-h-[38px]"
          >
            Frontal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'back'}
            onClick={() => setView('back')}
            data-active={view === 'back'}
            className="segment px-4 py-2 text-xs min-h-[38px]"
          >
            Posterior
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-3 py-1.5 rounded-[24px] bg-[var(--surface-elevated)] text-[var(--text-secondary)] tabular-nums">
            {selected.length}/{maxSelection} músculos
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              aria-label="Limpiar selección muscular"
              className="p-2 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-elevated)] cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={1.6} />
            </button>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] bg-[var(--surface-elevated)] px-3.5 py-2.5 rounded-[5px]">
        <span>Toca 1 vez: Prioridad 1 (+30%) · 2 veces: Prioridad 2 (+50%)</span>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--amp-glow)]" /> P1
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" /> P2
          </span>
        </div>
      </div>

      {/* Mapa SVG interactivo */}
      <div className="relative flex flex-col items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="h-5 mb-2 text-xs font-medium text-[var(--text-secondary)]">
          {hovered ? MUSCLE_LABELS[hovered] : `Silueta ${isF ? 'femenina' : 'masculina'} · Vista ${view === 'front' ? 'frontal' : 'posterior'}`}
        </div>

        <svg
          viewBox="0 0 200 355"
          className="w-full max-w-[260px] h-auto select-none"
          role="img"
          aria-label={`Mapa muscular interactivo, vista ${view === 'front' ? 'frontal' : 'posterior'}`}
        >
          {/* Silueta base anatómica */}
          <g fill="var(--surface-elevated)" stroke="var(--border)" strokeWidth="1.4">
            {/* Cabeza y cuello */}
            <ellipse cx="100" cy="24" rx={isF ? 13 : 14.5} ry="17" />
            <rect x="93" y="40" width="14" height="14" rx="4" />
            {/* Torso base */}
            <path
              d={`M ${64 + shoulderOffset} 58
                  Q 100 50 ${136 - shoulderOffset} 58
                  L ${146 - shoulderOffset} 76
                  L ${134 - shoulderOffset} 95
                  L ${126 - waistInset} 138
                  L ${131 + hipOutset} 166
                  L 124 244
                  L 126 322
                  L 132 338
                  L 111 338
                  L 111 322
                  L 106 244
                  L 102 184
                  L 98 184
                  L 94 244
                  L 89 322
                  L 89 338
                  L 68 338
                  L 74 322
                  L 76 244
                  L ${69 - hipOutset} 166
                  L ${74 + waistInset} 138
                  L ${66 + shoulderOffset} 95
                  L ${54 + shoulderOffset} 76 Z`}
            />
            {/* Brazos base */}
            <path
              d={`M ${56 + shoulderOffset} 72 L ${45 + shoulderOffset} 174 L ${59 + shoulderOffset} 176 L ${67 + shoulderOffset} 96 Z`}
            />
            <path
              d={`M ${144 - shoulderOffset} 72 L ${155 - shoulderOffset} 174 L ${141 - shoulderOffset} 176 L ${133 - shoulderOffset} 96 Z`}
            />
          </g>

          {/* Zonas musculares tocables */}
          {zones.map((zone) => {
            const level = selectedMap.get(zone.id);
            const isHovered = hovered === zone.id;
            const atLimit = !level && selected.length >= maxSelection;

            let fill = 'rgba(122, 123, 123, 0.16)';
            let stroke = 'rgba(122, 123, 123, 0.40)';
            if (level === 1) {
              fill = 'rgba(255, 160, 105, 0.80)';
              stroke = '#ffa069';
            } else if (level === 2) {
              fill = 'rgba(255, 97, 5, 0.92)';
              stroke = '#ff6105';
            } else if (isHovered && !atLimit) {
              fill = 'rgba(255, 97, 5, 0.22)';
              stroke = '#ff6105';
            }

            return (
              <g
                key={`${view}-${zone.id}`}
                role="button"
                tabIndex={0}
                aria-label={`${MUSCLE_LABELS[zone.id]}${level ? `, prioridad ${level}` : ', sin seleccionar'}`}
                aria-pressed={Boolean(level)}
                onClick={() => handleToggleMuscle(zone.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggleMuscle(zone.id);
                  }
                }}
                onMouseEnter={() => setHovered(zone.id)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  'transition-all duration-150 focus:outline-none',
                  atLimit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                )}
              >
                {zone.paths.map((d, idx) => (
                  <path
                    key={idx}
                    d={d}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={level ? 1.6 : 1}
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Músculos seleccionados con control rápido de prioridad 1 / 2 */}
      {selected.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow">
            Tus músculos prioritarios
          </p>
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {selected.map((item) => (
              <div
                key={item.muscle}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Flame
                    className={cn(
                      'h-4 w-4 shrink-0',
                      item.level === 2 ? 'text-[var(--accent)]' : 'text-[var(--amp-glow)]'
                    )}
                  />
                  <span className="text-sm font-medium truncate">
                    {MUSCLE_LABELS[item.muscle]}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMuscleLevel(item.muscle, 1)}
                    className={cn(
                      'px-3 py-1 rounded-[8px] text-xs font-medium min-h-[34px] cursor-pointer transition-colors',
                      item.level === 1
                        ? 'bg-[var(--amp-glow)] text-[var(--ink)]'
                        : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]'
                    )}
                  >
                    P1
                  </button>
                  <button
                    type="button"
                    onClick={() => setMuscleLevel(item.muscle, 2)}
                    className={cn(
                      'px-3 py-1 rounded-[8px] text-xs font-medium min-h-[34px] cursor-pointer transition-colors',
                      item.level === 2
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]'
                    )}
                  >
                    P2
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMuscle(item.muscle)}
                    aria-label={`Quitar ${MUSCLE_LABELS[item.muscle]}`}
                    className="p-1.5 rounded-[8px] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selector rápido accesible de los 19 músculos */}
      <details className="rounded-[5px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <summary className="text-xs font-medium text-[var(--text-secondary)] cursor-pointer select-none">
          Ver lista completa de los 19 grupos musculares
        </summary>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(MUSCLE_LABELS) as MuscleId[]).map((mId) => {
            const level = selectedMap.get(mId);
            const disabled = !level && selected.length >= maxSelection;
            return (
              <button
                key={mId}
                type="button"
                disabled={disabled}
                onClick={() => handleToggleMuscle(mId)}
                className={cn(
                  'px-3 py-1.5 rounded-[24px] text-xs font-medium border transition-colors min-h-[36px] cursor-pointer disabled:opacity-40',
                  level === 2
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : level === 1
                      ? 'bg-[var(--accent-soft)] text-[var(--text)] border-[var(--amp-glow)]'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--ash)]'
                )}
              >
                {MUSCLE_LABELS[mId]}
                {level ? ` · P${level}` : ''}
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}
