// Transparent grid-lines-only layer (see .tech-grid in src/app/globals.css).
// Paints no background color of its own, so the surface behind it keeps its
// exact existing color/gradient. Pass a `text-*` class to tint the lines
// (they derive from currentColor) and, where needed, a z-index class so it
// sits above the surface's own background but below real content.
export default function TechGridOverlay({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`tech-grid pointer-events-none absolute inset-0 ${className}`}
    />
  );
}
