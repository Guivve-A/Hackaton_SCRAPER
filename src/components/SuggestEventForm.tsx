"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

type FormState = {
  title: string;
  url: string;
  description: string;
  source: string;
  contactEmail: string;
  isOnline: boolean;
  website: string;
};

const INITIAL_STATE: FormState = {
  title: "",
  url: "",
  description: "",
  source: "",
  contactEmail: "",
  isOnline: true,
  website: "",
};

export function SuggestEventForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          url: form.url,
          description: form.description,
          source: form.source,
          contactEmail: form.contactEmail,
          isOnline: form.isOnline,
          website: form.website,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; issues?: Array<{ field: string; message: string }>; accepted?: boolean }
        | null;

      if (!response.ok) {
        if (payload?.issues?.length) {
          setMessage(payload.issues.map((issue) => `${issue.field}: ${issue.message}`).join(" | "));
        } else {
          setMessage(payload?.error ?? "No se pudo enviar tu sugerencia.");
        }
        setStatus("error");
        return;
      }

      if (payload && payload.accepted === false) {
        setMessage("Recibimos tu envío para revisión interna.");
        setStatus("success");
        setForm(INITIAL_STATE);
        return;
      }

      setMessage("Gracias. Tu sugerencia quedó en moderación y revisión manual.");
      setStatus("success");
      setForm(INITIAL_STATE);
    } catch (error) {
      console.error("[SuggestEventForm] submit failed", error);
      setMessage("No se pudo enviar tu sugerencia. Intenta de nuevo en unos segundos.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="title" className="text-xs font-medium uppercase tracking-wide text-white/70">
            Titulo del evento
          </label>
          <Input
            id="title"
            required
            maxLength={180}
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Ej: AI Agent Olympics Hackathon"
            className="h-10 border-white/15 bg-white/[0.03] text-white placeholder:text-white/45"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="url" className="text-xs font-medium uppercase tracking-wide text-white/70">
            Link oficial
          </label>
          <Input
            id="url"
            type="url"
            required
            maxLength={400}
            value={form.url}
            onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
            placeholder="https://..."
            className="h-10 border-white/15 bg-white/[0.03] text-white placeholder:text-white/45"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="source" className="text-xs font-medium uppercase tracking-wide text-white/70">
            Fuente
          </label>
          <Input
            id="source"
            maxLength={120}
            value={form.source}
            onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))}
            placeholder="Lablab, GitHub, etc."
            className="h-10 border-white/15 bg-white/[0.03] text-white placeholder:text-white/45"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contactEmail" className="text-xs font-medium uppercase tracking-wide text-white/70">
            Email (opcional)
          </label>
          <Input
            id="contactEmail"
            type="email"
            maxLength={160}
            value={form.contactEmail}
            onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
            placeholder="tu@email.com"
            className="h-10 border-white/15 bg-white/[0.03] text-white placeholder:text-white/45"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-xs font-medium uppercase tracking-wide text-white/70">
          Contexto del evento
        </label>
        <textarea
          id="description"
          required
          minLength={12}
          maxLength={3000}
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Comparte detalles clave: modalidad online/hibrida, fechas, premios, publico objetivo..."
          className="min-h-28 w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/45 outline-none transition-colors focus:border-violet-400/45 focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-white/75">
          <input
            type="checkbox"
            checked={form.isOnline}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, isOnline: event.target.checked }))
            }
            className="size-4 rounded border-white/30 bg-white/10 text-violet-400"
          />
          Es accesible online
        </label>

        <Button
          type="submit"
          variant="secondary"
          disabled={status === "submitting"}
          className="border border-white/20 bg-white/10 px-4 text-white hover:bg-white/20"
        >
          {status === "submitting" ? "Enviando..." : "Enviar sugerencia"}
        </Button>
      </div>

      {/* Honeypot anti-bot field */}
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
        />
      </div>

      {status === "success" && (
        <p className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      )}

      {status === "error" && (
        <p className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {message}
        </p>
      )}
    </form>
  );
}
