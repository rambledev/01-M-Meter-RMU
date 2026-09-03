// Fixed default OCR region (fraction of the full image) — good enough for a
// demo; no draggable/resizable crop UI needed (ocr-strategy.md §4).
export interface OcrRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_OCR_REGION: OcrRegion = {
  x: 0.15,
  y: 0.375,
  width: 0.7,
  height: 0.25,
};

export interface PixelRectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Converts the fractional region into the pixel rectangle Tesseract expects
// for a given image size. Pure math only — no image data touched here, so
// nothing crop-shaped is ever created by this function.
//
// Clamped to stay within the image bounds with at least a 1x1 size: Tesseract
// (Leptonica, under the hood) aborts the whole WASM worker on an out-of-bounds
// or zero-size rectangle instead of throwing a catchable JS error, which was
// observed against a degenerate (near-zero-pixel) test image during Phase 4
// browser testing. Real camera photos are always far larger than the region,
// so this only ever matters for pathological inputs.
export function regionToRectangle(
  region: OcrRegion,
  imageWidth: number,
  imageHeight: number,
): PixelRectangle {
  const maxLeft = Math.max(imageWidth - 1, 0);
  const maxTop = Math.max(imageHeight - 1, 0);
  const left = Math.min(Math.max(Math.round(region.x * imageWidth), 0), maxLeft);
  const top = Math.min(Math.max(Math.round(region.y * imageHeight), 0), maxTop);
  const width = Math.max(
    1,
    Math.min(Math.round(region.width * imageWidth), imageWidth - left),
  );
  const height = Math.max(
    1,
    Math.min(Math.round(region.height * imageHeight), imageHeight - top),
  );
  return { left, top, width, height };
}
