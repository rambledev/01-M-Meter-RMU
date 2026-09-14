import { describe, expect, it } from "vitest";
import { evaluateStability } from "./ocrStability";

describe("evaluateStability", () => {
  it("is insufficient with fewer than 3 samples", () => {
    expect(
      evaluateStability([
        { value: "23188", confidence: 0.96 },
        { value: "23188", confidence: 0.96 },
      ]),
    ).toBe("insufficient");
  });

  it("is stable when the last 3 match and all meet the 0.85 bar", () => {
    expect(
      evaluateStability([
        { value: "23188", confidence: 0.9 },
        { value: "23188", confidence: 0.86 },
        { value: "23188", confidence: 0.95 },
      ]),
    ).toBe("stable");
  });

  it("is unstable when the last 3 values disagree", () => {
    expect(
      evaluateStability([
        { value: "23188", confidence: 0.96 },
        { value: "23189", confidence: 0.96 },
        { value: "23188", confidence: 0.96 },
      ]),
    ).toBe("unstable");
  });

  it("is unstable when values match but one sample is below the stable confidence bar", () => {
    expect(
      evaluateStability([
        { value: "23188", confidence: 0.7 },
        { value: "23188", confidence: 0.9 },
        { value: "23188", confidence: 0.9 },
      ]),
    ).toBe("unstable");
  });

  it("only looks at the most recent window (older mismatches don't block stability)", () => {
    expect(
      evaluateStability([
        { value: "00000", confidence: 0.9 },
        { value: "23188", confidence: 0.9 },
        { value: "23188", confidence: 0.9 },
        { value: "23188", confidence: 0.9 },
      ]),
    ).toBe("stable");
  });
});
