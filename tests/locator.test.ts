import { describe, expect, it } from "vitest";
import { createLocator, LocateError, type DocumentLike, type TextContentLike } from "../src/index.js";

/** Deterministic pseudo-random generator (LCG) so the synthetic document is stable. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function makeVocabulary(next: () => number, size: number): string[] {
  const syllables = ["ka", "to", "mi", "ren", "su", "vel", "dor", "an", "pi", "lu", "ex", "or", "in", "ta"];
  return Array.from({ length: size }, () => {
    const n = 2 + Math.floor(next() * 3);
    return Array.from({ length: n }, () => syllables[Math.floor(next() * syllables.length)]).join("");
  });
}

/** Wraps text into ~60 character lines, one text item per line with hasEOL. */
function toContent(text: string, pageNumber: number): TextContentLike {
  const items: TextContentLike["items"][number][] = [];
  let line = "";
  let y = 740;
  const flush = () => {
    if (line === "") return;
    items.push({ str: line, transform: [10, 0, 0, 10, 50, y], width: line.length * 5, height: 10, hasEOL: true, fontName: "f" });
    y -= 12;
    line = "";
  };
  for (const word of text.split(" ")) {
    if ((line + " " + word).trim().length > 60) flush();
    line = (line + " " + word).trim();
  }
  flush();
  void pageNumber;
  return { items };
}

function fakeDoc(pages: string[]) {
  const calls = { getPage: 0, getTextContent: 0, pages: [] as number[] };
  const doc: DocumentLike = {
    numPages: pages.length,
    async getPage(n) {
      calls.getPage++;
      return {
        async getTextContent() {
          calls.getTextContent++;
          calls.pages.push(n);
          return toContent(pages[n - 1] as string, n);
        },
      };
    },
  };
  return { doc, calls };
}

describe("page hint and cache", () => {
  const pages = ["alpha beta gamma delta ".repeat(6), "the unique sentence about hinted retrieval lives here only", "omega sigma tau ".repeat(8), "x ".repeat(30)];

  it("indexes only the hinted page when it matches, and never twice", async () => {
    const { doc, calls } = fakeDoc(pages);
    const locator = createLocator(doc);
    const first = await locator.locate("unique sentence about hinted retrieval", { pageHint: 2 });
    expect(first.found && first.page).toBe(2);
    expect(calls.getTextContent).toBe(1);
    const second = await locator.locate("sentence about hinted retrieval lives", { pageHint: 2 });
    expect(second.found && second.page).toBe(2);
    expect(calls.getTextContent).toBe(1);
    expect(locator.indexedPages()).toEqual([2]);
  });

  it("falls back to the other pages when the hint is wrong", async () => {
    const { doc, calls } = fakeDoc(pages);
    const result = await createLocator(doc).locate("unique sentence about hinted retrieval", { pageHint: 4 });
    expect(result.found && result.page).toBe(2);
    expect(calls.pages[0]).toBe(4);
  });

  it("validates page numbers and the document", async () => {
    const { doc } = fakeDoc(pages);
    await expect(createLocator(doc).locate("some quote here", { pages: [9] })).rejects.toThrowError(LocateError);
    expect(() => createLocator({} as DocumentLike)).toThrowError(LocateError);
  });

  it("finds 20 typo quotes in a 100-page document in under 5 seconds", async () => {
    const next = rng(42);
    const vocabulary = makeVocabulary(next, 400);
    const sentenceOf = () => Array.from({ length: 12 }, () => vocabulary[Math.floor(next() * vocabulary.length)]).join(" ");
    const docPages: string[] = [];
    const sources: Array<{ page: number; sentence: string }> = [];
    for (let p = 1; p <= 100; p++) {
      const sentences = Array.from({ length: 28 }, sentenceOf); // ~2,800 words of text per page
      docPages.push(sentences.join(" "));
      if (p % 5 === 0) sources.push({ page: p, sentence: sentences[10] as string });
    }
    const { doc } = fakeDoc(docPages);
    const locator = createLocator(doc);

    const started = performance.now();
    for (const { page, sentence } of sources) {
      // Two typos: replace the 10th and 40th character.
      const chars = [...sentence];
      chars[10] = chars[10] === "z" ? "y" : "z";
      chars[40] = chars[40] === "q" ? "w" : "q";
      const result = await locator.locate(chars.join(""));
      expect(result.found, `page ${page}`).toBe(true);
      if (result.found) {
        expect(result.page).toBe(page);
        expect(result.method).toBe("fuzzy");
      }
    }
    expect(sources).toHaveLength(20);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});

describe("locateAll input validation", () => {
  const doc = (): DocumentLike & { calls: number } => {
    const d = {
      calls: 0,
      numPages: 1,
      async getPage() {
        d.calls++;
        return { async getTextContent(): Promise<TextContentLike> { return { items: [], styles: {} } as unknown as TextContentLike; } };
      },
    };
    return d as unknown as DocumentLike & { calls: number };
  };

  it.each([["string", "abc"], ["number", 42], ["undefined", undefined], ["null", null]])("rejects %s", async (_n, v) => {
    const d = doc();
    const loc = createLocator(d);
    await expect(loc.locateAll(v as never)).rejects.toMatchObject({ code: "INVALID_OPTIONS" });
    await expect(loc.locateAll(v as never)).rejects.toBeInstanceOf(LocateError);
    expect(loc.indexedPages()).toEqual([]);
    expect(d.calls).toBe(0);
  });

  it("accepts a Set of strings", async () => {
    const loc = createLocator(doc());
    const res = await loc.locateAll(new Set(["a", "b"]) as never);
    expect(res).toHaveLength(2);
  });
});
