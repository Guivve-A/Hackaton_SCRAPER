"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { Hackathon } from "@/types/hackathon";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

export type HackathonSearchHit = Hackathon & { similarity: number };

export interface SearchBarProps {
  placeholder?: string;
  defaultValue?: string;
  onResults?: (results: HackathonSearchHit[], query: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  onSubmit?: (query: string) => void;
  className?: string;
  size?: "default" | "lg";
  online?: boolean;
  platform?: string;
  limit?: number;
  autoSearch?: boolean;
}

export function SearchBar({
  placeholder = "Ej: hackathons de IA online...",
  defaultValue = "",
  onResults,
  onLoadingChange,
  onSubmit,
  className,
  size = "default",
  online,
  platform,
  limit = 12,
  autoSearch = true,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const skipNextRef = useRef(false);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    if (!autoSearch) return;

    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }

    const trimmed = value.trim();

    if (trimmed.length < MIN_CHARS) {
      abortRef.current?.abort();
      setLoading(false);
      onResults?.([], "");
      return;
    }

    const handle = setTimeout(() => {
      void runSearch(trimmed);
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, online, platform, limit, autoSearch]);

  async function runSearch(query: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      if (online !== undefined) params.set("online", String(online));
      if (platform) params.set("platform", platform);

      const res = await fetch(`/api/search?${params.toString()}`, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        onResults?.([], query);
        return;
      }

      const data = (await res.json()) as { results?: HackathonSearchHit[] };
      onResults?.(data.results ?? [], query);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("[SearchBar] search failed", error);
      onResults?.([], query);
    } finally {
      if (controller === abortRef.current) {
        setLoading(false);
      }
    }
  }

  function handleClear() {
    abortRef.current?.abort();
    skipNextRef.current = true;
    setValue("");
    setLoading(false);
    onResults?.([], "");
  }

  function handleKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      const trimmed = value.trim();
      onSubmit?.(trimmed);
      if (autoSearch && trimmed.length >= MIN_CHARS) void runSearch(trimmed);
    }
  }

  const heightClass = size === "lg" ? "h-16" : "h-12";
  const iconSize = size === "lg" ? "size-5" : "size-4";
  const textSize = size === "lg" ? "text-[15px]" : "text-sm";

  return (
    <div
      className={cn(
        "group relative w-full transition-all duration-400",
        className
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-px rounded-2xl border border-white/[0.08] opacity-0 transition-opacity duration-400",
          focused && "opacity-100"
        )}
      />
      <div
        className={cn(
          "relative flex items-center rounded-2xl border border-white/[0.1] bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl transition-all",
          heightClass,
          focused &&
            "border-white/[0.18] bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_44px_-28px_rgba(125,146,179,0.55)]"
        )}
      >
        <Search
          className={cn(
            "pointer-events-none ml-5 text-slate-300/60 transition-colors",
            iconSize,
            focused && "text-slate-100/80"
          )}
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label="Buscar hackathons"
          className={cn(
            "tracking-luxury h-full flex-1 bg-transparent px-4 font-medium text-slate-100 placeholder:font-normal placeholder:text-slate-300/45 focus:outline-none",
            textSize
          )}
        />
        <div className="mr-4 flex items-center gap-1">
          {loading && (
            <Loader2
              className={cn("animate-spin text-slate-200/85", iconSize)}
            />
          )}
          {!loading && value && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Limpiar búsqueda"
              className="rounded-full p-1.5 text-slate-300/55 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
            >
              <X className={iconSize} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
