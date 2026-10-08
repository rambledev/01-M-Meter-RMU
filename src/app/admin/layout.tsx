// Sets the admin red palette (src/app/globals.css's [data-role="admin"]
// scale) for everything under /admin — a pure attribute carrier, not a
// layout box, so `contents` keeps it out of the flex/grid flow entirely.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-role="admin" className="contents">
      {children}
    </div>
  );
}
