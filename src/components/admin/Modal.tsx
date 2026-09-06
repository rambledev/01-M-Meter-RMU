"use client";

// Minimal modal shell — fixed overlay + centered box, closes on backdrop
// click or the explicit close button. No focus-trap/animation library:
// this admin UI intentionally stays simple.
export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-xl bg-white p-4 shadow-lg dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-emerald-100 pb-2 dark:border-emerald-900">
          <p className="text-base font-semibold text-emerald-800 dark:text-emerald-400">
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-emerald-50 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
