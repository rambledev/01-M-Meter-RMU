# Offline Architecture — RMU Meter Collection

> สถานะ: **Architecture Specification เท่านั้น — ยังไม่ install Dexie.js หรือเขียนโค้ดใดๆ**
> อ้างอิง business rules จาก [requirement.md](requirement.md) §3.4 และ [workflow.md](workflow.md) §3
> เชื่อมโยงกับ [data-model.md](data-model.md) — schema ฝั่ง client (IndexedDB) mirror บางส่วนของ Prisma schema ฝั่ง server

---

## 1. เป้าหมาย

ผู้จดมิเตอร์ต้องบันทึก Reading ได้ครบ flow (Scan → ถ่าย → ตรวจ → ยืนยัน) แม้ไม่มีสัญญาณอินเทอร์เน็ต แล้วให้ระบบ sync ขึ้น server อัตโนมัติทันทีที่กลับมา online โดยผู้ใช้ไม่ต้องกดปุ่ม sync เอง

---

## 2. Client-side Storage — Dexie.js (IndexedDB)

### 2.1 เหตุผลที่เลือก Dexie.js
- เป็น wrapper ที่ครอบ IndexedDB API ให้ใช้งานง่ายกว่า raw API โดยตรง (Promise-based, query syntax ที่อ่านง่าย)
- รองรับการเก็บ Blob/File ได้โดยตรง (จำเป็นสำหรับเก็บ Original Image ตอน offline)
- ตรงตามที่ระบุไว้ใน requirement.md §3.4

### 2.2 โครง Table ฝั่ง client (Dexie schema)

```ts
// src/lib/offline/db.ts (ตัวอย่างโครงสร้าง — ยังไม่สร้างไฟล์จริง)
class LocalDB extends Dexie {
  readings!: Table<LocalReading, string>;
  syncQueue!: Table<SyncQueueItem, string>;
}

interface LocalReading {
  localId: string;            // client-generated id (uuid) — ใช้ก่อนมี server id
  serverId?: string;          // เติมทีหลังเมื่อ sync สำเร็จ
  meterId: string;
  readingMonth: string;       // ISO date string ของวันที่ 1 ของเดือน
  images: LocalReadingImage[];  // mirror ของ ReadingImage (data-model.md §3.2) — เก็บทั้ง ORIGINAL และ OCR_REGION
  ocrValue?: string;
  confirmedValue: number;
  status: "DRAFT" | "PENDING_SYNC" | "SYNCING" | "SYNCED" | "SYNC_ERROR";
  readerId: string;
  createdAt: string;
  lastSyncError?: string;
}

interface LocalReadingImage {
  type: "ORIGINAL" | "OCR_REGION";
  blob: Blob;                 // เก็บรูปจริงไว้ในเครื่องจนกว่าจะ SYNCED
  cropRegion?: { x: number; y: number; width: number; height: number }; // เฉพาะ type = OCR_REGION
}

interface SyncQueueItem {
  localId: string;      // FK → LocalReading.localId
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
}
```

> field ตรงกับ `Reading` + `ReadingImage` ใน data-model.md (§3.1–3.2) เพื่อให้ map ไป-กลับระหว่าง client/server ตรงกันโดยไม่ต้อง transform ซับซ้อน — ตอน sync สำเร็จ แต่ละ `LocalReadingImage` จะถูก upload แล้วสร้างเป็น `ReadingImage` record แยกต่อรูปที่ server (relation 1:N ตาม data-model.md §3.2)

---

## 3. Sync State Machine

```
DRAFT ──(confirm+save, offline)──► PENDING_SYNC ──(กลับ online, auto trigger)──► SYNCING ──┬─► SYNCED
                                                                                            └─► SYNC_ERROR ──(retry)──► SYNCING
```

- **DRAFT**: ผู้ใช้ยังไม่กด confirm — ไม่เข้า sync queue
- **PENDING_SYNC**: confirm แล้วแต่ตอนบันทึกไม่มีเน็ต — เข้า sync queue รอ
- **SYNCING**: กำลังส่งขึ้น server (มี network event listener ตรวจจับตอนกลับ online แล้ว trigger อัตโนมัติ — ไม่ต้องรอผู้ใช้กด)
- **SYNCED**: server ยืนยันบันทึกสำเร็จ → ลบ `originalImageBlob` ออกจาก IndexedDB ได้ (ประหยัดพื้นที่ เพราะรูปอยู่บน server แล้ว)
- **SYNC_ERROR**: server ปฏิเสธ (เช่น duplicate ที่ device อื่น sync ไปก่อนแล้ว) หรือ network error ระหว่างส่ง → เก็บ `lastError` ไว้ให้ผู้ใช้/แอดมินเห็น ไม่ fail เงียบๆ (workflow.md §3)

---

## 4. Auto-sync Trigger

- ใช้ `window.addEventListener("online", ...)` ร่วมกับ `navigator.onLine` เป็นตัวเริ่มต้นเช็ค
- เสริมด้วย periodic health-check (เช่น ping endpoint เบาๆ ทุก N วินาทีตอน foreground) เพราะ `online` event ของ browser บางครั้งไม่แม่นยำ 100% (เช่น ต่อ wifi ที่ไม่มี internet จริง)
- เมื่อ trigger sync: ดึงรายการทั้งหมดที่ status = `PENDING_SYNC` หรือ `SYNC_ERROR` (retry) จาก `syncQueue` เรียงตาม `createdAt` แล้วส่งทีละรายการ (ไม่ parallel ทั้งหมด เพื่อลดโอกาส duplicate/race condition ที่ server)

---

## 5. Duplicate Prevention ระหว่าง Offline/Online

ตาม requirement.md §3.2 และ workflow.md §3 ต้องเช็ค 2 ชั้น:

1. **ฝั่ง client (ก่อน confirm)**: query `LocalDB.readings` + cache ล่าสุดจาก server (ถ้าเคยออนไลน์มาก่อน) ว่ามี Meter+Month นี้แล้วหรือยัง — เป็น **best-effort UX เท่านั้น ไม่ใช่ source of truth**
2. **ฝั่ง server (ตอน sync)**: `@@unique([meterId, readingMonth])` ที่ database ระดับ Prisma/PostgreSQL (data-model.md §4) **คือ source of truth จริง** — ถ้า sync แล้วชนกับ unique constraint (เช่น 2 อุปกรณ์จดมิเตอร์เดียวกันตอน offline) ให้ตอบกลับเป็น `409 Conflict` แล้วฝั่ง client set status = `SYNC_ERROR` พร้อม `lastError` ที่สื่อความหมายว่า "มีการบันทึกไปแล้วจากอุปกรณ์อื่น" ให้ผู้ใช้/แอดมินตัดสินใจต่อ (แก้ไขของเดิมแทนการสร้างใหม่ ตาม workflow.md §3 ข้อ 6)

---

## 6. รูปภาพตอน Offline

- Original Image และ OCR Region ถ่าย/ครอปจากกล้อง → เก็บเป็น `LocalReadingImage[]` (แต่ละตัวมี `Blob` ของตัวเอง) ตรงใน IndexedDB คู่กับ record (ไม่ใช่แค่ path/URL เพราะไม่มี server ให้ upload ตอน offline)
- เมื่อ sync สำเร็จ: upload แต่ละ Blob ไปยัง server แล้วสร้างเป็น `ReadingImage` record แยกต่อรูป (data-model.md §3.2) จากนั้นลบ Blob ออกจาก IndexedDB เพื่อประหยัดพื้นที่บนมือถือ (object storage provider — ยังไม่กำหนดในเอกสารนี้ เป็นรายละเอียด Phase 0/Infra)
- ถ้า sync fail ระหว่าง upload รูป: ต้อง retry ทั้ง record (ทุก `LocalReadingImage` ของ reading นั้น ไม่ split เป็น sync ทีละรูป) เพื่อไม่ให้เกิดสถานะครึ่งๆ กลางๆ (มี record แต่ขาด ReadingImage บางประเภท)

---

## 7. จุดที่ยังไม่ตัดสินใจ / นอกขอบเขตเอกสารนี้

- Object storage provider สำหรับเก็บรูปฝั่ง server (S3-compatible, local disk ผ่าน Docker volume ฯลฯ) — เป็นรายละเอียด Phase 0 infra ไม่ใช่ offline architecture
- ขนาด/quality ของรูปที่บีบอัดก่อนเก็บ (เพื่อประหยัด IndexedDB quota บนมือถือ) — รอทดสอบจริงกับอุปกรณ์เป้าหมาย
