import type { CSSProperties, ReactElement } from "react";
import { toViewportRects } from "../viewport.js";
import type { PdfRect, ViewportLike } from "../types.js";

export interface CitationHighlightsProps {
  /** Result rectangles (may contain several pages; only `page` is drawn). */
  rects: ReadonlyArray<PdfRect>;
  /** Viewport of the rendered page, e.g. `page.getViewport({ scale })`. */
  viewport: ViewportLike;
  /** 1-based page number this overlay sits on. */
  page: number;
  /** Highlight fill. Default semi-transparent yellow. */
  color?: string;
  className?: string;
  /** Accessible label of each mark. Default "Citation". */
  label?: string;
  /** Called with the index of the clicked rectangle in `rects`. */
  onSelect?: (index: number) => void;
}

/**
 * Absolutely positioned highlight boxes. Put it inside the page container
 * (for react-pdf: as a child of `<Page>`), which must be `position: relative`.
 */
export function CitationHighlights(props: CitationHighlightsProps): ReactElement {
  const { rects, viewport, page, color = "rgba(255, 213, 0, 0.4)", className, label = "Citation", onSelect } = props;
  const entries = rects.map((rect, index) => ({ rect, index })).filter((e) => e.rect.page === page);
  const css = toViewportRects(
    entries.map((e) => e.rect),
    viewport,
  );
  const wrapper: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };
  return (
    <div data-pdf-cite-locate="" style={wrapper}>
      {entries.map((entry, i) => {
        const box = css[i] as (typeof css)[number];
        const style: CSSProperties = {
          position: "absolute",
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          background: color,
          mixBlendMode: "multiply",
          pointerEvents: onSelect ? "auto" : "none",
          cursor: onSelect ? "pointer" : undefined,
        };
        return (
          <div
            key={entry.index}
            role="mark"
            aria-label={label}
            className={className}
            style={style}
            onClick={onSelect ? () => onSelect(entry.index) : undefined}
          />
        );
      })}
    </div>
  );
}
