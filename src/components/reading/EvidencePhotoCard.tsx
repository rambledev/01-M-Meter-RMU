import MeterCamera from "@/components/meter/MeterCamera";
import MeterPreview from "@/components/meter/MeterPreview";

interface EvidencePhotoCardProps {
  imageBlob: Blob | null;
  imageUrl: string | null;
  onCapture: (blob: Blob) => void;
  onRetake: () => void;
}

// Manual Reading-first redesign (2026-09-15): the photo here is EVIDENCE
// only — proof the checker was at the meter, nothing more. No ROI, no
// crop, no OCR trigger, no OCR result — MeterCamera's `showLiveOcr=false`
// keeps the live-OCR pipeline from running at all (not just hidden), and
// MeterPreview is used without its optional OCR props so that UI doesn't
// render either. Camera Quality (blur/brightness) stays on in MeterCamera
// regardless — a warning only, never blocks attaching the photo.
//
// Selecting a file (camera OR "เลือกภาพจากเครื่อง") both land here as the
// same evidence blob — no ROI editor step, unlike the OCR-assist upload
// flow this replaces in the active UI (still available for a future
// OCR-assist mode via components/meter/MeterImageEditor.tsx, untouched).
export default function EvidencePhotoCard({
  imageBlob,
  imageUrl,
  onCapture,
  onRetake,
}: EvidencePhotoCardProps) {
  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm font-semibold">หลักฐานการอ่าน</p>
      {!imageBlob ? (
        <MeterCamera
          onCapture={(blob) => onCapture(blob)}
          onFileSelected={(file) => onCapture(file)}
          showLiveOcr={false}
        />
      ) : (
        <MeterPreview imageUrl={imageUrl ?? ""} onRetake={onRetake} />
      )}
      <p
        className={`text-sm font-medium ${
          imageBlob
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-amber-700 dark:text-amber-400"
        }`}
      >
        {imageBlob ? "✓ แนบภาพแล้ว" : "ยังไม่ได้แนบภาพ — ต้องถ่ายภาพก่อนจึงจะบันทึกได้"}
      </p>
    </section>
  );
}
