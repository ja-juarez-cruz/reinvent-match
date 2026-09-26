import type { PlanItem, SwipeLog } from "./types";

/**
 * The code a session keeps across its repeats: re:Invent offers popular sessions more than once as "-R", "-R1",
 * "-R2" (SVS335-R and SVS335-R1 are the same session at two times).
 */
export function baseCode(code: string): string {
  return code.replace(/-R\d*$/, "");
}

/** "AWS Jam: All-in Builder Showdown - brought to you by X" → "aws jam all in builder showdown". */
function normalizedTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+[-–—]\s+(brought to you by|presented by|sponsored by)\b.*$/, "")
    .replace(/\((repeat|encore)\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * One key per session, shared by all its times. Times are found two ways: the repeat code ("-R", "-R1"), and, for
 * repeats the catalog codes separately (a sponsored run of a Jam, GHJ311 and GHJ317-S), the same track, format and
 * title once a sponsor suffix is dropped. The format has to match: a breakout and a chalk talk with one title are
 * different sessions.
 */
export function sessionKeys(items: PlanItem[]): Map<string, string> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(x, root);
    return root;
  };
  const firstBy = new Map<string, string>();
  for (const item of items) {
    const id = item.session.id;
    parent.set(id, id);
    const track = item.session.code.match(/^[A-Z]+/)?.[0] ?? "";
    for (const key of [
      `code|${baseCode(item.session.code)}`,
      `title|${track}|${item.session.format}|${normalizedTitle(item.session.title)}`,
    ]) {
      const first = firstBy.get(key);
      if (first) parent.set(find(id), find(first));
      else firstBy.set(key, id);
    }
  }
  return new Map(items.map((i) => [i.session.id, find(i.session.id)]));
}

/** Every session with its other times (the session itself excluded). */
export function repeatsOf(items: PlanItem[]): Map<string, PlanItem[]> {
  const keys = sessionKeys(items);
  const byKey = new Map<string, PlanItem[]>();
  for (const item of items) {
    const key = keys.get(item.session.id)!;
    byKey.set(key, [...(byKey.get(key) ?? []), item]);
  }
  const repeats = new Map<string, PlanItem[]>();
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    for (const item of group)
      repeats.set(
        item.session.id,
        group.filter((o) => o !== item),
      );
  }
  return repeats;
}

export interface Settled {
  decision: "like" | "pass";
  /** The time that carries the decision. */
  by: PlanItem;
}

/**
 * Sessions already settled, by id of every time: one of their times is ❤️ (picked, see `by`) or ❌. A 🔖 maybe
 * leaves them open, since another time may fit better.
 */
export function settledSessions(items: PlanItem[], swipes: SwipeLog): Map<string, Settled> {
  const keys = sessionKeys(items);
  const byKey = new Map<string, Settled>();
  for (const item of items) {
    const decision = swipes[item.session.id]?.decision;
    if (decision !== "like" && decision !== "pass") continue;
    const key = keys.get(item.session.id)!;
    // A pick wins over a pass at another time.
    if (!byKey.has(key) || decision === "like") byKey.set(key, { decision, by: item });
  }
  const settled = new Map<string, Settled>();
  for (const item of items) {
    const s = byKey.get(keys.get(item.session.id)!);
    if (s) settled.set(item.session.id, s);
  }
  return settled;
}

/** One entry per session: when more than one time of a session is ❤️, only the first counts. */
export function distinctSessions(items: PlanItem[]): PlanItem[] {
  const keys = sessionKeys(items);
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keys.get(item.session.id)!;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface Series {
  /** The shared title prefix: "re:Architecture Rodeo". */
  name: string;
  /** The other sessions of the series (different content, not repeats). */
  others: PlanItem[];
}

function seriesKey(item: PlanItem): { key: string; name: string } | null {
  const name = item.session.title.match(/^(.{6,60}?):\s/)?.[1]?.trim();
  const track = item.session.code.match(/^[A-Z]+/)?.[0];
  return name && track ? { key: `${track}|${name.toLowerCase()}`, name } : null;
}

/**
 * Different sessions sold as a series: same track prefix and same title before the colon ("re:Architecture Rodeo:
 * Designing Agentic AI Applications", "…: Building an AI-Ready Data Foundation"). They look alike in a swipe but
 * are not repeats. Titles that only happen to start alike across tracks do not count.
 */
export function seriesOf(items: PlanItem[]): Map<string, Series> {
  const sessions = sessionKeys(items);
  const groups = new Map<string, { name: string; items: Map<string, PlanItem> }>();
  for (const item of items) {
    const k = seriesKey(item);
    if (!k) continue;
    const group = groups.get(k.key) ?? { name: k.name, items: new Map() };
    const session = sessions.get(item.session.id)!;
    if (!group.items.has(session)) group.items.set(session, item);
    groups.set(k.key, group);
  }
  const series = new Map<string, Series>();
  for (const item of items) {
    const k = seriesKey(item);
    const group = k ? groups.get(k.key) : undefined;
    if (!group || group.items.size < 2) continue;
    const session = sessions.get(item.session.id)!;
    series.set(item.session.id, {
      name: group.name,
      others: [...group.items].filter(([s]) => s !== session).map(([, i]) => i),
    });
  }
  return series;
}
