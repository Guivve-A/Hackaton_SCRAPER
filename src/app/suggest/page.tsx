import { SuggestEventForm } from "@/components/SuggestEventForm";
import { SiteHeader } from "@/components/SiteHeader";

export default function SuggestPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-14 sm:px-6 sm:pt-20">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl sm:p-7">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/65">
            Comunidad
          </span>
          <h1 className="mt-4 font-heading tracking-luxury text-3xl text-white sm:text-4xl">
            Sugerir un evento
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Si encontraste un hackathon internacional con participacion online,
            compartenos el link. Lo revisamos y lo agregamos al catalogo para la
            comunidad en Ecuador.
          </p>

          <div className="mt-6">
            <SuggestEventForm />
          </div>
        </section>
      </main>
    </>
  );
}
