import { beforeEach, describe, expect, it } from "vitest";
import {
  clearOcrMetrics,
  getOcrMetrics,
  recordOcrMetric,
  summarizeOcrMetrics,
} from "./ocrMetrics";

describe("ocrMetrics", () => {
  beforeEach(() => {
    clearOcrMetrics();
  });

  it("starts empty", () => {
    expect(getOcrMetrics()).toEqual([]);
    expect(summarizeOcrMetrics()).toEqual({
      count: 0,
      averageConfidence: 0,
      averageDurationMs: 0,
      stableRate: 0,
    });
  });

  it("records entries in order", () => {
    recordOcrMetric({ timestamp: 1, mode: "camera", value: "12345", confidence: 0.9, duration: 100, status: "stable" });
    recordOcrMetric({ timestamp: 2, mode: "upload", value: "23188", confidence: 0.7, duration: 150, status: "unstable" });
    expect(getOcrMetrics()).toHaveLength(2);
    expect(getOcrMetrics()[0].value).toBe("12345");
    expect(getOcrMetrics()[1].value).toBe("23188");
  });

  it("caps at the last 200 entries", () => {
    for (let i = 0; i < 210; i++) {
      recordOcrMetric({ timestamp: i, mode: "camera", value: String(i), confidence: 0.9, duration: 100, status: "stable" });
    }
    const metrics = getOcrMetrics();
    expect(metrics).toHaveLength(200);
    expect(metrics[0].value).toBe("10"); // oldest 10 entries dropped
    expect(metrics[metrics.length - 1].value).toBe("209");
  });

  it("summarizes count/averages/stable rate", () => {
    recordOcrMetric({ timestamp: 1, mode: "camera", value: "1", confidence: 1, duration: 100, status: "stable" });
    recordOcrMetric({ timestamp: 2, mode: "camera", value: "2", confidence: 0.6, duration: 200, status: "unstable" });
    const summary = summarizeOcrMetrics();
    expect(summary.count).toBe(2);
    expect(summary.averageConfidence).toBeCloseTo(0.8, 5);
    expect(summary.averageDurationMs).toBeCloseTo(150, 5);
    expect(summary.stableRate).toBeCloseTo(0.5, 5);
  });

  it("clears all entries", () => {
    recordOcrMetric({ timestamp: 1, mode: "camera", value: "1", confidence: 1, duration: 100, status: "stable" });
    clearOcrMetrics();
    expect(getOcrMetrics()).toEqual([]);
  });
});
