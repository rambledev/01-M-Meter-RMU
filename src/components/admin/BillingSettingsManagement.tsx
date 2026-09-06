"use client";

import { useEffect, useState } from "react";
import { updateBillingConfig } from "@/lib/admin/adminApi";
import { DEFAULT_BILLING_CONFIG } from "@/lib/billing/defaultConfig";
import { fetchBillingConfig } from "@/lib/billing/billingConfigApi";
import { validateTiers } from "@/lib/billing/tierValidation";
import type { BillingConfig, BillingTier } from "@/lib/billing/types";

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
// a UI toggle, so it can never be edited into an invalid combination.
function toBillingTiers(drafts: DraftTier[]): BillingTier[] {
  return drafts.map((d, index) => ({
    minUnit: Number(d.minUnit),
    maxUnit: index === drafts.length - 1 ? null : Number(d.maxUnit),
    rate: Number(d.rate),
  }));
}

// Admin tab "ตั้งค่าค่าไฟ" — was BillingSettingsPanel.tsx living inline on
// /checker with per-device IndexedDB storage; moved here 2026-09-06 so it's
// a single shared PostgreSQL config every /checker device reads (Admin is
// the role that owns system-wide settings, not each meter reader's own
// device).
export default function BillingSettingsManagement() {
  const [ftRate, setFtRate] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState("");
  const [baseCharge, setBaseCharge] = useState("");
  const [tiers, setTiers] = useState<DraftTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = await fetchBillingConfig();
      if (cancelled) return;
      setFtRate(String(config.ftRate));
      setTaxRatePercent(String(config.taxRatePercent));
      setBaseCharge(String(config.baseCharge));
      setTiers(toDraftTiers(config.tiers));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
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
    setTiers((prev) => prev.filter((_, i) => i !== index));
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

  async function applyConfig(config: BillingConfig, successMessage: string) {
    setBusy(true);
    setErrors([]);
    setSavedMessage(null);
    try {
      const saved = await updateBillingConfig(config);
      setFtRate(String(saved.ftRate));
      setTaxRatePercent(String(saved.taxRatePercent));
      setBaseCharge(String(saved.baseCharge));
      setTiers(toDraftTiers(saved.tiers));
      setSavedMessage(successMessage);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "บันทึกไม่สำเร็จ"]);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    const config = buildConfig();
    const validationErrors = validate(config);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;
    await applyConfig(config, "บันทึกการตั้งค่าแล้ว");
  }

  async function handleReset() {
    await applyConfig(DEFAULT_BILLING_CONFIG, "คืนค่าเริ่มต้นแล้ว");
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">กำลังโหลด...</p>;
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-400">ตั้งค่าการคิดค่าไฟ</h3>
      <p className="text-xs text-zinc-500">
        อัตราเหล่านี้เป็นสูตรเบื้องต้นจากเอกสารตัวอย่าง ยังไม่ใช่สูตรทางการที่ได้รับการรับรอง —
        มีผลกับผู้จดมิเตอร์ทุกเครื่องทันทีที่บันทึก
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
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800">
          {savedMessage}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50 hover:bg-emerald-700"
        >
          บันทึกการตั้งค่า
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold disabled:opacity-50 dark:border-zinc-700"
        >
          คืนค่าเริ่มต้น
        </button>
      </div>
    </section>
  );
}
