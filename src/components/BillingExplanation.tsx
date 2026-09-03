"use client";

import { useState } from "react";
import { buildBillingExplanation } from "@/lib/billing/explanation";
import type { BillingConfig } from "@/lib/billing/types";

function tierLabel(tier: BillingConfig["tiers"][number]): string {
  const range = tier.maxUnit === null ? `${tier.minUnit}+` : `${tier.minUnit}–${tier.maxUnit}`;
  return `${range} หน่วย`;
}

export default function BillingExplanation({ config }: { config: BillingConfig }) {
  const [open, setOpen] = useState(false);
  const explanation = buildBillingExplanation(config);

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="self-start rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
      >
        {open ? "ซ่อนคำอธิบาย" : "อธิบายการคิดค่าไฟ"}
      </button>

      {open && (
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-300 p-4 text-sm dark:border-zinc-700">
          <p className="font-semibold">การคิดค่าไฟปัจจุบัน</p>
          <ol className="list-decimal pl-5">
            {explanation.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>

          <p className="mt-2 font-semibold">ช่วงอัตราค่าไฟพื้นฐานปัจจุบัน</p>
          <ul className="list-disc pl-5">
            {explanation.config.tiers.map((tier, i) => (
              <li key={i}>
                {tierLabel(tier)}: {tier.rate} บาท/หน่วย
              </li>
            ))}
          </ul>
          <p>ค่าฐาน (คงที่): {explanation.config.baseCharge} บาท</p>

          <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-amber-800">
            {explanation.disclaimer}
          </p>
        </div>
      )}
    </section>
  );
}
