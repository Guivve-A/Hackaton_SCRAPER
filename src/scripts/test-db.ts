import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());

  const { getHackathonById, upsertHackathon } = await import("../lib/db/queries");

  const suffix = Date.now();
  const testUrl = `https://example.com/hackathon/test-${suffix}`;

  const inserted = await upsertHackathon({
    title: `DB Connection Test ${suffix}`,
    description: "Temporary test record for Supabase connectivity validation.",
    url: testUrl,
    platform: "devpost",
    is_online: true,
    tags: ["test", "db"],
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    location: "Online",
  });

  console.log("Inserted row:", inserted);

  const numericId = Number(inserted.id);
  if (!Number.isFinite(numericId)) {
    throw new Error(`Inserted id is not numeric: ${inserted.id}`);
  }

  const fetched = await getHackathonById(numericId);
  console.log("Fetched row:", fetched);
}

main().catch((error: unknown) => {
  console.error("Database test failed:", error);
  process.exit(1);
});
