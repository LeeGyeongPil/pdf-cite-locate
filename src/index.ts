export { LocateError } from "./errors.js";
export type { LocateErrorCode } from "./errors.js";
export { normalizeText } from "./normalize.js";
export { buildPageIndex } from "./page-index.js";
export type { BuildPageIndexOptions, IndexedItem, PageIndex } from "./page-index.js";
export { locateInIndexes, DEFAULT_THRESHOLD, MIN_FUZZY_LENGTH } from "./locate.js";
export { createLocator } from "./locator.js";
export type { Locator, LocatorOptions } from "./locator.js";
export { toViewportRects } from "./viewport.js";
export { BOX_ASCENT, BOX_DESCENT } from "./rects.js";
export { VERSION } from "./version.js";
export type {
  CssRect,
  DocumentLike,
  LocateBest,
  LocateFound,
  LocateMethod,
  LocateNotFound,
  LocateOptions,
  LocateResult,
  Measurer,
  PageLike,
  PdfRect,
  TextContentLike,
  TextItemLike,
  TextStyleLike,
  ViewportLike,
} from "./types.js";
