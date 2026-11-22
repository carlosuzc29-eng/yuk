import type { Metadata } from 'next';
import { ModelComparison } from './ModelComparison';

export const metadata: Metadata = {
  title: 'Personaje 3D · YUK',
  description: 'Visor de validación del personaje 3D animable.',
  robots: { index: false, follow: false },
};

export default function Modelo3DPage() {
  return <ModelComparison />;
}
