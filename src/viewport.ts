import { LocateError } from "./errors.js";
import type { CssRect, PdfRect, ViewportLike } from "./types.js";

/**
 * Converts PDF-space rectangles to CSS pixel rectangles of `viewport`
 * (any scale and rotation; y axis flipped by the viewport transform).
 */
export function toViewportRects(rects: ReadonlyArray<PdfRect>, viewport: ViewportLike): CssRect[] {
  const t = viewport?.transform;
  if (!Array.isArray(t) || t.length < 6 || !t.slice(0, 6).every((v) => typeof v === "number" && Number.isFinite(v))) {
    throw new LocateError(
      "INVALID_OPTIONS",
      "viewport.transform must be 6 finite numbers. Pass the object returned by page.getViewport({ scale }).",
    );
  }
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = t;
  return rects.map((r) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const x of [r.x0, r.x1]) {
      for (const y of [r.y0, r.y1]) {
        xs.push(a * x + c * y + e);
        ys.push(b * x + d * y + f);
      }
    }
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
  });
}
