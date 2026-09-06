"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import Modal from "./Modal";

// QR payload is "METER:<code>" — the format the checker workflow's
// QrScanner/parseMeterScanPayload already expects (src/lib/meters/
// meterLookup.ts), generated entirely client-side (no server round-trip
// needed, the code is all we encode).
function qrPayloadFor(code: string): string {
  return `METER:${code}`;
}

export default function MeterQrModal({
  code,
  onClose,
  onPrint,
}: {
  code: string;
  onClose: () => void;
  onPrint: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrPayloadFor(code), { width: 300, margin: 2 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  function handleDownload() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `QR-${code}.png`;
    link.click();
  }

  return (
    <Modal title={`QR Code — ${code}`} onClose={onClose}>
      <div className="flex flex-col items-center gap-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={`QR code สำหรับมิเตอร์ ${code}`} className="h-48 w-48" />
        ) : (
          <div className="flex h-48 w-48 items-center justify-center text-sm text-zinc-500">
            กำลังสร้าง QR...
          </div>
        )}
        <p className="text-lg font-bold">{code}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!dataUrl}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
          >
            ดาวน์โหลด
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
          >
            ปริ้น QRcode
          </button>
        </div>
      </div>
    </Modal>
  );
}
