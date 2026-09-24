import { useEffect, useState } from "react";

/** A tiny per-browser preference (selected event/profile). Real data lives on the local server. */
export function useStored(key: string, initial: string | null): [string | null, (v: string | null) => void] {
  const [value, setValue] = useState<string | null>(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable (private mode); the preference just won't persist.
    }
  }, [key, value]);
  return [value, setValue];
}
