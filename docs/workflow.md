# Workflow — RMU Meter Collection

> ดู data model ที่รองรับ flow นี้ใน [data-model.md](data-model.md), รายละเอียด offline/sync ใน [offline-strategy.md](offline-strategy.md), รายละเอียด OCR ใน [ocr-strategy.md](ocr-strategy.md) และรายละเอียด export ใน [export-format.md](export-format.md)
> **ปรับปรุง 2026-09-02**: ขั้นตอน 5 (OCR) — OCR Region เป็นการ crop ชั่วคราวใน memory/client เท่านั้น ไม่ persist เป็นไฟล์ถาวร (ดู [decision-log.md](decision-log.md))

## 1. Main Flow — ผู้จดมิเตอร์ (METER_READER)

```
1. Scan QR (กล้องมือถือ)
   → ระบบ resolve QR code → Meter ID

2. แสดงข้อมูลอัตโนมัติ (ไม่ต้องกรอกเอง)
   - Meter (รหัส/หมายเลข)
   - Room
   - Zone
   - Previous Reading (ของเดือนก่อนหน้าเดือนที่จะเลือก)

3. เลือกเดือน
   - Default: เดือนปัจจุบัน (auto-select)
   - แก้ไขได้: เลือกย้อนหลังได้
   - Guard: ห้ามเลือกเดือนอนาคต (validate ฝั่ง UI + ฝั่ง save)
   - เมื่อเปลี่ยนเดือน → Previous Reading ต้อง refresh ตามเดือนก่อนหน้าของเดือนใหม่ที่เลือก

4. ถ่ายภาพมิเตอร์ (เต็มภาพ)
   - เก็บเป็น Original Image (หลักฐาน ห้ามครอปทิ้ง)

5. OCR เฉพาะบริเวณเลขมิเตอร์
   - ผู้ใช้ (หรือระบบ) กำหนด OCR Region จาก Original Image — crop นี้อยู่ใน memory/client ชั่วคราวเท่านั้น ไม่บันทึกเป็นไฟล์
   - รัน OCR เฉพาะ region นั้น → ได้ OCR Value (เก็บเฉพาะค่าตัวเลขผลลัพธ์ลงฐานข้อมูล ไม่เก็บภาพ crop)

6. ตรวจสอบ
   - แสดง OCR Value ให้ผู้จดตรวจ
   - แก้ไขได้ถ้า OCR อ่านผิด → กลายเป็น Confirmed Value
   - ตรวจสอบ Duplicate: Meter + Month นี้เคยมี Reading แล้วหรือยัง
     - ถ้าซ้ำ → แจ้งเตือน ห้าม confirm ซ้ำ (ต้องแก้ไขของเดิมแทน ไม่ใช่สร้างใหม่)

7. Confirm
   - ผู้จดกดยืนยันค่าสุดท้าย (Confirmed Value)

8. บันทึก
   - ถ้า Online → บันทึกขึ้น Server ทันที
   - ถ้า Offline → บันทึกลง IndexedDB, status = PENDING_SYNC
     → เมื่อกลับ Online → ระบบ sync อัตโนมัติ (ไม่ต้องกดเอง)
```

**เป้าหมาย UX**: Scan → ถ่าย → ตรวจ → ยืนยัน → จบ (ขั้นตอนน้อยที่สุด)

---

## 2. ข้อมูลที่ต้องเก็บต่อ Reading 1 รายการ

| Field | ที่มา |
|---|---|
| Meter ID / Room / Zone | ได้จาก QR (ระบบรู้เอง ไม่ต้องกรอก) |
| Month | เลือกเดือน (auto-select ปัจจุบัน, ย้อนหลังได้, ห้ามอนาคต) |
| Previous Reading | Query จาก reading ของเดือนก่อนหน้าเดือนที่เลือก |
| Original Image | ภาพเต็มจากกล้อง — **ค่าเดียวที่ persist เป็นไฟล์** เก็บที่ `public/upload/meter/{MeterID}m{MM}_{YYYY}.{ext}` (ดู data-model.md §3.2) |
| OCR Value | ผลลัพธ์ดิบจาก OCR (ได้จาก crop ชั่วคราวใน memory — **ไม่ persist ตัวภาพ crop**, persist แค่ค่าตัวเลขนี้) |
| Confirmed Value | ค่าที่ผู้จดตรวจ/แก้ไขแล้ว (ค่าที่ใช้จริงในการคำนวณ/รายงาน) |
| Sync Status | DRAFT / PENDING_SYNC / SYNCING / SYNCED / SYNC_ERROR |
| Reader (Role/User ที่จด) | จาก role ที่เลือกใน MVP |
| Timestamp | เวลาที่บันทึก |

---

## 3. Offline / Sync State Machine

```
        [เริ่มกรอก]
             │
             ▼
          DRAFT ───────────────► (ยกเลิก/ยังไม่ confirm)
             │
        Confirm + Save
             │
      ┌──────┴──────┐
      │             │
   Online         Offline
      │             │
      ▼             ▼
   (บันทึก        PENDING_SYNC
    ตรง Server)      │
      │          กลับมา Online
      ▼               │
   SYNCED              ▼
                    SYNCING
                    ┌───┴───┐
                    ▼       ▼
                 SYNCED   SYNC_ERROR
                              │
                        (retry / แจ้งเตือนให้ผู้ใช้แก้ไข)
```

กติกาสำคัญ:
- Duplicate check (Meter + Month) ต้องทำทั้งตอน confirm บนเครื่อง **และ** ตอน sync ขึ้น server (กันกรณี 2 อุปกรณ์จดซ้ำกันตอน offline)
- รูปภาพ (Original Image) ต้องถูกเก็บใน IndexedDB คู่กับ record จนกว่าจะ SYNCED สำเร็จ
- SYNC_ERROR ต้องเก็บ error reason ไว้ให้ผู้ใช้/แอดมินตรวจสอบได้ ไม่ใช่แค่ fail เงียบๆ

---

## 4. Export Excel — โครงสร้างคอลัมน์ที่ต้องมี

```
ลำดับที่ | เลขที่บ้านพัก | ชื่อ-สกุล |     อ่านมิเตอร์      |            ค่าไฟ                    |
         |               |          | ครั้งหลัง | ครั้งก่อน | ค่าไฟพื้นฐาน | ค่า FT | ภาษี | รวมทั้งสิ้น |
```

- Group header "อ่านมิเตอร์" ครอบ: ครั้งหลัง, ครั้งก่อน
- Group header "ค่าไฟ" ครอบ: ค่าไฟพื้นฐาน, ค่า FT, ภาษี, รวมทั้งสิ้น
- หน่วยที่ใช้ = ครั้งหลัง − ครั้งก่อน (คำนวณได้แน่นอน ไม่ต้องรอ requirement เพิ่ม)
- **ค่าไฟพื้นฐาน / ค่า FT / ภาษี / รวมทั้งสิ้น = สูตรยังไม่ final ห้ามเดา** ต้องได้สูตรจริงจากผู้ใช้ก่อนพัฒนาส่วนนี้ (ดู requirement.md §5)

---

## 5. Role x Flow (สันนิษฐาน — ต้องยืนยัน)

| Flow | ADMIN | METER_READER | RESIDENT |
|---|---|---|---|
| Scan/จด reading | อาจทำได้ (สำรอง) | ✅ หลัก | ❌ |
| ดู reading ของตัวเอง | ✅ | ✅ | ✅ (เฉพาะของตน — ต้องยืนยันขอบเขต) |
| แก้ไข Meter/Room/Zone master data | ✅ | ❌ | ❌ |
| Export Excel | ✅ | ❌ (ต้องยืนยัน) | ❌ |
| จัดการ SYNC_ERROR | ✅ | อาจแก้ของตัวเองได้ | ❌ |

ตารางนี้เป็นข้อเสนอเบื้องต้นจากบริบท ไม่ใช่ requirement ที่ยืนยันแล้ว — โปรดยืนยัน/แก้ไขก่อนเริ่ม implement ระบบสิทธิ์
