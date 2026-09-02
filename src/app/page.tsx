export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 text-center dark:bg-black">
      <main className="flex w-full max-w-sm flex-col items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          RMU Meter Collection
        </h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Project foundation (Phase 0) พร้อมใช้งาน — ยังไม่มี workflow จดมิเตอร์จริงในเวอร์ชันนี้
        </p>
      </main>
    </div>
  );
}
