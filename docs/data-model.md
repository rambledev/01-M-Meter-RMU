# Data Model — RMU Meter Collection

> สถานะ: **Architecture Specification เท่านั้น — ยังไม่มีการสร้างไฟล์ `prisma/schema.prisma` จริง ยังไม่ install Prisma ยังไม่สร้าง database หรือ migration ใดๆ**
> ORM: Prisma **5.22.0** (locked — ดู [decision-log.md](decision-log.md)) บน PostgreSQL **17**
> อ้างอิง business rules จาก [requirement.md](requirement.md) และ [workflow.md](workflow.md)

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
- **ReadingImage** คือรูปภาพที่ผูกกับ Reading หนึ่งรายการ แบบ **1:N** — Reading หนึ่งรายการมีได้หลายรูป แยกตาม `type` (`ORIGINAL`, `OCR_REGION`) รายละเอียดเต็มอยู่ใน §3.2
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

enum ReadingImageType {
  ORIGINAL      // ภาพมิเตอร์เต็มภาพ (หลักฐานอ้างอิง — requirement.md §3.3 ข้อ 1)
  OCR_REGION    // บริเวณที่ครอปมาเฉพาะเลขมิเตอร์ (requirement.md §3.3 ข้อ 2)
}
```

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

### 3.2 ReadingImage (แยก entity ชัดเจน — ไม่ใช่แค่ field ใน Reading)

```prisma
model ReadingImage {
  id          String            @id @default(cuid())
  readingId   String
  reading     Reading           @relation(fields: [readingId], references: [id])
  type        ReadingImageType  // ORIGINAL หรือ OCR_REGION
  url         String            // path/URL ของไฟล์ภาพ (server-side storage หลัง sync สำเร็จ)
  cropRegion  Json?             // เฉพาะ type = OCR_REGION: { x, y, width, height } พิกัดอ้างอิงบนภาพ ORIGINAL คู่กัน
  createdAt   DateTime          @default(now())
}
```

- **Reading 1:N ReadingImage** — Reading หนึ่งรายการมี `ReadingImage` อย่างน้อย 2 record เมื่อบันทึกครบ: หนึ่งตัว `type = ORIGINAL` (ภาพเต็ม) และหนึ่งตัว `type = OCR_REGION` (ภาพครอปเฉพาะเลขมิเตอร์)
- แยกเป็น entity ต่างหากแทนการฝัง `originalImageUrl`/`ocrRegion` เป็น field ตรงบน `Reading` (ตามที่เคยออกแบบไว้ในฉบับก่อนหน้า) เพื่อให้ schema สื่อสารชัดเจนว่ารูปภาพเป็น "หลักฐานที่ผูกกับ reading" ซึ่งเป็น entity ของตัวเอง และรองรับการขยายในอนาคตได้ง่ายกว่า (เช่น ถ้าต้องเก็บภาพเพิ่มประเภทอื่น ไม่ต้อง migrate schema ของ `Reading` เอง)
- `cropRegion` เป็น `Json?` (nullable) เพราะมีความหมายเฉพาะกับ record ที่ `type = OCR_REGION` เท่านั้น — record ที่ `type = ORIGINAL` จะเป็น `null`

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
| แยก `ReadingImage` เป็น entity ต่างหาก (1:N กับ Reading) แทนการฝัง field ใน Reading | ตรงตาม requirement.md §3.3 ที่ต้องเก็บ Original Image และ OCR Region แยกกันชัดเจนเสมอ — การเป็น entity แยกทำให้ schema สื่อความหมายตรงและขยายได้ง่ายกว่า field เดี่ยว |
| `ocrValue` และ `confirmedValue` ยังอยู่บน `Reading` โดยตรง (ไม่ย้ายไป ReadingImage) | เพราะเป็นค่าตัวเลขที่ผูกกับ "การอ่านมิเตอร์ครั้งนี้" ไม่ใช่ attribute ของรูปภาพใดภาพหนึ่ง — ตรงตาม requirement.md §3.3 ที่แยก OCR Value/Confirmed Value เป็นข้อมูลคนละชั้นจากตัวรูปภาพ |
| `SyncLog` แยกออกจาก `Reading` แทนการเก็บ error ไว้ใน Reading ตรงๆ | รองรับหลาย attempt ต่อ 1 reading (retry) และเก็บ history การ sync ไว้ตรวจสอบย้อนหลังได้ (workflow.md §3) |
| `residentName` เป็น field บน `Room` ไม่ใช่ผูกกับ `User` | เพราะ RESIDENT ใน MVP ยังไม่มี login จริง (requirement.md §2) และ export ต้องการ "ชื่อ-สกุล" ผูกกับห้อง ไม่ใช่ผูกกับ account |
| `Meter.code` มี `@unique` | เป็น key ที่ QR code อ้างอิงถึง (workflow.md ขั้นตอน 1 Scan QR → resolve เป็น Meter) |

---

## 6. จุดที่ยังรอ requirement เพิ่มเติม (ไม่ block การออกแบบ schema นี้ แต่จะกระทบตอน implement)

- ขอบเขตสิทธิ์ RESIDENT ที่ชัดเจนอาจต้องเพิ่ม relation `User` ↔ `Room` ถ้า RESIDENT ต้อง login จริงในอนาคต (ปัจจุบัน MVP ไม่มี login — ดู requirement.md §5 ข้อ 3)
- ฟิลด์สำหรับสูตรคำนวณค่าไฟ (ค่าไฟพื้นฐาน/FT/ภาษี) **ยังไม่เพิ่มใน schema นี้โดยตั้งใจ** เพราะสูตรยังไม่ final (requirement.md §5 ข้อ 1) — ค่าที่คำนวณได้แน่นอนอยู่แล้ว (`usage = confirmedValue - previousReading`) จะคำนวณตอน export ผ่าน Calculation Service (export-format.md §3) ไม่ persist ซ้ำใน DB
