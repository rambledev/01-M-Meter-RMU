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

// Converts the fractional region into a pixel rectangle for a given image
// size. Pure math only — no image data touched here. Used by
// lib/image/meterCrop.ts to crop the region out of the original photo
// before OCR (Meter ROI Guide refactor — see decision-log.md for why this
// crop step now exists in-memory instead of being left to Tesseract).
//
// Clamped to stay within the image bounds with at least a 1x1 size:
// Tesseract (Leptonica, under the hood) used to abort the whole WASM worker
// on an out-of-bounds or zero-size rectangle instead of throwing a
// catchable JS error, observed against a degenerate (near-zero-pixel) test
// image during Phase 4 browser testing — the same clamp still protects
// meterCrop.ts against a degenerate ROI on a tiny/corrupt photo.
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
