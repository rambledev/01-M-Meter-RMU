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
//
// Meter ROI Guide refactor: this now receives an already-cropped and
// preprocessed image (see lib/image/meterCrop.ts + meterPreprocess.ts) —
// it no longer takes a region/rectangle, since the caller has already
// isolated the digits before this runs (decision-log.md, "Meter ROI Guide").

import type { OcrRecognitionResult } from "./ocrValidation";

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      // Meter displays are digits + a decimal point — restricting the
      // character set measurably improves accuracy over unrestricted text,
      // and keeps stray label text (e.g. "KILOWATT-HOUR METER", "220V") out
      // of the result even if it leaks into the cropped frame.
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789.",
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function recognizeMeterValue(
  preprocessedImageBlob: Blob,
): Promise<OcrRecognitionResult> {
  const worker = await getWorker();
  const { data } = await worker.recognize(preprocessedImageBlob);
  return { value: data.text.trim(), confidence: data.confidence / 100 };
}
