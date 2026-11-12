import { describe, expect, it } from "vitest";
import { createLocator, type LocateFound } from "../src/index.js";
import { createHelveticaMeasurer } from "./helpers/helvetica.js";
import { openFixture, PDFJS_VERSIONS, pdfjsVersion, readExpected, type PdfjsKey } from "./helpers/load-pdf.js";

const expected = readExpected();
const quotes = [
  expected.spans.hyphen!.quote,
  expected.spans.quotes!.quote,
  expected.spans.approx!.quote,
  expected.spans.rightColumn!.quote,
  expected.spans.rotated270!.quote,
  "Approximate alignment tolerates small typing mistaks in a quoted sentance, so the highlight still lands on the right line",
];

async function run(which: PdfjsKey): Promise<LocateFound[]> {
  const measure = await createHelveticaMeasurer();
  const { locatorDoc } = await openFixture(which);
  const locator = createLocator(locatorDoc, { measure });
  const out: LocateFound[] = [];
  for (const quote of quotes) {
    const result = await locator.locate(quote);
    expect(result.found, quote).toBe(true);
    if (result.found) out.push(result);
  }
  return out;
}

describe("pdfjs-dist version independence", () => {
  it("uses the two pinned pdfjs-dist copies", () => {
    expect(pdfjsVersion("6.3")).toBe("6.3.289");
    expect(pdfjsVersion("6.5")).toBe("6.5.438");
  });

  it("gives the same results with 6.3.289 and 6.5.438", async () => {
    const [a, b] = await Promise.all(PDFJS_VERSIONS.map(run));
    expect(a).toHaveLength(quotes.length);
    expect(b).toHaveLength(quotes.length);
    a!.forEach((first, i) => {
      const second = b![i]!;
      expect(second.page).toBe(first.page);
      expect(second.method).toBe(first.method);
      expect(second.matchedText).toBe(first.matchedText);
      expect(second.rects).toHaveLength(first.rects.length);
      first.rects.forEach((r, j) => {
        const s = second.rects[j]!;
        for (const key of ["x0", "y0", "x1", "y1"] as const) expect(Math.abs(r[key] - s[key])).toBeLessThanOrEqual(0.5);
      });
    });
  });
});
