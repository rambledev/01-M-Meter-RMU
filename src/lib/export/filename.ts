// "2026-09" -> "บัญชีเรียกเก็บเงินค่าไฟฟ้า-2026-09.xlsx" (Phase 6 spec item 9)
export function buildExportFilename(monthValue: string): string {
  return `บัญชีเรียกเก็บเงินค่าไฟฟ้า-${monthValue}.xlsx`;
}
