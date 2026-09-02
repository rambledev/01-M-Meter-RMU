# Data Model — RMU Meter Collection

> สถานะ: **Architecture Specification เท่านั้น — ยังไม่มีการสร้างไฟล์ `prisma/schema.prisma` จริง ยังไม่ install Prisma ยังไม่สร้าง database หรือ migration ใดๆ**
> ORM: Prisma **5.22.0** (locked — ดู [decision-log.md](decision-log.md)) บน PostgreSQL **17**
> อ้างอิง business rules จาก [requirement.md](requirement.md) และ [workflow.md](workflow.md)
> **ปรับปรุง 2026-09-02**: `ReadingImage` เก็บเฉพาะรูป **ORIGINAL** เท่านั้น — ไม่มี `OCR_REGION` อีกต่อไป (ดู [decision-log.md](decision-log.md) หัวข้อ "ไม่จัดเก็บ OCR Crop Image แบบถาวร")
> **ปรับปรุงเพิ่มเติม 2026-09-02**: ชื่อไฟล์ Original Image เปลี่ยนเป็น `{MeterID}m{MM}_{YYYY}.{ext}` (เพิ่มปี ค.ศ.) เพื่อแก้ปัญหา overwrite ข้ามปี — ดู §3.2

---

## 1. ภาพรวม Entity

```
Zone 1───* Room 1───* Meter 1───* Reading 1───* ReadingImage
                                     │
                                     ├── *───1 User (reader)
                                     │
                                     └── 1───* SyncLog (ประวัติการ sync ต่อ reading)
```

- **Zone** → **Room** → **Meter** เป็นลำดับชั้นตำแหน่ง (มิเตอร์ 1 ตัวผูกกับ 1 ห้อง, 1 ห้องอยู่ใน 1 zone)
- **Reading** คือรายการจดมิเตอร์ 1 ครั้ง ผูกกับ Meter + Month (unique constraint ป้องกัน duplicate ตาม requirement.md §3.2 — รายละเอียดเต็มอยู่ใน §4)
- **ReadingImage** คือรูปภาพต้นฉบับ (**ORIGINAL เท่านั้น**) ที่ผูกกับ Reading หนึ่งรายการ แบบ **1:N** — ไม่มีรูป OCR Crop เก็บถาวรอีกต่อไป (OCR Region เป็นข้อมูลชั่วคราวใน memory/client เท่านั้น) รายละเอียดเต็มอยู่ใน §3.2
- **User** ใน MVP คือการจำลอง Role (ไม่มี login จริง) — ยังต้องมี record เพื่อระบุว่าใครเป็นคนจด/แก้ไข
- **SyncLog** เก็บประวัติความพยายาม sync แต่ละครั้งของ Reading หนึ่งรายการ (โดยเฉพาะกรณี SYNC_ERROR ต้องรู้ error reason — workflow.md §3)

---

## 2. Enum

```prisma
enum Role {
  ADMIN
  METER_READER
  RESIDENT
}

enum ReadingStatus {
  DRAFT
  PENDING_SYNC
  SYNCING
  SYNCED
  SYNC_ERROR
}
```

> หมายเหตุ: ไม่มี `ReadingImageType` enum อีกต่อไป — `ReadingImage` เก็บเฉพาะรูปต้นฉบับ (ORIGINAL) เพียงประเภทเดียว จึงไม่จำเป็นต้องมี field แยกประเภทภาพ (ดู §3.2 และ decision-log.md)

> หมายเหตุ: ขอบเขตสิทธิ์ที่แท้จริงของแต่ละ Role (โดยเฉพาะ RESIDENT และสิทธิ์แก้ไข reading ที่ confirm แล้ว) ยังรอยืนยันจากผู้ใช้ — ดู requirement.md §5 ข้อ 3 ตารางด้านล่างเป็นโครง field เท่านั้น ไม่ใช่ authorization logic ที่ final

---

## 3. Model โครงร่าง (Prisma-style — เพื่อสื่อสาร schema เท่านั้น ยังไม่ใช่ไฟล์จริง)

### 3.1 Zone / Room / Meter / Reading / User / SyncLog

```prisma
model Zone {
  id        String   @id @default(cuid())
  name      String
  rooms     Room[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Room {
  id         String   @id @default(cuid())
  name       String            // เลขที่บ้านพัก/ห้อง
  residentName String?         // ชื่อ-สกุลผู้พักอาศัย (ใช้ตอน export คอลัมน์ "ชื่อ-สกุล")
  zoneId     String
  zone       Zone     @relation(fields: [zoneId], references: [id])
  meters     Meter[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Meter {
  id         String   @id @default(cuid())
  code       String   @unique   // รหัส/หมายเลขมิเตอร์ ที่ผูกกับ QR
  roomId     String
  room       Room     @relation(fields: [roomId], references: [id])
  readings   Reading[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Reading {
  id               String        @id @default(cuid())
  meterId          String
  meter            Meter         @relation(fields: [meterId], references: [id])
  readingMonth     DateTime      // เก็บเป็นวันที่ 1 ของเดือน เพื่อใช้ unique + query ง่าย เช่น 2026-03-01
  ocrValue         String?                      // OCR Value ดิบ (nullable กรณี manual entry ล้วน)
  confirmedValue   Decimal                      // Confirmed Value — ค่าที่ใช้จริงในการคำนวณ/รายงาน
  status           ReadingStatus @default(DRAFT)
  readerId         String
  reader           User          @relation(fields: [readerId], references: [id])
  images           ReadingImage[]
  syncLogs         SyncLog[]
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  @@unique([meterId, readingMonth])   // Duplicate Prevention ตาม requirement.md §3.2 — ดูรายละเอียดเต็มใน §4
}

model User {
  id        String   @id @default(cuid())
  name      String
  role      Role
  readings  Reading[]
  createdAt DateTime @default(now())
}

model SyncLog {
  id          String   @id @default(cuid())
  readingId   String
  reading     Reading  @relation(fields: [readingId], references: [id])
  attemptedAt DateTime @default(now())
  status      ReadingStatus   // สถานะ ณ ตอนพยายาม sync ครั้งนี้
  errorReason String?         // เก็บ error message เมื่อ status = SYNC_ERROR (workflow.md §3: ห้าม fail เงียบๆ)
}
```

> หมายเหตุ: field เดือนของ Reading เปลี่ยนชื่อจาก `month` เป็น **`readingMonth`** ในรอบนี้ เพื่อให้ตรงกับชื่อที่ใช้อ้างอิง unique constraint ทุกที่ในเอกสาร (`[meterId, readingMonth]`) — ความหมายและ business rule เดิมไม่เปลี่ยนแปลง (requirement.md §3.1)

### 3.2 ReadingImage (แยก entity ชัดเจน — ไม่ใช่แค่ field ใน Reading) — ORIGINAL เท่านั้น

```prisma
model ReadingImage {
  id          String   @id @default(cuid())
  readingId   String
  reading     Reading  @relation(fields: [readingId], references: [id])
  path        String   // path ของรูปต้นฉบับ เช่น /upload/meter/ME-001m09_2026.jpg — ดูกฎการตั้งชื่อไฟล์ด้านล่าง
  createdAt   DateTime @default(now())
}
```

- **Reading 1:N ReadingImage** — ในทางปฏิบัติ Reading หนึ่งรายการจะมี `ReadingImage` เพียง 1 record (ภาพต้นฉบับที่ถ่ายตอนจดมิเตอร์) ความสัมพันธ์เป็น 1:N (ไม่ใช่ field เดี่ยวฝังบน `Reading`) เพื่อให้ `ReadingImage` ยังเป็น entity ที่อ้างอิง `Reading` ได้ชัดเจนตามที่กำหนด และเผื่อกรณีในอนาคตที่ต้องอัปโหลดภาพต้นฉบับซ้ำ (เช่น แอดมินแก้ไขภาพหลักฐาน) โดยไม่ต้อง migrate schema ของ `Reading` เอง
- **ไม่มี field แยกประเภทภาพ (`type`) และไม่มี `cropRegion` อีกต่อไป** — เดิมมี `type: ORIGINAL | OCR_REGION` และ `cropRegion: Json?` สำหรับเก็บภาพครอป แต่ถูกตัดออกตาม decision "ไม่จัดเก็บ OCR Crop Image แบบถาวร" (decision-log.md) เพราะทุก record ใน `ReadingImage` คือภาพต้นฉบับอยู่แล้วโดยนิยาม จึงไม่จำเป็นต้องมี field บอกประเภท — ตรงตามหลัก "ห้ามสร้าง field/table ที่ไม่มีความจำเป็น"
- **การตั้งชื่อไฟล์ (Server-generated เท่านั้น — Client ห้ามกำหนดเอง)**:
  - Path: `public/upload/meter/`
  - ชื่อไฟล์: **`{MeterID}m{MM}_{YYYY}.{ext}`** โดย `MeterID` = `Meter.code`, `MM` = เดือน 2 หลัก (01–12) ของ `Reading.readingMonth`, `YYYY` = ปี ค.ศ. 4 หลักของ `Reading.readingMonth`, `ext` = นามสกุลไฟล์จริง (เช่น jpg, jpeg, png)
  - ตัวอย่าง: `readingMonth = 2026-09`, `MeterID = ME-001` → `ME-001m09_2026.jpg` → เก็บใน `ReadingImage.path` เป็น `/upload/meter/ME-001m09_2026.jpg`
  - **ชื่อไฟล์สร้างจาก `readingMonth` ที่ผู้ใช้เลือกเสมอ ไม่ใช่วันที่ upload จริง** — สำคัญโดยเฉพาะกรณี offline: ผู้จดอาจเลือกย้อนหลังหรือ sync ช้ากว่าวันที่ถ่ายจริง วันที่ upload จึงใช้ไม่ได้ ต้องอิง `readingMonth` ของ Reading เท่านั้น
  - **Server เป็นผู้สร้างชื่อไฟล์นี้เสมอ** ตอนรับภาพที่ upload ขึ้นมา (ทั้งกรณี online ทันที และกรณี sync จาก offline queue) — client ส่งแค่ตัว binary ภาพ ไม่ส่งชื่อไฟล์
  - ✅ **แก้ปัญหา overwrite ข้ามปีแล้ว**: การเพิ่ม `_{YYYY}` เข้าไปในชื่อไฟล์ทำให้มิเตอร์เดียวกัน เดือนเดียวกัน แต่คนละปี ได้ชื่อไฟล์ต่างกันเสมอ (เช่น `ME-001m09_2026.jpg` ≠ `ME-001m09_2027.jpg`) — ไม่มีความเสี่ยง overwrite ข้ามปีอีกต่อไป (เดิมเป็นความเสี่ยงที่ยังไม่ resolve ก่อนหน้านี้ ดู decision-log.md หัวข้อ "เพิ่มปี ค.ศ. ในชื่อไฟล์รูปภาพมิเตอร์")

---

## 4. Unique Constraint — `[meterId, readingMonth]` (Database เป็น Source of Truth)

ยืนยันคงไว้ตามเดิม ไม่มีการเปลี่ยนแปลง logic:

```prisma
@@unique([meterId, readingMonth])
```

- **Database ระดับ PostgreSQL/Prisma คือ source of truth จริงของ Duplicate Prevention** (requirement.md §3.2) — ไม่ใช่ application logic ฝั่งใดฝั่งหนึ่ง
- **UI/Client-side duplicate check เป็นเพียง best-effort** เพื่อ UX ที่ดี (แจ้งเตือนผู้ใช้เร็วที่สุดเท่าที่ทำได้) แต่**ไม่ใช่การป้องกันจริง** — การป้องกันจริงเกิดที่ constraint นี้เท่านั้น
- เหตุผลที่ต้องเป็น constraint ระดับ DB ไม่ใช่แค่ query เช็คก่อน insert: ป้องกัน race condition เมื่อ 2 อุปกรณ์ที่จดข้อมูลตอน offline พร้อมกัน แล้ว sync ขึ้น server ใกล้เคียงกัน (workflow.md §3) — ถ้าพึ่ง application-level check อย่างเดียวจะมีช่องโหว่ TOCTOU (time-of-check to time-of-use)
- เมื่อ sync แล้วชนกับ constraint นี้: server ตอบกลับ conflict → client set `status = SYNC_ERROR` พร้อม `errorReason` ที่สื่อความหมายชัดเจน (offline-strategy.md §5)

---

## 5. เหตุผลของแต่ละการตัดสินใจด้าน schema

| การตัดสินใจ | เหตุผล |
|---|---|
| `Reading.readingMonth` เป็น `DateTime` (วันที่ 1 ของเดือน) แทน string/enum | ทำให้ query "เดือนก่อนหน้า" (Previous Reading) ง่ายด้วย date arithmetic ตรงตาม requirement.md §3.1 |
| `@@unique([meterId, readingMonth])` ที่ระดับ database | บังคับ Duplicate Prevention (requirement.md §3.2) ที่ชั้น DB ไม่ใช่แค่ตรวจใน application logic — รายละเอียดเต็มอยู่ใน §4 |
| แยก `ReadingImage` เป็น entity ต่างหาก (1:N กับ Reading) แทนการฝัง field ใน Reading | ตรงตาม requirement.md §3.3 ที่ต้องเก็บ Original Image เป็นหลักฐานอ้างอิง — การเป็น entity แยกทำให้ schema สื่อความหมายตรงและขยายได้ง่ายกว่า field เดี่ยว |
| `ReadingImage` **ไม่มี** `type`/`cropRegion` (ตัดออกจากฉบับก่อนหน้า) | เก็บเฉพาะ ORIGINAL เท่านั้น — OCR Region เป็นข้อมูลชั่วคราวใน memory/client ไม่ persist ลง DB/server อีกต่อไป (decision-log.md: "ไม่จัดเก็บ OCR Crop Image แบบถาวร") |
| `ocrValue` และ `confirmedValue` ยังอยู่บน `Reading` โดยตรง (ไม่ย้ายไป ReadingImage) | เพราะเป็นค่าตัวเลขที่ผูกกับ "การอ่านมิเตอร์ครั้งนี้" ไม่ใช่ attribute ของรูปภาพ — ค่า OCR ได้มาจากการประมวลผล crop ชั่วคราว แต่ผลลัพธ์ (`ocrValue`)/`confirmedValue` ยังต้อง persist เสมอตาม requirement.md §3.3 |
| `SyncLog` แยกออกจาก `Reading` แทนการเก็บ error ไว้ใน Reading ตรงๆ | รองรับหลาย attempt ต่อ 1 reading (retry) และเก็บ history การ sync ไว้ตรวจสอบย้อนหลังได้ (workflow.md §3) |
| `residentName` เป็น field บน `Room` ไม่ใช่ผูกกับ `User` | เพราะ RESIDENT ใน MVP ยังไม่มี login จริง (requirement.md §2) และ export ต้องการ "ชื่อ-สกุล" ผูกกับห้อง ไม่ใช่ผูกกับ account |
| `Meter.code` มี `@unique` | เป็น key ที่ QR code อ้างอิงถึง (workflow.md ขั้นตอน 1 Scan QR → resolve เป็น Meter) |

---

## 6. จุดที่ยังรอ requirement เพิ่มเติม (ไม่ block การออกแบบ schema นี้ แต่จะกระทบตอน implement)

- ขอบเขตสิทธิ์ RESIDENT ที่ชัดเจนอาจต้องเพิ่ม relation `User` ↔ `Room` ถ้า RESIDENT ต้อง login จริงในอนาคต (ปัจจุบัน MVP ไม่มี login — ดู requirement.md §5 ข้อ 3)
- ฟิลด์สำหรับสูตรคำนวณค่าไฟ (ค่าไฟพื้นฐาน/FT/ภาษี) **ยังไม่เพิ่มใน schema นี้โดยตั้งใจ** เพราะสูตรยังไม่ final (requirement.md §5 ข้อ 1) — ค่าที่คำนวณได้แน่นอนอยู่แล้ว (`usage = confirmedValue - previousReading`) จะคำนวณตอน export ผ่าน Calculation Service (export-format.md §3) ไม่ persist ซ้ำใน DB
- **Persistent storage สำหรับ `public/upload/meter/` บน production (deploy ด้วย Coolify)** ยังเป็นแค่ requirement ระดับ infra ไม่ใช่ schema — ไม่กระทบ `ReadingImage.path` ซึ่งเก็บแค่ path แบบ relative เสมอ ไม่ผูกกับ storage backend ใดโดยเฉพาะ (ดู offline-strategy.md §7 และ tech-stack.md)
