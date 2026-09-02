# Offline Architecture — RMU Meter Collection

> สถานะ: **Architecture Specification เท่านั้น — ยังไม่ install Dexie.js หรือเขียนโค้ดใดๆ**
> อ้างอิง business rules จาก [requirement.md](requirement.md) §3.4 และ [workflow.md](workflow.md) §3
> เชื่อมโยงกับ [data-model.md](data-model.md) — schema ฝั่ง client (IndexedDB) mirror บางส่วนของ Prisma schema ฝั่ง server
> **ปรับปรุง 2026-09-02**: เก็บเฉพาะ Original Image ใน IndexedDB — ไม่มี OCR Crop Blob อีกต่อไป (crop เป็นข้อมูลชั่วคราวใน memory เท่านั้น ดู [decision-log.md](decision-log.md))
> **ปรับปรุงเพิ่มเติม 2026-09-02**: ชื่อไฟล์ที่ server ตั้งตอน sync สำเร็จเปลี่ยนเป็น `{MeterID}m{MM}_{YYYY}.{ext}` (เพิ่มปี ค.ศ. กันชื่อซ้ำข้ามปี)

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
  originalImageBlob: Blob;    // ภาพต้นฉบับเต็มภาพเท่านั้น — เก็บรูปจริงไว้ในเครื่องจนกว่าจะ SYNCED (mirror ของ ReadingImage ใน data-model.md §3.2)
  ocrValue?: string;
  confirmedValue: number;
  status: "DRAFT" | "PENDING_SYNC" | "SYNCING" | "SYNCED" | "SYNC_ERROR";
  readerId: string;
  createdAt: string;
  lastSyncError?: string;
}

interface SyncQueueItem {
  localId: string;      // FK → LocalReading.localId
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
}
```

> **ไม่มี OCR crop blob เก็บใน IndexedDB** — OCR Region ถูก crop จาก `originalImageBlob` แบบชั่วคราวใน memory เฉพาะตอนรัน OCR เท่านั้น (ดู ocr-strategy.md §4) แล้วทิ้งทันที ไม่ persist ที่ใดทั้งสิ้น (ไม่ใช่ทั้งฝั่ง client และฝั่ง server)
>
> field ตรงกับ `Reading` + `ReadingImage` ใน data-model.md (§3.1–3.2) เพื่อให้ map ไป-กลับระหว่าง client/server ตรงกันโดยไม่ต้อง transform ซับซ้อน — ตอน sync สำเร็จ `originalImageBlob` จะถูก upload ขึ้น server แล้ว **server เป็นผู้ตั้งชื่อไฟล์** ตามรูปแบบ `{MeterID}m{MM}_{YYYY}.{ext}` (data-model.md §3.2) ก่อนสร้างเป็น `ReadingImage` record

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

- **เฉพาะ Original Image เท่านั้นที่ถูก persist** — ถ่ายจากกล้องแล้วเก็บเป็น `originalImageBlob` ตรงใน IndexedDB คู่กับ record (ไม่ใช่แค่ path/URL เพราะไม่มี server ให้ upload ตอน offline)
- **OCR Region ไม่ถูกเก็บที่ไหนเลย แม้ตอน offline** — ระบบ crop บริเวณตัวเลขจาก `originalImageBlob` แบบชั่วคราวใน memory เพื่อรัน OCR (on-device, ดู ocr-strategy.md) ทันทีหลัง crop เสร็จและได้ `ocrValue` แล้ว ข้อมูล crop นั้นจะถูกทิ้ง — ใช้ได้ทั้งตอน online และ offline เพราะ OCR เป็น on-device (ไม่ต้องพึ่ง server)
- เมื่อ sync สำเร็จ: upload `originalImageBlob` ไปยัง server → **server ตั้งชื่อไฟล์ตามรูปแบบ `{MeterID}m{MM}_{YYYY}.{ext}`** (โดย `MM`/`YYYY` มาจาก `readingMonth` ของ Reading นั้น ไม่ใช่วันที่ sync จริง) แล้วเก็บที่ `public/upload/meter/` (data-model.md §3.2) จากนั้นสร้าง `ReadingImage` record พร้อม `path` ที่ได้ แล้วลบ Blob ออกจาก IndexedDB เพื่อประหยัดพื้นที่บนมือถือ
- ถ้า sync fail ระหว่าง upload รูป: ต้อง retry ทั้ง record เพื่อไม่ให้เกิดสถานะครึ่งๆ กลางๆ (มี Reading แต่ไม่มี ReadingImage อ้างอิง)

---

## 7. จุดที่ยังไม่ตัดสินใจ / นอกขอบเขตเอกสารนี้

- **Storage backend สำหรับ `public/upload/meter/` บน production**: ตัดสินใจแล้วว่า **ใช้ Coolify Persistent Storage (volume mount)** สำหรับ MVP นี้ — **ยังไม่ใช้ S3/MinIO** (ดู decision-log.md และ tech-stack.md) รายละเอียดการ config volume จริงเป็นงาน infra ที่ยังไม่ implement ในรอบเอกสารนี้
- ขนาด/quality ของรูปต้นฉบับที่บีบอัดก่อนเก็บ (เพื่อประหยัด IndexedDB quota บนมือถือ และพื้นที่ persistent storage บน production) — รอทดสอบจริงกับอุปกรณ์เป้าหมาย
