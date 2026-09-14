"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  clampZoom,
  distanceBetween,
  midpointOf,
  moveRect,
  regionToScreenRect,
  resizeRect,
  screenRectToRegion,
  type PixelRect,
  type Point,
  type ResizeCorner,
  type ViewTransform,
} from "@/lib/image/roiEditor";
import { DEFAULT_OCR_REGION, type OcrRegion } from "@/lib/ocr/ocrRegion";
import { useLiveOcr, type LiveOcrState, type OcrDebugSnapshot } from "@/lib/ocr/useLiveOcr";
import MeterLiveReadingBadge from "./MeterLiveReadingBadge";

interface MeterImageEditorProps {
  file: Blob;
  onConfirm: (file: Blob, region: OcrRegion, liveResult: LiveOcrState) => void;
  onCancel: () => void;
  // Field Calibration debug panel (development only) — see
  // MeterOcrDebugPanel.tsx. Omit in production usage.
  onDebugSnapshot?: (snapshot: OcrDebugSnapshot | null) => void;
}

type DragState =
  | { kind: "pan"; startX: number; startY: number; startOffsetX: number; startOffsetY: number }
  | { kind: "move-roi"; startX: number; startY: number; startRect: PixelRect }
  | { kind: "resize-roi"; corner: ResizeCorner; startX: number; startY: number; startRect: PixelRect }
  | { kind: "pinch"; startDistance: number; startZoom: number; startOffset: Point; midpoint: Point };

const CANVAS_HEIGHT = 320;
const ZOOM_STEP = 0.25;
const CORNER_CLASS: Record<ResizeCorner, string> = {
  nw: "-left-2 -top-2 cursor-nwse-resize",
  ne: "-right-2 -top-2 cursor-nesw-resize",
  sw: "-left-2 -bottom-2 cursor-nesw-resize",
  se: "-right-2 -bottom-2 cursor-nwse-resize",
};

// Upload Image Mode: zoom/pan the uploaded photo and drag/resize the ROI
// box, with live OCR (useLiveOcr) re-running continuously as the ROI
// changes — a real-time SUGGESTION, same as Camera Mode's live badge.
// Confirming here never saves anything: it hands the ORIGINAL file (never
// the zoomed/panned view, never a persisted crop) + the chosen region +
// the last live reading back to the page, which still runs the value
// through the same MeterPreview / confirm-and-save workflow as the camera
// path — nothing about saveOfflineReading()/duplicate-checking/billing
// changes.
export default function MeterImageEditor({
  file,
  onConfirm,
  onCancel,
  onDebugSnapshot,
}: MeterImageEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const activePointersRef = useRef<Map<number, Point>>(new Map());

  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [region, setRegion] = useState<OcrRegion>(DEFAULT_OCR_REGION);

  useEffect(() => {
    let cancelled = false;
    createImageBitmap(file).then((bitmap) => {
      if (cancelled) {
        bitmap.close();
        return;
      }
      bitmapRef.current = bitmap;
      setImageSize({ width: bitmap.width, height: bitmap.height });
    });
    return () => {
      cancelled = true;
      bitmapRef.current?.close();
    };
  }, [file]);

  useEffect(() => {
    if (containerRef.current) setCanvasWidth(containerRef.current.clientWidth);
  }, []);

  const baseScale =
    imageSize && canvasWidth > 0
      ? Math.min(canvasWidth / imageSize.width, CANVAS_HEIGHT / imageSize.height)
      : 1;

  const transform: ViewTransform = {
    scale: baseScale * zoom,
    offsetX: panOffset.x,
    offsetY: panOffset.y,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap || !imageSize || canvasWidth === 0) return;
    canvas.width = canvasWidth;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      bitmap,
      transform.offsetX,
      transform.offsetY,
      imageSize.width * transform.scale,
      imageSize.height * transform.scale,
    );
    // transform is derived fresh each render from zoom/panOffset/baseScaleRef —
    // depend on those directly instead of the object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSize, canvasWidth, zoom, panOffset]);

  const { state: liveState, debug } = useLiveOcr(() => file, region, {
    enabled: imageSize !== null,
    mode: "upload",
  });

  useEffect(() => {
    onDebugSnapshot?.(debug);
  }, [debug, onDebugSnapshot]);

  const roiRect = imageSize
    ? regionToScreenRect(region, transform, imageSize.width, imageSize.height)
    : null;

  function toLocalPoint(clientX: number, clientY: number): Point {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // Container pointer-down handles both single-finger pan and the second
  // finger of a pinch gesture: a second concurrent pointer promotes the
  // drag from "pan" to "pinch" (see also handlePointerMove/handlePointerUp
  // below, which keep activePointersRef in sync with every event).
  function handleContainerPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);

    if (activePointersRef.current.size >= 2) {
      const [p1, p2] = Array.from(activePointersRef.current.values());
      dragRef.current = {
        kind: "pinch",
        startDistance: distanceBetween(p1, p2),
        startZoom: zoom,
        startOffset: { x: panOffset.x, y: panOffset.y },
        midpoint: toLocalPoint(midpointOf(p1, p2).x, midpointOf(p1, p2).y),
      };
      return;
    }

    dragRef.current = {
      kind: "pan",
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: panOffset.x,
      startOffsetY: panOffset.y,
    };
  }

  function handleRoiPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (!roiRect) return;
    dragRef.current = {
      kind: "move-roi",
      startX: e.clientX,
      startY: e.clientY,
      startRect: roiRect,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleHandlePointerDown(corner: ResizeCorner) {
    return (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!roiRect) return;
      dragRef.current = {
        kind: "resize-roi",
        corner,
        startX: e.clientX,
        startY: e.clientY,
        startRect: roiRect,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const drag = dragRef.current;
    if (!drag || !imageSize) return;

    if (drag.kind === "pinch") {
      if (activePointersRef.current.size < 2) return;
      const [p1, p2] = Array.from(activePointersRef.current.values());
      const newDistance = distanceBetween(p1, p2);
      if (drag.startDistance === 0) return;
      const newZoom = clampZoom(drag.startZoom * (newDistance / drag.startDistance));
      const zoomRatio = newZoom / drag.startZoom;
      setZoom(newZoom);
      setPanOffset({
        x: drag.midpoint.x - (drag.midpoint.x - drag.startOffset.x) * zoomRatio,
        y: drag.midpoint.y - (drag.midpoint.y - drag.startOffset.y) * zoomRatio,
      });
      return;
    }

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (drag.kind === "pan") {
      setPanOffset({ x: drag.startOffsetX + dx, y: drag.startOffsetY + dy });
      return;
    }
    if (drag.kind === "move-roi") {
      const rect = moveRect(drag.startRect, dx, dy);
      setRegion(screenRectToRegion(rect, transform, imageSize.width, imageSize.height));
      return;
    }
    const rect = resizeRect(drag.startRect, drag.corner, dx, dy);
    setRegion(screenRectToRegion(rect, transform, imageSize.width, imageSize.height));
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      dragRef.current = null;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="relative touch-none select-none overflow-hidden rounded-xl bg-zinc-900"
        style={{ height: CANVAS_HEIGHT }}
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <canvas ref={canvasRef} className="absolute left-0 top-0" />

        {roiRect && (
          <div
            className="absolute cursor-move border-2 border-yellow-400 bg-yellow-400/10"
            style={{
              left: roiRect.left,
              top: roiRect.top,
              width: roiRect.width,
              height: roiRect.height,
            }}
            onPointerDown={handleRoiPointerDown}
          >
            {(Object.keys(CORNER_CLASS) as ResizeCorner[]).map((corner) => (
              <div
                key={corner}
                className={`absolute h-4 w-4 rounded-full border-2 border-yellow-400 bg-white ${CORNER_CLASS[corner]}`}
                onPointerDown={handleHandlePointerDown(corner)}
              />
            ))}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
          <MeterLiveReadingBadge state={liveState} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold dark:border-zinc-700"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold dark:border-zinc-700"
          >
            +
          </button>
        </div>
        <p className="text-right text-xs text-zinc-500">
          ลากภาพเพื่อเลื่อน · บีบนิ้วเพื่อซูม · ลากกรอบเหลืองเพื่อขยับ/ปรับขนาด
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-sm font-semibold dark:border-zinc-700"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={() => onConfirm(file, region, liveState)}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          ใช้ภาพนี้
        </button>
      </div>
    </div>
  );
}
