import { NextResponse } from "next/server";

import { embedAllHackathons } from "@/lib/ai/embeddings";
import { validateCronSecret } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const auth = validateCronSecret(request);
  if (!auth.ok) return auth.response;

  try {
    // Batch translation removed — translations are now per-session only
    // (client-side cache) to avoid cross-user data leakage.
    console.info("[cron/embed] Starting embedding pass.");
    const embedResult = await embedAllHackathons();
    console.info(
      `[cron/embed] Embedding done. processed=${embedResult.processed}, failed=${embedResult.failed}.`
    );

    return NextResponse.json({
      success: true,
      embed: embedResult,
    });
  } catch (error) {
    console.error("[cron/embed] Fatal error:", error);
    return NextResponse.json(
      { error: "Embed cron job failed" },
      { status: 500 }
    );
  }
}
