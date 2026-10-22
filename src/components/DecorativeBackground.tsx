import TechGridOverlay from "@/components/TechGridOverlay";

// Soft, modern decorative background (2026-10-22, explicit request: every
// page should have a "modern graphic" background matching each role's
// color). Plain server component — three large, blurred, low-opacity
// gradient blobs in the ambient `primary-*` color (resolves to red/blue/
// green/neutral automatically via whichever [data-role] ancestor this
// renders under, the same CSS-variable mechanism every other primary-*
// class already uses — no per-role logic needed here at all).
//
// Deliberately NOT a solid/dark background: this still has to satisfy the
// earlier "background is always white" requirement (the dark-mode-turned-
// black bug) — these blobs sit at low opacity on the normal white page
// background, fixed behind all real content (-z-10), so every solid
// white/zinc card still reads as a clean white card on top of a subtly
// decorated page, never as a colored or dark page.
export default function DecorativeBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-primary-200/50 blur-3xl sm:h-96 sm:w-96" />
      <div className="absolute top-1/3 -left-32 h-72 w-72 rounded-full bg-primary-300/30 blur-3xl sm:h-96 sm:w-96" />
      <div className="absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-primary-100/60 blur-3xl sm:h-80 sm:w-80" />
      <TechGridOverlay className="text-primary-900" />
    </div>
  );
}
