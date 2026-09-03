# Export Format — RMU Meter Collection

> สถานะ: **✅ Phase 6B implement แล้ว (2026-09-03)** — ค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้นคำนวณจริงแล้วผ่าน Billing Configuration ที่ปรับได้ (ดู §8) แต่อัตราเริ่มต้นเป็น **"สูตรเบื้องต้นจากเอกสารตัวอย่าง" เท่านั้น ไม่ใช่สูตรทางการที่ได้รับการรับรอง** (ดู [requirement.md](requirement.md) §5 ข้อ 1–2, §7, §8)
> เอกสารนี้ระบุเฉพาะส่วนที่คำนวณได้แน่นอนแล้ว — **ห้ามเดาสูตรค่าไฟ** ตามคำสั่งเดิมของผู้ใช้
> อ้างอิง [workflow.md](workflow.md) §4 และ [data-model.md](data-model.md)
> **ปรับปรุง Phase 1 (2026-09-02)**: `usage` เปลี่ยนจาก "คำนวณตอน export เท่านั้น" เป็น **persist เป็น field บน `Reading` แล้ว** (snapshot ณ เวลา confirm) — ดู §2
> **ปรับปรุง Phase 6 (2026-09-03)**: ดู §7 สำหรับสิ่งที่ implement จริง (path ไฟล์, library, decision ต่างๆ) — เป็น MVP ที่ยังไม่มีสูตรค่าไฟจริง (placeholder ทั้งหมด)
> **ปรับปรุง Phase 6B (2026-09-03)**: ดู §8 — เพิ่มสูตรค่าไฟแบบ configurable (Billing Configuration ใน IndexedDB) แทน placeholder เดิม, เพิ่มปุ่มอธิบาย/หน้าตั้งค่า

---

## 1. โครงสร้างคอลัมน์ (Confirmed)

```
ลำดับที่ | เลขที่บ้านพัก | ชื่อ-สกุล |     อ่านมิเตอร์      |            ค่าไฟ                    |
         |               |          | ครั้งหลัง | ครั้งก่อน | ค่าไฟพื้นฐาน | ค่า FT | ภาษี | รวมทั้งสิ้น |
```

| Group Header | คอลัมน์ย่อย | สถานะ |
|---|---|---|
| — | ลำดับที่ | ✅ generate จาก row index ตอน export |
| — | เลขที่บ้านพัก | ✅ มาจาก `Room.name` (data-model.md) |
| — | ชื่อ-สกุล | ✅ มาจาก `Room.residentName` (data-model.md) |
| อ่านมิเตอร์ | ครั้งหลัง | ✅ มาจาก `Reading.confirmedValue` ของเดือนที่ export |
| อ่านมิเตอร์ | ครั้งก่อน | ✅ มาจาก `Reading.previousReading` ที่ persist ไว้แล้ว (snapshot ณ เวลา confirm — ดู data-model.md §3.1) |
| ค่าไฟ | ค่าไฟพื้นฐาน | 🔴 รอสูตร |
| ค่าไฟ | ค่า FT | 🔴 รอสูตร |
| ค่าไฟ | ภาษี | 🔴 รอสูตร |
| ค่าไฟ | รวมทั้งสิ้น | 🔴 รอสูตร (ขึ้นกับ 3 คอลัมน์ข้างต้น) |

---

## 2. ค่าที่คำนวณได้แน่นอน (ไม่ต้องรอ requirement เพิ่ม)

```
usage = confirmedValue - previousReading
(หน่วยที่ใช้ = ครั้งหลัง − ครั้งก่อน)
```

**อัปเดต Phase 1**: `Reading.usage` และ `Reading.previousReading` **persist เป็น field บน `Reading` โดยตรงแล้ว** (snapshot ที่คำนวณ ณ เวลา confirm — ดู data-model.md §3.1, §5) — Export **อ่านค่าจาก `Reading.usage` ตรงๆ ไม่ต้องคำนวณซ้ำ** ต่างจากที่เคยออกแบบไว้ในเอกสารรุ่นก่อนที่ให้คำนวณตอน export เท่านั้น

---

## 3. Calculation Service (Architecture — แยกจาก Excel Export โดยเจตนา)

การคำนวณค่าไฟต้องอยู่ใน **service แยกต่างหาก** จาก logic การสร้างไฟล์ Excel เสมอ ไม่ว่าจะได้สูตรจริงเมื่อไหร่ก็ตาม:

```
src/lib/export/
├── calculation.ts   # Calculation Service — (ในอนาคต) ค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้น
└── excel.ts         # Excel generation — layout, merge cell, formatting เท่านั้น ไม่มี business logic คำนวณ
```

- **เหตุผลที่ต้องแยก**: สูตรค่าไฟ (§4 ด้านล่าง) ยังไม่ final และมีแนวโน้มเปลี่ยนแปลง/ปรับ config ได้ในอนาคต (เช่น อัตรา FT เปลี่ยนรายเดือน) — ถ้าฝัง logic ไว้ใน excel generation จะทำให้แก้สูตรกระทบ layout code โดยไม่จำเป็น
- **`usage` ไม่ต้องผ่าน Calculation Service อีกต่อไป** (อัปเดต Phase 1) — เพราะ persist เป็น field บน `Reading` แล้ว อ่านตรงจาก DB ได้เลย (§2) — Calculation Service เหลือหน้าที่แค่สูตรค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้นที่ยังไม่ final เท่านั้น (จะเป็น stub ที่รอสูตรจริงก่อนเขียนจริง ไม่ implement แบบเดาไปก่อน)
- Calculation Service ควร unit-test ได้อิสระจาก Excel generation เพื่อให้ตรวจสอบสูตรถูกต้องได้โดยไม่ต้อง generate ไฟล์จริงทุกครั้ง

---

## 4. ส่วนที่ยังไม่ implement ได้ (Blocker ของ Phase 6 — Excel Export)

1. **สูตรค่าไฟพื้นฐาน** — ไม่ทราบอัตราต่อหน่วย/ขั้นบันได (tiered rate) หรือ flat rate — ต้องรอข้อมูลจริงจากผู้ใช้
2. **สูตรค่า FT** (ค่าไฟฟ้าผันแปร) — ไม่ทราบอัตรา ณ ปัจจุบัน และไม่ทราบว่าอัตรานี้ต้อง config เปลี่ยนได้ต่อเดือนหรือ fix ค่าเดียว
3. **สูตรภาษี** — ไม่ทราบว่าเป็น VAT 7% มาตรฐาน หรือมีเงื่อนไขเฉพาะของ RMU
4. **รวมทั้งสิ้น** — ขึ้นกับผลของ 3 ข้อบน จึงยังคำนวณไม่ได้จนกว่าจะมีสูตรจริง
5. **ไฟล์ตัวอย่างรายงาน Excel จริง** — จำเป็นสำหรับตรวจสอบรายละเอียดที่ column header เพียงอย่างเดียวบอกไม่ครบ เช่น:
   - รูปแบบ merge cell ของ group header จริง (กี่แถว, วิธี merge)
   - Font/สี/border style ที่ต้องตรงกับรายงานต้นฉบับ
   - มีแถวสรุปท้ายตาราง (total/summary row) หรือไม่
   - Sheet เดียวหรือแยกตาม zone/เดือน

---

## 5. แนวทาง Implementation ที่เสนอ (เมื่อได้ข้อมูลครบแล้ว)

- ใช้ library สร้างไฟล์ Excel ที่รองรับ merge cell + group header (ตัวเลือก library จะกำหนดตอน Phase 0 setup เมื่อ dependency install ได้ — ยังไม่ล็อกในเอกสารนี้)
- คงการแยก Calculation Service (`src/lib/export/calculation.ts`) ออกจาก Excel generation (`src/lib/export/excel.ts`) ตาม §3
- Export ควรทำเป็น API Route (`src/app/api/export/`) ที่รับ parameter zone/เดือน แล้ว query `Reading` + `Room` ผ่าน Prisma มาประกอบเป็นไฟล์ ตรงตาม data-model.md

---

## 6. เมื่อไหร่ที่เอกสารนี้จะถือว่า "พร้อม implement Phase 6"

เอกสารนี้จะอัปเดตเป็น final เมื่อได้รับจากผู้ใช้ครบทั้ง:
- [ ] สูตร/อัตราค่าไฟพื้นฐาน, ค่า FT, ภาษี
- [ ] ไฟล์ตัวอย่างรายงาน Excel จริงอย่างน้อย 1 ไฟล์

จนกว่าจะครบ Phase 6 จะไม่เริ่ม implement ส่วนคำนวณค่าไฟตามคำสั่งเดิมของผู้ใช้ (requirement.md §3.5)

---

## 7. Phase 6 MVP — สิ่งที่ implement จริง (2026-09-03)

สูตรค่าไฟยังไม่ครบตาม §6 (ยังไม่ได้สูตรจริง/ไฟล์ตัวอย่างรายงาน) แต่ผู้ใช้อนุมัติให้ทำ **Excel Export MVP สำหรับ demo** โดยให้ค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้นเป็น placeholder แทนที่จะรอสูตรจริง งานนี้ไม่ถือว่าเอกสารข้อ §6 ครบแล้ว — เมื่อได้สูตรจริงต้องกลับมาแก้ `calculateBilling()` เท่านั้น (ไม่แตะ Excel layout code)

### ไฟล์ที่สร้างจริง
```
src/lib/export/
├── calculation.ts       # Calculation Service — calculateUsage() (wrapper รอบ src/lib/reading/readingMonth.ts)
│                        #   และ calculateBilling() ที่ return null ทั้งหมด (placeholder, ไม่มีสูตรจริง)
├── mapReadingToRow.ts   # แปลง Reading (join Meter→Room) เป็น ExportRow โดยเรียก Calculation Service
├── excel.ts             # ExcelJS layout เท่านั้น — merge cell, group header, border, number format
├── filename.ts          # buildExportFilename() → "บัญชีเรียกเก็บเงินค่าไฟฟ้า-YYYY-MM.xlsx"
└── monthParam.ts         # parse "YYYY-MM" จาก query string → Date (validate เดือน 01-12)

src/app/api/export/route.ts       # GET ?month=YYYY-MM — query PostgreSQL, join Reading→Meter→Room→Zone
src/components/ExportExcelButton.tsx  # UI: เลือกเดือน + ปุ่ม Export Excel (อยู่ต่อจาก History บนหน้าแรก)
```

### Decision ที่เพิ่มจาก MVP นี้
- **Library**: เลือก `exceljs` (ไม่ใช่ `xlsx`/SheetJS) เพราะรองรับ merge cell + font/border/fill ครบ ตรงกับ requirement ของ group header 2 ชั้น — ดู decision-log.md สำหรับ vulnerability ที่รับทราบและยอมรับ (uuid transitive dependency)
- **`calculateBilling()` เป็น stub ถาวรใน Phase 6** — return `{ baseCharge: null, ftCharge: null, tax: null, total: null }` เสมอ, Excel layer render null เป็น `"-"` — ไม่มีการเดาสูตรใดๆ ตามคำสั่งเดิม
- **ตำแหน่งคอลัมน์ "หน่วยที่ใช้"**: mockup header เดิมไม่ได้ระบุกลุ่มของคอลัมน์นี้ชัดเจน (มีแค่กลุ่ม "อ่านมิเตอร์" และ "ค่าไฟ") จึงวางเป็นคอลัมน์เดี่ยว (ไม่ merge กลุ่ม) คั่นกลางระหว่างสองกลุ่มนั้น
- **ไม่พบข้อมูล**: API ตอบ `404 {ok:false, error:"NO_DATA", message:"ไม่พบข้อมูลการอ่านมิเตอร์สำหรับเดือนนี้"}` แทนการสร้างไฟล์ Excel ว่างหรือ Reading ปลอม — ตรวจสอบแล้วด้วย browser test จริง
- **orderBy**: ใช้ `{ meterId: "asc" }` แบบง่าย แทนการ sort ผ่าน relation หลายชั้น (เช่น zone/room name) เพื่อลดความเสี่ยงจาก Prisma nested-relation ordering limitation — เป็นการลดความซับซ้อนสำหรับ MVP

### ยังไม่ implement (คงตามเดิมจาก §4)
สูตรค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้นจริง ยังคงบล็อกตาม §4 ทุกข้อ — เอกสารนี้จะไม่ถือว่า "พร้อม" (§6) จนกว่าจะได้ข้อมูลจริงจากผู้ใช้

---

## 8. Phase 6B — Billing Calculation + Settings + Explanation (2026-09-03)

Phase 6 ทิ้ง `calculateBilling()` ไว้เป็น stub คืน null ทั้งหมด (§7) เพราะยังไม่มีสูตรจริง — Phase 6B เพิ่มสูตรคำนวณจริงเข้ามาแล้ว แต่ **ยังไม่ใช่สูตรทางการ**: เป็น **"สูตรเบื้องต้นที่แกะจากเอกสารตัวอย่าง"** ที่ผู้ใช้ระบุไว้ในคำสั่ง Phase 6B kickoff (FT 0.0972 บาท/หน่วย, ภาษี 7%, ค่าฐาน 8.19 บาท, ช่วงอัตรา 5 ช่วง) — อัตราค่าไฟพื้นฐานยังอยู่ระหว่างรอการยืนยันจากเจ้าหน้าที่ RMU ไม่ควรนำไปใช้ออกบิลจริง

### สถาปัตยกรรม: Billing Configuration แยกจาก Calculation Service

```
src/lib/billing/
├── types.ts                  # BillingTier, BillingConfig interfaces (ไม่มีตัวเลขจริงในไฟล์นี้)
├── defaultConfig.ts           # DEFAULT_BILLING_CONFIG — ตัวเลขจากเอกสารตัวอย่างอยู่ที่นี่ที่เดียว
├── tierValidation.ts          # validateTiers() — min/max, rate>=0, ห้ามทับซ้อน, unlimited เฉพาะช่วงสุดท้าย
├── explanation.ts             # buildBillingExplanation(config) — ข้อความอธิบายสร้างจาก config เสมอ
└── breakdown.ts                # buildBillingBreakdown(...) — breakdown ต่อ Reading ("ดูวิธีคำนวณ")

src/lib/offline/billingConfigRepository.ts  # getBillingConfig/saveBillingConfig/resetBillingConfig (Dexie, IndexedDB)

src/lib/export/calculation.ts  # Calculation Service เดิม — เพิ่ม calculateBaseCharge/calculateFT/calculateTax/
                                #   calculateTotal/computeTierBreakdown, calculateBilling() รับ config เป็น parameter
                                #   ไม่มีตัวเลขอัตราใดๆ hard-code อยู่ในไฟล์นี้เลย (ตามคำสั่ง Phase 6B kickoff ข้อ 3)
```

- **`calculateBilling(confirmedValue, previousReading, config)`**: คืน `{ usage, baseCharge, ft, tax, total }` เต็มความละเอียด (ไม่ปัดเศษ) — ปัดเป็น 2 ตำแหน่งเฉพาะตอนแสดงผล (UI: `toFixed(2)`, Excel: `numFmt "#,##0.00"`)
- **ไม่มี previousReading → billing ทั้งชุดเป็น null** (ไม่ใช่แค่ usage) เพราะไม่รู้จำนวนหน่วยจริง การคำนวณค่าคงที่บางส่วนแล้วแสดงเป็นบิลบางส่วนจะทำให้เข้าใจผิดได้
- **ค่าไฟพื้นฐาน = ค่าฐานคงที่ (baseCharge) + ผลรวมตามช่วงอัตรา** — คำนวณแบบ progressive/graduated bracket มาตรฐาน (เหมือนขั้นบันไดภาษีเงินได้): แต่ละช่วงคิดเฉพาะส่วนของ usage ที่ตกอยู่ในช่วงนั้น ไม่ใช่สูตรที่ปรับแต่งให้ตรงกับตัวเลขตัวอย่างในเอกสารเป๊ะ (ตามคำสั่ง "อย่าฝืนแก้สูตรเพื่อให้ Test ผ่าน")

### Billing Configuration (IndexedDB, ไม่แตะ Prisma)

- เก็บใน Dexie table ใหม่ `billingConfig` (single-row, key `"singleton"`) — เพิ่ม `db.version(2)` ใน `src/lib/offline/db.ts` โดยคง `version(1)` เดิมไว้ (Dexie upgrade แบบไม่กระทบข้อมูลเดิม)
- `getBillingConfig()` auto-seed `DEFAULT_BILLING_CONFIG` ถ้ายังไม่มี record, `saveBillingConfig()`/`resetBillingConfig()` ตามที่กำหนด
- **ไม่มี Prisma model ใหม่ ไม่มี migration ใหม่** ตรงตามข้อห้าม

### UI ใหม่

- `BillingSettingsPanel.tsx` — ฟอร์ม FT/ภาษี/ค่าฐาน + ตาราง tier แก้ไขได้ (เพิ่ม/ลบ, validate ผ่าน `validateTiers()`), ปุ่ม "บันทึกการตั้งค่า"/"คืนค่าเริ่มต้น" — tier สุดท้ายบังคับเป็น "ไม่จำกัด" เสมอ (ไม่ให้ผู้ใช้ตั้งค่าผิดได้ตั้งแต่ UI)
- `BillingExplanation.tsx` — ปุ่ม "อธิบายการคิดค่าไฟ" เปิด panel ข้อความที่ generate จาก config ปัจจุบันทั้งหมด (ไม่มีตัวเลข hard-code ในข้อความ) พร้อม disclaimer "สูตรเบื้องต้นจากเอกสารตัวอย่าง..."
- `BillingBreakdownPanel.tsx` — ปุ่ม "ดูวิธีคำนวณ" ต่อ Reading แต่ละรายการ แสดง breakdown ตาม tier จริง — ใช้ทั้งใน saved-reading card และใน `ReadingHistoryList`

### Excel ใช้ Calculation Service เดียวกัน (ไม่มีสูตรที่สอง)

- Client (`ExportExcelButton`) ส่ง `config` (billing config ปัจจุบัน, JSON) เป็น query param เพิ่มจาก Phase 6 เดิม (`?month=...&config=...`) — ไม่เปลี่ยน method/response format ของ route เดิม
- Server (`route.ts`) parse ผ่าน `parseBillingConfigParam()`, fallback เป็น `DEFAULT_BILLING_CONFIG` ถ้าไม่มี/parse ไม่ได้ — เรียก `mapReadingToRow(reading, seq, config)` → `calculateBilling()` ตัวเดียวกับที่ UI ใช้ ไม่มีสูตรซ้ำใน route
- ข้อความ placeholder แถวที่ 4 ของ Excel เปลี่ยนจาก "ยังไม่มีสูตรคำนวณค่าไฟจริง" เป็น "สูตรเบื้องต้นจากเอกสารตัวอย่าง ยังไม่ใช่สูตรทางการ..." ให้ตรงกับสถานะจริง

### ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง

สร้าง 2 readings (ME-001 เดือนก่อน=200, เดือนนี้=260, usage=60) → เห็นค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้นบนหน้าเว็บทันทีหลังบันทึก → เปิด "ดูวิธีคำนวณ" และ "อธิบายการคิดค่าไฟ" → Sync → แก้ FT/ภาษี/อัตราช่วงแรกใน Settings → บันทึก (ค่าที่แสดงเปลี่ยนตาม) → คืนค่าเริ่มต้น (FT กลับเป็น 0.0972) → Export Excel → เปิดไฟล์จริงตรวจแถวข้อมูล: `baseCharge=107.75, ft=5.832, tax=7.9507, total=121.53274` ตรงกับที่คำนวณบนหน้าเว็บ (usage=60, DEFAULT_BILLING_CONFIG) เป๊ะ — ยืนยันว่า Excel กับหน้าเว็บใช้ Calculation Service เดียวกันจริง ไม่มี error ใน console/page เลย
