import { readFileSync } from "node:fs";
import * as pdfjs63 from "pdfjs-dist/legacy/build/pdf.mjs";
import * as pdfjs65 from "pdfjs-dist-6.5/legacy/build/pdf.mjs";
import type { DocumentLike, PdfRect, TextContentLike } from "../../src/index.js";

export type PdfjsKey = "6.3" | "6.5";

const modules = { "6.3": pdfjs63, "6.5": pdfjs65 } as const;
const fontDirs = {
  "6.3": new URL("../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).pathname,
  "6.5": new URL("../../node_modules/pdfjs-dist-6.5/standard_fonts/", import.meta.url).pathname,
};

export const PDFJS_VERSIONS: PdfjsKey[] = ["6.3", "6.5"];

export interface Expected {
  spans: Record<string, { page: number; quote: string; boxes: PdfRect[] }>;
  lines: Array<{ id: string; page: number; x: number; y: number; size: number; font: string; text: string }>;
}

export function readExpected(): Expected {
  return JSON.parse(readFileSync(new URL("../../fixtures/expected.json", import.meta.url), "utf8")) as Expected;
}

export function readSynthetic(name: string): TextContentLike {
  return JSON.parse(readFileSync(new URL(`../../fixtures/synthetic/${name}.json`, import.meta.url), "utf8")) as TextContentLike;
}

/** Opens fixtures/citations.pdf with the chosen pdfjs-dist copy. */
export async function openFixture(which: PdfjsKey) {
  const lib = modules[which];
  const data = new Uint8Array(readFileSync(new URL("../../fixtures/citations.pdf", import.meta.url)));
  const doc = await lib.getDocument({ data, standardFontDataUrl: fontDirs[which] }).promise;
  return { pdfjs: lib, doc, locatorDoc: doc as unknown as DocumentLike };
}

export function pdfjsVersion(which: PdfjsKey): string {
  return modules[which].version;
}
