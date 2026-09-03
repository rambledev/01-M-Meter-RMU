"use client";

import { useState } from "react";
import { buildBillingBreakdown } from "@/lib/billing/breakdown";
import type { BillingConfig } from "@/lib/billing/types";

function baht(value: number | null): string {
  return value === null ? "-" : value.toFixed(2);
}

export default function BillingBreakdownPanel({
  confirmedValue,
  previousReading,
  config,
}: {
  confirmedValue: number;
  previousReading: number | null;
  config: BillingConfig;
}) {
  const [open, setOpen] = useState(false);
  const breakdown = buildBillingBreakdown(confirmedValue, previousReading, config);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
        <span className="text-zinc-500">หน่วยที่ใช้</span>
        <span>{breakdown.usage ?? "-"}</span>
        <span className="text-zinc-500">ค่าไฟพื้นฐาน</span>
        <span>{baht(breakdown.baseCharge)}</span>
        <span className="text-zinc-500">ค่า FT</span>
        <span>{baht(breakdown.ft)}</span>
        <span className="text-zinc-500">ภาษี</span>
        <span>{baht(breakdown.tax)}</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">รวมทั้งสิ้น</span>
        <span className="font-semibold">{baht(breakdown.total)}</span>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="self-start rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold dark:border-zinc-700"
      >
        {open ? "ซ่อนวิธีคำนวณ" : "ดูวิธีคำนวณ"}
      </button>

      {open && (
        <div className="flex flex-col gap-1 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-800">
          <p>
            อ่านครั้งก่อน = {breakdown.previousReading ?? "-"}, อ่านครั้งหลัง ={" "}
            {breakdown.confirmedValue}
          </p>
          {breakdown.usage === null ? (
            <p>ไม่มีค่าครั้งก่อน — ไม่สามารถคำนวณค่าไฟได้</p>
          ) : (
            <>
              <p>
                หน่วยที่ใช้: {breakdown.confirmedValue} - {breakdown.previousReading} ={" "}
                {breakdown.usage} หน่วย
              </p>
              <p className="mt-1 font-semibold">ค่าไฟพื้นฐาน:</p>
              <p>ค่าฐาน (คงที่) = {breakdown.baseChargeFixed.toFixed(2)} บาท</p>
              {breakdown.tierLines
                .filter((line) => line.units > 0)
                .map((line, i) => (
                  <p key={i}>
                    ช่วง{" "}
                    {line.tier.maxUnit === null
                      ? `${line.tier.minUnit}+`
                      : `${line.tier.minUnit}–${line.tier.maxUnit}`}
                    : {line.units.toFixed(2)} × {line.tier.rate} ={" "}
                    {line.charge.toFixed(2)} บาท
                  </p>
                ))}
              <p>รวมค่าไฟพื้นฐาน = {baht(breakdown.baseCharge)} บาท</p>
              <p className="mt-1 font-semibold">ค่า FT:</p>
              <p>
                {breakdown.usage} × {config.ftRate} = {baht(breakdown.ft)} บาท
              </p>
              <p className="mt-1 font-semibold">ภาษี:</p>
              <p>
                ({baht(breakdown.baseCharge)} + {baht(breakdown.ft)}) × {config.taxRatePercent}% ={" "}
                {baht(breakdown.tax)} บาท
              </p>
              <p className="mt-1 font-semibold">รวมทั้งสิ้น:</p>
              <p>
                {baht(breakdown.baseCharge)} + {baht(breakdown.ft)} + {baht(breakdown.tax)} ={" "}
                {baht(breakdown.total)} บาท
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
