import { describe, expect, it } from "vitest";
import { buildPageIndex, locateInIndexes } from "../src/index.js";

const item = (str: string) => ({ str, transform: [1, 0, 0, 1, 0, 0], width: str.length * 5, height: 10, hasEOL: true });
const page = (...lines: string[]) => buildPageIndex({ items: lines.map(item) }, { pageNumber: 1 });

describe("line-end hyphen compounds quoted as printed", () => {
  const idx = page("This is a well-", "known fact about it.");
  it("finds a short quote with the hyphen", () => {
    const r = locateInIndexes([idx], "well-known");
    expect(r).toMatchObject({ found: true, method: "normalized", score: 1, matchedText: "well-known" });
  });
  it("finds a long quote with the hyphen", () => {
    const r = locateInIndexes([idx], "a well-known fact about it");
    expect(r).toMatchObject({ found: true, method: "normalized", score: 1, matchedText: "a well-known fact about it" });
  });
  it("finds the whitespace-insensitive form", () => {
    const r = locateInIndexes([idx], "well - known");
    expect(r).toMatchObject({ found: true, method: "normalized", matchedText: "well-known" });
  });
  it("keeps the unhyphenated quote unchanged", () => {
    const r = locateInIndexes([idx], "wellknown");
    expect(r).toMatchObject({ found: true, method: "normalized", score: 1, matchedText: "wellknown" });
  });
  it("still joins soft hyphenated words", () => {
    const r = locateInIndexes([page("one sen-", "tence here")], "sentence");
    expect(r).toMatchObject({ found: true, method: "normalized", matchedText: "sentence" });
  });
});
