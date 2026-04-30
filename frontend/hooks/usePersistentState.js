import { useState, useEffect } from 'react';

// Drop-in replacement for useState that mirrors state to localStorage.
// Hydrates from storage on mount so state survives app close/reopen.
// Key must be unique per usage site.
export function usePersistentState(key, defaultValue) {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      return stored != null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {} // storage quota — silently skip
  }, [key, state]);

  return [state, setState];
}
