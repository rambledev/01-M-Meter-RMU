import type { BillingConfig } from "./types";

export interface BillingExplanation {
  steps: string[];
  config: BillingConfig;
  disclaimer: string;
}

// All numbers come from the current config — nothing here is a hard-coded
// rate (Phase 6B kickoff §8: "ข้อความต้องสร้างจาก Billing Configuration
// ปัจจุบัน ห้าม hard-code ค่าในข้อความ").
export function buildBillingExplanation(config: BillingConfig): BillingExplanation {
  return {
    steps: [
      "หน่วยที่ใช้ = อ่านครั้งหลัง - อ่านครั้งก่อน",
      // (2026-09-22) เลือกทั้งตารางช่วงอัตราตามหน่วยที่ใช้ทั้งเดือน ไม่ใช่ผสมสองตาราง
      `หากใช้ไฟไม่เกิน ${config.highUsageThreshold} หน่วย ใช้ตารางช่วงอัตรา "ไม่เกิน" ทั้งตาราง — หากเกิน ใช้ตารางช่วงอัตรา "มากกว่า" ทั้งตาราง`,
      // (2026-09-22) ค่าพื้นฐานรวม ไม่รวมค่าบริการอีกต่อไป — ค่าบริการถูกเลื่อนไป
      // บวกครั้งเดียวตอนคำนวณค่าไฟสุทธิ (ขั้นตอนสุดท้าย) แทน
      "ค่าพื้นฐานรวม = ผลรวม(จำนวนหน่วยแต่ละช่วง × อัตราของช่วง)",
      // (2026-09-17) Ft กลายเป็นค่ารายเดือน (ผูกกับ readingMonth) ไม่ได้อยู่ใน
      // BillingConfig อีกต่อไป — ข้อความนี้จึงไม่ interpolate ตัวเลข Ft
      // ตายตัวอีกต่อไป (ค่าจริงต้องดูจากอัตรา Ft ของเดือนนั้นโดยเฉพาะ)
      "ค่า FT = ค่าพื้นฐานรวม × อัตรา Ft ของเดือนนั้น (กำหนดโดยผู้ดูแลระบบเป็นรายเดือน)",
      "ค่าไฟก่อน VAT = ค่าพื้นฐานรวม + ค่า FT",
      `VAT = ค่าไฟก่อน VAT × ${config.taxRatePercent}%`,
      "ค่าไฟสุทธิ = ค่าไฟก่อน VAT + VAT + ค่าบริการ",
    ],
    config,
    disclaimer:
      "อัตรานี้เป็นค่าตั้งต้นจากเอกสารตัวอย่าง สามารถปรับเปลี่ยนได้ที่ตั้งค่าการคิดค่าไฟ",
  };
}
