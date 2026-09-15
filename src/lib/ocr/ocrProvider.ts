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
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("eng");
      // PSM.SINGLE_LINE: the crop is already a tight single row of digits
      // (meterCrop.ts + meterPreprocess.ts), so tell Tesseract to expect
      // exactly that instead of guessing a general page layout.
      //
      // Deliberately NOT using tessedit_char_whitelist here (it did restrict
      // output to digits/'.', but real-device testing during Field
      // Calibration found it makes Tesseract's LSTM engine report 0%
      // confidence on every read — even when the text itself comes back
      // correct — a known upstream issue combining char_whitelist with the
      // LSTM engine's confidence reporting (tesseract-ocr/tesseract#3706,
      // #4175). ocrValidation.ts's digit-format regex already rejects
      // anything non-numeric that whitelisting would have blocked, so
      // dropping it costs nothing on correctness and fixes confidence.
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
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
