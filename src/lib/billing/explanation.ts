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
      "ค่าไฟพื้นฐาน = ค่าบริการคงที่ + ผลรวมหน่วยที่ใช้ตามช่วงอัตราที่ตั้งไว้",
      `ค่า FT = หน่วยที่ใช้ × ${config.ftRate} บาท`,
      `ภาษี = (ค่าไฟพื้นฐาน + ค่า FT) × ${config.taxRatePercent}%`,
      "รวมทั้งสิ้น = ค่าไฟพื้นฐาน + ค่า FT + ภาษี",
    ],
    config,
    disclaimer:
      "อัตรานี้เป็นค่าตั้งต้นจากเอกสารตัวอย่าง สามารถปรับเปลี่ยนได้ที่ตั้งค่าการคิดค่าไฟ",
  };
}
