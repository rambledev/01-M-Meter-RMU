import DecorativeBackground from "@/components/DecorativeBackground";

// Sets the resident green palette (src/app/globals.css's
// [data-role="resident"] scale) for everything under /resident —
// including ResidentAuthGate's own login screen, since the gate renders
// inside the page, which is inside this layout. Pure attribute carrier;
// `contents` keeps it out of the flex/grid flow entirely.
export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-role="resident" className="contents">
      <DecorativeBackground />
      {children}
    </div>
  );
}
