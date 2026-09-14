// Crops the meter-digit region out of the original photo, in memory only —
// never persisted (decision-log.md, "Meter ROI Guide": the crop exists only
// long enough to feed lib/image/meterPreprocess.ts + the OCR provider; the
// ORIGINAL photo is still the only image ever saved via saveOfflineReading).
// Browser-only (canvas/createImageBitmap) — no Node/vitest unit test, same
// as compressImage.ts.

import { regionToRectangle, type OcrRegion } from "@/lib/ocr/ocrRegion";

export async function cropToRegion(
  imageBlob: Blob,
  region: OcrRegion,
): Promise<Blob> {
  const bitmap = await createImageBitmap(imageBlob);
  try {
    const rect = regionToRectangle(region, bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return imageBlob;
    ctx.drawImage(
      bitmap,
      rect.left,
      rect.top,
      rect.width,
      rect.height,
      0,
      0,
      rect.width,
      rect.height,
    );

    const cropped = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/png");
    });
    return cropped ?? imageBlob;
  } finally {
    bitmap.close();
  }
}
