// Web example layout: the highlight must land inside the visible viewer panel.
// Regression for the rotated-page screenshot, where a 950px page in an ~814px panel
// put the highlighted line past the panel's right edge.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createLocator, toViewportRects, type CssRect } from "../src/index.js";
import { fitScale, FIT_MARGIN_PX, SCALE } from "../examples/web/src/fit.js";
import { createHelveticaMeasurer } from "./helpers/helvetica.js";
import { openFixture } from "./helpers/load-pdf.js";

const SCREEN_WIDTH = 1280; // README screenshot window (shots viewport)

/** Viewer panel content width at SCREEN_WIDTH, read from the example's own stylesheet. */
function panelWidthFromCss(screenWidth: number): number {
  const css = readFileSync(new URL("../examples/web/src/styles.css", import.meta.url), "utf8");
  const main = /main\s*\{[^}]*grid-template-columns:\s*(\d+)px\s+1fr;[^}]*gap:\s*(\d+)px;[^}]*padding:\s*(\d+)px;/.exec(css);
  const viewer = /\.viewer\s*\{[^}]*border:\s*(\d+)px[^}]*padding:\s*(\d+)px;/.exec(css);
  if (!main || !viewer) throw new Error("styles.css layout changed: update panelWidthFromCss");
  const [, answerCol, gap, mainPad] = main.map(Number);
  const [, border, viewerPad] = viewer.map(Number);
  // grid track for the viewer, minus the panel's own border and padding on both sides
  return screenWidth - 2 * mainPad! - answerCol! - gap! - 2 * border! - 2 * viewerPad!;
}

const answers = JSON.parse(readFileSync(new URL("../examples/web/answers.json", import.meta.url), "utf8")) as Array<{
  id: number;
  page: number;
  quote: string;
}>;

function insidePanel(rect: CssRect, panelWidth: number, pageHeight: number): boolean {
  return rect.left >= 0 && rect.top >= 0 && rect.left + rect.width <= panelWidth && rect.top + rect.height <= pageHeight;
}

describe("web example page fit", () => {
  it("keeps the preferred scale when the page fits and shrinks it when it does not", () => {
    expect(fitScale(SCALE, 612, 814)).toBe(SCALE); // 734px page in an 814px panel
    const shrunk = fitScale(SCALE, 792, 814); // rotated: 950px at SCALE
    expect(shrunk).toBeLessThan(SCALE);
    expect(792 * shrunk).toBeLessThanOrEqual(814 - FIT_MARGIN_PX);
  });

  it("keeps the preferred scale until the panel has been measured", () => {
    expect(fitScale(SCALE, 792, 0)).toBe(SCALE);
    expect(fitScale(SCALE, 792, Number.NaN)).toBe(SCALE);
    expect(fitScale(SCALE, 0, 814)).toBe(SCALE);
  });

  it("reads an ~814px viewer panel from the stylesheet at the screenshot width", () => {
    expect(panelWidthFromCss(SCREEN_WIDTH)).toBe(814);
  });

  it("draws every sample highlight inside the visible panel, rotated page included", async () => {
    const panel = panelWidthFromCss(SCREEN_WIDTH);
    const measure = await createHelveticaMeasurer();
    const { doc, locatorDoc } = await openFixture("6.3");
    const locator = createLocator(locatorDoc, { measure });
    let checked = 0;
    for (const answer of answers) {
      const result = await locator.locate(answer.quote, { pageHint: answer.page });
      if (!result.found) continue; // the hallucinated quote draws nothing
      const page = await doc.getPage(result.page);
      const scale = fitScale(SCALE, page.getViewport({ scale: 1 }).width, panel);
      const viewport = page.getViewport({ scale });
      expect(viewport.width, `page ${result.page} width`).toBeLessThanOrEqual(panel);
      for (const rect of toViewportRects(result.rects, viewport)) {
        expect(insidePanel(rect, panel, viewport.height), `source ${answer.id}: ${JSON.stringify(rect)}`).toBe(true);
      }
      checked += 1;
    }
    expect(checked).toBe(4);
  });

  it("leaves upright pages at SCALE, so the hero, fuzzy and not-found screens do not change", async () => {
    const panel = panelWidthFromCss(SCREEN_WIDTH);
    const { doc } = await openFixture("6.3");
    const page1 = await doc.getPage(1);
    expect(page1.rotate).toBe(0);
    expect(fitScale(SCALE, page1.getViewport({ scale: 1 }).width, panel)).toBe(SCALE);
  });

  it("would put the rotated highlight past the panel edge at the old fixed SCALE", async () => {
    const panel = panelWidthFromCss(SCREEN_WIDTH);
    const measure = await createHelveticaMeasurer();
    const { doc, locatorDoc } = await openFixture("6.3");
    const rotated = answers.find((a) => a.id === 4)!;
    const result = await createLocator(locatorDoc, { measure }).locate(rotated.quote, { pageHint: rotated.page });
    expect(result.found).toBe(true);
    if (!result.found) return;
    const page = await doc.getPage(result.page);
    expect(page.rotate).toBe(90);
    const rects = toViewportRects(result.rects, page.getViewport({ scale: SCALE }));
    // This is the bug the fit fixes: without it the line starts beyond the visible width.
    expect(rects.some((r) => r.left + r.width > panel)).toBe(true);
  });
});
