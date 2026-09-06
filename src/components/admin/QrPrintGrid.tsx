"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

// Renders one QR per meter code with the code printed underneath — shared
// by PrintQrModal (single or bulk, both go through the same component).
export default function QrPrintGrid({ codes }: { codes: string[] }) {
  const [dataUrls, setDataUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (codes.length === 0) return;
    let cancelled = false;
    Promise.all(
      codes.map(
        async (code) =>
          [code, await QRCode.toDataURL(`METER:${code}`, { width: 300, margin: 2 })] as const,
      ),
    ).then((entries) => {
      if (!cancelled) setDataUrls(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [codes]);

  if (codes.length === 0) {
    return <p className="text-sm text-zinc-500">ไม่พบรหัสมิเตอร์ที่ต้องการพิมพ์</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 print:grid-cols-3">
      {codes.map((code) => (
        <div key={code} className="flex flex-col items-center gap-2 break-inside-avoid p-2">
          {dataUrls[code] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrls[code]} alt={`QR code สำหรับมิเตอร์ ${code}`} className="h-40 w-40" />
          ) : (
            <div className="h-40 w-40 bg-zinc-100 dark:bg-zinc-800" />
          )}
          <p className="text-base font-bold">{code}</p>
        </div>
      ))}
    </div>
  );
}
