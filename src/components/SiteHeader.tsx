import Link from "next/link";
import { Compass } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[linear-gradient(180deg,rgba(15,23,42,0.55),rgba(2,6,23,0.28))] shadow-[0_1px_0_rgba(148,163,184,0.06),0_12px_40px_-24px_rgba(2,6,23,0.75)] backdrop-blur-2xl backdrop-saturate-150">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/25 to-transparent"
      />
      <div className="mx-auto flex h-[3.75rem] w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-slate-100/95 transition-opacity hover:opacity-90"
        >
          <span className="relative flex size-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-slate-100/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors group-hover:border-cyan-200/30">
            <Compass className="size-3.5" />
          </span>
          <span className="font-heading tracking-luxury text-[14px] font-[460]">
            HackFinder
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-[12px] font-medium tracking-[0.02em] text-slate-300/78">
          <Link
            href="/events"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-white/[0.05] hover:text-slate-100"
          >
            Eventos
          </Link>
          <Link
            href="/suggest"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-white/[0.05] hover:text-slate-100"
          >
            Sugerir
          </Link>
          <Link
            href="/chat"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-white/[0.05] hover:text-slate-100"
          >
            HackBot
          </Link>
        </nav>
      </div>
    </header>
  );
}
