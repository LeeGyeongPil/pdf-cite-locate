// Generates fixtures/citations.pdf and fixtures/expected.json with pdf-lib (offline, deterministic).
// The expected boxes come from the drawing coordinates and the Helvetica glyph widths, scaled so each
// line spans exactly what pdf.js reports (item start = transform[4], item end = transform[4] + item.width),
// which is where pdf.js's own text layer places the glyphs. The library code is not involved.
// Box convention (same as the library): baseline - 0.2*size .. baseline + 0.8*size.
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const outDir = new URL("../fixtures/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const doc = await PDFDocument.create();
doc.setCreationDate(new Date(0));
doc.setModificationDate(new Date(0));
doc.setProducer("pdf-cite-locate fixtures");
doc.setCreator("pdf-cite-locate fixtures");
doc.setTitle("pdf-cite-locate fixture");
const fonts = {
  regular: await doc.embedFont(StandardFonts.Helvetica),
  bold: await doc.embedFont(StandardFonts.HelveticaBold),
};

/** Every drawn line: id, page, origin, size, font, text. */
const lines = [];
function draw(page, pageNumber, id, text, x, y, size = 12, font = "regular") {
  page.drawText(text, { x, y, size, font: fonts[font] });
  lines.push({ id, page: pageNumber, x, y, size, font, text });
}

const p1 = doc.addPage([612, 792]);
draw(p1, 1, "title", "Retrieval Notes", 72, 720, 18, "bold");
draw(p1, 1, "l1", "Retrieval-augmented generation grounds an answer in source", 72, 680);
draw(p1, 1, "l2", "passages. Users want to see exactly where the cited sen-", 72, 664);
draw(p1, 1, "l3", "tence lives on the page, but the text layer splits every", 72, 648);
draw(p1, 1, "l4", "line into separate items and drops the space at the break.", 72, 632);
// One visual line drawn in three pieces with different fonts, so pdf.js emits several items.
const w = (font, text, size) => fonts[font].widthOfTextAtSize(text, size);
p1.drawText("Mixed ", { x: 72, y: 600, size: 12, font: fonts.regular });
p1.drawText("bold", { x: 72 + w("regular", "Mixed ", 12), y: 600, size: 12, font: fonts.bold });
p1.drawText(" words in one line.", { x: 72 + w("regular", "Mixed ", 12) + w("bold", "bold", 12), y: 600, size: 12, font: fonts.regular });
draw(p1, 1, "q1", "Reviewers said “provenance matters” and trust grows – slowly.", 72, 570);
draw(p1, 1, "a1", "Approximate alignment tolerates small typing mistakes in a", 72, 540);
draw(p1, 1, "a2", "quoted sentence, so the highlight still lands on the right", 72, 524);
draw(p1, 1, "a3", "line even when a model rewrites a word or two.", 72, 508);

const p2 = doc.addPage([612, 792]);
p2.setRotation(degrees(90));
draw(p2, 2, "c1", "Left column first line", 72, 700, 11);
draw(p2, 2, "c2", "left column second line", 72, 686, 11);
draw(p2, 2, "c3", "Right column first line", 330, 700, 11);
draw(p2, 2, "c4", "right column second line", 330, 686, 11);

const p3 = doc.addPage([612, 792]);
p3.setRotation(degrees(270));
draw(p3, 3, "r1", "Rotated three needs a viewport transform", 72, 500, 11);
draw(p3, 3, "r2", "Second rotated line of text", 72, 486, 11);

const pdfBytes = await doc.save();
writeFileSync(new URL("citations.pdf", outDir), pdfBytes);

// Ask pdf.js where each drawn line really starts and ends (one text item per line).
const fontDir = new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).pathname;
const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), standardFontDataUrl: fontDir }).promise;
const itemOf = new Map(); // line id -> { x, width } as pdf.js reports them
for (let n = 1; n <= pdfDoc.numPages; n++) {
  const content = await (await pdfDoc.getPage(n)).getTextContent();
  for (const line of lines.filter((l) => l.page === n)) {
    const item = content.items.find((it) => it.str === line.text);
    if (!item) throw new Error(`pdf.js has no text item for line ${line.id}`);
    itemOf.set(line.id, { x: item.transform[4], width: item.width });
  }
}

// ---- expected boxes ----------------------------------------------------------------------
const round = (v) => Math.round(v * 10000) / 10000;
/** Box of text[from..to] (substring search, inclusive of `to`) on line `id`. */
function part(id, from, to) {
  const line = lines.find((l) => l.id === id);
  const s = line.text.indexOf(from);
  const e = line.text.indexOf(to, s) + to.length;
  if (s < 0 || e < to.length) throw new Error(`bad span ${id}: ${from}..${to}`);
  const width = (t) => fonts[line.font].widthOfTextAtSize(t, line.size);
  const item = itemOf.get(id);
  const k = item.width / width(line.text); // AFM width -> pdf.js width
  return {
    page: line.page,
    x0: round(item.x + width(line.text.slice(0, s)) * k),
    y0: round(line.y - 0.2 * line.size),
    x1: round(item.x + width(line.text.slice(0, e)) * k),
    y1: round(line.y + 0.8 * line.size),
  };
}
const whole = (id) => {
  const line = lines.find((l) => l.id === id);
  return part(id, line.text, line.text);
};

const approxBoxes = [whole("a1"), whole("a2"), part("a3", "line", "line")];
const hyphenBoxes = [part("l2", "Users", "sen-"), part("l3", "tence", "page")];

const spans = {
  hyphen: { page: 1, quote: "Users want to see exactly where the cited sentence lives on the page", boxes: hyphenBoxes },
  quotes: { page: 1, quote: "Reviewers said “provenance matters” and trust grows – slowly.", boxes: [whole("q1")] },
  approx: {
    page: 1,
    quote: "Approximate alignment tolerates small typing mistakes in a quoted sentence, so the highlight still lands on the right line",
    boxes: approxBoxes,
  },
  typing: { page: 1, quote: "small typing mistakes", boxes: [part("a1", "small", "mistakes")] },
  rightColumn: { page: 2, quote: "right column second line", boxes: [whole("c4")] },
  leftFirst: { page: 2, quote: "Left column first line", boxes: [whole("c1")] },
  rotated270: { page: 3, quote: "needs a viewport transform", boxes: [part("r1", "needs", "transform")] },
};

writeFileSync(
  new URL("expected.json", outDir),
  JSON.stringify(
    {
      note: "Generated by scripts/make-fixtures.mjs from drawing coordinates and Helvetica widths. Boxes are PDF user space (y up).",
      pages: [
        { page: 1, rotate: 0 },
        { page: 2, rotate: 90 },
        { page: 3, rotate: 270 },
      ],
      lines,
      spans,
    },
    null,
    2,
  ) + "\n",
);
console.log("wrote fixtures/citations.pdf and fixtures/expected.json");
