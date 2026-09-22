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
  resolvedFtRate,
}: {
  confirmedValue: number;
  previousReading: number | null;
  config: BillingConfig;
  // Ft ของเดือนของ reading นี้โดยเฉพาะ (resolve จาก readingMonth เสมอ — ไม่ใช่
  // Ft ปัจจุบัน) null = ยังไม่ได้กำหนดค่า Ft สำหรับเดือนนี้ (2026-09-17)
  resolvedFtRate: number | null;
}) {
  const [open, setOpen] = useState(false);
  const breakdown = buildBillingBreakdown(confirmedValue, previousReading, config, resolvedFtRate);

  if (breakdown.ftNotConfigured) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          ยังไม่ได้กำหนดค่า Ft สำหรับเดือนนี้
        </p>
        <p className="text-xs text-zinc-500">
          หน่วยที่ใช้: {breakdown.usage ?? "-"} — ระบบยังไม่คำนวณยอดค่าไฟจนกว่าผู้ดูแลระบบจะกำหนดค่า Ft ของเดือนนี้
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
        <span className="text-zinc-500">หน่วยที่ใช้</span>
        <span>{breakdown.usage ?? "-"}</span>
        <span className="text-zinc-500">ค่าพื้นฐานรวม</span>
        <span>{baht(breakdown.baseCharge)}</span>
        <span className="text-zinc-500">ค่า FT</span>
        <span>{baht(breakdown.ft)}</span>
        <span className="text-zinc-500">VAT ({config.taxRatePercent}%)</span>
        <span>{baht(breakdown.tax)}</span>
        <span className="text-zinc-500">ค่าบริการ</span>
        <span>{breakdown.baseChargeFixed.toFixed(2)}</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">ค่าไฟสุทธิ</span>
        <span className="font-semibold">{baht(breakdown.total)}</span>
      </div>

      {breakdown.usage !== null && (
        <p className="text-xs text-zinc-500">
          สูตรเบื้องต้นจากเอกสารตัวอย่าง สามารถปรับอัตราได้ที่ตั้งค่าการคิดค่าไฟ
        </p>
      )}

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
              <p className="mt-1 font-semibold">ค่าพื้นฐานรวม (ไม่รวมค่าบริการ):</p>
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
              <p>ค่าพื้นฐานรวม = {baht(breakdown.baseCharge)} บาท</p>

              <p className="mt-1 font-semibold">ค่า FT:</p>
              <p>
                {baht(breakdown.baseCharge)} × {resolvedFtRate} = {baht(breakdown.ft)} บาท
              </p>

              <p className="mt-1 font-semibold">ค่าไฟก่อน VAT:</p>
              <p>
                {baht(breakdown.baseCharge)} + {baht(breakdown.ft)} = {baht(breakdown.preVatCharge)} บาท
              </p>

              <p className="mt-1 font-semibold">VAT:</p>
              <p>
                {baht(breakdown.preVatCharge)} × {config.taxRatePercent}% = {baht(breakdown.tax)} บาท
              </p>

              <p className="mt-1 font-semibold">ค่าบริการ:</p>
              <p>{breakdown.baseChargeFixed.toFixed(2)} บาท</p>

              <p className="mt-1 font-semibold">ค่าไฟสุทธิ:</p>
              <p>
                {baht(breakdown.preVatCharge)} + {baht(breakdown.tax)} +{" "}
                {breakdown.baseChargeFixed.toFixed(2)} = {baht(breakdown.total)} บาท
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
