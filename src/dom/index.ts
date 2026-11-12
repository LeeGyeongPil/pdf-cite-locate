import { LocateError } from "../errors.js";
import type { Measurer, TextStyleLike } from "../types.js";

/** Minimal 2D context surface used here (satisfied by canvas and OffscreenCanvas contexts). */
export interface MeasureContext {
  font: string;
  measureText(text: string): { width: number };
}

export interface CanvasMeasurerOptions {
  /** Supply your own context (tests, workers). Default: OffscreenCanvas or a detached <canvas>. */
  getContext?: () => MeasureContext | null;
}

const REFERENCE_SIZE = 100; // measuring at a fixed size; callers rescale to item.width

function defaultContext(): MeasureContext | null {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(1, 1).getContext("2d") as MeasureContext | null;
  if (typeof document !== "undefined") return document.createElement("canvas").getContext("2d");
  return null;
}

/**
 * Builds a `Measurer` from the `styles` of a text content: text widths come from the browser
 * with the same font family pdf.js' text layer uses, so partial-item x positions are precise.
 */
export function createCanvasMeasurer(
  styles: Record<string, TextStyleLike> | undefined,
  options: CanvasMeasurerOptions = {},
): Measurer {
  const ctx = (options.getContext ?? defaultContext)();
  if (!ctx) {
    throw new LocateError(
      "INVALID_OPTIONS",
      "createCanvasMeasurer needs a browser (OffscreenCanvas or document). In Node, pass your own Measurer or omit it.",
    );
  }
  return (text, item, style) => {
    const resolved = style ?? (item.fontName ? styles?.[item.fontName] : undefined);
    ctx.font = `${REFERENCE_SIZE}px ${resolved?.fontFamily ?? "sans-serif"}`;
    return ctx.measureText(text).width;
  };
}
