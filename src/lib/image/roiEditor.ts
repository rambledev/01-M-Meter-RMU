// Pure geometry for the Upload Image Mode editor (MeterImageEditor.tsx):
// converts between a fractional ROI (0-1 of the ORIGINAL image, the same
// shape OcrRegion uses everywhere else) and on-screen pixel rects under the
// editor's current pan/zoom, plus the drag-resize math for the ROI box's
// corner handles. No DOM/canvas access here, so it's unit-testable directly.

import type { OcrRegion } from "@/lib/ocr/ocrRegion";

export interface ViewTransform {
  scale: number; // combined base-fit scale * user zoom, image-px -> canvas-px
  offsetX: number; // canvas-px
  offsetY: number; // canvas-px
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

export interface Point {
  x: number;
  y: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
const MIN_REGION_FRACTION = 0.05;
const MIN_RECT_PX = 16;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function clampRegion(region: OcrRegion): OcrRegion {
  const width = Math.min(1, Math.max(MIN_REGION_FRACTION, region.width));
  const height = Math.min(1, Math.max(MIN_REGION_FRACTION, region.height));
  const x = Math.min(1 - width, Math.max(0, region.x));
  const y = Math.min(1 - height, Math.max(0, region.y));
  return { x, y, width, height };
}

// Fractional ROI (of the original image) -> pixel rect on the editor canvas.
export function regionToScreenRect(
  region: OcrRegion,
  transform: ViewTransform,
  imageWidth: number,
  imageHeight: number,
): PixelRect {
  return {
    left: region.x * imageWidth * transform.scale + transform.offsetX,
    top: region.y * imageHeight * transform.scale + transform.offsetY,
    width: region.width * imageWidth * transform.scale,
    height: region.height * imageHeight * transform.scale,
  };
}

// Inverse of the above — a screen-space rect (after a drag/resize) back
// into a fractional ROI of the original image, clamped to valid bounds.
export function screenRectToRegion(
  rect: PixelRect,
  transform: ViewTransform,
  imageWidth: number,
  imageHeight: number,
): OcrRegion {
  const scaledWidth = imageWidth * transform.scale;
  const scaledHeight = imageHeight * transform.scale;
  return clampRegion({
    x: (rect.left - transform.offsetX) / scaledWidth,
    y: (rect.top - transform.offsetY) / scaledHeight,
    width: rect.width / scaledWidth,
    height: rect.height / scaledHeight,
  });
}

// Two-finger pinch-zoom helpers (MeterImageEditor.tsx): distance between the
// touch points drives the zoom ratio, their midpoint is the anchor kept
// fixed on screen while zooming (the standard pinch-zoom "zoom toward your
// fingers" behavior).
export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpointOf(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Moves a rect by (dx, dy) — used while dragging the ROI box itself.
export function moveRect(rect: PixelRect, dx: number, dy: number): PixelRect {
  return { ...rect, left: rect.left + dx, top: rect.top + dy };
}

function anchorPoint(rect: PixelRect, corner: ResizeCorner) {
  // The corner opposite the one being dragged — stays fixed during resize.
  switch (corner) {
    case "nw":
      return { x: rect.left + rect.width, y: rect.top + rect.height };
    case "ne":
      return { x: rect.left, y: rect.top + rect.height };
    case "sw":
      return { x: rect.left + rect.width, y: rect.top };
    case "se":
      return { x: rect.left, y: rect.top };
  }
}

function cornerPoint(rect: PixelRect, corner: ResizeCorner) {
  switch (corner) {
    case "nw":
      return { x: rect.left, y: rect.top };
    case "ne":
      return { x: rect.left + rect.width, y: rect.top };
    case "sw":
      return { x: rect.left, y: rect.top + rect.height };
    case "se":
      return { x: rect.left + rect.width, y: rect.top + rect.height };
  }
}

// Resizes a rect by dragging one corner, keeping the opposite corner fixed.
// Clamped to a minimum on-screen size so the box can't be dragged inside out.
export function resizeRect(
  rect: PixelRect,
  corner: ResizeCorner,
  dx: number,
  dy: number,
): PixelRect {
  const anchor = anchorPoint(rect, corner);
  const dragged = cornerPoint(rect, corner);
  const moved = { x: dragged.x + dx, y: dragged.y + dy };

  let left = Math.min(anchor.x, moved.x);
  let top = Math.min(anchor.y, moved.y);
  let width = Math.abs(moved.x - anchor.x);
  let height = Math.abs(moved.y - anchor.y);

  if (width < MIN_RECT_PX) {
    width = MIN_RECT_PX;
    left = moved.x >= anchor.x ? anchor.x : anchor.x - width;
  }
  if (height < MIN_RECT_PX) {
    height = MIN_RECT_PX;
    top = moved.y >= anchor.y ? anchor.y : anchor.y - height;
  }

  return { left, top, width, height };
}
