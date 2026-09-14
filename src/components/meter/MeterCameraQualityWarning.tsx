import type { QualityAssessment } from "@/lib/image/cameraQuality";

interface MeterCameraQualityWarningProps {
  quality: QualityAssessment | null;
}

// Pre-capture warning only — never blocks the shutter, just tells the
// checker why a bad frame is likely before they waste a photo on it.
export default function MeterCameraQualityWarning({
  quality,
}: MeterCameraQualityWarningProps) {
  if (!quality) return null;

  let message: string | null = null;
  if (quality.isTooDark) message = "⚠️ ภาพมืดเกินไป กรุณาเปิดไฟเพิ่ม";
  else if (quality.isTooBright) message = "⚠️ ภาพสว่างเกินไป กรุณาหลีกเลี่ยงแสงสะท้อน";
  else if (quality.isBlurry) message = "⚠️ ภาพเบลอ กรุณาถือมือถือให้นิ่งและโฟกัสให้ชัด";

  if (!message) return null;

  return (
    <div className="pointer-events-none rounded-lg bg-red-600/90 px-3 py-1.5 text-sm font-medium text-white shadow">
      {message}
    </div>
  );
}
