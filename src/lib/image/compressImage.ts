// Resizes/re-encodes the ORIGINAL captured photo before it is stored — this
// is never a crop, only a smaller re-encoding of the same full frame
// (ห้ามสร้าง crop image เพื่อเก็บแทน original, Phase 4 spec item 8).
// Browser-only (canvas/createImageBitmap) — exercised via the Playwright
// browser test rather than a Node/vitest unit test.

export interface CompressImageOptions {
  maxDimension?: number; // longest side, in pixels
  quality?: number; // JPEG quality, 0-1
}

export async function compressImage(
  blob: Blob,
  options: CompressImageOptions = {},
): Promise<Blob> {
  const { maxDimension = 1600, quality = 0.8 } = options;

  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const compressed = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", quality);
    });
    return compressed ?? blob;
  } finally {
    bitmap.close();
  }
}
