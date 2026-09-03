import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildMeterBillingWorkbook } from "./excel";
import type { ExportRow } from "./mapReadingToRow";

const sampleRow: ExportRow = {
  seq: 1,
  roomName: "ห้อง 101",
  residentName: "สมชาย ใจดี",
  currentValue: 260,
  previousValue: 200,
  usage: 60,
  baseCharge: 130,
  ftCharge: 30,
  tax: 16,
  total: 176,
};

const noPreviousRow: ExportRow = {
  seq: 2,
  roomName: "ห้อง 102",
  residentName: "",
  currentValue: 50,
  previousValue: null,
  usage: null,
  baseCharge: null,
  ftCharge: null,
  tax: null,
  total: null,
};

// Smoke test only — not per-cell formatting (Phase 6 spec item 10).
describe("buildMeterBillingWorkbook", () => {
  it("produces a readable workbook with the title, headers, and data row", async () => {
    const buffer = await buildMeterBillingWorkbook({
      monthLabel: "กันยายน 2569",
      rows: [sampleRow],
    });

    const workbook = new ExcelJS.Workbook();
    // exceljs's Buffer type declares ES2024 ArrayBuffer members Node's real
    // Buffer type doesn't carry under lib "esnext" — a type-only mismatch,
    // the runtime value is a real Buffer and load() works fine with it.
    // @ts-expect-error see comment above
    await workbook.xlsx.load(Buffer.from(buffer));
    const sheet = workbook.worksheets[0];

    expect(sheet.getCell(1, 1).value).toBe("บัญชีเรียกเก็บเงินค่าไฟฟ้า");
    expect(sheet.getCell(2, 1).value).toContain("กันยายน 2569");
    expect(sheet.getCell(6, 4).value).toBe("อ่านมิเตอร์");
    expect(sheet.getCell(7, 4).value).toBe("ครั้งหลัง");
    expect(sheet.getCell(7, 5).value).toBe("ครั้งก่อน");
    expect(sheet.getCell(6, 7).value).toBe("ค่าไฟ");

    // first data row is right after the two header rows (6, 7)
    expect(sheet.getCell(8, 2).value).toBe("ห้อง 101");
    expect(sheet.getCell(8, 4).value).toBe(260);
    expect(sheet.getCell(8, 5).value).toBe(200);
    expect(sheet.getCell(8, 6).value).toBe(60);
    expect(sheet.getCell(8, 7).value).toBe(130); // ค่าไฟพื้นฐาน from the Calculation Service
    expect(sheet.getCell(8, 10).value).toBe(176); // รวมทั้งสิ้น
  });

  it("renders '-' placeholders for a row with no previous reading (usage/billing unknown)", async () => {
    const buffer = await buildMeterBillingWorkbook({
      monthLabel: "กันยายน 2569",
      rows: [noPreviousRow],
    });
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error see comment above
    await workbook.xlsx.load(Buffer.from(buffer));
    const sheet = workbook.worksheets[0];

    expect(sheet.getCell(8, 5).value).toBe("-"); // ครั้งก่อน
    expect(sheet.getCell(8, 6).value).toBe("-"); // หน่วยที่ใช้
    expect(sheet.getCell(8, 7).value).toBe("-"); // ค่าไฟพื้นฐาน
  });

  it("does not throw when there are zero rows", async () => {
    const buffer = await buildMeterBillingWorkbook({
      monthLabel: "กันยายน 2569",
      rows: [],
    });
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
