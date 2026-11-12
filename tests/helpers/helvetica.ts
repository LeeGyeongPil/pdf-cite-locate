import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Measurer } from "../../src/index.js";

/** Measurer backed by pdf-lib's Helvetica glyph widths (the fixture is drawn with Helvetica). */
export async function createHelveticaMeasurer(): Promise<Measurer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  return (text) => font.widthOfTextAtSize(text, 100);
}
