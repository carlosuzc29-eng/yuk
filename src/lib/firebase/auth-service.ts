import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  Timestamp,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

const AUTH_TS_FIELDS = ['createdAt', 'updatedAt', 'joinedAt', 'lastWorkoutAt'] as const;

function toFsTimestamps<T extends object>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = JSON.parse(JSON.stringify(obj));
  for (const f of AUTH_TS_FIELDS) {
    const v = out[f];
    if (typeof v === 'string') out[f] = Timestamp.fromDate(new Date(v));
  }
  return out;
}

function fromFsTimestamps<T>(data: Record<string, unknown>): T {
  const out = { ...data };
  for (const f of AUTH_TS_FIELDS) {
    const v = out[f];
    if (v instanceof Timestamp) out[f] = v.toDate().toISOString();
  }
  return out as T;
}
import { getFirebaseServices } from './client';
import { generateInviteCode, normalizeInviteCode } from '@/lib/utils/invite-code';
import type { GroupInfo, GroupMember, UserProfile } from '@/types/user';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
}

const LOCAL_KEYS = {
  session: 'forja_local_session_v1',
  accounts: 'forja_local_accounts_v1',
  profiles: 'forja_local_profiles_v1',
  groups: 'forja_local_groups_v1',
  members: 'forja_local_group_members_v1',
};

type LocalAccount = { uid: string; email: string; passwordHash: string; displayName: string };

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function simpleLocalId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `uid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Listeners para modo local
const localListeners = new Set<(user: AuthUser | null) => void>();
function emitLocalAuth(user: AuthUser | null) {
  localListeners.forEach((cb) => cb(user));
}

export function subscribeAuthState(callback: (user: AuthUser | null) => void): () => void {
  const services = getFirebaseServices();
  if (services) {
    return onAuthStateChanged(services.auth, (fbUser) => {
      if (!fbUser) {
        callback(null);
      } else {
        callback({
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Atleta',
        });
      }
    });
  }

  localListeners.add(callback);
  const current = readJSON<AuthUser | null>(LOCAL_KEYS.session, null);
  callback(current);
  return () => {
    localListeners.delete(callback);
  };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim() || cleanEmail.split('@')[0];
  const services = getFirebaseServices();

  if (services) {
    const cred = await createUserWithEmailAndPassword(services.auth, cleanEmail, password);
    await updateProfile(cred.user, { displayName: cleanName });
    return { uid: cred.user.uid, email: cleanEmail, displayName: cleanName };
  }

  const accounts = readJSON<LocalAccount[]>(LOCAL_KEYS.accounts, []);
  if (accounts.some((a) => a.email === cleanEmail)) {
    throw new Error('Ya existe una cuenta registrada con ese correo.');
  }
  const newAcc: LocalAccount = {
    uid: simpleLocalId(),
    email: cleanEmail,
    passwordHash: btoa(password),
    displayName: cleanName,
  };
  writeJSON(LOCAL_KEYS.accounts, [...accounts, newAcc]);
  const authUser: AuthUser = {
    uid: newAcc.uid,
    email: newAcc.email,
    displayName: newAcc.displayName,
  };
  writeJSON(LOCAL_KEYS.session, authUser);
  emitLocalAuth(authUser);
  return authUser;
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();
  const services = getFirebaseServices();

  if (services) {
    const cred = await signInWithEmailAndPassword(services.auth, cleanEmail, password);
    return {
      uid: cred.user.uid,
      email: cred.user.email || cleanEmail,
      displayName: cred.user.displayName || cleanEmail.split('@')[0],
    };
  }

  const accounts = readJSON<LocalAccount[]>(LOCAL_KEYS.accounts, []);
  const found = accounts.find((a) => a.email === cleanEmail && a.passwordHash === btoa(password));
  if (!found) {
    throw new Error('Correo o contraseña incorrectos.');
  }
  const authUser: AuthUser = {
    uid: found.uid,
    email: found.email,
    displayName: found.displayName,
  };
  writeJSON(LOCAL_KEYS.session, authUser);
  emitLocalAuth(authUser);
  return authUser;
}

export async function signInWithGoogle(): Promise<AuthUser> {
  const services = getFirebaseServices();
  if (services) {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(services.auth, provider);
    return {
      uid: cred.user.uid,
      email: cred.user.email || '',
      displayName: cred.user.displayName || 'Atleta',
    };
  }

  throw new Error(
    'Para usar Google Sign-In configura tus credenciales de Firebase en .env.local. En modo local puedes entrar con correo y contraseña.'
  );
}

export async function requestPasswordReset(email: string): Promise<void> {
  const services = getFirebaseServices();
  if (services) {
    await sendPasswordResetEmail(services.auth, email.trim().toLowerCase());
    return;
  }
  // En modo local sin servidor SMTP simplemente confirmamos
}

export async function signOutUser(): Promise<void> {
  const services = getFirebaseServices();
  if (services) {
    await fbSignOut(services.auth);
    return;
  }
  writeJSON(LOCAL_KEYS.session, null);
  emitLocalAuth(null);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const services = getFirebaseServices();
  if (services) {
    const snap = await getDoc(doc(services.db, 'users', uid));
    return snap.exists() ? fromFsTimestamps<UserProfile>(snap.data()) : null;
  }
  const profiles = readJSON<Record<string, UserProfile>>(LOCAL_KEYS.profiles, {});
  return profiles[uid] ?? null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const services = getFirebaseServices();
  if (services) {
    await setDoc(doc(services.db, 'users', profile.uid), toFsTimestamps(profile), { merge: true });
    return;
  }
  const profiles = readJSON<Record<string, UserProfile>>(LOCAL_KEYS.profiles, {});
  profiles[profile.uid] = profile;
  writeJSON(LOCAL_KEYS.profiles, profiles);
}

export async function createGroup(
  name: string,
  user: { uid: string; displayName: string; daysPerWeek?: number }
): Promise<GroupInfo> {
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 60) {
    throw new Error('El nombre del grupo debe tener entre 2 y 60 caracteres.');
  }

  const inviteCode = generateInviteCode(6);
  const now = new Date().toISOString();
  const groupId = simpleLocalId();
  const safeDisplayName = user.displayName.trim() || 'Atleta';
  const group: GroupInfo = {
    id: groupId,
    name: cleanName,
    inviteCode,
    adminUid: user.uid,
    createdAt: now,
  };
  const member: GroupMember = {
    uid: user.uid,
    displayName: safeDisplayName,
    role: 'admin',
    joinedAt: now,
    currentStreak: 0,
    weeklyPlannedSessions: Math.min(14, Math.max(0, user.daysPerWeek ?? 4)),
    weeklyCompletedSessions: 0,
    monthlyCompliancePct: 0,
    lastWorkoutAt: null,
  };

  const services = getFirebaseServices();
  if (services) {
    const nowTs = Timestamp.fromDate(new Date(now));
    const batch = writeBatch(services.db);
    // El documento de grupo en Firestore NO incluye el campo `id` (va en la ruta).
    batch.set(doc(services.db, 'groups', groupId), {
      name: cleanName,
      inviteCode,
      adminUid: user.uid,
      memberCount: 1,
      createdAt: nowTs,
      updatedAt: nowTs,
    });
    batch.set(doc(services.db, 'groups', groupId, 'members', user.uid), toFsTimestamps(member));
    batch.set(doc(services.db, 'inviteCodes', inviteCode), {
      groupId,
      groupName: cleanName,
      adminUid: user.uid,
      createdAt: nowTs,
    });
    batch.set(
      doc(services.db, 'users', user.uid),
      { groupId, updatedAt: nowTs },
      { merge: true }
    );
    await batch.commit();
    return group;
  }

  const groups = readJSON<Record<string, GroupInfo>>(LOCAL_KEYS.groups, {});
  groups[groupId] = group;
  writeJSON(LOCAL_KEYS.groups, groups);

  const membersByGroup = readJSON<Record<string, GroupMember[]>>(LOCAL_KEYS.members, {});
  membersByGroup[groupId] = [member];
  writeJSON(LOCAL_KEYS.members, membersByGroup);

  const profiles = readJSON<Record<string, UserProfile>>(LOCAL_KEYS.profiles, {});
  if (profiles[user.uid]) {
    profiles[user.uid] = { ...profiles[user.uid], groupId, updatedAt: now };
    writeJSON(LOCAL_KEYS.profiles, profiles);
  }

  return group;
}

export async function joinGroupByCode(
  rawCode: string,
  user: { uid: string; displayName: string; daysPerWeek?: number }
): Promise<GroupInfo> {
  const code = normalizeInviteCode(rawCode);
  if (code.length !== 6) {
    throw new Error('El código de invitación debe tener 6 caracteres.');
  }

  const now = new Date().toISOString();
  const member: GroupMember = {
    uid: user.uid,
    displayName: user.displayName.trim() || 'Atleta',
    role: 'member',
    joinedAt: now,
    currentStreak: 0,
    weeklyPlannedSessions: Math.min(14, Math.max(0, user.daysPerWeek ?? 4)),
    weeklyCompletedSessions: 0,
    monthlyCompliancePct: 0,
    lastWorkoutAt: null,
  };

  const services = getFirebaseServices();
  if (services) {
    const codeSnap = await getDoc(doc(services.db, 'inviteCodes', code));
    if (!codeSnap.exists()) {
      throw new Error('Código de invitación inválido o inactivo.');
    }
    const { groupId } = codeSnap.data() as { groupId: string };
    await setDoc(doc(services.db, 'groups', groupId, 'members', user.uid), toFsTimestamps(member));
    await setDoc(
      doc(services.db, 'users', user.uid),
      {
        groupId,
        updatedAt: Timestamp.fromDate(new Date(now)),
      },
      { merge: true }
    );
    const groupSnap = await getDoc(doc(services.db, 'groups', groupId));
    return fromFsTimestamps<GroupInfo>({
      ...(groupSnap.data() as Record<string, unknown>),
      id: groupSnap.id,
    });
  }

  const groups = readJSON<Record<string, GroupInfo>>(LOCAL_KEYS.groups, {});
  const found = Object.values(groups).find((g) => g.inviteCode === code);
  if (!found) {
    throw new Error('No encontramos ningún grupo con ese código de 6 caracteres.');
  }

  const membersByGroup = readJSON<Record<string, GroupMember[]>>(LOCAL_KEYS.members, {});
  const existing = membersByGroup[found.id] ?? [];
  if (!existing.some((m) => m.uid === user.uid)) {
    membersByGroup[found.id] = [...existing, member];
    writeJSON(LOCAL_KEYS.members, membersByGroup);
  }

  const profiles = readJSON<Record<string, UserProfile>>(LOCAL_KEYS.profiles, {});
  if (profiles[user.uid]) {
    profiles[user.uid] = { ...profiles[user.uid], groupId: found.id, updatedAt: now };
    writeJSON(LOCAL_KEYS.profiles, profiles);
  }

  return found;
}

export async function getGroupAndMembers(
  groupId: string
): Promise<{ group: GroupInfo | null; members: GroupMember[] }> {
  const services = getFirebaseServices();
  if (services) {
    const groupSnap = await getDoc(doc(services.db, 'groups', groupId));
    if (!groupSnap.exists()) return { group: null, members: [] };
    const membersSnap = await getDocs(collection(services.db, 'groups', groupId, 'members'));
    const members = membersSnap.docs.map((d) =>
      fromFsTimestamps<GroupMember>({ ...d.data(), uid: d.id })
    );
    return {
      group: fromFsTimestamps<GroupInfo>({ ...groupSnap.data(), id: groupSnap.id }),
      members,
    };
  }

  const groups = readJSON<Record<string, GroupInfo>>(LOCAL_KEYS.groups, {});
  const membersByGroup = readJSON<Record<string, GroupMember[]>>(LOCAL_KEYS.members, {});
  return {
    group: groups[groupId] ?? null,
    members: membersByGroup[groupId] ?? [],
  };
}
