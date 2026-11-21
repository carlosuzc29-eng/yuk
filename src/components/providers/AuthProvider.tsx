'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  subscribeAuthState,
  getUserProfile,
  getGroupAndMembers,
  type AuthUser,
} from '@/lib/firebase/auth-service';
import type { GroupInfo, GroupMember, UserProfile } from '@/types/user';

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  group: GroupInfo | null;
  groupMembers: GroupMember[];
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (authUser: AuthUser | null) => {
    if (!authUser) {
      setProfile(null);
      setGroup(null);
      setGroupMembers([]);
      setLoading(false);
      return;
    }

    try {
      const p = await getUserProfile(authUser.uid);
      setProfile(p);
      if (p?.groupId) {
        const res = await getGroupAndMembers(p.groupId);
        setGroup(res.group);
        setGroupMembers(res.members);
      } else {
        setGroup(null);
        setGroupMembers([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeAuthState((authUser) => {
      setUser(authUser);
      void loadUserData(authUser);
    });
    return unsub;
  }, [loadUserData]);

  const refreshProfile = useCallback(async () => {
    await loadUserData(user);
  }, [user, loadUserData]);

  return (
    <AuthContext.Provider
      value={{ user, profile, group, groupMembers, loading, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
