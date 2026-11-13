import { LocateError } from "./errors.js";
import { exactResult, fuzzyResult, pageOrder, prepareQuery } from "./locate.js";
import { buildPageIndex, type PageIndex } from "./page-index.js";
import type { DocumentLike, LocateOptions, LocateResult, Measurer } from "./types.js";

export interface LocatorOptions {
  /** Glyph width function for precise x positions (see `createCanvasMeasurer`). */
  measure?: Measurer;
  /** Passed to `page.getTextContent(params)`. Default `{}`. */
  textContentParams?: object;
}

export interface Locator {
  locate(quote: string, options?: LocateOptions): Promise<LocateResult>;
  locateAll(quotes: string[], options?: LocateOptions): Promise<LocateResult[]>;
  /** Pages indexed so far (ascending). */
  indexedPages(): number[];
}

/**
 * Creates a locator for a pdf.js document (anything with `numPages` and `getPage`).
 * Pages are indexed lazily on first use and cached for the life of the locator.
 */
export function createLocator(doc: DocumentLike, options: LocatorOptions = {}): Locator {
  if (!doc || typeof doc.getPage !== "function" || !Number.isInteger(doc.numPages) || doc.numPages < 0) {
    throw new LocateError("INVALID_PAGE", "createLocator expects a pdf.js document with numPages and getPage(n).");
  }
  const cache = new Map<number, Promise<PageIndex>>();

  const indexOf = (pageNumber: number): Promise<PageIndex> => {
    let pending = cache.get(pageNumber);
    if (!pending) {
      pending = (async () => {
        const page = await doc.getPage(pageNumber);
        const content = await page.getTextContent(options.textContentParams ?? {});
        return buildPageIndex(content, { pageNumber, measure: options.measure });
      })();
      pending.catch(() => cache.delete(pageNumber)); // failed pages can be retried
      cache.set(pageNumber, pending);
    }
    return pending;
  };

  const locate = async (quote: string, opts: LocateOptions = {}): Promise<LocateResult> => {
    const query = prepareQuery(quote, opts);
    if (query.normalized === "") return { found: false, reason: "empty-quote" };
    const all = Array.from({ length: doc.numPages }, (_, i) => i + 1);
    if (opts.pages) {
      const bad = opts.pages.find((p) => p > doc.numPages);
      if (bad !== undefined) {
        throw new LocateError("INVALID_OPTIONS", `pages contains ${bad}, but the document has ${doc.numPages} pages.`);
      }
    }
    const order = pageOrder(all, query.pageHint, query.pages);
    const seen: PageIndex[] = [];
    // Stages 1-2 page by page: a hit on the hinted page never indexes the others.
    for (const pageNumber of order) {
      const index = await indexOf(pageNumber);
      seen.push(index);
      const hit = exactResult(index, query);
      if (hit) return hit;
    }
    return fuzzyResult(seen, query);
  };

  return {
    locate,
    async locateAll(quotes, opts) {
      const list: unknown = quotes;
      if (typeof list === "string" || list == null || typeof (list as Iterable<unknown>)[Symbol.iterator] !== "function") {
        throw new LocateError("INVALID_OPTIONS", "locateAll expects an array of strings.");
      }
      const items = [...(list as Iterable<string>)];
      const out: LocateResult[] = [];
      for (const q of items) out.push(await locate(q, opts));
      return out;
    },
    indexedPages: () => [...cache.keys()].sort((a, b) => a - b),
  };
}
