// Prepares a cropped meter-digit image for OCR: upscale, grayscale, contrast
// enhancement, denoise, then threshold to pure black/white. Improves
// Tesseract accuracy on small, low-contrast, or glare-affected digit
// crops. In memory only, same as meterCrop.ts — never persisted.
// Browser-only (canvas) — no Node/vitest unit test, same as compressImage.ts.

export interface PreprocessOptions {
  scale?: number; // upscale factor applied to the crop, 2-4x
  contrast?: number; // -100..100, positive = more contrast
}

export async function preprocessForOcr(
  imageBlob: Blob,
  options: PreprocessOptions = {},
): Promise<Blob> {
  const { scale = 3, contrast = 60 } = options;

  const bitmap = await createImageBitmap(imageBlob);
  let width: number;
  let height: number;
  try {
    width = Math.max(1, Math.round(bitmap.width * scale));
    height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return imageBlob;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const gray = toGrayscale(imageData.data, width, height);
    const denoised = medianDenoise(gray, width, height);
    const contrasted = applyContrast(denoised, contrast);
    const threshold = otsuThreshold(contrasted);
    const binary = applyThreshold(contrasted, threshold);

    writeGrayscale(imageData.data, binary);
    ctx.putImageData(imageData, 0, 0);

    const processed = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/png");
    });
    return processed ?? imageBlob;
  } finally {
    bitmap.close();
  }
}

function toGrayscale(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
    // Standard luma weights.
    gray[p] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  }
  return gray;
}

// 3x3 median filter — removes salt-and-pepper/sensor noise without
// smearing digit edges the way a mean blur would.
function medianDenoise(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length);
  const window = new Uint8ClampedArray(9);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(width - 1, Math.max(0, x + dx));
          window[n++] = gray[yy * width + xx];
        }
      }
      window.sort();
      out[y * width + x] = window[4];
    }
  }
  return out;
}

function applyContrast(
  gray: Uint8ClampedArray,
  contrast: number,
): Uint8ClampedArray {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = factor * (gray[i] - 128) + 128;
  }
  return out;
}

// Otsu's method — picks a threshold from the image's own histogram instead
// of a fixed guess, so it adapts to different lighting/glare per photo.
function otsuThreshold(gray: Uint8ClampedArray): number {
  const histogram = new Array(256).fill(0);
  for (const value of gray) histogram[value]++;

  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;

    const variance =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) ** 2;
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  return threshold;
}

function applyThreshold(
  gray: Uint8ClampedArray,
  threshold: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = gray[i] >= threshold ? 255 : 0;
  }
  return out;
}

function writeGrayscale(rgba: Uint8ClampedArray, gray: Uint8ClampedArray) {
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
    rgba[i] = gray[p];
    rgba[i + 1] = gray[p];
    rgba[i + 2] = gray[p];
  }
}
