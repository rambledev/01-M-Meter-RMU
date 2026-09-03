import type { BillingTier } from "./types";

export interface TierValidationError {
  index: number; // -1 when the error is not about one specific tier
  message: string;
}

export interface TierValidationResult {
  valid: boolean;
  errors: TierValidationError[];
}

// Pure validation only — no UI, no storage. Tiers are expected in the order
// they are displayed/edited (ascending by minUnit); this checks that
// ordering too rather than re-sorting behind the caller's back.
export function validateTiers(tiers: BillingTier[]): TierValidationResult {
  const errors: TierValidationError[] = [];

  if (tiers.length === 0) {
    return { valid: false, errors: [{ index: -1, message: "ต้องมีอย่างน้อย 1 ช่วงอัตรา" }] };
  }

  tiers.forEach((tier, index) => {
    const label = `ช่วงที่ ${index + 1}`;
    if (tier.rate < 0) {
      errors.push({ index, message: `${label}: อัตราต้องไม่ติดลบ` });
    }
    if (tier.minUnit < 0) {
      errors.push({ index, message: `${label}: หน่วยเริ่มต้นต้องไม่ติดลบ` });
    }
    const isLast = index === tiers.length - 1;
    if (!isLast && tier.maxUnit === null) {
      errors.push({ index, message: `${label}: กำหนดเป็น "ไม่จำกัด" ได้เฉพาะช่วงสุดท้ายเท่านั้น` });
    }
    if (tier.maxUnit !== null && tier.maxUnit <= tier.minUnit) {
      errors.push({ index, message: `${label}: หน่วยสูงสุดต้องมากกว่าหน่วยเริ่มต้น` });
    }
  });

  for (let i = 1; i < tiers.length; i += 1) {
    const prev = tiers[i - 1];
    const curr = tiers[i];
    const label = `ช่วงที่ ${i + 1}`;
    if (curr.minUnit <= prev.minUnit) {
      errors.push({ index: i, message: `${label}: ต้องเรียงหน่วยเริ่มต้นจากน้อยไปมาก` });
      continue;
    }
    if (prev.maxUnit === null) {
      errors.push({ index: i, message: `${label}: ช่วงก่อนหน้าถูกกำหนดเป็นไม่จำกัดแล้ว จึงมีช่วงถัดไปไม่ได้` });
      continue;
    }
    if (curr.minUnit <= prev.maxUnit) {
      errors.push({ index: i, message: `${label}: ทับซ้อนกับช่วงก่อนหน้า` });
    }
  }

  return { valid: errors.length === 0, errors };
}
