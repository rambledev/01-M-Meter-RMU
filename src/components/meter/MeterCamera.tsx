"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useCameraQuality } from "@/lib/image/useCameraQuality";
import { DEFAULT_OCR_REGION, type OcrRegion } from "@/lib/ocr/ocrRegion";
import { useLiveOcr, type LiveOcrState, type OcrDebugSnapshot } from "@/lib/ocr/useLiveOcr";
import MeterCameraQualityWarning from "./MeterCameraQualityWarning";
import MeterCaptureButton from "./MeterCaptureButton";
import MeterGuideOverlay from "./MeterGuideOverlay";
import MeterLiveReadingBadge from "./MeterLiveReadingBadge";

interface MeterCameraProps {
  onCapture: (blob: Blob, liveResult: LiveOcrState) => void;
  onFileSelected: (file: Blob) => void;
  // Camera Mode uses a fixed region for now (Meter ROI Guide) — these two
  // props exist so a future drag-to-adjust camera ROI can land without
  // changing this component's public API. `allowAdjust` has no effect yet.
  initialRegion?: OcrRegion;
  allowAdjust?: boolean;
  // Manual Reading-first redesign (2026-09-15): OCR is opt-in and OFF by
  // default. When false, useLiveOcr's `enabled` is false too — it doesn't
  // just hide the badge, the crop/preprocess/recognize pipeline never runs
  // at all (no Tesseract calls, no CPU cost) — "OCR ต้องไม่ทำงาน" in the
  // active manual-reading flow. The ROI guide overlay is OCR-specific too,
  // so it's tied to the same flag (a plain evidence photo has no reason to
  // show a "line up the digits here" box). Camera Quality (blur/brightness)
  // is unrelated to OCR and always stays on regardless of this flag — a
  // good evidence photo should be in-focus and well-lit either way.
  showLiveOcr?: boolean;
  // Field Calibration debug panel (development only) — see
  // MeterOcrDebugPanel.tsx. Omit in production usage; harmless if passed
  // since the snapshot itself is always null outside development.
  onDebugSnapshot?: (snapshot: OcrDebugSnapshot | null) => void;
}

type Phase = "idle" | "starting" | "streaming" | "error";

function cameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") {
      return "ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาเลือกภาพจากเครื่องแทน";
    }
    if (err.name === "NotFoundError") {
      return "ไม่พบกล้องบนอุปกรณ์นี้ กรุณาเลือกภาพจากเครื่องแทน";
    }
  }
  return "เปิดกล้องไม่สำเร็จ กรุณาเลือกภาพจากเครื่องแทน";
}

// Camera lifecycle (was CameraCapture.tsx) plus the Meter ROI Guide overlay
// and a real-time OCR suggestion (useLiveOcr) that samples the live video
// while streaming — purely a live preview, never a save; the shutter still
// captures the full frame the same way it always did. Falls back to a plain
// file input whenever getUserMedia is unsupported, denied, or fails.
export default function MeterCamera({
  onCapture,
  onFileSelected,
  initialRegion = DEFAULT_OCR_REGION,
  allowAdjust = false,
  showLiveOcr = false,
  onDebugSnapshot,
}: MeterCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (allowAdjust && process.env.NODE_ENV === "development") {
      console.warn(
        "[MeterCamera] allowAdjust=true has no effect yet — Camera Mode still uses a fixed region.",
      );
    }
  }, [allowAdjust]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => stopStream();
  }, []);

  function captureLiveFrame(): Promise<Blob | null> {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return Promise.resolve(null);
    if (!liveCanvasRef.current) {
      liveCanvasRef.current = document.createElement("canvas");
    }
    const canvas = liveCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
  }

  const { state: liveState, debug } = useLiveOcr(captureLiveFrame, initialRegion, {
    enabled: showLiveOcr && phase === "streaming",
    mode: "camera",
  });

  useEffect(() => {
    onDebugSnapshot?.(debug);
  }, [debug, onDebugSnapshot]);

  const quality = useCameraQuality(videoRef, { enabled: phase === "streaming" });

  async function startCamera() {
    setErrorMessage(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase("error");
      setErrorMessage("อุปกรณ์นี้ไม่รองรับกล้อง กรุณาเลือกภาพจากเครื่องแทน");
      return;
    }
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("streaming");
    } catch (err) {
      setPhase("error");
      setErrorMessage(cameraErrorMessage(err));
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setErrorMessage(
        "กล้องยังไม่พร้อม กรุณารอสักครู่แล้วลองถ่ายอีกครั้ง หรือเลือกภาพจากเครื่องแทน",
      );
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob, liveState);
      },
      "image/jpeg",
      0.9,
    );
    stopStream();
    setPhase("idle");
  }

  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      {phase !== "streaming" && (
        <button
          type="button"
          onClick={startCamera}
          className="rounded-lg bg-emerald-600 px-4 py-4 text-lg font-bold text-white hover:bg-emerald-700"
        >
          📷 ถ่ายภาพมิเตอร์
        </button>
      )}

      {phase === "starting" && (
        <p className="text-sm text-zinc-500">กำลังเปิดกล้อง...</p>
      )}

      {phase === "streaming" && (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="w-full" playsInline muted />
          {showLiveOcr && <MeterGuideOverlay region={initialRegion} />}
          <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-2 px-3">
            {showLiveOcr && <MeterLiveReadingBadge state={liveState} />}
            <MeterCameraQualityWarning quality={quality} />
          </div>
          <MeterCaptureButton onCapture={capture} />
        </div>
      )}

      {errorMessage && (
        <p className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700">
          {errorMessage}
        </p>
      )}

      <label className="cursor-pointer text-center text-sm font-medium text-zinc-600 underline dark:text-zinc-400">
        หรือเลือกภาพจากเครื่อง
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelected}
        />
      </label>
    </div>
  );
}
