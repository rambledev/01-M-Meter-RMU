"use client";

import { useEffect, useState } from "react";
import {
  getBillingConfig,
  resetBillingConfig,
  saveBillingConfig,
} from "@/lib/offline/billingConfigRepository";
import type { BillingConfig, BillingTier } from "@/lib/billing/types";
import { validateTiers } from "@/lib/billing/tierValidation";

interface DraftTier {
  minUnit: string;
  maxUnit: string; // "" means unlimited — only meaningful for the last row
  rate: string;
}

function toDraftTiers(tiers: BillingTier[]): DraftTier[] {
  return tiers.map((t) => ({
    minUnit: String(t.minUnit),
    maxUnit: t.maxUnit === null ? "" : String(t.maxUnit),
    rate: String(t.rate),
  }));
}

// The last tier is always the unlimited one — enforced here rather than via
// a UI toggle, so it can never be edited into an invalid combination
// (Phase 6B kickoff §7: "กำหนด tier สุดท้ายเป็นไม่จำกัด").
function toBillingTiers(drafts: DraftTier[]): BillingTier[] {
  return drafts.map((d, index) => ({
    minUnit: Number(d.minUnit),
    maxUnit: index === drafts.length - 1 ? null : Number(d.maxUnit),
    rate: Number(d.rate),
  }));
}

export default function BillingSettingsPanel({
  onSaved,
}: {
  onSaved: (config: BillingConfig) => void;
}) {
  const [ftRate, setFtRate] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState("");
  const [baseCharge, setBaseCharge] = useState("");
  const [tiers, setTiers] = useState<DraftTier[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    getBillingConfig().then((config) => {
      setFtRate(String(config.ftRate));
      setTaxRatePercent(String(config.taxRatePercent));
      setBaseCharge(String(config.baseCharge));
      setTiers(toDraftTiers(config.tiers));
    });
  }, []);

  function updateTier(index: number, patch: Partial<DraftTier>) {
    setSavedMessage(null);
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setSavedMessage(null);
    setTiers((prev) => {
      const last = prev[prev.length - 1];
      const lastMax = last ? Number(last.maxUnit || last.minUnit) : -1;
      const newMin = lastMax + 1;
      const closedLast: DraftTier[] = last
        ? [...prev.slice(0, -1), { ...last, maxUnit: String(newMin - 1) }]
        : [];
      return [...closedLast, { minUnit: String(newMin), maxUnit: "", rate: "0" }];
    });
  }

  function removeTier(index: number) {
    setSavedMessage(null);
    setTiers((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
  }

  function buildConfig(): BillingConfig {
    return {
      ftRate: Number(ftRate),
      taxRatePercent: Number(taxRatePercent),
      baseCharge: Number(baseCharge),
      tiers: toBillingTiers(tiers),
    };
  }

  function validate(config: BillingConfig): string[] {
    const errs: string[] = [];
    if (Number.isNaN(config.ftRate) || config.ftRate < 0) errs.push("ค่า FT ต้องไม่ติดลบ");
    if (Number.isNaN(config.taxRatePercent) || config.taxRatePercent < 0)
      errs.push("ภาษีต้องไม่ติดลบ");
    if (Number.isNaN(config.baseCharge) || config.baseCharge < 0)
      errs.push("ค่าฐานต้องไม่ติดลบ");
    const tierResult = validateTiers(config.tiers);
    errs.push(...tierResult.errors.map((e) => e.message));
    return errs;
  }

  async function handleSave() {
    setSavedMessage(null);
    const config = buildConfig();
    const validationErrors = validate(config);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    await saveBillingConfig(config);
    onSaved(config);
    setSavedMessage("บันทึกการตั้งค่าแล้ว");
  }

  async function handleReset() {
    const config = await resetBillingConfig();
    setFtRate(String(config.ftRate));
    setTaxRatePercent(String(config.taxRatePercent));
    setBaseCharge(String(config.baseCharge));
    setTiers(toDraftTiers(config.tiers));
    setErrors([]);
    onSaved(config);
    setSavedMessage("คืนค่าเริ่มต้นแล้ว");
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-300 p-3 dark:border-zinc-700">
      <p className="text-sm font-semibold">ตั้งค่าการคิดค่าไฟ</p>
      <p className="text-xs text-zinc-500">
        อัตราเหล่านี้เป็นสูตรเบื้องต้นจากเอกสารตัวอย่าง ยังไม่ใช่สูตรทางการที่ได้รับการรับรอง
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-sm" htmlFor="ft-rate">
          FT (บาท/หน่วย)
        </label>
        <input
          id="ft-rate"
          type="number"
          step="any"
          value={ftRate}
          onChange={(e) => {
            setSavedMessage(null);
            setFtRate(e.target.value);
          }}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm" htmlFor="tax-rate">
          ภาษี (%)
        </label>
        <input
          id="tax-rate"
          type="number"
          step="any"
          value={taxRatePercent}
          onChange={(e) => {
            setSavedMessage(null);
            setTaxRatePercent(e.target.value);
          }}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm" htmlFor="base-charge">
          ค่าฐาน (บาท)
        </label>
        <input
          id="base-charge"
          type="number"
          step="any"
          value={baseCharge}
          onChange={(e) => {
            setSavedMessage(null);
            setBaseCharge(e.target.value);
          }}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">ช่วงอัตราค่าไฟ</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="pb-1 pr-2">หน่วยเริ่มต้น</th>
                <th className="pb-1 pr-2">หน่วยสูงสุด</th>
                <th className="pb-1 pr-2">บาท/หน่วย</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier, index) => {
                const isLast = index === tiers.length - 1;
                return (
                  <tr key={index}>
                    <td className="pr-2 pb-2">
                      <input
                        type="number"
                        step="1"
                        value={tier.minUnit}
                        onChange={(e) => updateTier(index, { minUnit: e.target.value })}
                        className="w-24 rounded-lg border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="pr-2 pb-2">
                      {isLast ? (
                        <span className="text-zinc-500">ไม่จำกัด</span>
                      ) : (
                        <input
                          type="number"
                          step="1"
                          value={tier.maxUnit}
                          onChange={(e) => updateTier(index, { maxUnit: e.target.value })}
                          className="w-24 rounded-lg border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      )}
                    </td>
                    <td className="pr-2 pb-2">
                      <input
                        type="number"
                        step="any"
                        value={tier.rate}
                        onChange={(e) => updateTier(index, { rate: e.target.value })}
                        className="w-28 rounded-lg border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="pb-2">
                      <button
                        type="button"
                        onClick={() => removeTier(index)}
                        disabled={tiers.length <= 1}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-zinc-700"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addTier}
          className="self-start rounded-lg border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          + เพิ่มช่วงอัตรา
        </button>
      </div>

      {errors.length > 0 && (
        <ul className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
      {savedMessage && (
        <p className="rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-800">
          {savedMessage}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-zinc-900 px-4 py-2 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          บันทึกการตั้งค่า
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold dark:border-zinc-700"
        >
          คืนค่าเริ่มต้น
        </button>
      </div>
    </section>
  );
}
