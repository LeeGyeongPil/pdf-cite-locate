import { LocateError } from "./errors.js";
import { foldChar, lowerChar } from "./normalize.js";
import type { Measurer, TextContentLike, TextItemLike, TextStyleLike } from "./types.js";

/** A text item kept in the index (marked-content entries are dropped). */
export interface IndexedItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
}

/**
 * Normalized text of one page plus a reverse map from every normalized character back to
 * the pdf.js text item and the character offset inside that item's `str`.
 * All per-character arrays have the same length as `cased`.
 */
export interface PageIndex {
  page: number;
  /** Normalized text, letter case kept. */
  cased: string;
  /** Normalized text, case folded. Same length as `cased`. */
  text: string;
  /** Index into `items` for each character. */
  itemOf: number[];
  /** Offset into `items[i].str`; -1 for spaces inserted at line ends. */
  charOf: number[];
  /** The text as drawn: original character for each position ("" for expansion tails). */
  raw: string[];
  /** 1 when a dropped line-end hyphen follows this character (rectangles then cover it). */
  hyphenAfter: number[];
  /** true when the character follows a dropped hyphen or differs from the drawn character. */
  lossy: boolean[];
  items: IndexedItem[];
  styles: Record<string, TextStyleLike>;
  measure?: Measurer;
  /** true when the page has no text at all (scanned page). */
  empty: boolean;
  /** Lazily built caches, see align.ts and locate.ts. */
  cache: { grams?: Map<boolean, Map<string, number[]>>; compact?: Map<boolean, { text: string; at: number[] }> };
}

export interface BuildPageIndexOptions {
  pageNumber: number;
  measure?: Measurer;
}

function isNumberArray(v: unknown, n: number): v is number[] {
  return Array.isArray(v) && v.length >= n && v.slice(0, n).every((x) => typeof x === "number" && Number.isFinite(x));
}

function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === "object" && item !== null && typeof (item as { str?: unknown }).str === "string";
}

/**
 * Builds the searchable index for one page from a pdf.js `getTextContent()` result.
 * Items without a string `str` (marked content) are skipped. A line break (`hasEOL`) becomes
 * one space, except after a letter followed by a hyphen, where the hyphen is dropped and the
 * word is joined ("sen-" + "tence" -> "sentence").
 */
export function buildPageIndex(content: TextContentLike, options: BuildPageIndexOptions): PageIndex {
  if (typeof content !== "object" || content === null || !Array.isArray(content.items)) {
    throw new LocateError(
      "INVALID_TEXT_CONTENT",
      "buildPageIndex expects the object returned by page.getTextContent(), i.e. { items: [...], styles?: {...} }.",
    );
  }
  if (!Number.isInteger(options?.pageNumber) || options.pageNumber < 1) {
    throw new LocateError("INVALID_PAGE", "buildPageIndex needs options.pageNumber: a 1-based page number (1, 2, 3, ...).");
  }
  const items: IndexedItem[] = [];
  const itemOf: number[] = [];
  const charOf: number[] = [];
  const raw: string[] = [];
  const hyphenAfter: number[] = [];
  const lossy: boolean[] = [];
  let cased = "";
  let text = "";
  let pendingLossy = false;

  const push = (c: string, item: number, ch: number, orig: string, isLossy: boolean) => {
    cased += c;
    text += lowerChar(c);
    itemOf.push(item);
    charOf.push(ch);
    raw.push(orig);
    hyphenAfter.push(0);
    lossy.push(isLossy);
  };

  content.items.forEach((entry, entryIndex) => {
    if (!isTextItem(entry)) return; // marked content or unknown entries
    if (!isNumberArray(entry.transform, 6)) {
      throw new LocateError(
        "INVALID_TEXT_CONTENT",
        `Text item #${entryIndex} has no valid 6-number "transform". Pass the unmodified result of page.getTextContent().`,
      );
    }
    const width = typeof entry.width === "number" && Number.isFinite(entry.width) ? entry.width : 0;
    const height = typeof entry.height === "number" && Number.isFinite(entry.height) ? entry.height : 0;
    const idx = items.length;
    items.push({ str: entry.str, transform: entry.transform.slice(0, 6), width, height, fontName: entry.fontName });

    let k = 0;
    for (const ch of entry.str) {
      const at = k;
      k += ch.length;
      const folded = foldChar(ch);
      if (folded === "") {
        // Soft hyphens and zero-width characters vanish but later characters stay lossless.
        continue;
      }
      let first = true;
      for (const f of folded) {
        if (f === " ") {
          if (text === "" || text.endsWith(" ")) continue;
          push(" ", idx, at, first ? ch : "", false);
        } else {
          push(f, idx, at, first ? ch : "", pendingLossy || f !== ch);
          pendingLossy = false;
        }
        first = false;
      }
    }

    if (entry.hasEOL) {
      const n = text.length;
      if (n >= 2 && text[n - 1] === "-" && /\p{L}/u.test(text[n - 2] as string) && itemOf[n - 1] === idx) {
        // Line-end hyphen: drop it and join the word. Rectangles still cover the hyphen.
        cased = cased.slice(0, -1);
        text = text.slice(0, -1);
        itemOf.pop();
        charOf.pop();
        raw.pop();
        lossy.pop();
        hyphenAfter.pop();
        hyphenAfter[hyphenAfter.length - 1] = 1;
        pendingLossy = true;
      } else if (text !== "" && !text.endsWith(" ")) {
        push(" ", idx, -1, " ", false);
      }
    }
  });

  return {
    page: options.pageNumber,
    cased,
    text,
    itemOf,
    charOf,
    raw,
    hyphenAfter,
    lossy,
    items,
    styles: content.styles && typeof content.styles === "object" ? content.styles : {},
    measure: options.measure,
    empty: text.trim() === "",
    cache: {},
  };
}
