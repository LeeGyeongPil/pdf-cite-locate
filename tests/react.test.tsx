// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toViewportRects, type PdfRect } from "../src/index.js";
import { CitationHighlights } from "../src/react/index.js";

afterEach(cleanup);

const viewport = { transform: [1.5, 0, 0, -1.5, 0, 1188], width: 918, height: 1188 };
const rects: PdfRect[] = [
  { page: 2, x0: 10, y0: 10, x1: 50, y1: 20 },
  { page: 1, x0: 72, y0: 664, x1: 300, y1: 676 },
  { page: 1, x0: 72, y0: 648, x1: 200, y1: 660 },
];

describe("<CitationHighlights>", () => {
  it("draws one mark per rectangle of its page, positioned like toViewportRects", () => {
    render(<CitationHighlights rects={rects} viewport={viewport} page={1} />);
    const marks = screen.getAllByRole("mark");
    expect(marks).toHaveLength(2);
    const css = toViewportRects(rects.slice(1), viewport);
    marks.forEach((mark, i) => {
      const box = css[i]!;
      expect(parseFloat(mark.style.left)).toBeCloseTo(box.left, 6);
      expect(parseFloat(mark.style.top)).toBeCloseTo(box.top, 6);
      expect(parseFloat(mark.style.width)).toBeCloseTo(box.width, 6);
      expect(parseFloat(mark.style.height)).toBeCloseTo(box.height, 6);
    });
  });

  it("calls onSelect with the index in the original rects array", () => {
    const onSelect = vi.fn();
    render(<CitationHighlights rects={rects} viewport={viewport} page={1} onSelect={onSelect} label="Source" />);
    const marks = screen.getAllByLabelText("Source");
    fireEvent.click(marks[1]!);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("draws nothing for a page without rectangles", () => {
    render(<CitationHighlights rects={rects} viewport={viewport} page={3} />);
    expect(screen.queryAllByRole("mark")).toHaveLength(0);
  });
});
