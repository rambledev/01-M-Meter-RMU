// Quick pre-capture quality gate for Camera Mode — flags a frame as too
// dark/bright or blurry so the checker can be warned BEFORE pressing the
// shutter, instead of finding out after OCR already failed. Deliberately
// separate from meterPreprocess.ts: this runs on a small downscaled frame
// at a higher polling rate for a cheap go/no-go signal, not a full-quality
// OCR preprocessing pass.
//
// Accepts a plain {data, width, height} shape (not the DOM `ImageData`
// type directly) so the assessment logic is unit-testable without a
// browser/canvas — the caller (useCameraQuality.ts) still gets real pixels
// from `CanvasRenderingContext2D.getImageData()`, which structurally
// satisfies this shape.
//
// All three thresholds below are Field Calibration values — see
// lib/calibration/config.ts (single source of truth, revised against
// docs/meter-calibration.md's real-device results).

import { DEFAULT_CALIBRATION_CONFIG } from "@/lib/calibration/config";

export interface PixelBuffer {
  data: ArrayLike<number>; // RGBA, 4 values per pixel
  width: number;
  height: number;
}

export interface QualityAssessment {
  brightness: number; // 0-255 average luma
  blurScore: number; // Laplacian variance — higher = sharper
  isTooDark: boolean;
  isTooBright: boolean;
  isBlurry: boolean;
}

function toGrayscale(buffer: PixelBuffer): Float64Array {
  const gray = new Float64Array(buffer.width * buffer.height);
  const { data } = buffer;
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
}

function averageBrightness(gray: Float64Array): number {
  let sum = 0;
  for (const value of gray) sum += value;
  return sum / gray.length;
}

// Laplacian-variance sharpness estimate: convolve with a simple 4-neighbor
// Laplacian kernel, then take the variance of the result — a sharp image
// (strong, well-defined edges) produces high variance; a blurry image
// (soft, smeared edges) produces low variance.
function laplacianVariance(
  gray: Float64Array,
  width: number,
  height: number,
): number {
  const responses: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const value =
        -4 * gray[idx] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx - width] +
        gray[idx + width];
      responses.push(value);
    }
  }
  if (responses.length === 0) return 0;
  const mean = responses.reduce((sum, v) => sum + v, 0) / responses.length;
  const variance =
    responses.reduce((sum, v) => sum + (v - mean) ** 2, 0) / responses.length;
  return variance;
}

export function assessFrameQuality(buffer: PixelBuffer): QualityAssessment {
  const gray = toGrayscale(buffer);
  const brightness = averageBrightness(gray);
  const blurScore = laplacianVariance(gray, buffer.width, buffer.height);
  const { darkThreshold, brightThreshold, blurThreshold } =
    DEFAULT_CALIBRATION_CONFIG.cameraQuality;
  return {
    brightness,
    blurScore,
    isTooDark: brightness < darkThreshold,
    isTooBright: brightness > brightThreshold,
    isBlurry: blurScore < blurThreshold,
  };
}
