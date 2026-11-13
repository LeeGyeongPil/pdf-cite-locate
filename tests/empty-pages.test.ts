import { describe, expect, it } from "vitest";
import { buildPageIndex, createLocator, locateInIndexes } from "../src/index.js";
import { openFixture } from "./helpers/load-pdf.js";

const QUOTE = "Retrieval Notes";

describe("empty and invalid pages option", () => {
  it("rejects pages: [] and indexes nothing", async () => {
    const { locatorDoc } = await openFixture("6.3");
    const loc = createLocator(locatorDoc);
    await expect(loc.locate(QUOTE, { pages: [] })).rejects.toMatchObject({ code: "INVALID_OPTIONS", message: expect.stringContaining("at least one page") });
    expect(loc.indexedPages()).toEqual([]);
  });

  it("keeps the out-of-range message for pages: [5]", async () => {
    const { locatorDoc } = await openFixture("6.3");
    await expect(createLocator(locatorDoc).locate(QUOTE, { pages: [5] })).rejects.toMatchObject({
      code: "INVALID_OPTIONS",
      message: "pages contains 5, but the document has 3 pages.",
    });
  });

  it("keeps rejecting pageHint: 0", async () => {
    const { locatorDoc } = await openFixture("6.3");
    await expect(createLocator(locatorDoc).locate(QUOTE, { pageHint: 0 })).rejects.toMatchObject({ code: "INVALID_OPTIONS" });
  });

  it("rejects pages: [] combined with pageHint: 1", async () => {
    const { locatorDoc } = await openFixture("6.3");
    await expect(createLocator(locatorDoc).locate(QUOTE, { pages: [], pageHint: 1 })).rejects.toMatchObject({ code: "INVALID_OPTIONS" });
  });

  it("rejects pages: [] in locateAll", async () => {
    const { locatorDoc } = await openFixture("6.3");
    await expect(createLocator(locatorDoc).locateAll([QUOTE], { pages: [] })).rejects.toMatchObject({ code: "INVALID_OPTIONS" });
  });

  it("rejects pages: [] in locateInIndexes", () => {
    const idx = buildPageIndex(
      { items: [{ str: QUOTE, transform: [10, 0, 0, 10, 50, 700], width: 80, height: 10, hasEOL: true, fontName: "f" }] },
      { pageNumber: 1 },
    );
    expect(() => locateInIndexes([idx], QUOTE, { pages: [] })).toThrowError(expect.objectContaining({ code: "INVALID_OPTIONS" }));
  });

  it.each([
    ["omitted", undefined],
    ["[1]", [1]],
  ])("still finds the quote when pages is %s", async (_n, pages) => {
    const { locatorDoc } = await openFixture("6.3");
    const result = await createLocator(locatorDoc).locate(QUOTE, pages === undefined ? {} : { pages });
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.page).toBe(1);
      expect(result.method).toBe("exact");
    }
  });
});
