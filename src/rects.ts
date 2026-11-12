import type { IndexedItem, PageIndex } from "./page-index.js";
import type { PdfRect } from "./types.js";

/** Box below/above the baseline as a fraction of the item height (Helvetica-like glyph extents). */
export const BOX_DESCENT = 0.2;
export const BOX_ASCENT = 0.8;

interface Piece {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  horizontal: boolean;
}

/** Distance along the baseline from the item start to character offset `upTo`. */
function offsetAlong(index: PageIndex, item: IndexedItem, upTo: number, state: { approx: boolean }): number {
  const n = item.str.length;
  if (n === 0 || upTo <= 0) return 0;
  if (upTo >= n) return item.width;
  if (index.measure) {
    const style = item.fontName ? index.styles[item.fontName] : undefined;
    const full = index.measure(item.str, item, style);
    const part = index.measure(item.str.slice(0, upTo), item, style);
    // Rescale so that the whole string spans exactly item.width, as pdf.js' text layer does.
    if (Number.isFinite(full) && Number.isFinite(part) && full > 0) return (item.width * part) / full;
  }
  state.approx = true;
  return (item.width * upTo) / n;
}

function pieceFor(index: PageIndex, item: IndexedItem, a: number, b: number, state: { approx: boolean }): Piece {
  const [ta = 1, tb = 0, tc = 0, td = 1, e = 0, f = 0] = item.transform;
  const sx = Math.hypot(ta, tb) || 1;
  const ux = ta / sx; // baseline direction
  const uy = tb / sx;
  const fs = Math.hypot(tc, td);
  const vx = fs > 0 ? tc / fs : -uy; // "up" direction of the glyphs
  const vy = fs > 0 ? td / fs : ux;
  const h = item.height > 0 ? item.height : fs > 0 ? fs : sx; // space-only items report height 0
  const s0 = offsetAlong(index, item, a, state);
  const s1 = offsetAlong(index, item, b, state);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of [s0, s1]) {
    for (const t of [-BOX_DESCENT * h, BOX_ASCENT * h]) {
      xs.push(e + ux * s + vx * t);
      ys.push(f + uy * s + vy * t);
    }
  }
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
    horizontal: Math.abs(ux) >= Math.abs(uy),
  };
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

function sameLine(p: Piece, q: Piece): boolean {
  if (p.horizontal !== q.horizontal) return false;
  if (p.horizontal) {
    const h = Math.min(p.y1 - p.y0, q.y1 - q.y0);
    const gap = Math.max(p.x0, q.x0) - Math.min(p.x1, q.x1);
    return overlap(p.y0, p.y1, q.y0, q.y1) >= 0.5 * h && gap <= 2 * Math.max(p.y1 - p.y0, q.y1 - q.y0);
  }
  const w = Math.min(p.x1 - p.x0, q.x1 - q.x0);
  const gap = Math.max(p.y0, q.y0) - Math.min(p.y1, q.y1);
  return overlap(p.x0, p.x1, q.x0, q.x1) >= 0.5 * w && gap <= 2 * Math.max(p.x1 - p.x0, q.x1 - q.x0);
}

/**
 * Rectangles (PDF user space) for the normalized characters [start, end) of a page:
 * one rectangle per text item run, merged into one rectangle per visual line.
 */
export function rectsForSpan(index: PageIndex, start: number, end: number): { rects: PdfRect[]; approx: boolean } {
  const state = { approx: false };
  const ranges = new Map<number, [number, number]>();
  for (let i = start; i < end; i++) {
    const ch = index.charOf[i] as number;
    if (ch < 0) continue;
    const item = index.itemOf[i] as number;
    let stop = ch + Math.max(1, (index.raw[i] as string).length);
    if (index.hyphenAfter[i] && i < end - 1) stop += 1; // the dropped line-end hyphen is part of the match
    const r = ranges.get(item);
    if (r) {
      r[0] = Math.min(r[0], ch);
      r[1] = Math.max(r[1], stop);
    } else {
      ranges.set(item, [ch, stop]);
    }
  }
  const pieces: Piece[] = [];
  for (const itemIndex of [...ranges.keys()].sort((x, y) => x - y)) {
    const [a, b] = ranges.get(itemIndex) as [number, number];
    pieces.push(pieceFor(index, index.items[itemIndex] as IndexedItem, a, b, state));
  }
  const merged: Piece[] = [];
  for (const p of pieces) {
    const last = merged[merged.length - 1];
    if (last && sameLine(last, p)) {
      last.x0 = Math.min(last.x0, p.x0);
      last.x1 = Math.max(last.x1, p.x1);
      last.y0 = Math.min(last.y0, p.y0);
      last.y1 = Math.max(last.y1, p.y1);
    } else {
      merged.push({ ...p });
    }
  }
  return {
    rects: merged.map((p) => ({ page: index.page, x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 })),
    approx: state.approx,
  };
}
