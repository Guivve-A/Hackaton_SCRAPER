import axios from "axios";
import * as cheerio from "cheerio";
import { endOfDay, isValid, parse, startOfDay } from "date-fns";

import type { Hackathon } from "@/types/hackathon";

export type EventbriteRegion =
  | "online"
  | "united-states"
  | "canada"
  | "united-kingdom"
  | "spain"
  | "france"
  | "italy"
  | "netherlands"
  | "germany"
  | "india"
  | "mexico"
  | "brazil"
  | "argentina"
  | "colombia"
  | "chile";

const EVENTBRITE_REGION_PATHS: Record<EventbriteRegion, string> = {
  online: "online",
  "united-states": "united-states",
  canada: "canada",
  "united-kingdom": "united-kingdom",
  spain: "spain",
  france: "france",
  italy: "italy",
  netherlands: "netherlands",
  germany: "germany",
  india: "india",
  mexico: "mexico",
  brazil: "brazil",
  argentina: "argentina",
  colombia: "colombia",
  chile: "chile",
};

const PRIMARY_SEARCH_TERM = "hackathon";
const EXTRA_ONLINE_SEARCH_TERMS = [
  "buildathon",
  "ai-challenge",
  "datathon",
  "code-jam",
] as const;

const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (compatible; HackFinder/1.0)";
const EVENT_KEYWORDS =
  /\b(hack(?:athon|fest|day)?|buildathon|datathon|code\s*jam|codeathon|ai\s*challenge|innovation\s*challenge|coding\s*challenge|machine\s*learning\s*challenge)\b/i;
const ONLINE_KEYWORDS = /\b(online|virtual|remote|hybrid|worldwide|global)\b/i;

type EventbriteImage = {
  url?: string;
};

type EventbriteAddress = {
  localized_area_display?: string;
  city?: string;
  addressRegion?: string;
};

type EventbriteVenue = {
  name?: string;
  address?: EventbriteAddress;
};

type EventbriteServerEvent = {
  id?: string;
  name?: string;
  summary?: string;
  full_description?: string;
  url?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  is_online_event?: boolean;
  image?: EventbriteImage;
  primary_venue?: EventbriteVenue;
};

type EventbriteServerData = {
  search_data?: {
    events?: {
      results?: EventbriteServerEvent[];
    };
  };
};

type JsonLdEvent = {
  name?: string;
  description?: string;
  url?: string;
  image?: string;
  startDate?: string;
  endDate?: string;
  eventAttendanceMode?: string;
  location?: {
    name?: string;
    address?: {
      addressLocality?: string;
    };
  };
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

function toAbsoluteUrl(url: string | undefined | null): string | null {
  const cleaned = cleanText(url);
  if (!cleaned) {
    return null;
  }

  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  if (cleaned.startsWith("/")) {
    return `https://www.eventbrite.com${cleaned}`;
  }

  return cleaned;
}

function parseDate(datePart: string | undefined, timePart: string | undefined): string | null {
  if (!datePart) {
    return null;
  }

  const dateOnly = cleanText(datePart);
  const timeOnly = cleanText(timePart);

  if (!dateOnly) {
    return null;
  }

  if (timeOnly) {
    const withTime = parse(`${dateOnly} ${timeOnly}`, "yyyy-MM-dd HH:mm", new Date());
    if (isValid(withTime)) {
      return withTime.toISOString();
    }
  }

  const day = parse(dateOnly, "yyyy-MM-dd", new Date());
  if (isValid(day)) {
    return startOfDay(day).toISOString();
  }

  return null;
}

function parseEndDate(datePart: string | undefined, timePart: string | undefined): string | null {
  if (!datePart) {
    return null;
  }

  const dateOnly = cleanText(datePart);
  const timeOnly = cleanText(timePart);

  if (!dateOnly) {
    return null;
  }

  if (timeOnly) {
    const withTime = parse(`${dateOnly} ${timeOnly}`, "yyyy-MM-dd HH:mm", new Date());
    if (isValid(withTime)) {
      return withTime.toISOString();
    }
  }

  const day = parse(dateOnly, "yyyy-MM-dd", new Date());
  if (isValid(day)) {
    return endOfDay(day).toISOString();
  }

  return null;
}

function isHackathonCandidate(title: string | null, summary: string | null): boolean {
  const haystack = `${title ?? ""} ${summary ?? ""}`;
  return EVENT_KEYWORDS.test(haystack);
}

function isOnlineCandidate(text: string): boolean {
  return ONLINE_KEYWORDS.test(text);
}

function extractServerDataEvents(html: string): EventbriteServerEvent[] {
  const $ = cheerio.load(html);
  const scriptContent = $("script")
    .toArray()
    .map((script) => $(script).html() ?? "")
    .find((content) => content.includes("window.__SERVER_DATA__"));

  if (!scriptContent) {
    return [];
  }

  const withReactState = scriptContent.match(
    /window\.__SERVER_DATA__\s*=\s*(\{[\s\S]*?\});\s*window\.__REACT_QUERY_STATE__/
  );
  const basic = scriptContent.match(/window\.__SERVER_DATA__\s*=\s*(\{[\s\S]*?\});/);
  const payload = withReactState?.[1] ?? basic?.[1];

  if (!payload) {
    return [];
  }

  const parsed = JSON.parse(payload) as EventbriteServerData;
  return parsed?.search_data?.events?.results ?? [];
}

function extractJsonLdEvents(html: string): JsonLdEvent[] {
  const $ = cheerio.load(html);
  const result: JsonLdEvent[] = [];

  $("script[type='application/ld+json']").each((_, script) => {
    const content = $(script).html();
    if (!content) {
      return;
    }

    try {
      const parsed = JSON.parse(content) as
        | { itemListElement?: Array<{ item?: JsonLdEvent }> }
        | Array<{ itemListElement?: Array<{ item?: JsonLdEvent }> }>;

      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of candidates) {
        const items = entry.itemListElement ?? [];
        for (const item of items) {
          if (item.item) {
            result.push(item.item);
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks from third-party scripts.
    }
  });

  return result;
}

function mapServerEvent(event: EventbriteServerEvent): Partial<Hackathon> | null {
  const title = cleanText(event.name);
  const summary = cleanText(event.summary) ?? cleanText(event.full_description);

  if (!isHackathonCandidate(title, summary)) {
    return null;
  }

  const url = toAbsoluteUrl(event.url);
  if (!title || !url) {
    return null;
  }

  const startDate = parseDate(event.start_date, event.start_time);
  const endDate = parseEndDate(event.end_date, event.end_time);
  const venueText = cleanText(event.primary_venue?.name) ?? "";
  const regionText =
    cleanText(event.primary_venue?.address?.localized_area_display) ??
    cleanText(event.primary_venue?.address?.city) ??
    cleanText(event.primary_venue?.address?.addressRegion) ??
    "";
  const combined = `${title ?? ""} ${summary ?? ""} ${venueText} ${regionText}`;

  const onlineLike = Boolean(event.is_online_event) || isOnlineCandidate(combined);
  if (!onlineLike) {
    return null;
  }

  const location = /hybrid/i.test(combined) ? "Online / Hybrid" : "Online";

  const mapped: Partial<Hackathon> = {
    title,
    url,
    platform: "eventbrite",
    start_date: startDate,
    end_date: endDate,
    deadline: startDate,
    location,
    is_online: true,
    image_url: cleanText(event.image?.url),
    organizer: null,
    tags: [/hybrid/i.test(combined) ? "hybrid" : "online"],
  };

  if (summary) {
    mapped.description = summary;
  }

  return mapped;
}

function mapJsonLdEvent(event: JsonLdEvent): Partial<Hackathon> | null {
  const title = cleanText(event.name);
  const description = cleanText(event.description);

  if (!isHackathonCandidate(title, description)) {
    return null;
  }

  const url = toAbsoluteUrl(event.url);
  if (!title || !url) {
    return null;
  }

  const startDate = cleanText(event.startDate);
  const endDate = cleanText(event.endDate);
  const attendanceMode = cleanText(event.eventAttendanceMode) ?? "";
  const locationText =
    cleanText(event.location?.address?.addressLocality) ?? cleanText(event.location?.name) ?? "";
  const onlineLike =
    /OnlineEventAttendanceMode|MixedEventAttendanceMode/i.test(attendanceMode) ||
    isOnlineCandidate(`${title ?? ""} ${description ?? ""} ${locationText}`);

  if (!onlineLike) {
    return null;
  }

  const location = /MixedEventAttendanceMode|hybrid/i.test(attendanceMode)
    ? "Online / Hybrid"
    : "Online";

  const mapped: Partial<Hackathon> = {
    title,
    url,
    platform: "eventbrite",
    start_date: startDate,
    end_date: endDate,
    deadline: startDate,
    location,
    is_online: true,
    image_url: cleanText(event.image),
    organizer: null,
    tags: [location === "Online / Hybrid" ? "hybrid" : "online"],
  };

  if (description) {
    mapped.description = description;
  }

  return mapped;
}

function dedupeByUrl(items: Partial<Hackathon>[]): Partial<Hackathon>[] {
  const map = new Map<string, Partial<Hackathon>>();

  for (const item of items) {
    if (!item.url) {
      continue;
    }

    if (!map.has(item.url)) {
      map.set(item.url, item);
      continue;
    }

    const current = map.get(item.url)!;
    map.set(item.url, {
      ...current,
      ...item,
      tags: Array.from(new Set([...(current.tags ?? []), ...(item.tags ?? [])])),
    });
  }

  return Array.from(map.values());
}

function buildSearchUrls(region: EventbriteRegion): string[] {
  const regionPath = EVENTBRITE_REGION_PATHS[region];
  const terms =
    region === "online"
      ? [PRIMARY_SEARCH_TERM, ...EXTRA_ONLINE_SEARCH_TERMS]
      : [PRIMARY_SEARCH_TERM];

  return terms.map(
    (term) => `https://www.eventbrite.com/d/${regionPath}/${term}/`
  );
}

export async function scrapeEventbrite(
  region: EventbriteRegion
): Promise<Partial<Hackathon>[]> {
  const targetUrls = buildSearchUrls(region);
  const settled = await Promise.allSettled(
    targetUrls.map((url) =>
      http.get<string>(url, {
        responseType: "text",
      })
    )
  );

  const fromAllPages: Partial<Hackathon>[] = [];

  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : "Unknown Eventbrite page error";
      console.warn(
        `[scrapers][eventbrite:${region}] Failed ${targetUrls[index]}: ${message}`
      );
      return;
    }

    const html = result.value.data;
    const fromServerData = extractServerDataEvents(html)
      .map(mapServerEvent)
      .filter((item): item is Partial<Hackathon> => item !== null);

    const fromJsonLd = extractJsonLdEvents(html)
      .map(mapJsonLdEvent)
      .filter((item): item is Partial<Hackathon> => item !== null);

    fromAllPages.push(...fromServerData, ...fromJsonLd);
  });

  const merged = dedupeByUrl(fromAllPages);
  console.info(
    `[scrapers][eventbrite:${region}] Parsed ${merged.length} online/hybrid events from ${targetUrls.length} search pages.`
  );

  return merged;
}
