// Persisted UI-state cache of the last known camera permission outcome
// (2026-09-25) — NOT a substitute for the browser's own permission store,
// which already remembers the real grant/denial per-origin on its own.
// Needed because navigator.permissions.query({name:"camera"}) isn't
// supported on Safari/iOS (rejects/throws there), so on those browsers
// this localStorage value is the only way the app remembers a prior
// denial across page loads/reloads, to show a helpful message instead of
// silently re-prompting or failing every time. Same get/save shape as
// src/lib/checker/checkerSession.ts and friends.
export type CameraPermissionState = "granted" | "denied" | "prompt" | "unknown";

const STORAGE_KEY = "rmu-camera-permission";

export function getStoredCameraPermission(): CameraPermissionState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "granted" || raw === "denied" ? raw : "unknown";
  } catch {
    return "unknown";
  }
}

export function saveCameraPermission(state: "granted" | "denied"): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, state);
  } catch {
    // Best-effort cache only — a failed write just means we ask again next time.
  }
}
