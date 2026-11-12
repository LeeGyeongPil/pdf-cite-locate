import { describe, expect, it } from "vitest";
import { buildPageIndex, LocateError, locateInIndexes, normalizeText, type TextContentLike } from "../src/index.js";
import { readSynthetic } from "./helpers/load-pdf.js";

describe("page index on synthetic text content", () => {
  it("ignores marked content entries", () => {
    const index = buildPageIndex(readSynthetic("marked-content"), { pageNumber: 1 });
    expect(index.items).toHaveLength(2);
    expect(index.text.trimEnd()).toBe("marked content entries must be skipped.");
    const result = locateInIndexes([index], "content entries must be");
    expect(result.found).toBe(true);
  });

  it("uses the font size for space-only items with height 0", () => {
    const index = buildPageIndex(readSynthetic("space-items"), { pageNumber: 1 });
    expect(index.text.trimEnd()).toBe("mixed bold words in one line.");
    const result = locateInIndexes([index], "bold words in");
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.rects).toHaveLength(1); // three items merge into one visual line
    const rect = result.rects[0]!;
    expect(rect.y1 - rect.y0).toBeCloseTo(10, 5); // 0.2 + 0.8 of the item height, never 0
  });

  it("matches un-normalized ligatures", () => {
    const index = buildPageIndex(readSynthetic("ligature"), { pageNumber: 1 });
    expect(index.text.trimEnd()).toBe("the final flow of efficient office work");
    const result = locateInIndexes([index], "final flow of efficient office");
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.method).toBe("normalized");
    expect(result.matchedText).toBe("ﬁnal ﬂow of eﬃcient oﬃce");
  });

  it("finds a Korean quote over two lines", () => {
    const index = buildPageIndex(readSynthetic("korean"), { pageNumber: 4 });
    const result = locateInIndexes([index], "답변의 근거를 원문 문장에서 찾아");
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.page).toBe(4);
    expect(result.rects).toHaveLength(2);
  });

  it("reports an empty text layer", () => {
    const index = buildPageIndex(readSynthetic("empty"), { pageNumber: 1 });
    expect(index.empty).toBe(true);
    expect(locateInIndexes([index], "anything at all here")).toEqual({ found: false, reason: "no-text-layer" });
  });

  it("rejects malformed text content with INVALID_TEXT_CONTENT", () => {
    const bad: unknown[] = [null, {}, { items: "nope" }, { items: [{ str: "x", transform: [1, 2] }] }];
    for (const value of bad) {
      expect(() => buildPageIndex(value as TextContentLike, { pageNumber: 1 })).toThrowError(LocateError);
      try {
        buildPageIndex(value as TextContentLike, { pageNumber: 1 });
      } catch (error) {
        expect((error as LocateError).code).toBe("INVALID_TEXT_CONTENT");
      }
    }
  });
});

describe("normalizeText", () => {
  it("folds quotes, dashes, invisible characters, case and whitespace", () => {
    expect(normalizeText("  “Hello” —  wor­ld​\n again ")).toBe('"hello" - world again');
  });

  it("keeps case when asked", () => {
    expect(normalizeText("Ab  Cd", { caseSensitive: true })).toBe("Ab Cd");
  });
});

describe("option validation", () => {
  it("rejects a threshold outside (0, 1]", () => {
    const index = buildPageIndex(readSynthetic("korean"), { pageNumber: 1 });
    expect(() => locateInIndexes([index], "검색 증강", { threshold: 2 })).toThrowError(/threshold/);
  });

  it("returns empty-quote for blank quotes", () => {
    const index = buildPageIndex(readSynthetic("korean"), { pageNumber: 1 });
    expect(locateInIndexes([index], "   ")).toEqual({ found: false, reason: "empty-quote" });
  });
});

describe("page number validation", () => {
  it.each([0, -1, 1.5, Number.NaN])("rejects pageNumber %s with INVALID_PAGE", (pageNumber) => {
    expect(() => buildPageIndex({ items: [] }, { pageNumber })).toThrowError(expect.objectContaining({ code: "INVALID_PAGE" }));
  });
});
