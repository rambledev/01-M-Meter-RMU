import { DEFAULT_OCR_REGION, type OcrRegion } from "@/lib/ocr/ocrRegion";

interface MeterGuideOverlayProps {
  region?: OcrRegion;
}

// Purely visual — must line up with the region lib/image/meterCrop.ts
// actually crops (DEFAULT_OCR_REGION by default), or OCR will read a
// different part of the frame than what the user lined up in the guide.
// pointer-events-none so it never intercepts taps on the video/shutter.
export default function MeterGuideOverlay({
  region = DEFAULT_OCR_REGION,
}: MeterGuideOverlayProps) {
  return (
    <div
      className="pointer-events-none absolute border-4 border-yellow-400"
      style={{
        left: `${region.x * 100}%`,
        top: `${region.y * 100}%`,
        width: `${region.width * 100}%`,
        height: `${region.height * 100}%`,
      }}
    />
  );
}
