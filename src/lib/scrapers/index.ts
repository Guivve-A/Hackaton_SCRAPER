import type { Hackathon, Platform } from "@/types/hackathon";
import {
  getHackathonByUrl,
  pruneExpiredByDeadline,
  pruneStaleByPlatform,
  upsertHackathon,
} from "@/lib/db/queries";

import { scrapeDevpost } from "./devpost";
import { scrapeMLH } from "./mlh";
import { scrapeEventbrite } from "./eventbrite";
import { scrapeGDG } from "./gdg";

type ScraperTask = {
  name: string;
  platform: Platform;
  run: () => Promise<Partial<Hackathon>[]>;
};

export type RunAllScrapersResult = {
  total: number;
  inserted: number;
  updated: number;
  deleted: { stale: number; expired: number };
  errors: string[];
};

const EXPIRED_DEADLINE_DAYS = 30;

function cleanText(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeHackathon(item: Partial<Hackathon>): Partial<Hackathon> | null {
  const title = cleanText(item.title);
  const url = cleanText(item.url);

  if (!title || !url) {
    return null;
  }

  return {
    ...item,
    title,
    url,
    tags: Array.from(new Set(item.tags ?? [])),
    is_online: item.is_online ?? false,
  };
}

function mergeHackathons(
  current: Partial<Hackathon>,
  incoming: Partial<Hackathon>
): Partial<Hackathon> {
  return {
    ...current,
    ...incoming,
    tags: Array.from(new Set([...(current.tags ?? []), ...(incoming.tags ?? [])])),
    is_online: incoming.is_online ?? current.is_online ?? false,
  };
}

export async function runAllScrapers(): Promise<RunAllScrapersResult> {
  const runStartedAt = new Date().toISOString();

  const tasks: ScraperTask[] = [
    { name: "devpost", platform: "devpost", run: scrapeDevpost },
    { name: "mlh", platform: "mlh", run: scrapeMLH },
    { name: "eventbrite-online", platform: "eventbrite", run: () => scrapeEventbrite("online") },
    { name: "eventbrite-us", platform: "eventbrite", run: () => scrapeEventbrite("united-states") },
    { name: "eventbrite-uk", platform: "eventbrite", run: () => scrapeEventbrite("united-kingdom") },
    { name: "eventbrite-de", platform: "eventbrite", run: () => scrapeEventbrite("germany") },
    { name: "eventbrite-in", platform: "eventbrite", run: () => scrapeEventbrite("india") },
    { name: "gdg", platform: "gdg", run: scrapeGDG },
  ];

  console.info(
    `[scrapers] Starting ${tasks.length} scrapers in parallel at ${runStartedAt}.`
  );
  const settled = await Promise.allSettled(tasks.map((task) => task.run()));

  const collected: Partial<Hackathon>[] = [];
  const errors: string[] = [];
  const platformOutcomes: Record<string, { ok: number; fail: number }> = {};

  for (const task of tasks) {
    if (!platformOutcomes[task.platform]) {
      platformOutcomes[task.platform] = { ok: 0, fail: 0 };
    }
  }

  settled.forEach((result, index) => {
    const task = tasks[index];

    if (result.status === "fulfilled") {
      platformOutcomes[task.platform].ok += 1;
      console.info(
        `[scrapers] ${task.name} succeeded with ${result.value.length} items.`
      );
      collected.push(...result.value);
      return;
    }

    platformOutcomes[task.platform].fail += 1;
    const message =
      result.reason instanceof Error
        ? result.reason.message
        : "Unknown scraper failure";
    errors.push(`${task.name}: ${message}`);
    console.error(`[scrapers] ${task.name} failed: ${message}`);
  });

  const byUrl = new Map<string, Partial<Hackathon>>();

  for (const raw of collected) {
    const normalized = normalizeHackathon(raw);
    if (!normalized || !normalized.url) {
      errors.push("dropped-item: missing title or url");
      continue;
    }

    const existing = byUrl.get(normalized.url);
    if (!existing) {
      byUrl.set(normalized.url, normalized);
      continue;
    }

    byUrl.set(normalized.url, mergeHackathons(existing, normalized));
  }

  let inserted = 0;
  let updated = 0;

  for (const [url, item] of byUrl.entries()) {
    try {
      const existing = await getHackathonByUrl(url);
      await upsertHackathon({ ...item, scraped_at: runStartedAt });

      if (existing) {
        updated += 1;
      } else {
        inserted += 1;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown upsert failure";
      errors.push(`upsert:${url}: ${message}`);
    }
  }

  let staleDeleted = 0;
  for (const [platform, outcome] of Object.entries(platformOutcomes)) {
    if (outcome.fail > 0 || outcome.ok === 0) {
      console.warn(
        `[scrapers] Skip stale-prune for ${platform} (ok=${outcome.ok}, fail=${outcome.fail}).`
      );
      continue;
    }

    try {
      const removed = await pruneStaleByPlatform(platform, runStartedAt);
      staleDeleted += removed;
      if (removed > 0) {
        console.info(
          `[scrapers] Pruned ${removed} stale ${platform} hackathons not seen in this run.`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown prune failure";
      errors.push(`prune-stale:${platform}: ${message}`);
      console.error(
        `[scrapers] Failed to prune stale ${platform} rows: ${message}`
      );
    }
  }

  const expiredCutoff = new Date(
    Date.now() - EXPIRED_DEADLINE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  let expiredDeleted = 0;
  try {
    expiredDeleted = await pruneExpiredByDeadline(expiredCutoff);
    if (expiredDeleted > 0) {
      console.info(
        `[scrapers] Pruned ${expiredDeleted} hackathons with deadline before ${expiredCutoff}.`
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown prune failure";
    errors.push(`prune-expired: ${message}`);
    console.error(`[scrapers] Failed to prune expired rows: ${message}`);
  }

  const summary: RunAllScrapersResult = {
    total: byUrl.size,
    inserted,
    updated,
    deleted: { stale: staleDeleted, expired: expiredDeleted },
    errors,
  };

  console.info(
    `[scrapers] Done. total=${summary.total}, inserted=${summary.inserted}, updated=${summary.updated}, deleted_stale=${summary.deleted.stale}, deleted_expired=${summary.deleted.expired}, errors=${summary.errors.length}`
  );

  return summary;
}
