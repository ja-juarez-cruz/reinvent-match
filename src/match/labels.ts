/**
 * Label normalization so profile entries such as "EKS" or "Amazon SQS" line up with catalog tags such as
 * "Amazon Elastic Kubernetes Service (Amazon EKS)" or "Amazon Simple Queue Service (Amazon SQS)".
 */

const VENDOR_PREFIX = /\b(amazon|aws)\s+/g;

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** All the names a label is known by: the full name and any parenthetical short name, without vendor prefixes. */
export function aliasesOf(label: string): string[] {
  const text = normalizeText(label);
  const aliases = new Set<string>();
  const parenthetical = [...text.matchAll(/\(([^)]+)\)/g)].map((m) => m[1] ?? "");
  const outer = text.replace(/\([^)]*\)/g, " ");
  for (const candidate of [outer, ...parenthetical]) {
    const cleaned = candidate.replace(VENDOR_PREFIX, "").replace(/\s+/g, " ").trim();
    if (cleaned) aliases.add(cleaned);
  }
  return [...aliases];
}

/** Aliases shorter than this only match exactly, so "eks" or "s3" never match inside another word. */
const MIN_CONTAINS_LENGTH = 4;

export function aliasMatches(profileAlias: string, tagAlias: string): boolean {
  if (profileAlias === tagAlias) return true;
  if (profileAlias.length < MIN_CONTAINS_LENGTH) return false;
  return new RegExp(`\\b${escapeRegExp(profileAlias)}\\b`).test(tagAlias);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary search that tolerates "multi-region" vs "multi region". */
const keywordPatterns = new Map<string, RegExp>();

export function textContains(normalizedText: string, keyword: string): boolean {
  let regex = keywordPatterns.get(keyword);
  if (!regex) {
    const pattern = escapeRegExp(normalizeText(keyword)).replace(/\\?[-\s]+/g, "[-\\s]?");
    regex = new RegExp(`(^|[^a-z0-9])${pattern}($|[^a-z0-9])`);
    keywordPatterns.set(keyword, regex);
  }
  return regex.test(normalizedText);
}
