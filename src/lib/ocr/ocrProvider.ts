// Client-side OCR wrapper — Tesseract.js only, no backend/API (decision-log.md,
// ocr-strategy.md §3 confirmed at Phase 4 kickoff). Kept behind this one
// function so a future provider swap never touches the UI or data model.
//
// Offline caveat: Tesseract.js downloads its worker script, WASM core, and
// "eng" trained-data (a few MB total) from a CDN the first time it runs. The
// browser then caches those assets (Cache Storage API), so every OCR run
// after that first one works offline. There is no bundled/self-hosted copy
// of those assets in this repo yet — see docs/ocr-strategy.md for why that
// was intentionally deferred instead of blocking this phase.

import { DEFAULT_OCR_REGION, regionToRectangle, type OcrRegion } from "./ocrRegion";

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      // Meter displays are digits + a decimal point — restricting the
      // character set measurably improves accuracy over unrestricted text.
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789.",
      });
      return worker;
    })();
  }
  return workerPromise;
}

// Reads only the given region of the ORIGINAL image — the region is passed
// to Tesseract as a `rectangle` alongside the full image; Tesseract crops
// internally in WASM memory. This code never builds or persists a separate
// cropped image (ocr-strategy.md §4: "ไม่จัดเก็บ OCR Crop Image แบบถาวร").
export async function recognizeMeterValue(
  imageBlob: Blob,
  region: OcrRegion = DEFAULT_OCR_REGION,
): Promise<string> {
  const bitmap = await createImageBitmap(imageBlob);
  let rectangle;
  try {
    rectangle = regionToRectangle(region, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }

  const worker = await getWorker();
  const { data } = await worker.recognize(imageBlob, { rectangle });
  return data.text.trim();
}
