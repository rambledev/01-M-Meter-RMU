import { describe, expect, it } from "vitest";
import { DEFAULT_CALIBRATION_CONFIG } from "./config";

describe("DEFAULT_CALIBRATION_CONFIG", () => {
  it("keeps confidence values within (0, 1]", () => {
    expect(DEFAULT_CALIBRATION_CONFIG.ocr.previewConfidence).toBeGreaterThan(0);
    expect(DEFAULT_CALIBRATION_CONFIG.ocr.previewConfidence).toBeLessThanOrEqual(1);
    expect(DEFAULT_CALIBRATION_CONFIG.ocr.stableConfidence).toBeGreaterThan(0);
    expect(DEFAULT_CALIBRATION_CONFIG.ocr.stableConfidence).toBeLessThanOrEqual(1);
  });

  it("keeps the stable confidence bar at least as strict as the preview bar", () => {
    expect(DEFAULT_CALIBRATION_CONFIG.ocr.stableConfidence).toBeGreaterThanOrEqual(
      DEFAULT_CALIBRATION_CONFIG.ocr.previewConfidence,
    );
  });

  it("requires at least 2 consecutive matches for stability", () => {
    expect(DEFAULT_CALIBRATION_CONFIG.ocr.stabilityCount).toBeGreaterThanOrEqual(2);
  });

  it("keeps the dark threshold below the bright threshold", () => {
    expect(DEFAULT_CALIBRATION_CONFIG.cameraQuality.darkThreshold).toBeLessThan(
      DEFAULT_CALIBRATION_CONFIG.cameraQuality.brightThreshold,
    );
  });

  it("keeps all polling intervals positive", () => {
    expect(DEFAULT_CALIBRATION_CONFIG.ocr.liveIntervalMs).toBeGreaterThan(0);
    expect(
      DEFAULT_CALIBRATION_CONFIG.cameraQuality.checkIntervalMs,
    ).toBeGreaterThan(0);
  });

  it("requires a usage anomaly multiplier greater than 1", () => {
    expect(
      DEFAULT_CALIBRATION_CONFIG.reading.usageAnomalyMultiplier,
    ).toBeGreaterThan(1);
  });

  it("requires at least 1 historical data point before checking for anomalies", () => {
    expect(
      DEFAULT_CALIBRATION_CONFIG.reading.minHistoryForAnomalyCheck,
    ).toBeGreaterThanOrEqual(1);
  });
});
