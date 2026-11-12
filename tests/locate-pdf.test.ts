import { describe, expect, it } from "vitest";
import { createLocator } from "../src/index.js";
import { openFixture, readExpected } from "./helpers/load-pdf.js";

describe("locate on the fixture PDF (pdfjs-dist 6.3.289)", () => {
  it("finds a quote across an end-of-line hyphen", async () => {
    const expected = readExpected().spans.hyphen!;
    const { locatorDoc } = await openFixture("6.3");
    const result = await createLocator(locatorDoc).locate(expected.quote);

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.page).toBe(1);
    expect(result.method).toBe("normalized");
    expect(result.rects).toHaveLength(2);
    result.rects.forEach((rect, i) => {
      const box = expected.boxes[i]!;
      expect(Math.abs(rect.y0 - box.y0)).toBeLessThanOrEqual(1);
      expect(Math.abs(rect.y1 - box.y1)).toBeLessThanOrEqual(1);
    });
    // The hyphen is dropped and the empty end-of-line marker items do not glue words together.
    expect(result.matchedText).toContain("sentence");
    expect(result.matchedText).not.toMatch(/Notes?Retrieval/);
  });

  it("does not glue the title to the first paragraph line", async () => {
    const { locatorDoc } = await openFixture("6.3");
    const result = await createLocator(locatorDoc).locate("Retrieval Notes Retrieval-augmented generation");
    expect(result.found).toBe(true);
    if (result.found) expect(result.page).toBe(1);
  });

  it("reports exact for a verbatim single-line quote", async () => {
    const { locatorDoc } = await openFixture("6.3");
    const result = await createLocator(locatorDoc).locate("alignment tolerates", { pageHint: 1 });
    expect(result.found && result.method).toBe("exact");
  });

  it("finds quotes on rotated pages", async () => {
    const { locatorDoc } = await openFixture("6.3");
    const locator = createLocator(locatorDoc);
    const right = await locator.locate("right column second line");
    expect(right.found && right.page).toBe(2);
    const third = await locator.locate("needs a viewport transform");
    expect(third.found && third.page).toBe(3);
  });
});
