// Sets the checker blue palette (src/app/globals.css's [data-role="checker"]
// scale) for /checker, /checker/reading, and /checker/history in one place
// — including CheckerAuthGate's own login screen, since the gate renders
// inside each page, which is inside this layout. Pure attribute carrier;
// `contents` keeps it out of the flex/grid flow entirely.
export default function CheckerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-role="checker" className="contents">
      {children}
    </div>
  );
}
