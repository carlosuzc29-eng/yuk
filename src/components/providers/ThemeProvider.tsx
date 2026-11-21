'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemePreference = 'system' | 'dark' | 'light';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: 'dark' | 'light';
  setPreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'color-scheme';

function getSystemScheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyMetaColorScheme(pref: ThemePreference) {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', pref === 'system' ? 'light dark' : pref);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setSystemScheme(getSystemScheme());

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        setPreferenceState(saved);
        applyMetaColorScheme(saved);
      } else {
        setPreferenceState('system');
        applyMetaColorScheme('system');
      }
    } catch {
      // Ignore storage access restrictions
    }

    // Listen to OS color-scheme changes without removing pinned user preference
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = (e: MediaQueryListEvent) => {
      setSystemScheme(e.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onMediaChange);

    // Sync theme across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next: ThemePreference =
        e.newValue === 'dark' || e.newValue === 'light' ? e.newValue : 'system';
      setPreferenceState(next);
      applyMetaColorScheme(next);
    };
    window.addEventListener('storage', onStorage);

    // Register PWA Service Worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => {});
    }

    return () => {
      media.removeEventListener('change', onMediaChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    applyMetaColorScheme(pref);
    try {
      if (pref === 'system') {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, pref);
      }
    } catch {
      // Theme still applies to current session
    }
  }, []);

  const resolvedTheme: 'dark' | 'light' =
    preference === 'system' ? systemScheme : preference;

  const toggleTheme = useCallback(() => {
    const target: 'dark' | 'light' = resolvedTheme === 'dark' ? 'light' : 'dark';
    if (target === systemScheme) {
      setPreference('system');
    } else {
      setPreference(target);
    }
  }, [resolvedTheme, systemScheme, setPreference]);

  return (
    <ThemeContext.Provider
      value={{ preference, resolvedTheme, setPreference, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}
