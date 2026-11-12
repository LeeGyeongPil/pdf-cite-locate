import { describe, expect, it } from "vitest";
import { createLocator } from "../src/index.js";
import { createHelveticaMeasurer } from "./helpers/helvetica.js";
import { openFixture, readExpected } from "./helpers/load-pdf.js";

const typing = readExpected().spans.typing!;

describe("x precision", () => {
  it("estimates proportionally without a measurer and says so", async () => {
    const { locatorDoc } = await openFixture("6.3");
    const result = await createLocator(locatorDoc).locate(typing.quote, { pageHint: 1 });
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.approx).toBe(true);
    const box = typing.boxes[0]!;
    const rect = result.rects[0]!;
    const limit = 0.6 * 12;
    expect(Math.abs(rect.x0 - box.x0)).toBeLessThanOrEqual(limit);
    expect(Math.abs(rect.x1 - box.x1)).toBeLessThanOrEqual(limit);
  });

  it("is within 0.5pt with Helvetica glyph widths", async () => {
    const measure = await createHelveticaMeasurer();
    const { locatorDoc } = await openFixture("6.3");
    const result = await createLocator(locatorDoc, { measure }).locate(typing.quote, { pageHint: 1 });
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.approx).toBe(false);
    const box = typing.boxes[0]!;
    const rect = result.rects[0]!;
    expect(Math.abs(rect.x0 - box.x0)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(rect.x1 - box.x1)).toBeLessThanOrEqual(0.5);
  });
});
