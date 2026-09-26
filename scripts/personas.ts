/**
 * Builds a review report of what Reinvent:Match recommends to each test persona (test/personas/*.json): pre-list
 * size, what is hidden and why, the first cards of each tab with their reasons, a week filled the way the app fills
 * it (❤️ on every card that fits, tab by tab), and automatic red flags. Reviewers use it to find recommendations
 * that are wrong for a persona.
 *
 *   npm run personas -- [--event reinvent2026] [--out ~/.rematch/reports/personas-reinvent2026.html]
 *
 * The report holds catalog data, so it is written outside the repository by default.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { loadCatalog } from "../src/catalog/cache.js";
import { normalizeSession } from "../src/catalog/normalize.js";
import { answersSchema, type Answers } from "../src/plan/answers.js";
import { buildPlan, type Plan, type PlanItem } from "../src/plan/plan.js";
import { rematchHome } from "../src/paths.js";
import { buildQueue } from "../web/src/queue.js";
import { distinctSessions, settledSessions } from "../web/src/repeats.js";
import type { PlanItem as WebPlanItem, SwipeLog } from "../web/src/types.js";
import { buildWeek } from "../web/src/week.js";

const INTENTS = ["reinforce", "broaden", "learn"] as const;
const TOP = 10;
const FLAG_WINDOW = 20;
const LEVELS = ["100", "200", "300", "400"];

interface Persona {
  id: string;
  name: string;
  description: string;
  expectations: string[];
  answers: Answers;
}

interface Flag {
  severity: "high" | "medium" | "info";
  text: string;
}

const { values } = parseArgs({
  options: { event: { type: "string", default: "reinvent2026" }, out: { type: "string" } },
});
const eventId = values.event!;
const out = values.out ?? join(rematchHome(), "reports", `personas-${eventId}.html`);

const personaDir = join(import.meta.dirname, "..", "test", "personas");
const personas: Persona[] = readdirSync(personaDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => {
    const raw = JSON.parse(readFileSync(join(personaDir, f), "utf8"));
    return { id: f.replace(/\.json$/, ""), ...raw, answers: answersSchema.parse(raw.answers) };
  });

const catalog = await loadCatalog(eventId);
if (!catalog) {
  console.error(`No catalog for ${eventId}. Download it in the app first.`);
  process.exit(1);
}
const sessions = catalog.sessions.map(normalizeSession);

/** A tab's cards as the app deals them: one card per session, whatever its repeats. */
const tabOf = (plan: Plan, intent: string) =>
  distinctSessions(plan.results.filter((r) => r.intent === intent) as unknown as WebPlanItem[]) as unknown as PlanItem[];

const levelOf = (item: PlanItem) => item.session.levelLabel?.match(/^\d00/)?.[0] ?? "none";
const isAi = (item: PlanItem) => item.keys.includes("domain:ai");

/** Fills the week the way the app does: ❤️ on the first card that fits, tab by tab, until nothing else fits. */
function autoAgenda(plan: Plan): PlanItem[] {
  const results = plan.results as unknown as WebPlanItem[];
  const log: SwipeLog = {};
  const picked: PlanItem[] = [];
  for (const intent of INTENTS) {
    const tab = results.filter((r) => r.intent === intent);
    for (let i = 0; i < 80; i++) {
      const week = buildWeek(results, log);
      const queue = buildQueue(tab, log, week, false, settledSessions(results, log));
      if (queue.stage !== "fill") break;
      const next = queue.queue.find((r) => r.session.schedule.date && r.session.schedule.startTime);
      if (!next) break;
      log[next.session.id] = { decision: "like", at: new Date().toISOString() };
      picked.push(next as unknown as PlanItem);
    }
  }
  return picked.sort((a, b) =>
    `${a.session.schedule.date}${a.session.schedule.startTime}`.localeCompare(
      `${b.session.schedule.date}${b.session.schedule.startTime}`,
    ),
  );
}

function flagsFor(persona: Persona, plan: Plan, agenda: PlanItem[]): Flag[] {
  const flags: Flag[] = [];
  const topics = persona.answers.topics;
  const allNew = topics.every((t) => t.level === "new");
  const aiTopic = topics.find((t) => t.key === "domain:ai");
  for (const intent of INTENTS) {
    const top = tabOf(plan, intent).slice(0, FLAG_WINDOW);
    if (top.length === 0) continue;
    if (allNew) {
      const deep = top.filter((r) => ["300", "400"].includes(levelOf(r)));
      if (deep.length > 0)
        flags.push({
          severity: "high",
          text: `${intent}: ${deep.length} of the first ${top.length} cards are 300+ for someone new to everything (${deep.map((r) => r.session.code).join(", ")}).`,
        });
    }
    if (intent === "reinforce") {
      const basicForAdvanced = top.filter(
        (r) => ["100", "200"].includes(levelOf(r)) && r.reasons.some((x) => x.about === "match" && /you are Advanced/.test(x.text)),
      );
      if (basicForAdvanced.length > 0)
        flags.push({
          severity: "medium",
          text: `reinforce: ${basicForAdvanced.length} entry-level cards on a topic marked Advanced (${basicForAdvanced.map((r) => r.session.code).join(", ")}).`,
        });
    }
    const ai = top.filter(isAi).length;
    // AI filling Learn is expected when AI is the topic the persona wants to learn.
    const aiUnexpected = !aiTopic || (aiTopic.level === "new" && intent !== "learn");
    if (aiUnexpected && ai / top.length > 0.4)
      flags.push({
        severity: "medium",
        text: `${intent}: ${ai} of the first ${top.length} cards are AI sessions though AI is ${aiTopic ? "new to this persona" : "not among their topics"}.`,
      });
    const sponsored = top.slice(0, TOP).filter((r) => r.session.isSponsored);
    if (sponsored.length > 2)
      flags.push({ severity: "info", text: `${intent}: ${sponsored.length} sponsored sessions in the first ${TOP} cards.` });
  }
  const reinforce = plan.results.filter((r) => r.intent === "reinforce").length;
  if (!allNew && reinforce < 15)
    flags.push({ severity: "high", text: `Only ${reinforce} Reinforce sessions for topics the persona already knows.` });
  const learn = plan.results.filter((r) => r.intent === "learn").length;
  if (topics.some((t) => t.level === "new") && learn < 10)
    flags.push({ severity: "medium", text: `Only ${learn} Learn sessions though the persona marked topics as new.` });
  if (distinctSessions(agenda as unknown as WebPlanItem[]).length < agenda.length)
    flags.push({ severity: "high", text: "The auto-filled week picks the same session twice." });
  const perDay = countBy(agenda, (r) => r.session.schedule.date ?? "TBA");
  const thinDays = Object.entries(perDay).filter(([, n]) => n < 3);
  if (thinDays.length > 0)
    flags.push({ severity: "info", text: `Thin days in the auto-filled week: ${thinDays.map(([d, n]) => `${d} (${n})`).join(", ")}.` });
  return flags;
}

function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function sessionRow(r: PlanItem): string {
  const reasons = r.reasons.filter((x) => ["match", "level", "ai"].includes(x.about ?? "")).map((x) => esc(x.text));
  return `<tr><td class="code">${esc(r.session.code)}</td><td>${esc(r.session.title)}<div class="why">${reasons.join("<br>")}</div></td><td>${levelOf(r)}</td><td>${esc(r.session.formatLabel ?? r.session.format)}</td><td class="num">${r.score}%</td></tr>`;
}

const sections: string[] = [];
const summary: string[] = [];
for (const persona of personas) {
  const plan = buildPlan(sessions, persona.answers);
  const agenda = autoAgenda(plan);
  const flags = flagsFor(persona, plan, agenda);
  const byIntent = countBy(plan.results, (r) => r.intent);
  const hidden = Object.entries(plan.hidden).filter(([, n]) => n > 0);
  const levelMix = countBy(plan.results.slice(0, 60), levelOf);
  summary.push(
    `<tr><td><a href="#${persona.id}">${esc(persona.name)}</a></td><td class="num">${plan.results.length}</td>${INTENTS.map((i) => `<td class="num">${byIntent[i] ?? 0}</td>`).join("")}<td class="num">${agenda.length}</td><td class="num">${flags.filter((f) => f.severity !== "info").length}</td></tr>`,
  );
  const topics = persona.answers.topics.map((t) => `${t.key.replace("domain:", "")} (${t.level})`).join(", ");
  sections.push(`
<section id="${persona.id}">
  <h2>${esc(persona.name)}</h2>
  <p>${esc(persona.description)}</p>
  <p class="meta"><strong>Topics:</strong> ${esc(topics)}<br><strong>Formats:</strong> ${persona.answers.formats.join(", ")} · <strong>Platforms left out:</strong> ${persona.answers.ignore.join(", ") || "none"}</p>
  <div class="cols">
    <div><h3>A reviewer should see</h3><ul>${persona.expectations.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>
    <div><h3>Automatic flags</h3>${flags.length ? `<ul class="flags">${flags.map((f) => `<li class="${f.severity}"><span>${f.severity}</span> ${esc(f.text)}</li>`).join("")}</ul>` : "<p>None.</p>"}</div>
  </div>
  <p class="meta"><strong>Pre-list:</strong> ${plan.results.length} sessions · ${INTENTS.map((i) => `${i} ${byIntent[i] ?? 0}`).join(" · ")}<br><strong>Hidden:</strong> ${hidden.map(([k, n]) => `${n} ${k}`).join(" · ") || "none"}<br><strong>Levels in the first 60:</strong> ${LEVELS.map((l) => `${l}: ${levelMix[l] ?? 0}`).join(" · ")}</p>
  ${INTENTS.map((i) => {
    const top = tabOf(plan, i).slice(0, TOP);
    return top.length ? `<h3>First ${top.length} cards in ${i}</h3><table><thead><tr><th>Code</th><th>Session and why</th><th>Level</th><th>Format</th><th>Score</th></tr></thead><tbody>${top.map(sessionRow).join("")}</tbody></table>` : `<h3>${i}</h3><p>No sessions.</p>`;
  }).join("")}
  <h3>Auto-filled week (${agenda.length} sessions)</h3>
  <table><thead><tr><th>When</th><th>Session</th><th>Tab</th><th>Level</th></tr></thead><tbody>${agenda
    .map((r) => `<tr><td class="code">${r.session.schedule.date?.slice(5)} ${r.session.schedule.startTime}</td><td>${esc(r.session.code)} · ${esc(r.session.title)}</td><td>${r.intent}</td><td>${levelOf(r)}</td></tr>`)
    .join("")}</tbody></table>
</section>`);
  console.log(`${persona.name}: ${plan.results.length} in pre-list, ${agenda.length} in the week, ${flags.length} flags`);
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Persona review</title>
<style>
:root { --bg:#f6f7fb; --surface:#fff; --text:#16181d; --muted:#5d6474; --border:#dfe3ec; --high:#b3261e; --medium:#b25e00; --info:#2f6fbf; }
@media (prefers-color-scheme: dark) { :root { --bg:#0f1116; --surface:#171a21; --text:#eef0f5; --muted:#9aa2b3; --border:#2b303b; --high:#ff7b6b; --medium:#f0a44b; --info:#6aa8ff; } }
body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, sans-serif; }
main { max-width:1100px; margin:0 auto; padding:24px 16px 64px; }
section { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:16px 20px; margin:20px 0; }
table { width:100%; border-collapse:collapse; margin:8px 0 16px; font-size:14px; }
th, td { text-align:left; vertical-align:top; padding:6px 8px; border-bottom:1px solid var(--border); }
th { color:var(--muted); font-weight:600; }
.num { text-align:right; font-variant-numeric:tabular-nums; }
.code { white-space:nowrap; font-variant-numeric:tabular-nums; }
.why, .meta { color:var(--muted); font-size:13px; }
.cols { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; }
.flags { list-style:none; padding:0; }
.flags li { margin:4px 0; }
.flags span { display:inline-block; min-width:4.5em; font-size:12px; font-weight:700; text-transform:uppercase; }
.flags .high span { color:var(--high); } .flags .medium span { color:var(--medium); } .flags .info span { color:var(--info); }
</style></head>
<body><main>
<h1>Persona review · ${esc(eventId)}</h1>
<p class="meta">Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC from ${sessions.length} sessions. For each persona: what a reviewer should expect, automatic flags, the first cards of each tab and a week filled the way the app fills it. Look for sessions that are wrong for the persona, missing ones, and reasons that don't hold.</p>
<table><thead><tr><th>Persona</th><th class="num">Pre-list</th><th class="num">Reinforce</th><th class="num">Broaden</th><th class="num">Learn</th><th class="num">Week</th><th class="num">Flags</th></tr></thead><tbody>${summary.join("")}</tbody></table>
${sections.join("\n")}
</main></body></html>`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`\nReport: ${out}`);
