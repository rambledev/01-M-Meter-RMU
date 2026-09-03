# src/lib/ocr

Client-side OCR — Tesseract.js only, no backend/API (locked at Phase 4 kickoff).

- `ocrRegion.ts` — the fixed default OCR region (fraction of the image) and
  the pure math that converts it to pixel coordinates for a given image size.
- `ocrProvider.ts` — `recognizeMeterValue(imageBlob, region?)`. Sends the
  **original full image** plus a `rectangle` to Tesseract.js, which crops
  internally in WASM memory — no cropped image is ever created or persisted
  by this code (see `docs/ocr-strategy.md` §5).

Offline caveat: Tesseract.js downloads its worker/core/trained-data from a
CDN on first use; the browser then caches those assets for offline use
afterward. See `docs/ocr-strategy.md` §5.4 for why this wasn't self-hosted
in Phase 4.
