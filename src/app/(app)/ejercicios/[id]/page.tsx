import { EXERCISES } from '@/lib/exercises/catalog';
import { ExerciseDetailView } from './ExerciseDetailView';

export function generateStaticParams() {
  return EXERCISES.map((e) => ({ id: e.id }));
}

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExerciseDetailView id={id} />;
}
