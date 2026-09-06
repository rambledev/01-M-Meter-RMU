"use client";

import Modal from "./Modal";
import QrPrintGrid from "./QrPrintGrid";

// Printing goes through window.print() on THIS page (no separate tab/route
// anymore) — the ".print-area" rule in globals.css hides everything else
// (including the modal chrome itself) so only the QR grid ends up on paper.
export default function PrintQrModal({
  codes,
  onClose,
}: {
  codes: string[];
  onClose: () => void;
}) {
  return (
    <Modal title={`พิมพ์ QR Code (${codes.length} รายการ)`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          พิมพ์
        </button>
        <div className="print-area">
          <QrPrintGrid codes={codes} />
        </div>
      </div>
    </Modal>
  );
}
