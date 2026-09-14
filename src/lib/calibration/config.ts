// Single source of truth for every tunable threshold in the Meter ROI
// Guide / Real-time OCR Preview / Camera Quality Detector pipeline. Every
// consumer below imports its values from here instead of hardcoding its
// own constant, so recalibrating against real hardware — the whole point
// of the Field Calibration phase — is always a one-file change.
//
// See docs/meter-calibration.md for the real-device test log this config
// gets revised against, and docs/decision-log.md for why each default
// value was chosen initially (still unverified against real hardware as
// of the values below — see that doc's "รอทดสอบบนอุปกรณ์จริง" notes).

export interface CalibrationConfig {
  ocr: {
    /** Minimum confidence (0-1) for a live OCR read to be shown at all as a candidate (ocrValidation.ts). */
    previewConfidence: number;
    /** Minimum confidence (0-1) required on EACH of the last `stabilityCount` reads before the badge shows "stable" (ocrStability.ts). */
    stableConfidence: number;
    /** Consecutive matching reads required before a live OCR result counts as stable (ocrStability.ts). */
    stabilityCount: number;
    /** Polling interval (ms) for the live OCR loop (useLiveOcr.ts). */
    liveIntervalMs: number;
  };
  cameraQuality: {
    /** Polling interval (ms) for the pre-capture brightness/blur check (useCameraQuality.ts). */
    checkIntervalMs: number;
    /** Average luma (0-255) below which a frame is flagged too dark (cameraQuality.ts). */
    darkThreshold: number;
    /** Average luma (0-255) above which a frame is flagged too bright (cameraQuality.ts). */
    brightThreshold: number;
    /** Laplacian variance below which a frame is flagged blurry (cameraQuality.ts). */
    blurThreshold: number;
  };
}

export const DEFAULT_CALIBRATION_CONFIG: CalibrationConfig = {
  ocr: {
    previewConfidence: 0.6,
    stableConfidence: 0.85,
    stabilityCount: 3,
    liveIntervalMs: 800,
  },
  cameraQuality: {
    checkIntervalMs: 500,
    darkThreshold: 60,
    brightThreshold: 200,
    blurThreshold: 50,
  },
};
