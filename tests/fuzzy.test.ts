import { describe, expect, it } from "vitest";
import { buildPageIndex, createLocator, locateInIndexes, type PdfRect } from "../src/index.js";
import { openFixture, readExpected } from "./helpers/load-pdf.js";

const expected = readExpected();

/** true when the rectangle shares vertical extent with at least one expected line box. */
function touchesLine(rect: PdfRect, boxes: PdfRect[]): boolean {
  return boxes.some((b) => b.page === rect.page && Math.min(b.y1, rect.y1) - Math.max(b.y0, rect.y0) > 4);
}

const variants: Array<{ name: string; quote: string; span: string }> = [
  {
    name: "two typos",
    quote: "Approximate alignment tolerates small typing mistaks in a quoted sentance, so the highlight still lands on the right line",
    span: "approx",
  },
  {
    name: "dropped quotation marks and dash",
    quote: "Reviewers said provenance matters and trust grows slowly.",
    span: "quotes",
  },
  {
    name: "one word missing",
    quote: "Approximate alignment tolerates typing mistakes in a quoted sentence, so the highlight still lands on the right line",
    span: "approx",
  },
  {
    name: "extra whitespace plus a typo",
    quote: "Approximate  alignment tolerates small typing mistakes in a quoted  sentence,  so the highlite still lands on the right line",
    span: "approx",
  },
  {
    name: "typos across a hyphenated line break",
    quote: "Users want to see exactly were the cited sentance lives on the page",
    span: "hyphen",
  },
];

describe("fuzzy matching of LLM-style quotes", () => {
  for (const variant of variants) {
    it(`finds: ${variant.name}`, async () => {
      const { locatorDoc } = await openFixture("6.3");
      const result = await createLocator(locatorDoc).locate(variant.quote);
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.method).toBe("fuzzy");
      expect(result.score).toBeGreaterThanOrEqual(0.85);
      expect(result.page).toBe(1);
      const boxes = expected.spans[variant.span]!.boxes;
      expect(result.rects.length).toBeGreaterThan(0);
      for (const rect of result.rects) expect(touchesLine(rect, boxes)).toBe(true);
    });
  }

  it("refuses a hallucinated quote and reports the closest candidate", async () => {
    const { locatorDoc } = await openFixture("6.3");
    const result = await createLocator(locatorDoc).locate(
      "The model must always return the answer in valid JSON format with exactly three keys",
    );
    expect(result.found).toBe(false);
    if (result.found) return;
    expect(result.reason).toBe("below-threshold");
    expect(result.best).toBeDefined();
    expect(result.best!.score).toBeLessThan(0.85);
  });

  it("lowering the threshold accepts a weaker match", async () => {
    const { locatorDoc } = await openFixture("6.3");
    const quote = "Approximate alignment tolerates small typing mistakes in a quoted sentence, but the highlighter always lands";
    const strict = await createLocator(locatorDoc).locate(quote, { threshold: 0.95 });
    expect(strict.found).toBe(false);
    const lax = await createLocator(locatorDoc).locate(quote, { threshold: 0.6 });
    expect(lax.found).toBe(true);
  });

  it("does not guess for very short quotes", async () => {
    const { locatorDoc } = await openFixture("6.3");
    const result = await createLocator(locatorDoc).locate("typng");
    expect(result.found).toBe(false);
  });

  it("skips alignment on a page far shorter than the quote (fast, not found)", () => {
    const index = buildPageIndex({ items: [{ str: "A short page of text with a few words.", transform: [12, 0, 0, 12, 72, 700], width: 200, height: 12 }] }, { pageNumber: 1 });
    const quote = "lorem ipsum dolor sit amet ".repeat(20000);
    const started = Date.now();
    const result = locateInIndexes([index], quote);
    expect(result.found).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
