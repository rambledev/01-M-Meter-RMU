type OcrStatus = "idle" | "loading" | "done" | "error";

interface MeterPreviewProps {
  imageUrl: string;
  onRetake: () => void;
  // OCR trigger/result are optional (Manual Reading-first redesign,
  // 2026-09-15) — the active evidence-photo flow (EvidencePhotoCard.tsx)
  // omits all of these, so the "อ่านตัวเลข" button and its result simply
  // don't render at all. Left in place (rather than removed) so a future
  // OCR-assist mode can reuse this same component unchanged.
  onRunOcr?: () => void;
  ocrStatus?: OcrStatus;
  ocrValue?: string;
  ocrError?: string | null;
}

// Captured-photo review step: retake, and (only when the OCR props are
// supplied) run OCR + show its result/error.
export default function MeterPreview({
  imageUrl,
  onRetake,
  onRunOcr,
  ocrStatus,
  ocrValue,
  ocrError,
}: MeterPreviewProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="ภาพมิเตอร์ที่ถ่าย"
        className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700"
      />
      <button
        type="button"
        onClick={onRetake}
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
      >
        ถ่ายใหม่
      </button>

      {onRunOcr && (
        <button
          type="button"
          onClick={onRunOcr}
          disabled={ocrStatus === "loading"}
          className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
        >
          {ocrStatus === "loading" ? "กำลังอ่านตัวเลข..." : "🔎 อ่านตัวเลข"}
        </button>
      )}

      {onRunOcr && ocrStatus === "done" && (
        <p className="text-sm text-zinc-500">
          OCR: <span className="font-semibold">{ocrValue || "(ว่าง)"}</span>
        </p>
      )}
      {onRunOcr && ocrError && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
          {ocrError}
        </p>
      )}
    </div>
  );
}
