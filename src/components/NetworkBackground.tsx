// Site-wide background (2026-10-28, explicit request with a reference
// image: dark charcoal + blue "network/constellation" graphic as the
// background of the whole system). Rendered once in the root layout,
// fixed behind every page (-z-10), replacing the per-role light
// DecorativeBackground, the home-only LoginHeroBackground and the
// tech-grid overlay. The image is decoration only, so it stays a CSS
// background (no <img>, no alt text) on top of its own base color, which
// shows while the image loads. A soft edge vignette keeps the busiest
// line clusters from competing with page content; readable content sits
// on .surface-panel (see globals.css) or on the existing white cards.
export default function NetworkBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[#161616]">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/bg-network.jpg)" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(0_0_0/0.45)_100%)]" />
    </div>
  );
}
