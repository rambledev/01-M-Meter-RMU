// Dark "hero" background for the home/login page only (2026-10-22, explicit
// request with a reference screenshot: navy gradient + grid lines behind a
// two-column hero). Deliberately distinct from every other page's light
// DecorativeBackground — the home page has no [data-role], so the muted
// neutral primary-* scale reads as plain gray, not a real "navy hero," so
// this uses fixed navy/blue values instead of the primary-* token system.
// The login card itself stays solid white, so the standing "page background
// always white" rule still holds for every *content* surface — only this
// one hero section behind it is intentionally dark.
export default function LoginHeroBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-linear-to-br from-[#0a1230] via-[#0e1c42] to-[#13275a]"
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="absolute -top-32 -right-20 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-80 w-80 -translate-x-1/3 translate-y-1/3 rounded-full bg-indigo-400/10 blur-3xl" />
    </div>
  );
}
