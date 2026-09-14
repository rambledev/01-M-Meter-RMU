"use client";

// Polls the live camera preview at a modest rate and runs the cheap
// brightness/blur check from cameraQuality.ts on a small downscaled frame
// — independent of useLiveOcr.ts (no Tesseract involved here), so it can
// run more often for responsive pre-capture feedback without adding to the
// OCR loop's cost.

import { useEffect, useRef, useState, type RefObject } from "react";
import { DEFAULT_CALIBRATION_CONFIG } from "@/lib/calibration/config";
import { assessFrameQuality, type QualityAssessment } from "./cameraQuality";

export interface UseCameraQualityOptions {
  enabled: boolean;
  intervalMs?: number;
}

const SAMPLE_WIDTH = 160;
const SAMPLE_HEIGHT = 120;

export function useCameraQuality(
  videoRef: RefObject<HTMLVideoElement | null>,
  options: UseCameraQualityOptions,
): QualityAssessment | null {
  const {
    enabled,
    intervalMs = DEFAULT_CALIBRATION_CONFIG.cameraQuality.checkIntervalMs,
  } = options;
  const [quality, setQuality] = useState<QualityAssessment | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      const canvas = canvasRef.current;
      canvas.width = SAMPLE_WIDTH;
      canvas.height = SAMPLE_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const imageData = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      setQuality(assessFrameQuality(imageData));
    }, intervalMs);

    return () => clearInterval(id);
  }, [enabled, intervalMs, videoRef]);

  return enabled ? quality : null;
}
