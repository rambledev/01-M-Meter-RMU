import { describe, expect, it } from "vitest";
import {
  clampRegion,
  clampZoom,
  distanceBetween,
  midpointOf,
  moveRect,
  regionToScreenRect,
  resizeRect,
  screenRectToRegion,
} from "./roiEditor";

describe("clampZoom", () => {
  it("clamps within [1, 4]", () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(10)).toBe(4);
  });
});

describe("clampRegion", () => {
  it("keeps a valid region unchanged", () => {
    expect(clampRegion({ x: 0.15, y: 0.375, width: 0.7, height: 0.25 })).toEqual({
      x: 0.15,
      y: 0.375,
      width: 0.7,
      height: 0.25,
    });
  });

  it("clamps a region that overflows the image bounds", () => {
    expect(clampRegion({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 })).toEqual({
      x: 0.5,
      y: 0.5,
      width: 0.5,
      height: 0.5,
    });
  });

  it("enforces a minimum size instead of collapsing to zero", () => {
    const region = clampRegion({ x: 0.5, y: 0.5, width: 0, height: 0 });
    expect(region.width).toBeGreaterThan(0);
    expect(region.height).toBeGreaterThan(0);
  });
});

describe("regionToScreenRect / screenRectToRegion round trip", () => {
  const transform = { scale: 2, offsetX: 10, offsetY: 20 };
  const imageWidth = 1000;
  const imageHeight = 800;

  it("round-trips a region through screen space", () => {
    const region = { x: 0.15, y: 0.375, width: 0.7, height: 0.25 };
    const rect = regionToScreenRect(region, transform, imageWidth, imageHeight);
    const roundTripped = screenRectToRegion(rect, transform, imageWidth, imageHeight);
    expect(roundTripped.x).toBeCloseTo(region.x, 5);
    expect(roundTripped.y).toBeCloseTo(region.y, 5);
    expect(roundTripped.width).toBeCloseTo(region.width, 5);
    expect(roundTripped.height).toBeCloseTo(region.height, 5);
  });
});

describe("moveRect", () => {
  it("translates a rect by (dx, dy) without changing its size", () => {
    const rect = { left: 10, top: 20, width: 100, height: 50 };
    expect(moveRect(rect, 5, -5)).toEqual({ left: 15, top: 15, width: 100, height: 50 });
  });
});

describe("distanceBetween / midpointOf", () => {
  it("computes euclidean distance between two points", () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("computes the midpoint between two points", () => {
    expect(midpointOf({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });
});

describe("resizeRect", () => {
  const rect = { left: 100, top: 100, width: 200, height: 100 };

  it("dragging the se corner keeps the nw corner (left/top) fixed", () => {
    const result = resizeRect(rect, "se", 20, 10);
    expect(result).toEqual({ left: 100, top: 100, width: 220, height: 110 });
  });

  it("dragging the nw corner keeps the se corner fixed", () => {
    const result = resizeRect(rect, "nw", -20, -10);
    expect(result.width).toBe(220);
    expect(result.height).toBe(110);
    expect(result.left + result.width).toBeCloseTo(rect.left + rect.width, 5);
    expect(result.top + result.height).toBeCloseTo(rect.top + rect.height, 5);
  });

  it("does not collapse below the minimum size when dragged inward past it", () => {
    const result = resizeRect(rect, "se", -190, -90);
    expect(result.width).toBeGreaterThanOrEqual(16);
    expect(result.height).toBeGreaterThanOrEqual(16);
  });
});
