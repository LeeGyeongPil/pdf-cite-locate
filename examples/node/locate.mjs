// Node example: open the fixture PDF with pdfjs-dist (legacy build), locate four hand-written
// citation strings and print one JSON line per quote. Run with: npm run example
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createLocator } from "../../dist/index.js";

const pdfPath = fileURLToPath(new URL("../../fixtures/citations.pdf", import.meta.url));
const fontDir = fileURLToPath(new URL("../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url));
const quotes = JSON.parse(readFileSync(new URL("./quotes.json", import.meta.url), "utf8"));

// standardFontDataUrl silences pdf.js' standard-font warning in Node.
const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(pdfPath)), standardFontDataUrl: fontDir });
const doc = await task.promise;
const locator = createLocator(doc);
const r2 = (n) => Math.round(n * 100) / 100;

for (const { quote, page } of quotes) {
  const result = await locator.locate(quote, { pageHint: page });
  if (result.found) {
    console.log(
      JSON.stringify({
        found: true,
        page: result.page,
        method: result.method,
        score: r2(result.score),
        rects: result.rects.map((r) => [r.x0, r.y0, r.x1, r.y1].map(r2)),
        quote: quote.slice(0, 40) + "...",
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        found: false,
        reason: result.reason,
        best: result.best && { page: result.best.page, score: r2(result.best.score) },
        quote: quote.slice(0, 40) + "...",
      }),
    );
  }
}
await task.destroy(); // frees the worker and document
