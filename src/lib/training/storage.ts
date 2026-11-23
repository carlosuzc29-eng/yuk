import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase/client';
import type { BodyWeightEntry, FavoriteRoutine, Routine, Workout } from '@/types/training';

/**
 * Persistencia de rutinas, entrenamientos y peso corporal.
 * Con Firebase configurado usa Firestore (con caché offline persistente);
 * sin configuración, guarda en localStorage como el resto del modo local.
 */

const LOCAL = {
  routine: (uid: string) => `yuk_routine_v1_${uid}`,
  workouts: (uid: string) => `yuk_workouts_v1_${uid}`,
  active: (uid: string) => `yuk_active_workout_v1_${uid}`,
  weight: (uid: string) => `yuk_bodyweight_v1_${uid}`,
  favorites: (uid: string) => `yuk_favorites_v1_${uid}`,
  members: 'forja_local_group_members_v1',
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cuota llena o almacenamiento bloqueado: la sesión sigue en memoria.
  }
}

// Las reglas de Firestore exigen Timestamp en estos campos.
const TS_FIELDS = ['createdAt', 'updatedAt', 'startedAt', 'completedAt'] as const;

function toFirestore<T extends object>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = JSON.parse(JSON.stringify(obj));
  for (const f of TS_FIELDS) {
    const v = out[f];
    if (typeof v === 'string') out[f] = Timestamp.fromDate(new Date(v));
  }
  return out;
}

function fromFirestore<T>(data: Record<string, unknown>): T {
  const out = { ...data };
  for (const f of TS_FIELDS) {
    const v = out[f];
    if (v instanceof Timestamp) out[f] = v.toDate().toISOString();
  }
  return out as T;
}

// ───────────── Rutina ─────────────

export async function getRoutine(uid: string): Promise<Routine | null> {
  const s = getFirebaseServices();
  if (s) {
    const snap = await getDoc(doc(s.db, 'users', uid, 'routines', 'current'));
    return snap.exists() ? fromFirestore<Routine>(snap.data()) : null;
  }
  return readJSON<Routine | null>(LOCAL.routine(uid), null);
}

export async function saveRoutine(uid: string, routine: Routine): Promise<Routine> {
  const next = { ...routine, updatedAt: new Date().toISOString() };
  const s = getFirebaseServices();
  if (s) {
    await setDoc(doc(s.db, 'users', uid, 'routines', 'current'), {
      ...toFirestore(next),
      isActive: true,
      daysPerWeek: next.days.length,
    });
    return next;
  }
  writeJSON(LOCAL.routine(uid), next);
  return next;
}

// ───────────── Rutinas favoritas ─────────────
// En Firestore viven junto a la rutina activa: users/{uid}/routines/{fav_…} con `favorite: true`
// (las reglas ya validan esos documentos como rutinas y son privados del usuario).

export async function listFavorites(uid: string): Promise<FavoriteRoutine[]> {
  const s = getFirebaseServices();
  let list: FavoriteRoutine[];
  if (s) {
    const snap = await getDocs(collection(s.db, 'users', uid, 'routines'));
    list = snap.docs
      .filter((d) => d.id !== 'current' && d.data().favorite === true)
      .map((d) => {
        const { favorite: _f, isActive: _a, daysPerWeek: _d, ...rest } = d.data();
        return fromFirestore<FavoriteRoutine>({ ...rest, id: d.id });
      });
  } else {
    list = readJSON<FavoriteRoutine[]>(LOCAL.favorites(uid), []);
  }
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveFavorite(uid: string, fav: FavoriteRoutine): Promise<FavoriteRoutine> {
  const next = { ...fav, updatedAt: new Date().toISOString() };
  const s = getFirebaseServices();
  if (s) {
    await setDoc(doc(s.db, 'users', uid, 'routines', fav.id), {
      ...toFirestore(next),
      favorite: true,
      isActive: false,
      daysPerWeek: next.days.length,
    });
    return next;
  }
  const list = readJSON<FavoriteRoutine[]>(LOCAL.favorites(uid), []).filter((f) => f.id !== fav.id);
  writeJSON(LOCAL.favorites(uid), [next, ...list]);
  return next;
}

export async function deleteFavorite(uid: string, id: string): Promise<void> {
  if (id === 'current') return; // nunca borrar la rutina activa por esta vía
  const s = getFirebaseServices();
  if (s) {
    await deleteDoc(doc(s.db, 'users', uid, 'routines', id));
    return;
  }
  writeJSON(
    LOCAL.favorites(uid),
    readJSON<FavoriteRoutine[]>(LOCAL.favorites(uid), []).filter((f) => f.id !== id)
  );
}

// ───────────── Entrenamientos ─────────────

export async function listWorkouts(uid: string, max = 200): Promise<Workout[]> {
  const s = getFirebaseServices();
  if (s) {
    const q = query(collection(s.db, 'users', uid, 'workouts'), orderBy('startedAt', 'desc'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromFirestore<Workout>({ ...d.data(), id: d.id }));
  }
  return readJSON<Workout[]>(LOCAL.workouts(uid), [])
    .slice()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, max);
}

export async function saveWorkout(uid: string, workout: Workout): Promise<void> {
  const s = getFirebaseServices();
  if (s) {
    await setDoc(doc(s.db, 'users', uid, 'workouts', workout.id), {
      ...toFirestore(workout),
      createdAt: Timestamp.fromDate(new Date(workout.startedAt)),
    });
    return;
  }
  const all = readJSON<Workout[]>(LOCAL.workouts(uid), []).filter((w) => w.id !== workout.id);
  writeJSON(LOCAL.workouts(uid), [workout, ...all]);
}

export async function deleteWorkout(uid: string, id: string): Promise<void> {
  const s = getFirebaseServices();
  if (s) {
    await deleteDoc(doc(s.db, 'users', uid, 'workouts', id));
    return;
  }
  writeJSON(
    LOCAL.workouts(uid),
    readJSON<Workout[]>(LOCAL.workouts(uid), []).filter((w) => w.id !== id)
  );
}

// ───────────── Sesión en curso (siempre local: sobrevive a recargas y a la falta de señal) ─────────────

export function getActiveWorkout(uid: string): Workout | null {
  return readJSON<Workout | null>(LOCAL.active(uid), null);
}

export function setActiveWorkout(uid: string, workout: Workout | null): void {
  writeJSON(LOCAL.active(uid), workout);
}

// ───────────── Peso corporal ─────────────

export async function listBodyWeight(uid: string): Promise<BodyWeightEntry[]> {
  const s = getFirebaseServices();
  if (s) {
    const q = query(collection(s.db, 'users', uid, 'bodyMetrics'), orderBy('date', 'asc'), limit(365));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as { date: string; weightKg: number | null })
      .filter((d) => typeof d.weightKg === 'number')
      .map((d) => ({ id: d.date, date: d.date, weightKg: d.weightKg as number }));
  }
  return readJSON<BodyWeightEntry[]>(LOCAL.weight(uid), []).sort((a, b) => a.date.localeCompare(b.date));
}

export async function addBodyWeight(uid: string, entry: Omit<BodyWeightEntry, 'id'>): Promise<void> {
  const s = getFirebaseServices();
  if (s) {
    // Un registro por día: el id del documento es la fecha.
    await setDoc(doc(s.db, 'users', uid, 'bodyMetrics', entry.date), {
      date: entry.date,
      weightKg: entry.weightKg,
      createdAt: Timestamp.now(),
    });
    return;
  }
  const all = readJSON<BodyWeightEntry[]>(LOCAL.weight(uid), []).filter((e) => e.date !== entry.date);
  writeJSON(LOCAL.weight(uid), [...all, { ...entry, id: entry.date }]);
}

// ───────────── Estadísticas de constancia para el grupo ─────────────

export interface ConsistencyStats {
  currentStreak: number;
  weeklyPlannedSessions: number;
  weeklyCompletedSessions: number;
  monthlyCompliancePct: number;
  lastWorkoutAt: string;
}

export async function updateGroupStats(
  groupId: string,
  uid: string,
  stats: ConsistencyStats
): Promise<void> {
  const s = getFirebaseServices();
  if (s) {
    await updateDoc(doc(s.db, 'groups', groupId, 'members', uid), {
      currentStreak: stats.currentStreak,
      weeklyPlannedSessions: Math.min(14, stats.weeklyPlannedSessions),
      weeklyCompletedSessions: Math.min(21, stats.weeklyCompletedSessions),
      monthlyCompliancePct: Math.max(0, Math.min(100, stats.monthlyCompliancePct)),
      lastWorkoutAt: Timestamp.fromDate(new Date(stats.lastWorkoutAt)),
      updatedAt: Timestamp.now(),
    });
    return;
  }
  const byGroup = readJSON<Record<string, { uid: string }[]>>(LOCAL.members, {});
  const list = byGroup[groupId];
  if (!list) return;
  byGroup[groupId] = list.map((m) => (m.uid === uid ? { ...m, ...stats } : m));
  writeJSON(LOCAL.members, byGroup);
}
