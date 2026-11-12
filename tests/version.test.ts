import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { VERSION } from "../src/index.js";
import { createCanvasMeasurer } from "../src/dom/index.js";
import { LocateError } from "../src/index.js";

describe("package metadata", () => {
  it("keeps the VERSION constant equal to package.json and the changelog", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(VERSION).toBe(pkg.version);
    const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
    expect(changelog).toContain(`## [${pkg.version}]`);
  });
});

describe("createCanvasMeasurer", () => {
  it("measures with the font family of the item style", () => {
    const ctx = { font: "", measureText: vi.fn(() => ({ width: 42 })) };
    const measure = createCanvasMeasurer({ f1: { fontFamily: "Georgia" } }, { getContext: () => ctx });
    const width = measure("abc", { str: "abc", transform: [1, 0, 0, 1, 0, 0], width: 1, height: 1, fontName: "f1" });
    expect(width).toBe(42);
    expect(ctx.font).toBe("100px Georgia");
  });

  it("explains how to proceed when no canvas is available", () => {
    expect(() => createCanvasMeasurer({}, { getContext: () => null })).toThrowError(LocateError);
  });
});
