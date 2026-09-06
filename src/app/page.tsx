import Link from "next/link";

const ROLES = [
  {
    label: "ผู้ดูแลระบบ",
    description: "จัดการโซน ห้องพัก มิเตอร์ ผู้ใช้งาน และตั้งค่าระบบ",
    icon: "🛠️",
    href: "/admin",
  },
  {
    label: "ผู้จดมิเตอร์",
    description: "แสกน QR และบันทึกค่ามิเตอร์ไฟฟ้าจากพื้นที่จริง",
    icon: "⚡",
    href: "/checker",
  },
  {
    label: "ผู้บริหาร",
    description: "ดูรายงานสรุป แนวโน้ม และเปรียบเทียบข้อมูลทั้งระบบ",
    icon: "📊",
    href: "/executive",
  },
] as const;

// Home page — role-select landing page (no real login in this MVP, see
// requirement.md §2 / tech-stack.md §4 "(role-select)"). Each button just
// navigates to that role's own route; the actual meter-reading workflow now
// lives at /checker (moved here when this page became the role selector).
export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-linear-to-b from-emerald-50 to-white px-4 py-12 dark:from-zinc-950 dark:to-zinc-950">
      <div className="flex w-full max-w-md flex-col items-center gap-10 text-center">
        <header className="flex flex-col items-center gap-2">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl shadow-sm">
            ⚡
          </span>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            DEMO ระบบเก็บมิเตอร์ไฟฟ้า 2569
          </h1>
          <p className="text-sm text-zinc-500">โดย ฝ่ายพัฒนาระบบเทคโนโลยีสารสนเทศ</p>
        </header>

        <section className="flex w-full flex-col gap-3">
          <h2 className="text-left text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            บทบาทการใช้งาน
          </h2>
          <div className="flex flex-col gap-3">
            {ROLES.map((role) => (
              <Link
                key={role.href}
                href={role.href}
                className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-2xl transition-colors group-hover:bg-emerald-100 dark:bg-emerald-950/40">
                  {role.icon}
                </span>
                <span className="flex flex-col">
                  <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {role.label}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {role.description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-0.5 text-xs text-zinc-400">
          <p>พัฒนาโดย เตโชธ์ เขตอนันต์</p>
          <p>นักวิชาการคอมพิวเตอร์</p>
          <p>ศูนย์เทคโนโลยีดิจิทัลและนวัตกรรม สำนักงานอธิการบดี</p>
        </footer>
      </div>
    </div>
  );
}
