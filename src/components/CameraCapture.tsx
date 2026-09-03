"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { DEFAULT_OCR_REGION } from "@/lib/ocr/ocrRegion";

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
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

// Simple, single-purpose camera UI (item 1 of the Phase 4 spec) — no
// advanced controls (zoom, flash, multi-camera picker). Falls back to a
// plain file input whenever getUserMedia is unsupported, denied, or fails,
// so the rest of the reading workflow never gets stuck.
export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => stopStream();
  }, []);

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
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.9,
    );
    stopStream();
    setPhase("idle");
  }

  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      {phase !== "streaming" && (
        <button
          type="button"
          onClick={startCamera}
          className="rounded-lg bg-zinc-900 px-4 py-4 text-lg font-bold text-white dark:bg-zinc-100 dark:text-zinc-900"
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
          <div
            className="pointer-events-none absolute border-4 border-yellow-400"
            style={{
              left: `${DEFAULT_OCR_REGION.x * 100}%`,
              top: `${DEFAULT_OCR_REGION.y * 100}%`,
              width: `${DEFAULT_OCR_REGION.width * 100}%`,
              height: `${DEFAULT_OCR_REGION.height * 100}%`,
            }}
          />
          <button
            type="button"
            onClick={capture}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-6 py-3 font-bold text-black shadow"
          >
            ถ่าย
          </button>
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
