import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EXERCISES } from '@/lib/exercises/catalog';
import { EXERCISE_MACHINE_SPECS } from '@/lib/exercises/machines';
import { PATTERNS } from '@/lib/exercises/poses';
import { anatomicalLimbPath, footPath, muscleShapes, sideHeadPath } from '@/lib/exercises/rig';
import { computeViewBox, FigureSVG, skeletonForView } from '@/components/exercises/ExerciseAnimation';
import type { View2DMode } from '@/types/training';
import type { Sex } from '@/types/user';

const VIEWS: View2DMode[] = ['lateral', 'frontal', 'espalda'];
const SEXES: Sex[] = ['male', 'female'];
const PHASES = [0, 0.25, 0.5, 0.75, 1];

describe('auditoría integral 2D de los 103 ejercicios (Lateral · Frontal · Espalda)', () => {
  it('cada uno de los 103 ejercicios tiene ficha dedicada de máquina real, ajuste y descripción completa', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(100);
    for (const ex of EXERCISES) {
      // Debe existir entrada específica por ID en EXERCISE_MACHINE_SPECS
      const spec = EXERCISE_MACHINE_SPECS[ex.id];
      expect(spec, `Falta ficha de máquina para ${ex.id}`).toBeDefined();
      expect(ex.machineName.trim().length, `${ex.id} machineName vacío`).toBeGreaterThan(12);
      expect(ex.machineSetup.trim().length, `${ex.id} machineSetup vacío`).toBeGreaterThan(25);
      expect(ex.description.trim().length, `${ex.id} description vacía`).toBeGreaterThan(45);
      expect(VIEWS).toContain(ex.defaultView);
    }
  });

  it('genera esqueletos 2D, caminos SVG y encuadres sin descuadres ni NaN en las 3 vistas (3090 combinaciones)', () => {
    for (const ex of EXERCISES) {
      const def = PATTERNS[ex.pattern];
      expect(def, `Patrón inexistente para ${ex.id}`).toBeDefined();

      for (const viewMode of VIEWS) {
        for (const sex of SEXES) {
          const vb = computeViewBox(def, ex, sex, viewMode);
          const [x0, y0, w, h] = vb;
          expect(Number.isFinite(x0) && Number.isFinite(y0) && Number.isFinite(w) && Number.isFinite(h)).toBe(true);
          expect(w, `${ex.id} ${viewMode} ancho viewBox`).toBeGreaterThan(50);
          expect(h, `${ex.id} ${viewMode} alto viewBox`).toBeGreaterThan(50);
          expect(w / h, `${ex.id} ${viewMode} proporción viewBox`).toBeGreaterThanOrEqual(1.0);
          expect(w / h, `${ex.id} ${viewMode} proporción viewBox`).toBeLessThanOrEqual(1.6);

          for (const t of PHASES) {
            const sk = skeletonForView(def, t, sex, viewMode, ex);
            const expectedSkView =
              viewMode === 'lateral' ? 'side' : viewMode === 'frontal' ? 'front' : 'back';
            expect(sk.view).toBe(expectedSkView);

            // Todas las articulaciones deben ser finitas y caer dentro del viewBox calculado
            const points = [
              sk.head,
              sk.shoulder,
              sk.hip,
              sk.hand,
              sk.hand2,
              sk.ankle,
              sk.ankle2,
              sk.toe,
              sk.toe2,
              sk.neck[0],
              sk.neck[1],
            ];
            for (const pt of points) {
              expect(Number.isFinite(pt[0]) && Number.isFinite(pt[1]), `${ex.id} ${viewMode} t=${t}`).toBe(true);
              expect(pt[0], `${ex.id} ${viewMode} t=${t} X fuera de encuadre`).toBeGreaterThanOrEqual(x0 - 2);
              expect(pt[0], `${ex.id} ${viewMode} t=${t} X fuera de encuadre`).toBeLessThanOrEqual(x0 + w + 2);
              expect(pt[1], `${ex.id} ${viewMode} t=${t} Y fuera de encuadre`).toBeGreaterThanOrEqual(y0 - 2);
              expect(pt[1], `${ex.id} ${viewMode} t=${t} Y fuera de encuadre`).toBeLessThanOrEqual(y0 + h + 2);
            }

            // Caminos SVG libres de NaN
            expect(sk.torsoPath).not.toContain('NaN');
            expect(footPath(sk.ankle, sk.toe)).not.toContain('NaN');
            if (sk.view === 'side') {
              expect(sideHeadPath(sk.head, sk.neck[0])).not.toContain('NaN');
            }

            for (const [segName, seg] of Object.entries(sk.segs)) {
              if (!seg || segName === 'torso') continue;
              const kind = segName.replace('2', '') as 'thigh' | 'shin' | 'upperArm' | 'forearm';
              const path = anatomicalLimbPath(seg, kind);
              expect(path, `${ex.id} ${viewMode} ${segName}`).not.toContain('NaN');
              const segLen = Math.hypot(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]);
              expect(segLen, `${ex.id} ${viewMode} ${segName} longitud válida`).toBeGreaterThan(5);
            }

            // Mapas de calor muscular válidos en las 3 vistas
            for (const m of [...ex.primary, ...ex.secondary]) {
              const shapes = muscleShapes(sk, m);
              for (const s of shapes) {
                expect(Number.isFinite(s.cx) && Number.isFinite(s.cy) && Number.isFinite(s.rx) && Number.isFinite(s.ry)).toBe(true);
                expect(s.rx).toBeGreaterThan(0);
                expect(s.ry).toBeGreaterThan(0);
              }
            }
          }

          // Renderizar el SVG completo de la figura + máquina en cada vista para verificar que no hay errores de React ni NaN en el DOM
          if (sex === 'male') {
            const skMid = skeletonForView(def, 0.5, sex, viewMode, ex);
            const svgHtml = renderToStaticMarkup(
              React.createElement(FigureSVG, {
                def,
                sk: skMid,
                sex,
                viewMode,
                exercise: ex,
                label: ex.name,
              })
            );
            expect(svgHtml.startsWith('<svg')).toBe(true);
            expect(svgHtml).not.toContain('NaN');
            expect(svgHtml).not.toContain('undefined');
          }
        }
      }
    }
  }, 20000);
});
