"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "hackfinder:favorites:v1";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(raw)) {
        setFavorites(new Set((raw as unknown[]).filter((v): v is number => Number.isFinite(v))));
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true);
  }, []);

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
