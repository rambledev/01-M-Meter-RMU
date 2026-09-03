import { describe, expect, it } from "vitest";
import { DEFAULT_OCR_REGION, regionToRectangle } from "./ocrRegion";

describe("regionToRectangle", () => {
  it("converts a fractional region into pixel coordinates for a given image size", () => {
    const rect = regionToRectangle(
      { x: 0.25, y: 0.5, width: 0.5, height: 0.25 },
      1000,
      800,
    );
    expect(rect).toEqual({ left: 250, top: 400, width: 500, height: 200 });
  });

  it("works with the default region", () => {
    const rect = regionToRectangle(DEFAULT_OCR_REGION, 2000, 1000);
    expect(rect).toEqual({ left: 300, top: 375, width: 1400, height: 250 });
  });

  it("clamps to a valid rectangle for a degenerate (near-zero-pixel) image", () => {
    // Regression: an unclamped rectangle here crashed the Tesseract/Leptonica
    // WASM worker outright instead of raising a catchable error.
    const rect = regionToRectangle(DEFAULT_OCR_REGION, 1, 1);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.width).toBeGreaterThanOrEqual(1);
    expect(rect.height).toBeGreaterThanOrEqual(1);
    expect(rect.left + rect.width).toBeLessThanOrEqual(1);
    expect(rect.top + rect.height).toBeLessThanOrEqual(1);
  });
});
