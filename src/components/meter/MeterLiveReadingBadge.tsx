import type { LiveOcrState } from "@/lib/ocr/useLiveOcr";

interface MeterLiveReadingBadgeProps {
  state: LiveOcrState;
}

// Purely a live SUGGESTION display — never writes any state and never
// triggers a save. The checker still confirms the value explicitly further
// down the page (MeterPreview / the confirmation card), same as before.
// Unpositioned by design — the caller places it (both MeterCamera and
// MeterImageEditor stack it inside their own absolutely-positioned overlay
// container alongside other overlays like the quality warning).
export default function MeterLiveReadingBadge({
  state,
}: MeterLiveReadingBadgeProps) {
  const confidencePercent = Math.round(state.confidence * 100);

  if (state.status === "stable") {
    return (
      <div className="pointer-events-none rounded-lg bg-emerald-600/90 px-3 py-1.5 text-sm font-bold text-white shadow">
        อ่านได้: {state.value} ✓ ({confidencePercent}%)
      </div>
    );
  }

  if (state.status === "unstable") {
    return (
      <div className="pointer-events-none rounded-lg bg-amber-500/90 px-3 py-1.5 text-sm font-medium text-white shadow">
        อ่านได้: {state.value} ({confidencePercent}%) — กำลังตรวจสอบ...
      </div>
    );
  }

  return (
    <div className="pointer-events-none rounded-lg bg-black/70 px-3 py-1.5 text-sm font-medium text-white shadow">
      กำลังอ่าน...
    </div>
  );
}
