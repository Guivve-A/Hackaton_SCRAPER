"use client";

import { useCallback, useRef } from "react";

const STORAGE_KEY = "hackfinder:translation-cache:v1";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ENTRIES = 200;

type CacheEntry = {
  text: string;
  lang: string;
  ts: number;
};

type CacheShape = Record<string, CacheEntry>;

function buildKey(hackathonId: number, lang: string): string {
  return `${hackathonId}:${lang}`;
}

function readStore(): CacheShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as CacheShape;
    }
  } catch {
    // Corrupt JSON or access denied — reset silently.
  }
  return {};
}

function writeStore(store: CacheShape): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded or storage disabled — ignore, cache is best-effort.
  }
}

function prune(store: CacheShape): CacheShape {
  const now = Date.now();
  const entries = Object.entries(store).filter(([, v]) => now - v.ts < TTL_MS);
  entries.sort(([, a], [, b]) => b.ts - a.ts);
  return Object.fromEntries(entries.slice(0, MAX_ENTRIES));
}

export interface UseTranslationCacheApi {
  get: (hackathonId: number, lang: string) => string | null;
  set: (hackathonId: number, lang: string, text: string) => void;
  clear: () => void;
}

/**
 * Per-browser ephemeral translation cache. Never hits the server,
 * never shares state across devices or users. Each session owns its copy.
 *
 * Privacy guarantee: translations requested by the user stay on their
 * device only. No other visitor to the same event sees them.
 */
export function useTranslationCache(): UseTranslationCacheApi {
  const cacheRef = useRef<CacheShape | null>(null);

  const ensureLoaded = useCallback((): CacheShape => {
    if (!cacheRef.current) {
      cacheRef.current = prune(readStore());
    }
    return cacheRef.current;
  }, []);

  const get = useCallback(
    (hackathonId: number, lang: string): string | null => {
      const store = ensureLoaded();
      const entry = store[buildKey(hackathonId, lang)];
      if (!entry) return null;
      if (Date.now() - entry.ts > TTL_MS) return null;
      return entry.text;
    },
    [ensureLoaded]
  );

  const set = useCallback(
    (hackathonId: number, lang: string, text: string): void => {
      const store = ensureLoaded();
      store[buildKey(hackathonId, lang)] = {
        text,
        lang,
        ts: Date.now(),
      };
      cacheRef.current = prune(store);
      writeStore(cacheRef.current);
    },
    [ensureLoaded]
  );

  const clear = useCallback((): void => {
    cacheRef.current = {};
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  return { get, set, clear };
}
