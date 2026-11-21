'use client';

import React, { useId, useState } from 'react';
import {
  MUSCLE_LABELS,
  type MuscleId,
  type PriorityLevel,
  type PriorityMuscle,
  type Sex,
} from '@/types/user';
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

const CX = 140;

/** Refleja horizontalmente un path SVG (comandos M, L, C, Q, Z) respecto a CX = 140 */
function mirrorPath(d: string): string {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g);
  if (!tokens) return d;
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (/[a-zA-Z]/.test(cmd)) {
      out.push(cmd);
      i += 1;
      const upper = cmd.toUpperCase();
      if (upper === 'Z') continue;
      const pairCount = upper === 'C' ? 3 : upper === 'Q' || upper === 'S' ? 2 : 1;
      while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
        for (let p = 0; p < pairCount; p++) {
          const x = parseFloat(tokens[i++]);
          const y = parseFloat(tokens[i++]);
          out.push(String(Number((2 * CX - x).toFixed(1))), String(y));
        }
      }
    } else {
      out.push(tokens[i++]);
    }
  }
  return out.join(' ');
}

function pair(leftPath: string): [string, string] {
  return [leftPath, mirrorPath(leftPath)];
}

/** Silueta anatómica realista con proporciones de 7.5 cabezas (viewBox 0 0 280 540) */
function getBodySilhouette(sex: Sex) {
  const f = sex === 'female';
  // Ajustes anatómicos diferenciados hombre vs mujer
  const shX = f ? 76 : 64; // ancho de hombros (lado izquierdo)
  const armpitX = f ? 98 : 90;
  const ribX = f ? 102 : 95;
  const waistX = f ? 105 : 99;
  const hipX = f ? 86 : 92;
  const thighOutX = f ? 83 : 87;
  const armDelta = f ? 10 : 0;

  // Cabeza con cráneo, pómulos y mandíbula esculpida
  const head = f
    ? 'M 140 16 C 125 16 118 28 119 42 C 120 53 126 63 134 67 C 137 68.5 143 68.5 146 67 C 154 63 160 53 161 42 C 162 28 155 16 140 16 Z'
    : 'M 140 15 C 123 15 116 27 117 42 C 118 53 124 62 132 67 C 136 69 144 69 148 67 C 156 62 162 53 163 42 C 164 27 157 15 140 15 Z';

  // Orejas sutiles
  const ears = pair(
    f
      ? 'M 119 38 C 115.5 38 115.5 47 119.5 49'
      : 'M 117 37 C 113 37 113 48 117.5 50'
  );

  // Cuerpo completo continuo (cuello -> hombros -> brazos/manos -> torso -> piernas -> pies)
  const leftContour = `
    M 140 66
    L ${f ? 129 : 126} 66
    C ${f ? 128 : 124} 75 ${f ? 124 : 119} 83 ${f ? 111 : 104} 88
    C ${shX + 14} 91 ${shX + 2} 96 ${shX - 2} 109
    C ${shX - 6} 122 ${shX - 8} 138 ${shX - 11} 156
    C ${shX - 14} 173 ${shX - 18} 190 ${shX - 20} 204
    C ${shX - 24} 222 ${shX - 28} 242 ${shX - 31} 262
    C ${shX - 35} 271 ${shX - 40} 281 ${shX - 39} 292
    C ${shX - 38} 298 ${shX - 33} 302 ${shX - 29} 298
    C ${shX - 27} 293 ${shX - 26} 285 ${shX - 24} 280
    C ${shX - 22} 285 ${shX - 21} 290 ${shX - 18} 288
    C ${shX - 16} 282 ${shX - 18} 272 ${shX - 20} 263
    C ${shX - 14} 245 ${shX - 8} 225 ${shX - 4} 206
    C ${shX + 1} 188 ${shX + 7} 170 ${armpitX - 2} 148
    C ${armpitX - 2} 162 ${ribX} 180 ${waistX} 204
    C ${waistX - 4} 224 ${hipX} 244 ${hipX - 2} 268
    C ${thighOutX - 4} 298 ${thighOutX} 336 ${f ? 93 : 92} 372
    C ${f ? 96 : 95} 388 ${f ? 97 : 96} 400 ${f ? 94 : 93} 414
    C ${f ? 89 : 88} 434 ${f ? 90 : 89} 456 ${f ? 97 : 96} 478
    C ${f ? 100 : 99} 490 ${f ? 101 : 100} 500 ${f ? 97 : 96} 508
    C ${f ? 90 : 88} 516 ${f ? 84 : 82} 522 ${f ? 88 : 86} 526
    C ${f ? 95 : 94} 529 ${f ? 112 : 114} 528 ${f ? 118 : 119} 522
    C ${f ? 120 : 121} 516 ${f ? 117 : 118} 506 ${f ? 116 : 117} 494
    C ${f ? 120 : 122} 470 ${f ? 126 : 128} 444 ${f ? 125 : 126} 416
    C ${f ? 124 : 125} 402 ${f ? 125 : 126} 388 ${f ? 128 : 129} 370
    C ${f ? 132 : 133} 338 ${f ? 135 : 136} 302 138 274
    L 140 274
  `;

  // Construimos la silueta cerrada uniendo izquierda y derecha simétricamente
  const rightContour = mirrorPath(leftContour)
    .replace(/^M\s+140\s+66/, '')
    .trim();

  // Contorno izquierdo + derecho como dos mitades limpias sin línea central visible
  return {
    head,
    ears,
    leftHalf: `${leftContour} Z`,
    rightHalf: `${mirrorPath(leftContour)} Z`,
    armDelta,
    rightContour,
  };
}

function getFrontZones(sex: Sex): MuscleZone[] {
  const f = sex === 'female';
  const s = f ? 10 : 0; // desplazamiento de hombro hacia adentro en mujer
  const w = f ? 5 : 0; // cintura más estrecha en mujer
  const h = f ? 5 : 0; // cadera más curva en mujer

  return [
    {
      id: 'trapecio',
      paths: pair(
        `M 127 78 C 122 84 111 89 ${95 + s} 94 C ${102 + s} 98 116 97 129 93 C 131 87 130 82 127 78 Z`
      ),
    },
    {
      id: 'deltoides_lateral',
      paths: pair(
        `M ${76 + s} 96 C ${65 + s} 100 ${59 + s} 112 ${61 + s} 127 C ${63 + s} 134 ${67 + s} 138 ${71 + s} 136 C ${70 + s} 122 ${73 + s} 109 ${80 + s} 99 Z`
      ),
    },
    {
      id: 'deltoides_anterior',
      paths: pair(
        `M ${82 + s} 96 C ${91 + s} 97 ${97 + s} 104 ${95 + s} 118 C ${93 + s} 128 ${85 + s} 136 ${75 + s} 136 C ${72 + s} 124 ${74 + s} 109 ${82 + s} 96 Z`
      ),
    },
    {
      id: 'pectorales',
      paths: pair(
        f
          ? `M 137 104 C 125 103 108 105 ${98 + s} 114 C ${95 + s} 128 ${100 + s} 145 ${111 + w} 150 C 123 154 134 150 138 142 C 139 128 139 114 137 104 Z`
          : `M 138 102 C 124 101 104 103 94 112 C 90 128 94 146 108 153 C 122 157 134 153 138 144 C 139 129 139 114 138 102 Z`
      ),
    },
    {
      id: 'biceps',
      paths: pair(
        `M ${68 + s} 140 C ${76 + s} 139 ${84 + s} 143 ${85 + s} 155 C ${85 + s} 171 ${79 + s} 188 ${71 + s} 197 C ${64 + s} 196 ${59 + s} 190 ${59 + s} 177 C ${59 + s} 162 ${62 + s} 148 ${68 + s} 140 Z`
      ),
    },
    {
      id: 'antebrazos',
      paths: pair(
        `M ${58 + s} 202 C ${65 + s} 199 ${72 + s} 203 ${71 + s} 216 C ${68 + s} 233 ${60 + s} 251 ${53 + s} 262 C ${48 + s} 263 ${44 + s} 260 ${44 + s} 252 C ${46 + s} 235 ${50 + s} 214 ${58 + s} 202 Z`
      ),
    },
    {
      id: 'abdomen',
      paths: [
        // 6-pack esculpido en pares orgánicos + segmento inferior
        ...pair(`M 138 158 C 132 157 123 158 ${120 + w * 0.4} 163 C ${119 + w * 0.4} 171 ${121 + w * 0.4} 177 126 179 C 131 180 136 179 138 176 Z`),
        ...pair(`M 138 183 C 131 183 123 184 ${121 + w * 0.4} 190 C ${120 + w * 0.4} 198 ${122 + w * 0.4} 205 127 207 C 132 208 136 207 138 204 Z`),
        ...pair(`M 138 211 C 132 211 124 212 ${122 + w * 0.4} 219 C ${122 + w * 0.4} 228 125 237 130 245 C 134 250 137 251 138 249 Z`),
      ],
    },
    {
      id: 'oblicuos',
      paths: pair(
        `M ${98 + w} 156 C ${106 + w * 0.6} 158 ${114 + w * 0.4} 162 ${116 + w * 0.4} 173 C ${117 + w * 0.4} 192 ${118 + w * 0.3} 214 ${119 + w * 0.2} 236 C ${111 + w * 0.2} 233 ${103 - h * 0.4} 226 ${100 - h * 0.3} 214 C ${101 + w * 0.6} 194 ${97 + w} 174 ${98 + w} 156 Z`
      ),
    },
    {
      id: 'aductores',
      paths: pair(
        `M 136 274 C 128 274 121 280 119 294 C 118 314 121 338 127 356 C 131 352 134 334 136 308 C 137 292 137 281 136 274 Z`
      ),
    },
    {
      id: 'cuadriceps',
      paths: [
        // Vasto lateral + recto femoral + vasto medial (lágrima)
        ...pair(
          `M ${92 - h} 266 C ${103 - h * 0.3} 264 114 270 117 284 C 120 310 118 344 114 374 C 109 382 100 381 96 371 C ${89 - h * 0.6} 342 ${85 - h} 302 ${92 - h} 266 Z`
        ),
        ...pair(
          `M 118 334 C 124 338 127 354 124 372 C 121 381 115 382 113 375 C 114 360 116 346 118 334 Z`
        ),
      ],
    },
    {
      id: 'pantorrillas',
      paths: pair(
        `M 98 416 C 105 412 117 413 122 422 C 126 438 123 462 116 488 C 111 493 105 493 102 487 C 95 464 92 438 98 416 Z`
      ),
    },
  ];
}

function getBackZones(sex: Sex): MuscleZone[] {
  const f = sex === 'female';
  const s = f ? 10 : 0;
  const w = f ? 5 : 0;
  const h = f ? 7 : 0;

  return [
    {
      id: 'trapecio',
      paths: [
        `M 140 72 C 131 72 126 79 118 85 C 107 91 ${95 + s} 94 ${91 + s} 100 C ${99 + s} 108 114 116 126 128 C 132 135 137 142 140 146 C 143 142 148 135 154 128 C 166 116 ${181 - s} 108 ${189 - s} 100 C ${185 - s} 94 173 91 162 85 C 154 79 149 72 140 72 Z`,
      ],
    },
    {
      id: 'deltoides_lateral',
      paths: pair(
        `M ${75 + s} 96 C ${64 + s} 101 ${59 + s} 114 ${61 + s} 128 C ${64 + s} 135 ${68 + s} 137 ${72 + s} 134 C ${71 + s} 120 ${73 + s} 107 ${79 + s} 99 Z`
      ),
    },
    {
      id: 'deltoides_posterior',
      paths: pair(
        `M ${82 + s} 96 C ${91 + s} 97 ${98 + s} 105 ${96 + s} 119 C ${92 + s} 128 ${83 + s} 134 ${74 + s} 133 C ${72 + s} 121 ${74 + s} 108 ${82 + s} 96 Z`
      ),
    },
    {
      id: 'espalda_media',
      paths: pair(
        `M 137 122 C 127 118 112 117 104 125 C 102 138 106 154 115 162 C 124 166 133 163 137 156 Z`
      ),
    },
    {
      id: 'dorsales',
      paths: pair(
        `M ${96 + s} 129 C ${103 + s * 0.5} 132 108 145 113 163 C 117 177 122 192 126 202 C 117 204 ${106 + w} 198 ${102 + w} 186 C ${97 + w * 0.5} 168 ${92 + s * 0.7} 148 ${96 + s} 129 Z`
      ),
    },
    {
      id: 'lumbares',
      paths: pair(
        `M 138 172 C 131 171 123 176 121 188 C 119 204 120 222 124 234 C 130 237 136 236 138 232 Z`
      ),
    },
    {
      id: 'triceps',
      paths: pair(
        `M ${67 + s} 139 C ${76 + s} 138 ${85 + s} 144 ${85 + s} 159 C ${84 + s} 176 ${78 + s} 190 ${70 + s} 197 C ${63 + s} 195 ${58 + s} 187 ${59 + s} 173 C ${60 + s} 158 ${62 + s} 146 ${67 + s} 139 Z`
      ),
    },
    {
      id: 'antebrazos',
      paths: pair(
        `M ${58 + s} 202 C ${65 + s} 199 ${72 + s} 204 ${70 + s} 218 C ${67 + s} 234 ${59 + s} 252 ${52 + s} 262 C ${47 + s} 263 ${44 + s} 259 ${44 + s} 251 C ${46 + s} 234 ${51 + s} 213 ${58 + s} 202 Z`
      ),
    },
    {
      id: 'gluteo_medio',
      paths: pair(
        `M ${94 - h * 0.6} 236 C ${103 - h * 0.2} 229 116 230 123 239 C 118 248 106 254 ${91 - h} 256 C ${89 - h * 0.8} 248 ${91 - h * 0.7} 241 ${94 - h * 0.6} 236 Z`
      ),
    },
    {
      id: 'gluteo_mayor',
      paths: pair(
        `M ${91 - h} 257 C ${105 - h * 0.3} 248 124 244 137 251 C 139 266 138 286 134 298 C 122 308 ${101 - h * 0.5} 307 ${91 - h} 292 C ${87 - h} 280 ${88 - h} 267 ${91 - h} 257 Z`
      ),
    },
    {
      id: 'isquiotibiales',
      paths: pair(
        `M ${93 - h * 0.5} 302 C 106 308 123 307 132 302 C 134 328 131 360 124 388 C 116 393 104 392 98 384 C ${93 - h * 0.3} 358 ${90 - h * 0.4} 328 ${93 - h * 0.5} 302 Z`
      ),
    },
    {
      id: 'pantorrillas',
      paths: [
        // Cabeza medial y lateral de gastrocnemio
        ...pair(
          `M 96 416 C 102 411 109 412 111 422 C 112 440 110 462 107 482 C 102 478 96 462 94 442 C 93 430 94 421 96 416 Z`
        ),
        ...pair(
          `M 113 418 C 119 414 125 418 125 432 C 125 450 121 468 115 484 C 111 482 110 462 111 440 C 111 428 112 421 113 418 Z`
        ),
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
  const uid = useId().replace(/:/g, '');
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
  const body = getBodySilhouette(sex);
  const isF = sex === 'female';

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

      {/* Mapa SVG anatómico interactivo */}
      <div className="relative flex flex-col items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-4 py-5 overflow-hidden">
        <div className="h-5 mb-2 text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
          {hovered ? (
            <span className="text-[var(--accent)]">{MUSCLE_LABELS[hovered]}</span>
          ) : (
            `Silueta ${isF ? 'femenina' : 'masculina'} · Vista ${view === 'front' ? 'frontal' : 'posterior'}`
          )}
        </div>

        <svg
          viewBox="0 0 280 540"
          className="w-full max-w-[290px] h-auto select-none"
          role="img"
          aria-label={`Mapa muscular anatómico interactivo, silueta ${isF ? 'femenina' : 'masculina'}, vista ${view === 'front' ? 'frontal' : 'posterior'}`}
        >
          <defs>
            {/* Sombreado escultórico 3D para la figura base */}
            <linearGradient id={`${uid}-body`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.22" />
              <stop offset="28%" stopColor="#cbd5e1" stopOpacity="0.14" />
              <stop offset="50%" stopColor="#f1f5f9" stopOpacity="0.22" />
              <stop offset="72%" stopColor="#cbd5e1" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.22" />
            </linearGradient>

            {/* Gradiente de músculo en reposo */}
            <linearGradient id={`${uid}-idle`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0.18" />
            </linearGradient>

            {/* Hover */}
            <linearGradient id={`${uid}-hover`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff8a4c" stopOpacity="0.52" />
              <stop offset="100%" stopColor="#ff6105" stopOpacity="0.28" />
            </linearGradient>

            {/* Prioridad 1 (+30%) */}
            <linearGradient id={`${uid}-p1`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffc299" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#ffa069" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#e57a3c" stopOpacity="0.85" />
            </linearGradient>

            {/* Prioridad 2 (+50%) */}
            <linearGradient id={`${uid}-p2`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff8842" stopOpacity="0.98" />
              <stop offset="50%" stopColor="#ff6105" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#c43d00" stopOpacity="0.92" />
            </linearGradient>

            {/* Resplandor sutil para músculos seleccionados */}
            <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#ff6105" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* Sombra sutil en el suelo */}
          <ellipse cx="140" cy="530" rx="58" ry="6" fill="currentColor" opacity="0.08" />

          {/* Silueta base anatómica */}
          <g
            fill={`url(#${uid}-body)`}
            stroke="var(--border)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            {/* Cuerpo (mitad izquierda + derecha) */}
            <path d={body.leftHalf} stroke="none" />
            <path d={body.rightHalf} stroke="none" />
            {/* Contorno externo continuo sin costura central */}
            <path d={body.leftHalf.replace(/\s+Z$/, '')} fill="none" />
            <path d={body.rightHalf.replace(/\s+Z$/, '')} fill="none" />
            {/* Orejas y cabeza */}
            {body.ears.map((d, i) => (
              <path key={i} d={d} fill="none" strokeWidth="1.3" />
            ))}
            <path d={body.head} />
          </g>

          {/* Líneas de referencia anatómica (clavículas, esternón, rótulas, columna) */}
          <g
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.65"
            pointerEvents="none"
          >
            {view === 'front' ? (
              <>
                {/* Clavículas y cuello */}
                <path d={`M 134 94 Q 114 91 ${92 + (isF ? 8 : 0)} 96`} />
                <path d={`M 146 94 Q 166 91 ${188 - (isF ? 8 : 0)} 96`} />
                {/* Línea media / esternón + ombligo */}
                <path d="M 140 100 L 140 248" opacity="0.45" />
                <ellipse cx="140" cy="212" rx="1.6" ry="2.4" fill="var(--border)" />
                {/* Rótulas */}
                <path d="M 103 392 Q 111 387 119 392 Q 117 404 111 406 Q 105 404 103 392 Z" />
                <path d="M 177 392 Q 169 387 161 392 Q 163 404 169 406 Q 175 404 177 392 Z" />
              </>
            ) : (
              <>
                {/* Surco espinal */}
                <path d="M 140 82 L 140 246" opacity="0.55" />
                {/* Pliegue subglúteo y huecos poplíteos */}
                <path d="M 96 300 Q 115 307 134 298" opacity="0.5" />
                <path d="M 184 300 Q 165 307 146 298" opacity="0.5" />
                <path d="M 101 396 Q 111 400 121 396" opacity="0.5" />
                <path d="M 179 396 Q 169 400 159 396" opacity="0.5" />
                {/* Tendones de Aquiles */}
                <path d="M 109 478 L 109 514" opacity="0.55" />
                <path d="M 171 478 L 171 514" opacity="0.55" />
              </>
            )}
          </g>

          {/* Zonas musculares anatómicas tocables */}
          {zones.map((zone) => {
            const level = selectedMap.get(zone.id);
            const isHovered = hovered === zone.id;
            const atLimit = !level && selected.length >= maxSelection;

            let fill = `url(#${uid}-idle)`;
            let stroke = 'rgba(100, 116, 139, 0.42)';
            if (level === 1) {
              fill = `url(#${uid}-p1)`;
              stroke = '#ffa069';
            } else if (level === 2) {
              fill = `url(#${uid}-p2)`;
              stroke = '#ff6105';
            } else if (isHovered && !atLimit) {
              fill = `url(#${uid}-hover)`;
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
                filter={level ? `url(#${uid}-glow)` : undefined}
                className={cn(
                  'transition-all duration-150 focus:outline-none',
                  atLimit ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'
                )}
              >
                {zone.paths.map((d, idx) => (
                  <path
                    key={idx}
                    d={d}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={level ? 1.5 : 1}
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
          <p className="eyebrow">Tus músculos prioritarios</p>
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
