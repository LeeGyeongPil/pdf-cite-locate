// Page scale for the web example: never wider than the viewer panel.
//
// A rotated page (90/270) is wider than tall: 792pt x 1.2 = 950px does not fit an ~814px panel,
// and the highlight on its right column ends up outside the visible area. So the page is drawn at
// SCALE when it fits, and shrunk to the panel width when it does not. The same scale goes to
// <Page scale> and page.getViewport({ scale }), so the highlight boxes always line up with the canvas.

/** Preferred zoom when the page fits the panel. */
export const SCALE = 1.2;

/** Space kept free on the right so a rounding error never adds a horizontal scrollbar. */
export const FIT_MARGIN_PX = 4;

/**
 * @param maxScale          preferred scale (SCALE)
 * @param pageWidthAtScale1 page width in CSS px at scale 1, rotation included (getViewport({ scale: 1 }).width)
 * @param panelWidthPx      content width of the viewer panel; 0 or unknown keeps maxScale
 */
export function fitScale(maxScale: number, pageWidthAtScale1: number, panelWidthPx: number): number {
  // Not measured yet (first render, jsdom): keep the preferred scale.
  if (!(panelWidthPx > 0) || !(pageWidthAtScale1 > 0)) return maxScale;
  const fit = (panelWidthPx - FIT_MARGIN_PX) / pageWidthAtScale1;
  if (fit >= maxScale) return maxScale; // fits: unchanged zoom
  // Round down to 3 decimals so the canvas is never a fraction of a pixel too wide.
  return Math.max(0.1, Math.floor(fit * 1000) / 1000);
}
