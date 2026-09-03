import { describe, expect, it } from "vitest";
import { buildExportFilename } from "./filename";

describe("buildExportFilename", () => {
  it("matches the required naming convention", () => {
    expect(buildExportFilename("2026-09")).toBe(
      "บัญชีเรียกเก็บเงินค่าไฟฟ้า-2026-09.xlsx",
    );
  });
});
