"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

interface QrScannerProps {
  onScan: (payload: string) => void;
  onCancel: () => void;
}

// Scans a QR code from the camera feed (getUserMedia + jsQR against a
// canvas snapshot each animation frame — no native BarcodeDetector
// dependency, since Safari support for that is still inconsistent).
// Decoded text is handed to the caller as-is; parsing "METER:<code>" out of
// it is the caller's job (src/lib/meters/meterLookup.ts), same as the
// existing manual code-entry path.
export default function QrScanner({ onScan, onCancel }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement("canvas");

    function scanLoop() {
      const video = videoRef.current;
      if (cancelled) return;
      if (!video || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(frame.data, frame.width, frame.height);
        if (result?.data) {
          onScanRef.current(result.data);
          return; // caller unmounts this component on scan — stop looping
        }
      }
      rafRef.current = requestAnimationFrame(scanLoop);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("อุปกรณ์นี้ไม่รองรับกล้อง กรุณากรอกรหัสมิเตอร์เอง");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanLoop();
      } catch {
        setError("เปิดกล้องไม่สำเร็จ กรุณากรอกรหัสมิเตอร์เอง");
      }
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="w-full" playsInline muted />
        <div className="pointer-events-none absolute inset-8 rounded-xl border-4 border-yellow-400" />
      </div>
      {error && (
        <p className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
      >
        ยกเลิก
      </button>
    </div>
  );
}
