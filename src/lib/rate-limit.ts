import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

let supabaseLimiterClient: SupabaseClient | null = null;

let didLogDistributedLimiterError = false;

export type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; response: Response };

type DistributedRateResult = {
  allowed: boolean;
  remaining: number;
  retry_after_sec: number;
  current_count: number;
};

function getSupabaseLimiterClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  if (supabaseLimiterClient) {
    return supabaseLimiterClient;
  }

  supabaseLimiterClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        "X-Client-Info": "hackfinder-rate-limiter",
      },
    },
  });

  return supabaseLimiterClient;
}

function buildRateLimitExceededResponse(
  config: RateLimitConfig,
  retryAfterSec: number
): RateLimitResult {
  return {
    ok: false,
    response: NextResponse.json(
      { error: "Too many requests", retryAfter: retryAfterSec },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    ),
  };
}

async function checkRateLimitWithSupabase(
  config: RateLimitConfig
): Promise<DistributedRateResult | null> {
  const client = getSupabaseLimiterClient();
  if (!client) {
    return null;
  }

  const windowSeconds = Math.max(1, Math.floor(config.windowMs / 1_000));

  try {
    const { data, error } = await client
      .rpc("consume_api_rate_limit", {
        p_bucket_key: config.key,
        p_limit: config.limit,
        p_window_seconds: windowSeconds,
      })
      .single<DistributedRateResult>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data || typeof data.allowed !== "boolean") {
      throw new Error("Supabase rate limiter returned an invalid payload");
    }

    return data;
  } catch (error) {
    if (!didLogDistributedLimiterError) {
      didLogDistributedLimiterError = true;
      console.error(
        "[rate-limit] Supabase distributed limiter unavailable, falling back to in-memory limiter:",
        error
      );
    }

    return null;
  }
}

function sweepExpired(now: number): void {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.timestamps.length === 0) {
      buckets.delete(key);
    } else if (now - bucket.timestamps[bucket.timestamps.length - 1] > 60 * 60 * 1_000) {
      buckets.delete(key);
    }
  }
}

function checkRateLimitInMemory(
  config: RateLimitConfig,
  now = Date.now()
): RateLimitResult {
  const bucket = buckets.get(config.key) ?? { timestamps: [] };

  const windowStart = now - config.windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= config.limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + config.windowMs - now) / 1_000));

    return buildRateLimitExceededResponse(config, retryAfterSec);
  }

  bucket.timestamps.push(now);
  buckets.set(config.key, bucket);
  sweepExpired(now);

  return { ok: true, remaining: config.limit - bucket.timestamps.length };
}

export async function checkRateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const distributed = await checkRateLimitWithSupabase(config);

  if (distributed) {
    if (!distributed.allowed) {
      return buildRateLimitExceededResponse(
        config,
        Math.max(1, Number(distributed.retry_after_sec) || 1)
      );
    }

    return {
      ok: true,
      remaining: Math.max(0, Number(distributed.remaining) || 0),
    };
  }

  return checkRateLimitInMemory(config, now);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
