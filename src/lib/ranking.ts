import type { Hackathon } from "@/types/hackathon";

type SemanticHit = Hackathon & { similarity: number };

const DAY_MS = 24 * 60 * 60 * 1_000;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deadlineProximityScore(deadline: string | null | undefined): number {
  const target = parseDate(deadline);
  if (!target) {
    return 0.25;
  }

  const diffDays = (target.getTime() - Date.now()) / DAY_MS;

  if (diffDays < -2) return 0.05;
  if (diffDays < 0) return 0.12;
  if (diffDays <= 14) return 1 - diffDays / 20;
  if (diffDays <= 45) return 0.65 - (diffDays - 14) / 120;
  if (diffDays <= 180) return 0.35;
  return 0.22;
}

function freshnessScore(dateLike: string | null | undefined): number {
  const target = parseDate(dateLike);
  if (!target) {
    return 0.2;
  }

  const ageDays = (Date.now() - target.getTime()) / DAY_MS;
  if (ageDays <= 0) return 1;
  if (ageDays <= 7) return 0.95 - ageDays * 0.05;
  if (ageDays <= 30) return 0.6 - (ageDays - 7) * 0.01;
  if (ageDays <= 90) return 0.3 - (ageDays - 30) * 0.003;
  return 0.08;
}

function qualityScore(item: Hackathon): number {
  let score = 0;

  if (item.description && item.description.length >= 80) score += 3;
  else if (item.description) score += 2;

  if (item.start_date) score += 2;
  if (item.deadline) score += 2;
  if (item.organizer) score += 1;
  if (item.image_url) score += 1;
  if ((item.tags?.length ?? 0) > 0) score += 1;
  if (item.prize_pool || item.prize_amount) score += 1;

  return clamp01(score / 11);
}

function onlinePriority(item: Hackathon): number {
  return item.is_online ? 1 : 0.15;
}

function semanticRankScore(item: SemanticHit): number {
  const similarity = clamp01(item.similarity);
  const freshness = freshnessScore(item.scraped_at ?? item.created_at ?? null);
  const deadline = deadlineProximityScore(item.deadline ?? item.start_date);
  const quality = qualityScore(item);
  const online = onlinePriority(item);

  return (
    similarity * 0.62 +
    online * 0.16 +
    deadline * 0.12 +
    quality * 0.07 +
    freshness * 0.03
  );
}

function catalogRankScore(item: Hackathon): number {
  const freshness = freshnessScore(item.scraped_at ?? item.created_at ?? null);
  const deadline = deadlineProximityScore(item.deadline ?? item.start_date);
  const quality = qualityScore(item);
  const online = onlinePriority(item);

  return (
    online * 0.4 +
    deadline * 0.3 +
    freshness * 0.17 +
    quality * 0.13
  );
}

function compareByDateAsc(a: string | null, b: string | null): number {
  const ad = parseDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bd = parseDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return ad - bd;
}

export function rankSemanticResults<T extends SemanticHit>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const scoreDiff = semanticRankScore(b) - semanticRankScore(a);
    if (Math.abs(scoreDiff) > 0.0001) {
      return scoreDiff;
    }

    return compareByDateAsc(a.deadline ?? a.start_date, b.deadline ?? b.start_date);
  });
}

export function rankCatalogHackathons<T extends Hackathon>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const scoreDiff = catalogRankScore(b) - catalogRankScore(a);
    if (Math.abs(scoreDiff) > 0.0001) {
      return scoreDiff;
    }

    return compareByDateAsc(a.deadline ?? a.start_date, b.deadline ?? b.start_date);
  });
}
