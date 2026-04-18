"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "hackfinder:favorites:v1";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }

    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(raw)) {
        return new Set((raw as unknown[]).filter((v): v is number => Number.isFinite(v)));
      }
    } catch {
      // ignore parse errors
    }

    return new Set();
  });

  const hydrated = typeof window !== "undefined";

  const toggle = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: number) => favorites.has(id), [favorites]);

  return { favorites, toggle, isFavorite, hydrated, count: favorites.size };
}
