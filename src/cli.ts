#!/usr/bin/env node
import { parseArgs } from "node:util";
import { EventsApiError, EventsClient } from "./api/client.js";
import { loadCatalog, saveCatalog } from "./catalog/cache.js";
import { normalizeSession, type NormalizedSession } from "./catalog/normalize.js";
import { CATEGORIES, matchSessions, type Category, type MatchResult } from "./match/engine.js";
import { loadProfile } from "./profile/profile.js";

const HELP = `rematch - person-to-session matching for AWS events (unofficial)

Usage:
  rematch events                          List ongoing and upcoming AWS events
  rematch fetch <eventId> [--locale en-US] Download an event catalog into .rematch/cache
  rematch vocab <eventId> [--field tags]   Show catalog labels to use in your profile
  rematch match <eventId> --profile <file> [options]

Match options:
  --profile, -p <file>     Profile JSON (see examples/profile.example.json)
  --category, -c <list>    Comma-separated: ${CATEGORIES.join(",")}
  --top, -n <number>       Sessions per category (default 10)
  --explain, -e            Show the reasons behind each match
  --json                   Print results as JSON
`;

const CATEGORY_LABELS: Record<Category, string> = {
  "deep-dive": "🔥 Deep Dive",
  growth: "🚀 Growth",
  foundation: "📚 Foundation",
  discovery: "🧭 Discovery",
  skip: "⏭️  Skip",
};

const REASON_ICONS = { pro: "✅", con: "⚠️ ", info: "ℹ️ " } as const;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      profile: { type: "string", short: "p" },
      category: { type: "string", short: "c" },
      top: { type: "string", short: "n" },
      explain: { type: "boolean", short: "e" },
      json: { type: "boolean" },
      locale: { type: "string" },
      field: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, eventId] = positionals;
  if (!command || values.help) {
    process.stdout.write(HELP);
    return command ? 0 : 1;
  }

  const client = new EventsClient({ getAccessToken: async () => process.env.REMATCH_ACCESS_TOKEN });

  switch (command) {
    case "events": {
      const events = await client.listEvents();
      for (const e of events) {
        const access = e.authenticationRequired ? "sign-in + registration" : "public";
        console.log(`${e.eventId.padEnd(36)} ${e.startDate.slice(0, 10)}  ${e.name}  [${access}]`);
      }
      return 0;
    }
    case "fetch": {
      requireEvent(eventId);
      const locale = values.locale ?? "en-US";
      const sessions = await client.listAllSessions(eventId, {
        locale,
        onPage: (fetched, total) => process.stderr.write(`\rFetched ${fetched}/${total} sessions`),
      });
      process.stderr.write("\n");
      const path = await saveCatalog({ eventId, fetchedAt: new Date().toISOString(), locale, sessions });
      console.log(`Saved ${sessions.length} sessions to ${path}`);
      return 0;
    }
    case "vocab": {
      requireEvent(eventId);
      const sessions = await catalogSessions(eventId);
      const field = values.field ?? "tags";
      const counts = new Map<string, number>();
      for (const s of sessions) {
        const labels = field === "tags" ? s.tags : field === "services" ? s.services : field === "topics" ? s.topics : null;
        if (!labels) throw new Error(`Unknown --field ${field}; use tags, services or topics.`);
        for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      for (const [label, count] of [...counts].sort((a, b) => b[1] - a[1])) {
        console.log(`${String(count).padStart(5)}  ${label}`);
      }
      return 0;
    }
    case "match": {
      requireEvent(eventId);
      if (!values.profile) throw new Error("--profile is required.");
      const [profile, sessions] = await Promise.all([loadProfile(values.profile), catalogSessions(eventId)]);
      const categories = parseCategories(values.category);
      const top = values.top ? Number(values.top) : 10;
      const results = matchSessions(sessions, profile).filter((r) => !r.unrelated && categories.includes(r.category));

      if (values.json) {
        console.log(JSON.stringify(results.map(toJson), null, 2));
        return 0;
      }
      printSummary(results);
      for (const category of categories) {
        const inCategory = results.filter((r) => r.category === category);
        if (inCategory.length === 0) continue;
        console.log(`\n${CATEGORY_LABELS[category]} (${inCategory.length})`);
        for (const r of inCategory.slice(0, top)) printResult(r, values.explain ?? false);
      }
      return 0;
    }
    default:
      process.stderr.write(`Unknown command "${command}".\n\n${HELP}`);
      return 1;
  }
}

function requireEvent(eventId: string | undefined): asserts eventId is string {
  if (!eventId) throw new Error("An eventId is required. Run `rematch events` to list them.");
}

async function catalogSessions(eventId: string): Promise<NormalizedSession[]> {
  const catalog = await loadCatalog(eventId);
  if (!catalog) throw new Error(`No cached catalog for ${eventId}. Run \`rematch fetch ${eventId}\` first.`);
  return catalog.sessions.map(normalizeSession);
}

function parseCategories(value: string | undefined): Category[] {
  if (!value) return CATEGORIES.filter((c) => c !== "skip");
  const requested = value.split(",").map((c) => c.trim());
  const invalid = requested.filter((c) => !(CATEGORIES as readonly string[]).includes(c));
  if (invalid.length > 0) throw new Error(`Unknown categories: ${invalid.join(", ")}.`);
  return requested as Category[];
}

function printSummary(results: MatchResult[]): void {
  const counts = CATEGORIES.map((c) => `${CATEGORY_LABELS[c]} ${results.filter((r) => r.category === c).length}`);
  console.log(counts.join("   "));
}

function printResult(r: MatchResult, explain: boolean): void {
  const s = r.session;
  const when = [s.schedule.date, s.schedule.startTime].filter(Boolean).join(" ");
  const where = [s.schedule.venue, s.schedule.room].filter(Boolean).join(", ");
  console.log(`  ${String(r.score).padStart(3)}%  ${s.code.padEnd(10)} ${s.title}`);
  console.log(`        ${[s.formatLabel, s.levelLabel, when, where].filter(Boolean).join(" · ")}`);
  if (explain) {
    for (const reason of r.reasons) console.log(`        ${REASON_ICONS[reason.kind]} ${reason.text}`);
  }
}

function toJson(r: MatchResult) {
  return {
    id: r.session.id,
    code: r.session.code,
    title: r.session.title,
    category: r.category,
    score: r.score,
    components: r.components,
    reasons: r.reasons,
    format: r.session.format,
    level: r.session.levelLabel,
    schedule: r.session.schedule,
  };
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    if (error instanceof EventsApiError && (error.status === 401 || error.status === 403)) {
      console.error(`${error.message}\nThis event requires sign-in as a registered attendee (\`rematch login\` is coming next).`);
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exit(1);
  },
);
