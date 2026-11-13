import { alignOnPage } from "./align.js";
import { LocateError } from "./errors.js";
import { normalizeText } from "./normalize.js";
import type { PageIndex } from "./page-index.js";
import { rectsForSpan } from "./rects.js";
import type { LocateBest, LocateFound, LocateMethod, LocateNotFound, LocateOptions, LocateResult } from "./types.js";

export const DEFAULT_THRESHOLD = 0.85;
/** Quotes shorter than this (normalized) must match exactly; fuzzy matching would be guesswork. */
export const MIN_FUZZY_LENGTH = 12;
/** A later page replaces an earlier page's fuzzy match only when it scores clearly better. */
const PAGE_TIE_MARGIN = 0.02;

export interface PreparedQuery {
  /** Normalized quote. Empty when the quote has no content. */
  normalized: string;
  /** The quote as given, trimmed. */
  trimmed: string;
  caseSensitive: boolean;
  threshold: number;
  pageHint?: number;
  pages?: number[];
}

export function prepareQuery(quote: string, options: LocateOptions = {}): PreparedQuery {
  if (typeof quote !== "string") {
    throw new LocateError("INVALID_OPTIONS", "The quote must be a string.");
  }
  const { threshold = DEFAULT_THRESHOLD, caseSensitive = false, pageHint, pages } = options;
  if (typeof threshold !== "number" || !(threshold > 0 && threshold <= 1)) {
    throw new LocateError("INVALID_OPTIONS", `threshold must be a number in (0, 1], got ${String(threshold)}.`);
  }
  if (pageHint !== undefined && !(Number.isInteger(pageHint) && pageHint >= 1)) {
    throw new LocateError("INVALID_OPTIONS", `pageHint must be a 1-based page number, got ${String(pageHint)}.`);
  }
  if (pages !== undefined && !(Array.isArray(pages) && pages.every((p) => Number.isInteger(p) && p >= 1))) {
    throw new LocateError("INVALID_OPTIONS", "pages must be an array of 1-based page numbers.");
  }
  if (pages !== undefined && pages.length === 0) {
    throw new LocateError("INVALID_OPTIONS", "pages must contain at least one page number.");
  }
  return {
    normalized: normalizeText(quote, { caseSensitive }),
    trimmed: quote.trim(),
    caseSensitive,
    threshold,
    pageHint,
    pages,
  };
}

/** Page visiting order: the hint, then its neighbours, then the remaining pages ascending. */
export function pageOrder(available: number[], hint?: number, restrict?: number[]): number[] {
  let list = [...new Set(available)].sort((a, b) => a - b);
  if (restrict) {
    const allowed = new Set(restrict);
    list = list.filter((p) => allowed.has(p));
  }
  if (hint === undefined) return list;
  const first = [hint, hint + 1, hint - 1].filter((p) => list.includes(p));
  return [...first, ...list.filter((p) => !first.includes(p))];
}

interface Span {
  start: number;
  end: number;
  score: number;
  method: LocateMethod;
}

function compactOf(index: PageIndex, caseSensitive: boolean): { text: string; at: number[] } {
  index.cache.compact ??= new Map();
  let compact = index.cache.compact.get(caseSensitive);
  if (compact) return compact;
  const hay = caseSensitive ? index.cased : index.text;
  let text = "";
  const at: number[] = [];
  for (let i = 0; i < hay.length; i++) {
    if (hay[i] === " ") continue;
    text += hay[i];
    at.push(i);
  }
  compact = { text, at };
  index.cache.compact.set(caseSensitive, compact);
  return compact;
}

function trimSpan(hay: string, start: number, end: number): [number, number] {
  while (start < end && hay[start] === " ") start++;
  while (end > start && hay[end - 1] === " ") end--;
  return [start, end];
}

function displayText(index: PageIndex, start: number, end: number): string {
  return index.raw.slice(start, end).join("");
}

function isExact(index: PageIndex, query: PreparedQuery, start: number, end: number): boolean {
  for (let i = start; i < end; i++) if (index.lossy[i]) return false;
  return displayText(index, start, end) === query.trimmed;
}

/** Stage 1 (exact) and stage 2 (normalized, whitespace-insensitive) on one page. */
export function findExactOnPage(index: PageIndex, query: PreparedQuery): Span | null {
  if (query.normalized === "" || index.empty) return null;
  const hay = query.caseSensitive ? index.cased : index.text;
  const at = hay.indexOf(query.normalized);
  if (at >= 0) {
    const end = at + query.normalized.length;
    return { start: at, end, score: 1, method: isExact(index, query, at, end) ? "exact" : "normalized" };
  }
  const needle = query.normalized.replace(/ /g, "");
  if (needle === "") return null;
  const compact = compactOf(index, query.caseSensitive);
  const found = compact.text.indexOf(needle);
  if (found < 0) return null;
  const start = compact.at[found] as number;
  const end = (compact.at[found + needle.length - 1] as number) + 1;
  return { start, end, score: 1, method: "normalized" };
}

function toFound(index: PageIndex, span: Span): LocateFound {
  const { rects, approx } = rectsForSpan(index, span.start, span.end);
  return {
    found: true,
    page: index.page,
    score: span.score,
    method: span.method,
    matchedText: displayText(index, span.start, span.end),
    rects,
    approx,
  };
}

/** Result for a stage 1/2 hit on `index`, or null. */
export function exactResult(index: PageIndex, query: PreparedQuery): LocateFound | null {
  const span = findExactOnPage(index, query);
  return span ? toFound(index, span) : null;
}

/** Stage 3 over pages in visiting order: best approximate match, or the closest candidate. */
export function fuzzyResult(indexes: PageIndex[], query: PreparedQuery): LocateResult {
  const scanned = indexes.filter((i) => !i.empty);
  if (query.normalized === "") return { found: false, reason: "empty-quote" };
  if (scanned.length === 0) return { found: false, reason: "no-text-layer" };

  let best: { index: PageIndex; span: Span } | null = null;
  if (query.normalized.length >= MIN_FUZZY_LENGTH) {
    for (const index of scanned) {
      const hay = query.caseSensitive ? index.cased : index.text;
      // A page shorter than quote length x threshold cannot reach the threshold: skip the costly alignment.
      if (hay.length < query.normalized.length * query.threshold) continue;
      const a = alignOnPage(index, query.normalized, query.caseSensitive);
      if (!a) continue;
      const [start, end] = trimSpan(hay, a.start, a.end);
      if (start >= end) continue;
      const score = Math.max(0, 1 - a.distance / query.normalized.length);
      if (score <= 0) continue;
      if (best === null || score > best.span.score + PAGE_TIE_MARGIN) {
        best = { index, span: { start, end, score, method: "fuzzy" } };
      }
    }
  }
  if (best && best.span.score >= query.threshold) return toFound(best.index, best.span);
  const notFound: LocateNotFound = { found: false, reason: "below-threshold" };
  if (best) {
    const { index, span } = best;
    const candidate: LocateBest = {
      page: index.page,
      score: span.score,
      matchedText: displayText(index, span.start, span.end),
      rects: rectsForSpan(index, span.start, span.end).rects,
    };
    notFound.best = candidate;
  }
  return notFound;
}

/**
 * Synchronous search over already built page indexes (for example restored from a cache).
 * Order: exact / normalized match on the hinted page first, then neighbours and the rest;
 * only if no page matches textually, approximate alignment over all pages.
 */
export function locateInIndexes(indexes: PageIndex[], quote: string, options: LocateOptions = {}): LocateResult {
  if (!Array.isArray(indexes)) {
    throw new LocateError("INVALID_PAGE", "locateInIndexes expects an array of PageIndex objects from buildPageIndex().");
  }
  const query = prepareQuery(quote, options);
  if (query.normalized === "") return { found: false, reason: "empty-quote" };
  const byPage = new Map(indexes.map((i) => [i.page, i]));
  const ordered = pageOrder([...byPage.keys()], query.pageHint, query.pages).map((p) => byPage.get(p) as PageIndex);
  for (const index of ordered) {
    const hit = exactResult(index, query);
    if (hit) return hit;
  }
  return fuzzyResult(ordered, query);
}
