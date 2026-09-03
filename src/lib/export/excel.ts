import ExcelJS from "exceljs";
import type { ExportRow } from "./mapReadingToRow";

// Excel generation ONLY — layout, merge cells, borders, formatting. No
// billing/usage math happens in this file (export-format.md §3); every
// number here already came out of the Calculation Service via mapReadingToRow.

const COLUMN_COUNT = 10; // A..J
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE0E0E0" },
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const NUMBER_FORMAT = "#,##0.00";
const PLACEHOLDER = "-"; // used for values with no real formula yet (usage: null) or a still-locked billing formula

function numberOrPlaceholder(value: number | null): number | string {
  return value === null ? PLACEHOLDER : value;
}

export interface BuildWorkbookOptions {
  monthLabel: string; // e.g. "กันยายน 2569" — for the title block only
  rows: ExportRow[];
}

export async function buildMeterBillingWorkbook(
  options: BuildWorkbookOptions,
): Promise<ExcelJS.Buffer> {
  const { monthLabel, rows } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RMU Meter Collection";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("รายงาน", {
    views: [{ state: "frozen", ySplit: 7 }],
  });

  sheet.columns = [
    { width: 8 }, // A ลำดับที่
    { width: 16 }, // B เลขที่บ้านพัก
    { width: 24 }, // C ชื่อ-สกุล
    { width: 13 }, // D ครั้งหลัง
    { width: 13 }, // E ครั้งก่อน
    { width: 12 }, // F หน่วยที่ใช้
    { width: 14 }, // G ค่าไฟพื้นฐาน
    { width: 12 }, // H ค่า FT
    { width: 12 }, // I ภาษี
    { width: 14 }, // J รวมทั้งสิ้น
  ];

  // --- Title block (rows 1-4) ---
  sheet.mergeCells(1, 1, 1, COLUMN_COUNT);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = "บัญชีเรียกเก็บเงินค่าไฟฟ้า";
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(2, 1, 2, COLUMN_COUNT);
  sheet.getCell(2, 1).value = `ประจำเดือน ${monthLabel}`;
  sheet.getCell(2, 1).alignment = { horizontal: "center" };

  const generatedAt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  sheet.mergeCells(3, 1, 3, COLUMN_COUNT);
  sheet.getCell(3, 1).value = `วันที่ออกรายงาน: ${generatedAt}`;
  sheet.getCell(3, 1).alignment = { horizontal: "center" };
  sheet.getCell(3, 1).font = { size: 10, color: { argb: "FF666666" } };

  sheet.mergeCells(4, 1, 4, COLUMN_COUNT);
  sheet.getCell(4, 1).value =
    "อัตราค่าไฟที่ใช้เป็นสูตรเบื้องต้นจากเอกสารตัวอย่าง ยังไม่ใช่สูตรทางการที่ได้รับการรับรอง — ปรับได้ที่หน้าตั้งค่าการคิดค่าไฟ (แถวที่ไม่มีค่าครั้งก่อนจะแสดงเป็น \"-\")";
  sheet.getCell(4, 1).alignment = { horizontal: "center" };
  sheet.getCell(4, 1).font = { size: 10, italic: true, color: { argb: "FF999999" } };

  // --- Grouped column headers (rows 6-7; row 5 left blank as a spacer) ---
  const groupHeaderRow = 6;
  const subHeaderRow = 7;

  const singleColumnHeaders: [number, string][] = [
    [1, "ลำดับที่"],
    [2, "เลขที่บ้านพัก"],
    [3, "ชื่อ-สกุล"],
    [6, "หน่วยที่ใช้"],
  ];
  for (const [col, label] of singleColumnHeaders) {
    sheet.mergeCells(groupHeaderRow, col, subHeaderRow, col);
    sheet.getCell(groupHeaderRow, col).value = label;
  }

  sheet.mergeCells(groupHeaderRow, 4, groupHeaderRow, 5); // อ่านมิเตอร์ over D:E
  sheet.getCell(groupHeaderRow, 4).value = "อ่านมิเตอร์";
  sheet.getCell(subHeaderRow, 4).value = "ครั้งหลัง";
  sheet.getCell(subHeaderRow, 5).value = "ครั้งก่อน";

  sheet.mergeCells(groupHeaderRow, 7, groupHeaderRow, 10); // ค่าไฟ over G:J
  sheet.getCell(groupHeaderRow, 7).value = "ค่าไฟ";
  sheet.getCell(subHeaderRow, 7).value = "ค่าไฟพื้นฐาน";
  sheet.getCell(subHeaderRow, 8).value = "ค่า FT";
  sheet.getCell(subHeaderRow, 9).value = "ภาษี";
  sheet.getCell(subHeaderRow, 10).value = "รวมทั้งสิ้น";

  for (let row = groupHeaderRow; row <= subHeaderRow; row += 1) {
    for (let col = 1; col <= COLUMN_COUNT; col += 1) {
      const cell = sheet.getCell(row, col);
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = HEADER_FILL;
      cell.border = THIN_BORDER;
    }
  }

  // --- Data rows ---
  const firstDataRow = subHeaderRow + 1;
  rows.forEach((row, index) => {
    const r = firstDataRow + index;
    sheet.getCell(r, 1).value = row.seq;
    sheet.getCell(r, 2).value = row.roomName;
    sheet.getCell(r, 3).value = row.residentName;
    sheet.getCell(r, 4).value = numberOrPlaceholder(row.currentValue);
    sheet.getCell(r, 5).value = numberOrPlaceholder(row.previousValue);
    sheet.getCell(r, 6).value = numberOrPlaceholder(row.usage);
    sheet.getCell(r, 7).value = numberOrPlaceholder(row.baseCharge);
    sheet.getCell(r, 8).value = numberOrPlaceholder(row.ftCharge);
    sheet.getCell(r, 9).value = numberOrPlaceholder(row.tax);
    sheet.getCell(r, 10).value = numberOrPlaceholder(row.total);

    for (let col = 1; col <= COLUMN_COUNT; col += 1) {
      const cell = sheet.getCell(r, col);
      cell.border = THIN_BORDER;
      cell.alignment = { horizontal: col <= 3 ? "left" : "center", vertical: "middle" };
      if (col >= 4 && typeof cell.value === "number") {
        cell.numFmt = NUMBER_FORMAT;
      }
    }
  });

  const lastDataRow = firstDataRow + rows.length - 1;
  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: subHeaderRow, column: 1 },
      to: { row: lastDataRow, column: COLUMN_COUNT },
    };
  }

  return workbook.xlsx.writeBuffer();
}
