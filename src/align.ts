import type { PageIndex } from "./page-index.js";

export interface Alignment {
  /** Start offset in the searched text (inclusive). */
  start: number;
  /** End offset (exclusive). */
  end: number;
  /** Edit distance (substitutions, insertions, deletions each cost 1). */
  distance: number;
}

/**
 * Sellers' algorithm: the substring of `text[lo, hi)` with the smallest edit distance to
 * `pattern`, with start tracking so the match can be mapped back without a traceback matrix.
 * Cost O(pattern.length * (hi - lo)) time, O(hi - lo) memory.
 */
export function alignBest(pattern: string, text: string, lo = 0, hi = text.length): Alignment | null {
  const m = pattern.length;
  const n = hi - lo;
  if (m === 0 || n <= 0) return null;

  let prevCost = new Int32Array(n + 1); // row 0: matching may start anywhere for free
  let prevStart = new Int32Array(n + 1);
  let curCost = new Int32Array(n + 1);
  let curStart = new Int32Array(n + 1);
  for (let j = 0; j <= n; j++) prevStart[j] = j;

  for (let i = 1; i <= m; i++) {
    const pc = pattern.charCodeAt(i - 1);
    curCost[0] = i;
    curStart[0] = 0;
    for (let j = 1; j <= n; j++) {
      // Diagonal (match/substitute) wins ties so alignments stay compact.
      let cost = (prevCost[j - 1] as number) + (pc === text.charCodeAt(lo + j - 1) ? 0 : 1);
      let start = prevStart[j - 1] as number;
      const up = (prevCost[j] as number) + 1; // pattern char missing from text
      if (up < cost) {
        cost = up;
        start = prevStart[j] as number;
      }
      const left = (curCost[j - 1] as number) + 1; // extra char in text
      if (left < cost) {
        cost = left;
        start = curStart[j - 1] as number;
      }
      curCost[j] = cost;
      curStart[j] = start;
    }
    [prevCost, curCost] = [curCost, prevCost];
    [prevStart, curStart] = [curStart, prevStart];
  }

  let bestJ = 0;
  let bestCost = Infinity;
  for (let j = 0; j <= n; j++) {
    const c = prevCost[j] as number;
    if (c < bestCost) {
      bestCost = c;
      bestJ = j;
    }
  }
  return { start: lo + (prevStart[bestJ] as number), end: lo + bestJ, distance: bestCost };
}

const GRAM = 3;

function gramsOf(index: PageIndex, caseSensitive: boolean): Map<string, number[]> {
  index.cache.grams ??= new Map();
  let grams = index.cache.grams.get(caseSensitive);
  if (grams) return grams;
  grams = new Map();
  const hay = caseSensitive ? index.cased : index.text;
  for (let p = 0; p + GRAM <= hay.length; p++) {
    const g = hay.slice(p, p + GRAM);
    const list = grams.get(g);
    if (list) list.push(p);
    else grams.set(g, [p]);
  }
  index.cache.grams.set(caseSensitive, grams);
  return grams;
}

/**
 * Picks up to `max` regions of the page text where many 3-grams of the pattern occur at a
 * consistent diagonal. Aligning only inside those regions keeps long pages fast.
 */
export function candidateWindows(index: PageIndex, pattern: string, caseSensitive: boolean, max = 3): Array<[number, number]> {
  const hay = caseSensitive ? index.cased : index.text;
  const m = pattern.length;
  const n = hay.length;
  if (n <= 4 * m + 64) return [[0, n]];

  const grams = gramsOf(index, caseSensitive);
  const bucket = Math.max(8, Math.ceil(m / 4));
  const votes = new Map<number, number>();
  const gramCount = m - GRAM + 1;
  for (let o = 0; o + GRAM <= m; o++) {
    const list = grams.get(pattern.slice(o, o + GRAM));
    if (!list) continue;
    for (const p of list) {
      const b = Math.floor((p - o) / bucket);
      votes.set(b, (votes.get(b) ?? 0) + 1);
    }
  }
  const minVotes = Math.max(2, Math.ceil(gramCount * 0.1));
  const scored: Array<[number, number]> = [];
  for (const b of votes.keys()) {
    const score = (votes.get(b) ?? 0) + (votes.get(b + 1) ?? 0);
    if (score >= minVotes) scored.push([b, score]);
  }
  scored.sort((x, y) => y[1] - x[1] || x[0] - y[0]);

  const slack = Math.ceil(m * 0.3) + 4;
  const chosen: number[] = [];
  const windows: Array<[number, number]> = [];
  for (const [b] of scored) {
    if (chosen.some((c) => Math.abs(c - b) <= 1)) continue;
    chosen.push(b);
    windows.push([Math.max(0, b * bucket - slack), Math.min(n, (b + 2) * bucket + m + slack)]);
    if (windows.length >= max) break;
  }
  return windows;
}

/** Best approximate occurrence of `pattern` on one page, or null when nothing resembles it. */
export function alignOnPage(index: PageIndex, pattern: string, caseSensitive: boolean): Alignment | null {
  const hay = caseSensitive ? index.cased : index.text;
  let best: Alignment | null = null;
  for (const [lo, hi] of candidateWindows(index, pattern, caseSensitive)) {
    const a = alignBest(pattern, hay, lo, hi);
    if (a && (best === null || a.distance < best.distance)) best = a;
  }
  return best;
}
