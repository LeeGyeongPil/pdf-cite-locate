/** Structural (duck-typed) subset of pdf.js `TextItem`. pdfjs-dist is never imported. */
export interface TextItemLike {
  str: string;
  /** [a, b, c, d, e, f]: font size/rotation in a..d, baseline origin in (e, f). PDF user space (y up). */
  transform: number[];
  /** Advance length of the whole item along the baseline, in PDF user units. */
  width: number;
  height: number;
  hasEOL?: boolean;
  fontName?: string;
  dir?: string;
}

export interface TextStyleLike {
  ascent?: number;
  descent?: number;
  fontFamily?: string;
  vertical?: boolean;
}

/** Result of `page.getTextContent()`. Marked-content entries (no `str`) are ignored. */
export interface TextContentLike {
  items: ReadonlyArray<TextItemLike | { type: string }>;
  styles?: Record<string, TextStyleLike>;
}

export interface PageLike {
  getTextContent(params?: object): Promise<TextContentLike>;
}

export interface DocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PageLike>;
}

export interface ViewportLike {
  /** PDF user space -> CSS pixels: [a, b, c, d, e, f]. */
  transform: number[];
  width: number;
  height: number;
}

/**
 * Width of `text` rendered with the font of `item`, in any consistent unit.
 * The result is rescaled so the full item string matches `item.width`.
 */
export type Measurer = (text: string, item: TextItemLike, style?: TextStyleLike) => number;

export interface LocateOptions {
  /** Page (1-based) to try first, then its neighbours, then the rest. */
  pageHint?: number;
  /** Restrict the search to these pages (1-based). */
  pages?: number[];
  /** Minimum fuzzy score, 0..1. Default 0.85. */
  threshold?: number;
  /** Compare letter case. Default false. */
  caseSensitive?: boolean;
}

/** Rectangle in PDF user space (y axis points up). */
export interface PdfRect {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Rectangle in CSS pixels of a viewport. */
export interface CssRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type LocateMethod = "exact" | "normalized" | "fuzzy";

export interface LocateFound {
  found: true;
  page: number;
  /** 1 for exact and normalized matches, 1 - distance/length for fuzzy ones. */
  score: number;
  method: LocateMethod;
  /** The page text covered by the match, as drawn in the PDF (line breaks become single spaces). */
  matchedText: string;
  /** One rectangle per text line. */
  rects: PdfRect[];
  /** true when x positions were estimated proportionally (no Measurer given). */
  approx: boolean;
}

export interface LocateBest {
  page: number;
  score: number;
  matchedText: string;
  rects: PdfRect[];
}

export interface LocateNotFound {
  found: false;
  reason: "below-threshold" | "no-text-layer" | "empty-quote";
  /** Closest candidate below the threshold. Do not highlight it as if it were a match. */
  best?: LocateBest;
}

export type LocateResult = LocateFound | LocateNotFound;
