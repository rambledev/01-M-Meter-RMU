# Export Format — RMU Meter Collection

> สถานะ: **⏸️ ยังไม่ final — รอสูตรคำนวณค่าไฟและไฟล์ตัวอย่างรายงานจริงจากผู้ใช้** (ดู [requirement.md](requirement.md) §5 ข้อ 1–2)
> เอกสารนี้ระบุเฉพาะส่วนที่คำนวณได้แน่นอนแล้ว — **ห้ามเดาสูตรค่าไฟ** ตามคำสั่งเดิมของผู้ใช้
> อ้างอิง [workflow.md](workflow.md) §4 และ [data-model.md](data-model.md)

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
| อ่านมิเตอร์ | ครั้งก่อน | ✅ มาจาก `Reading.confirmedValue` ของเดือนก่อนหน้า (ใช้ logic เดียวกับ Previous Reading ใน requirement.md §3.1) |
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

ค่านี้ไม่ persist ซ้ำใน database (ดู data-model.md §6) — คำนวณตอน generate export เท่านั้น จาก `Reading.confirmedValue` ของเดือนปัจจุบัน และ `previousReading` ที่ query จาก `Reading.confirmedValue` ของเดือนก่อนหน้า (logic เดียวกับ Previous Reading ใน requirement.md §3.1)

---

## 3. Calculation Service (Architecture — แยกจาก Excel Export โดยเจตนา)

การคำนวณค่าไฟต้องอยู่ใน **service แยกต่างหาก** จาก logic การสร้างไฟล์ Excel เสมอ ไม่ว่าจะได้สูตรจริงเมื่อไหร่ก็ตาม:

```
src/lib/export/
├── calculation.ts   # Calculation Service — usage, และ (ในอนาคต) ค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้น
└── excel.ts         # Excel generation — layout, merge cell, formatting เท่านั้น ไม่มี business logic คำนวณ
```

- **เหตุผลที่ต้องแยก**: สูตรค่าไฟ (§4 ด้านล่าง) ยังไม่ final และมีแนวโน้มเปลี่ยนแปลง/ปรับ config ได้ในอนาคต (เช่น อัตรา FT เปลี่ยนรายเดือน) — ถ้าฝัง logic ไว้ใน excel generation จะทำให้แก้สูตรกระทบ layout code โดยไม่จำเป็น
- **Calculation Service วันนี้** ทำได้แค่ `usage` (สูตรด้านบน) เท่านั้น — ฟังก์ชันคำนวณค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้นจะเป็น stub ที่รอสูตรจริงก่อนเขียนจริง (ไม่ implement แบบเดาไปก่อน)
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
