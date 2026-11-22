/**
 * Configuración de escena por personaje: archivo, fondo, luces, exposición, vistas de cámara
 * y material de comparación. El visor es el mismo; cada personaje se compara con su referencia
 * en las condiciones de iluminación que pide su brief.
 */

/** Tipos de encuadre que sabe calcular el visor a partir de la caja del modelo. */
export type ViewKind =
  | 'full' // cuerpo completo de frente
  | 'side' // cuerpo completo de perfil
  | 'back' // cuerpo completo de espalda
  | 'face' // primer plano del rostro
  | 'torso'; // rostro + torso hasta el ombligo, como una referencia de busto

export interface ViewDef {
  id: string;
  label: string;
  kind: ViewKind;
}

export interface LightDef {
  /** Dirección desde la que llega la luz (se normaliza). */
  dir: [number, number, number];
  color: number;
  intensity: number;
  shadow?: boolean;
}

export interface CharacterLook {
  id: string;
  label: string;
  /** Ruta relativa a /public, sin basePath. */
  file: string;
  /** Especificación del recurso. */
  doc: string;
  background: number;
  exposure: number;
  envIntensity: number;
  hemisphere: { sky: number; ground: number; intensity: number };
  lights: LightDef[];
  /** Opacidad de la sombra en el suelo (0 = sin suelo visible). */
  groundShadow: number;
  views: ViewDef[];
  initialView: string;
  material: {
    color: string;
    roughness: number;
    roughnessRange: [number, number];
    /** Intensidad del mapa normal del GLB cuando se usa el material de comparación. */
    normalScale: number;
  };
}

export const LOOKS: Record<'femenino' | 'masculino', CharacterLook> = {
  femenino: {
    id: 'femenino',
    label: 'Mujer',
    file: '/models/mujer.glb',
    doc: 'docs/personaje-3d.md',
    background: 0x0b0b0c, // casi negro
    exposure: 1.0,
    envIntensity: 0.35,
    hemisphere: { sky: 0xffffff, ground: 0x1a1a1c, intensity: 0.25 },
    lights: [
      { dir: [2.2, 4.5, 2.4], color: 0xffffff, intensity: 2.4, shadow: true }, // principal: arriba y lateral
      { dir: [-3, 1.6, 2], color: 0xf1f2ff, intensity: 0.55 }, // relleno suave
      { dir: [-1.5, 2.8, -3.2], color: 0xffffff, intensity: 0.9 }, // separación del fondo
    ],
    groundShadow: 0.35,
    views: [
      { id: 'frontal', label: 'Frontal', kind: 'full' },
      { id: 'lateral', label: 'Lateral', kind: 'side' },
      { id: 'posterior', label: 'Posterior', kind: 'back' },
      { id: 'rostro', label: 'Rostro', kind: 'face' },
    ],
    initialView: 'frontal',
    material: { color: '#ecebe7', roughness: 0.45, roughnessRange: [0.35, 0.55], normalScale: 1 },
  },
  masculino: {
    id: 'masculino',
    label: 'Hombre',
    file: '/models/hombre.glb',
    doc: 'docs/personaje-3d-masculino.md',
    background: 0x2a2b2d, // gris carbón
    exposure: 1.05,
    envIntensity: 0.3,
    // Relleno algo más alto para conservar detalle en las sombras del abdomen y bajo los pectorales.
    hemisphere: { sky: 0xffffff, ground: 0x2a2b2d, intensity: 0.4 },
    lights: [
      { dir: [0.5, 5, 2.2], color: 0xffffff, intensity: 2.6, shadow: true }, // grande, superior y ligeramente frontal
      { dir: [-2.5, 1.2, 3], color: 0xf3f4f6, intensity: 0.45 }, // relleno
      { dir: [1.2, 2.5, -3.5], color: 0xffffff, intensity: 0.5 }, // separación sutil
    ],
    groundShadow: 0.3,
    views: [
      { id: 'referencia', label: 'Referencia', kind: 'torso' },
      { id: 'completo', label: 'Cuerpo', kind: 'full' },
      { id: 'espalda', label: 'Espalda', kind: 'back' },
      { id: 'lateral', label: 'Lateral', kind: 'side' },
      { id: 'rostro', label: 'Rostro', kind: 'face' },
    ],
    initialView: 'referencia',
    material: { color: '#8f9091', roughness: 0.55, roughnessRange: [0.45, 0.65], normalScale: 0.6 },
  },
};
