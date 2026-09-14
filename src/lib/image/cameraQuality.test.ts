import { describe, expect, it } from "vitest";
import { assessFrameQuality, type PixelBuffer } from "./cameraQuality";

function solidBuffer(width: number, height: number, gray: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

function checkerboardBuffer(width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray = (x + y) % 2 === 0 ? 0 : 255;
      data[idx] = gray;
      data[idx + 1] = gray;
      data[idx + 2] = gray;
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

describe("assessFrameQuality", () => {
  it("flags a solid dark frame as too dark and blurry (no edges at all)", () => {
    const result = assessFrameQuality(solidBuffer(20, 20, 10));
    expect(result.brightness).toBeCloseTo(10, 0);
    expect(result.isTooDark).toBe(true);
    expect(result.isTooBright).toBe(false);
    expect(result.isBlurry).toBe(true);
    expect(result.blurScore).toBe(0);
  });

  it("flags a solid bright frame as too bright", () => {
    const result = assessFrameQuality(solidBuffer(20, 20, 240));
    expect(result.isTooBright).toBe(true);
    expect(result.isTooDark).toBe(false);
  });

  it("treats a mid-brightness solid frame as neither too dark nor too bright", () => {
    const result = assessFrameQuality(solidBuffer(20, 20, 128));
    expect(result.isTooDark).toBe(false);
    expect(result.isTooBright).toBe(false);
  });

  it("scores a high-contrast checkerboard as sharp (high blur score, not blurry)", () => {
    const result = assessFrameQuality(checkerboardBuffer(20, 20));
    expect(result.blurScore).toBeGreaterThan(50);
    expect(result.isBlurry).toBe(false);
  });
});
