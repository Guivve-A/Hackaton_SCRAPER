import Link from "next/link";
import { Compass } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-[rgba(2,6,23,0.74)] backdrop-blur-2xl">
      <div className="mx-auto flex h-[3.75rem] w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-slate-100/95 transition-opacity hover:opacity-85"
        >
          <span className="relative flex size-7 items-center justify-center rounded-full border border-white/[0.16] bg-white/[0.03] text-slate-100/85">
            <Compass className="size-3.5" />
          </span>
          <span className="font-heading tracking-luxury text-[14px] font-[460]">
            HackFinder
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-[12px] font-medium tracking-[0.02em] text-slate-300/78">
          <Link
            href="/events"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
          >
            Eventos
          </Link>
          <Link
            href="/suggest"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
          >
            Sugerir
          </Link>
          <Link
            href="/chat"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
          >
            HackBot
          </Link>
        </nav>
      </div>
    </header>
  );
}
