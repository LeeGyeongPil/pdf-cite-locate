import { describe, expect, it } from "vitest";
import { buildPageIndex, createLocator, locateInIndexes, toViewportRects, type CssRect, type PdfRect } from "../src/index.js";
import { createHelveticaMeasurer } from "./helpers/helvetica.js";
import { openFixture, readExpected, readSynthetic } from "./helpers/load-pdf.js";

const expected = readExpected();

/** Reference conversion by pdf.js itself (convertToViewportPoint), normalized to left/top/width/height. */
function reference(viewport: { convertToViewportPoint(x: number, y: number): number[] }, box: PdfRect): CssRect {
  // pdf.js 6.x has convertToViewportPoint only; two opposite corners give the bounding box.
  const [x0 = 0, y0 = 0] = viewport.convertToViewportPoint(box.x0, box.y0);
  const [x1 = 0, y1 = 0] = viewport.convertToViewportPoint(box.x1, box.y1);
  return { left: Math.min(x0, x1), top: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
}

function expectClose(actual: CssRect, want: CssRect, tolerance: number, keys: Array<keyof CssRect> = ["left", "top", "width", "height"]): void {
  for (const key of keys) {
    expect(Math.abs(actual[key] - want[key])).toBeLessThanOrEqual(tolerance);
  }
}

describe("toViewportRects", () => {
  it("matches pdf.js on pages rotated 0, 90 and 270 at scale 1.5", async () => {
    const { doc } = await openFixture("6.3");
    for (const [key, span] of Object.entries(expected.spans)) {
      const page = await doc.getPage(span.page);
      const viewport = page.getViewport({ scale: 1.5 });
      const css = toViewportRects(span.boxes, viewport);
      span.boxes.forEach((box, i) => expectClose(css[i]!, reference(viewport, box), 1e-6));
      expect(key).toBeTruthy();
    }
    const rotations = await Promise.all([1, 2, 3].map(async (n) => (await doc.getPage(n)).rotate));
    expect(rotations).toEqual([0, 90, 270]);
  });

  it("also handles an explicit extra rotation (180)", async () => {
    const { doc } = await openFixture("6.3");
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.5, rotation: 180 });
    const box = expected.spans.hyphen!.boxes[0]!;
    expectClose(toViewportRects([box], viewport)[0]!, reference(viewport, box), 1e-6);
  });

  it("puts located rectangles within 1px of the expected boxes in every rotation", async () => {
    const measure = await createHelveticaMeasurer();
    const { doc, locatorDoc } = await openFixture("6.3");
    const locator = createLocator(locatorDoc, { measure });
    for (const key of ["hyphen", "quotes", "approx", "rightColumn", "rotated270"] as const) {
      const span = expected.spans[key]!;
      const result = await locator.locate(span.quote, { pageHint: span.page });
      expect(result.found).toBe(true);
      if (!result.found) continue;
      const viewport = (await doc.getPage(span.page)).getViewport({ scale: 1.5 });
      const css = toViewportRects(result.rects, viewport);
      expect(css).toHaveLength(span.boxes.length);
      // left, top, width and height of every rectangle, against boxes built from pdf.js item positions.
      span.boxes.forEach((box, i) => expectClose(css[i]!, reference(viewport, box), 1));
    }
  });

  it("covers the glyph area of an item with a rotated text matrix", () => {
    const index = buildPageIndex(readSynthetic("rotated"), { pageNumber: 1 });
    const result = locateInIndexes([index], "Rotate");
    expect(result.found).toBe(true);
    if (!result.found) return;
    const rect = result.rects[0]!;
    // Baseline runs upward from (100, 200) for 66 units; glyphs extend to the left (x decreasing).
    expect(rect.x0).toBeLessThanOrEqual(100 - 0.8 * 11 + 1e-9);
    expect(rect.x1).toBeGreaterThanOrEqual(100 + 0.2 * 11 - 1e-9);
    expect(rect.y0).toBeLessThanOrEqual(200 + 1e-9);
    expect(rect.y1).toBeGreaterThanOrEqual(266 - 1e-9);
    const css = toViewportRects([rect], { transform: [1.5, 0, 0, -1.5, 0, 1188], width: 918, height: 1188 })[0]!;
    expect(css.left).toBeCloseTo(rect.x0 * 1.5, 6);
    expect(css.top).toBeCloseTo(1188 - rect.y1 * 1.5, 6);
    expect(css.height).toBeCloseTo((rect.y1 - rect.y0) * 1.5, 6);
  });

  it("rejects a viewport without a transform", () => {
    expect(() => toViewportRects([], { width: 1, height: 1 } as never)).toThrowError(/transform/);
  });
});
