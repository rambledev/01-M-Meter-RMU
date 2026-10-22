import DecorativeBackground from "@/components/DecorativeBackground";

// Sets the admin red palette (src/app/globals.css's [data-role="admin"]
// scale) for everything under /admin — a pure attribute carrier, not a
// layout box, so `contents` keeps it out of the flex/grid flow entirely.
// DecorativeBackground renders as a child here specifically (not at the
// root layout) so it picks up this red scale via the same [data-role]
// CSS-variable inheritance every other primary-* class relies on.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-role="admin" className="contents">
      <DecorativeBackground />
      {children}
    </div>
  );
}
