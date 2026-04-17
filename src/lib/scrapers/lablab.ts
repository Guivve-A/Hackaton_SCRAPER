import axios from "axios";
import { isValid, parseISO } from "date-fns";

import type { Hackathon } from "@/types/hackathon";

const LABLAB_HACKATHONS_URL = "https://lablab.ai/ai-hackathons";
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (compatible; HackFinder/1.0)";
const ONLINE_TYPES = new Set(["ONLINE", "HYBRID"]);
const EXPIRED_GRACE_DAYS = 2;
const UPCOMING_FALLBACK_DAYS = 14;

type LablabTech = {
  name?: string | null;
};

type LablabEvent = {
  id?: string;
  name?: string | null;
  description?: string | null;
  slug?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  eventType?: string | null;
  signupActive?: boolean | null;
  toBeAnnounced?: boolean | null;
  imageLink?: string | null;
  thumbnailLink?: string | null;
  technologyList?: LablabTech[] | null;
  techs?: LablabTech[] | null;
};

const http = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "User-Agent": USER_AGENT,
  },
});

function cleanText(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function stripHtml(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  return cleanText(value.replace(/<[^>]*>/g, " "));
}

function parseIso(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return null;
  }

  return parsed.toISOString();
}

function toDate(value: string | undefined | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return null;
  }

  return parsed;
}

function extractSortedEventsPayload(html: string): string | null {
  const marker = "\"sortedEvents\":";
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const start = html.indexOf("[", markerIndex + marker.length);
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const char = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start, i + 1);
      }
    }
  }

  return null;
}

function isDescriptionReference(description: string | null): boolean {
  if (!description) {
    return false;
  }

  return /^\$\d+[a-z]?$/i.test(description);
}

function isOnlineEvent(eventType: string | null): boolean {
  if (!eventType) {
    return true;
  }

  return ONLINE_TYPES.has(eventType.toUpperCase());
}

function isLikelyCurrentOrUpcoming(event: LablabEvent): boolean {
  const nowMs = Date.now();
  const graceMs = EXPIRED_GRACE_DAYS * 24 * 60 * 60 * 1_000;
  const fallbackFutureMs = UPCOMING_FALLBACK_DAYS * 24 * 60 * 60 * 1_000;

  if (event.toBeAnnounced && event.signupActive) {
    return true;
  }

  const endDate = toDate(event.endAt);
  if (endDate) {
    return endDate.getTime() >= nowMs - graceMs;
  }

  const startDate = toDate(event.startAt);
  if (startDate) {
    return startDate.getTime() >= nowMs - fallbackFutureMs;
  }

  return Boolean(event.signupActive);
}

function extractTags(event: LablabEvent): string[] {
  const tags = new Set<string>();

  const eventType = cleanText(event.eventType)?.toLowerCase();
  if (eventType) {
    tags.add(eventType);
  }

  for (const tech of event.technologyList ?? []) {
    const name = cleanText(tech?.name);
    if (name) {
      tags.add(name);
    }
  }

  for (const tech of event.techs ?? []) {
    const name = cleanText(tech?.name);
    if (name) {
      tags.add(name);
    }
  }

  tags.add("AI");
  tags.add("online");

  return Array.from(tags);
}

function mapLablabEvent(event: LablabEvent): Partial<Hackathon> | null {
  const title = cleanText(event.name);
  const slug = cleanText(event.slug);

  if (!title || !slug) {
    return null;
  }

  const eventType = cleanText(event.eventType);
  if (!isOnlineEvent(eventType)) {
    return null;
  }

  const descriptionRaw = stripHtml(event.description);
  const description = isDescriptionReference(descriptionRaw)
    ? null
    : descriptionRaw;

  const startDate = parseIso(event.startAt);
  const endDate = parseIso(event.endAt);

  const mapped: Partial<Hackathon> = {
    title,
    description,
    url: `https://lablab.ai/ai-hackathons/${slug}`,
    platform: "lablab",
    start_date: startDate,
    end_date: endDate,
    deadline: endDate,
    location: eventType?.toUpperCase() === "HYBRID" ? "Online / Hybrid" : "Online",
    is_online: true,
    tags: extractTags(event),
    image_url: cleanText(event.thumbnailLink) ?? cleanText(event.imageLink),
    organizer: "lablab.ai",
  };

  return mapped;
}

export async function scrapeLablab(): Promise<Partial<Hackathon>[]> {
  const { data: html } = await http.get<string>(LABLAB_HACKATHONS_URL, {
    responseType: "text",
  });

  const payload = extractSortedEventsPayload(html);
  if (!payload) {
    throw new Error("Lablab payload missing sortedEvents array.");
  }

  let events: LablabEvent[];
  try {
    events = JSON.parse(payload) as LablabEvent[];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse Lablab sortedEvents payload: ${message}`);
  }

  const mapped = events
    .filter((event) => isLikelyCurrentOrUpcoming(event))
    .map(mapLablabEvent)
    .filter((item): item is Partial<Hackathon> => item !== null);

  const byUrl = new Map<string, Partial<Hackathon>>();
  for (const item of mapped) {
    if (!item.url || byUrl.has(item.url)) {
      continue;
    }
    byUrl.set(item.url, item);
  }

  console.info(
    `[scrapers][lablab] Parsed ${events.length} events, kept ${byUrl.size} online/hybrid hackathons.`
  );

  return Array.from(byUrl.values());
}
