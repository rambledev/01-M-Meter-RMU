# Offline Architecture — RMU Meter Collection

> สถานะ: **Phase 2 — implemented.** Dexie.js ติดตั้งแล้ว, `src/lib/offline/{db,readingRepository,syncQueueRepository}.ts` สร้างจริงแล้วพร้อม test (`npm test` ผ่าน) ยังไม่มี UI/Camera/OCR/API/Auto-sync เรียกใช้งาน (Phase 3 เป็นต้นไป)
> อ้างอิง business rules จาก [requirement.md](requirement.md) §3.4 และ [workflow.md](workflow.md) §3
> เชื่อมโยงกับ [data-model.md](data-model.md) — schema ฝั่ง client (IndexedDB) mirror บางส่วนของ Prisma schema ฝั่ง server
> **ปรับปรุง 2026-09-02**: เก็บเฉพาะ Original Image ใน IndexedDB — ไม่มี OCR Crop Blob อีกต่อไป (crop เป็นข้อมูลชั่วคราวใน memory เท่านั้น ดู [decision-log.md](decision-log.md))
> **ปรับปรุงเพิ่มเติม 2026-09-02**: ชื่อไฟล์ที่ server ตั้งตอน sync สำเร็จเปลี่ยนเป็น `{MeterID}m{MM}_{YYYY}.{ext}` (เพิ่มปี ค.ศ. กันชื่อซ้ำข้ามปี)
> **ปรับปรุง Phase 2 (2026-09-03)**: `readingImages` แยกเป็น table ต่างหาก (ไม่ embed ใน `LocalReading`) — ดู §2.2

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

> **Implemented Phase 2 (2026-09-03)**: `src/lib/offline/db.ts` — ปรับจากตัวอย่างเดิม (embed `originalImageBlob` ไว้ใน `LocalReading` โดยตรง) เป็น **แยก table `readingImages` ต่างหาก** เพื่อให้ mirror ความสัมพันธ์ 1:N ระหว่าง `Reading`↔`ReadingImage` บนฝั่ง server (data-model.md §3.2) ตรงกว่า — ดูเหตุผลใน decision-log.md

```ts
// src/lib/offline/db.ts
class LocalDatabase extends Dexie {
  readings!: Table<LocalReading, string>;
  readingImages!: Table<LocalReadingImage, string>;
  syncQueue!: Table<SyncQueueItem, string>;
}

interface LocalReading {
  localId: string;            // client-generated id (crypto.randomUUID()) — ใช้ก่อนมี server id
  serverId?: string;          // เติมทีหลังเมื่อ sync สำเร็จ
  meterId: string;
  readingMonth: string;       // ISO date string ของวันที่ 1 ของเดือน
  previousReading?: number;   // snapshot ณ เวลา confirm (mirror ของ Reading.previousReading, data-model.md §3.1)
  ocrValue?: string;
  confirmedValue?: number;    // nullable ตอน DRAFT/ก่อน confirm (mirror ของ Reading.confirmedValue, data-model.md §5)
  usage?: number;             // confirmedValue - previousReading ณ เวลา confirm (mirror ของ Reading.usage)
  status: "DRAFT" | "PENDING_SYNC" | "SYNCING" | "SYNCED" | "SYNC_ERROR";
  recordedBy: string;
  recordedAt?: string;        // business timestamp ตอน confirm — แยกจาก createdAt (เวลาที่ record เขียนลง DB จริง) — nullable จนกว่าจะ confirm
  createdAt: string;
  updatedAt: string;
  lastSyncError?: string;
}

// แยก table ต่างหาก (ไม่ embed ใน LocalReading) — mirror ReadingImage 1:N บน server
interface LocalReadingImage {
  localId: string;
  localReadingId: string;     // FK → LocalReading.localId
  blob: Blob;                 // Original Image เท่านั้น — เก็บรูปจริงไว้ในเครื่องจนกว่าจะ SYNCED
  mimeType: string;
  createdAt: string;
}

interface SyncQueueItem {
  id: string;
  readingId: string;          // FK → LocalReading.localId
  action: "CREATE" | "UPDATE";
  status: "DRAFT" | "PENDING_SYNC" | "SYNCING" | "SYNCED" | "SYNC_ERROR";
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}
```

> **ไม่มี OCR crop blob เก็บใน IndexedDB** — OCR Region ถูก crop จาก Original Image แบบชั่วคราวใน memory เฉพาะตอนรัน OCR เท่านั้น (ดู ocr-strategy.md §4) แล้วทิ้งทันที ไม่ persist ที่ใดทั้งสิ้น (ไม่ใช่ทั้งฝั่ง client และฝั่ง server)
>
> field ตรงกับ `Reading` + `ReadingImage` ใน data-model.md (§3.1–3.2) เพื่อให้ map ไป-กลับระหว่าง client/server ตรงกันโดยไม่ต้อง transform ซับซ้อน — ตอน sync สำเร็จ blob ใน `readingImages` จะถูก upload ขึ้น server แล้ว **server เป็นผู้ตั้งชื่อไฟล์** ตามรูปแบบ `{MeterID}m{MM}_{YYYY}.{ext}` (data-model.md §3.2) ก่อนสร้างเป็น `ReadingImage` record
>
> **UI เรียกผ่าน repository เท่านั้น** — `src/lib/offline/readingRepository.ts` (`createDraftReading`, `updateReading`, `getReading`, `getReadings`, `deleteDraftReading`, `addReadingImage`, `getReadingImages`) และ `src/lib/offline/syncQueueRepository.ts` (`enqueueForSync`, `getQueueItem`, `getPendingQueueItems`, `updateQueueItem` — data structure/CRUD เท่านั้น ยังไม่มี network/retry logic จริง รอ Phase 5)

---

## 3. Sync State Machine

```
DRAFT ──(confirm+save, offline)──► PENDING_SYNC ──(กลับ online, auto trigger)──► SYNCING ──┬─► SYNCED
                                                                                            └─► SYNC_ERROR ──(retry)──► SYNCING
```

- **DRAFT**: ผู้ใช้ยังไม่กด confirm — ไม่เข้า sync queue
- **PENDING_SYNC**: confirm แล้วแต่ตอนบันทึกไม่มีเน็ต — เข้า sync queue รอ
- **SYNCING**: กำลังส่งขึ้น server (มี network event listener ตรวจจับตอนกลับ online แล้ว trigger อัตโนมัติ — ไม่ต้องรอผู้ใช้กด)
- **SYNCED**: server ยืนยันบันทึกสำเร็จ → ลบ `originalImageBlob` ออกจาก IndexedDB ได้ (ประหยัดพื้นที่ เพราะรูปอยู่บน server แล้ว) — **ยังไม่ implement ใน Phase 5** (MVP เก็บ blob ไว้ต่อแม้ SYNCED แล้ว) เป็น optimization ที่ deferred ไว้ ไม่กระทบความถูกต้องของข้อมูล
- **SYNC_ERROR**: server ปฏิเสธ (เช่น duplicate ที่ device อื่น sync ไปก่อนแล้ว) หรือ network error ระหว่างส่ง → เก็บ `lastError` ไว้ให้ผู้ใช้/แอดมินเห็น ไม่ fail เงียบๆ (workflow.md §3)

---

## 4. Sync Trigger

> **ปรับปรุง Phase 5 (2026-09-03)**: MVP นี้เป็น **manual trigger** (ปุ่ม "Sync ข้อมูล" บนหน้าหลัก) ไม่ใช่ auto-trigger ตอนกลับ online ตามที่ร่างไว้เดิม — ผู้ใช้กำหนดชัดเจนใน Phase 5 kickoff ว่ายังไม่ต้องทำ background/automatic sync ("ยังไม่ต้องทำ automatic background sync") เพื่อให้ demo ควบคุมจังหวะ sync ได้ง่าย ส่วน auto-trigger ตาม design เดิมด้านล่างยังคงเป็นแผนสำหรับอนาคต ไม่ใช่ scope ของ Phase 5

- **Implemented (Phase 5)**: `src/lib/sync/syncService.ts` — `syncPendingReadings()` เรียกจากปุ่ม "Sync ข้อมูล" เท่านั้น ดึง `getPendingQueueItems()` (สถานะ `PENDING_SYNC`/`SYNC_ERROR`) แล้วส่งทีละรายการเรียงตาม `createdAt` (ไม่ parallel — ลด race condition ที่ server) ตรงตาม design เดิมด้านล่างทุกประการ ยกเว้นวิธี trigger
- **แผนเดิม (ยังไม่ implement)**: ใช้ `window.addEventListener("online", ...)` ร่วมกับ `navigator.onLine` + periodic health-check เพื่อ auto-trigger sync ทันทีที่กลับมา online โดยผู้ใช้ไม่ต้องกดเอง — deferred ไปทำใน phase ถัดไปถ้าจำเป็น

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
