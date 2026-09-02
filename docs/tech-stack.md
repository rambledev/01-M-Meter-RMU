# Tech Stack & Environment Report — RMU Meter Collection

> วันที่ตรวจสอบ Environment เดิม: 2026-09-01
> วันที่ผู้ใช้อนุมัติ (approve) tech stack ทั้งหมด: 2026-09-02
> สถานะ: **Pre-coding — Documentation/Architecture Specification เท่านั้น ยังไม่มีการติดตั้งหรือสร้างโค้ดใดๆ**
> รายการทั้งหมดในเอกสารนี้ถือเป็น **Final Locked Version** — ดูรายละเอียดการอนุมัติใน [decision-log.md](decision-log.md)

---

## 1. Final Tech Stack (Locked — Approved 2026-09-02)

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | **22.x** |
| Framework | Next.js (App Router) | **16.3.4** |
| UI Library | React | **19.2.8** |
| Language | TypeScript | **5.9.3** |
| Styling | Tailwind CSS | **4.3.3** |
| ORM | Prisma | **5.22.0** |
| DB Client | @prisma/client | **5.22.0** |
| Database | PostgreSQL | **17** |
| Offline Storage | Dexie.js (IndexedDB wrapper) | latest stable ที่เข้ากับ React 19 |
| Package Manager | npm | — |
| Containerization | Docker + Docker Compose | — |

**ห้ามเปลี่ยนแปลงรายการนี้โดยไม่ได้รับคำสั่งจากผู้ใช้โดยตรง** (ดูเงื่อนไขใน decision-log.md)

---

## 2. Environment ปัจจุบัน (ตรวจจริงบนเครื่อง — 2026-09-01)

| รายการ | ผลตรวจ | หมายเหตุ |
|---|---|---|
| Current directory | `/Users/ccrmu/Desktop/rmu/rmu-01-meter` | มีแค่โฟลเดอร์ `docs/` — ไม่มีไฟล์โปรเจกต์เดิม ปลอดภัยที่จะ init ที่ root ได้เลย |
| Node.js | v22.14.0 | ตรงตาม version ที่ล็อก (22.x) |
| npm | 10.9.2 | มากับ Node 22 |
| Git | 2.49.0 | พร้อมใช้งาน แต่ directory นี้ยังไม่ได้ `git init` |
| Docker | 29.1.3 (build f52814d) | พร้อมใช้งาน |
| Docker Compose | v2.40.3-desktop.1 | พร้อมใช้งาน |

---

## 3. เหตุผลเชิงเทคนิคของแต่ละเวอร์ชัน (สรุปจากการตรวจสอบ)

- **Next.js 16.3.4**: ต้อง pin ที่ ≥ 16.3.3 เนื่องจากช่องโหว่ RCE ระดับ critical (August 2026 security release) กระทบ self-hosted/Docker deployment โดยตรง — 16.3.4 patched แล้ว
- **React 19.2.8**: ต้อง ≥ 19.2.6 เนื่องจากช่องโหว่ DoS (CVE-2026-23870) ใน React Server Components — 19.2.8 patched แล้ว
- **TypeScript 5.9.3**: เลือกสาย 5.x แทน 7.x (ล่าสุด) เพื่อความเข้ากันได้เต็มรูปแบบกับ tooling ปัจจุบัน (Next.js plugin, ESLint)
- **Tailwind CSS 4.3.3**: ใช้สถาปัตยกรรม CSS-first config (`@theme` ใน CSS แทน `tailwind.config.js`)
- **Prisma 5.22.0**: เป็น **project requirement** ที่ผู้ใช้ล็อกไว้ชัดเจน แม้เป็น legacy major version (หยุด release ตั้งแต่ 2024-11-05 มี major ใหม่กว่า 2 รุ่นแซงหน้า) — รายละเอียดเหตุผลและความเสี่ยงที่รับทราบแล้วอยู่ใน [decision-log.md](decision-log.md)

รายละเอียดผลตรวจ npm audit / security advisory แบบเต็มอยู่ใน decision-log.md (ส่วน "บริบทการตัดสินใจ")

---

## 4. Final Project Structure

```
rmu-01-meter/
├── docs/                          # เอกสารโปรเจกต์
│   ├── tech-stack.md
│   ├── requirement.md
│   ├── workflow.md
│   ├── decision-log.md
│   ├── data-model.md
│   ├── offline-strategy.md
│   ├── ocr-strategy.md
│   └── export-format.md
├── prisma/
│   └── schema.prisma              # Meter, Room, Zone, Reading, User(role sim), SyncLog
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (role-select)/         # หน้าจำลองเลือก Role (MVP ไม่มี login จริง)
│   │   ├── scan/                  # หน้า Scan QR
│   │   ├── reading/[meterId]/     # หน้าเลือกเดือน + ถ่ายภาพ + OCR + Confirm
│   │   ├── admin/                 # หน้า Admin (จัดการ Meter/Zone, Export)
│   │   └── api/                   # API Routes (sync, export, meter lookup)
│   ├── components/                # UI components (mobile-first)
│   ├── lib/
│   │   ├── db/                    # Prisma client (server)
│   │   ├── offline/               # Dexie.js (IndexedDB) schema + sync queue logic
│   │   ├── ocr/                   # OCR service wrapper (provider TBD — ดู ocr-strategy.md)
│   │   └── export/                # Excel export (format ตาม export-format.md)
│   ├── hooks/                     # useOnlineStatus, useSyncQueue, ...
│   └── types/                     # Role, ReadingStatus ฯลฯ
├── public/
├── docker-compose.yml             # PostgreSQL 17 + app service
├── Dockerfile
├── .env.example
└── package.json
```

> หมายเหตุ: โครงสร้างนี้เป็นข้อเสนอสำหรับพิจารณาเท่านั้น ยังไม่มีการสร้างไฟล์ใดๆ จนกว่าจะได้รับคำสั่งเริ่ม Phase 0

---

## 5. Development Phases

> **หลักการ**: Offline-first เป็นรากฐานของสถาปัตยกรรม ไม่ใช่ feature ที่เพิ่มทีหลัง — Offline Data Layer (Phase 2) จึงอยู่**ก่อน** Core Meter Workflow (Phase 3) ห้ามออกแบบ workflow เป็น online-first แล้วค่อยเพิ่ม offline ทีหลัง

| Phase | ขอบเขต | Output | Blocker |
|---|---|---|---|
| **Phase 0** | Project Setup: init Next.js + TS + Tailwind + Prisma + Docker Compose (PostgreSQL 17) | โปรเจกต์รันได้ พร้อม DB local | รอคำสั่งเริ่มจากผู้ใช้ |
| **Phase 1** | Core Data Model: Zone, Room, Meter, Reading, ReadingImage, User/Role, Prisma migration, Seed data | Schema พร้อมใช้, migration รันได้, มี seed data ทดสอบ | ต้องยืนยันขอบเขตสิทธิ์ RESIDENT (requirement.md §5) |
| **Phase 2** | Offline-first Data Layer: Dexie/IndexedDB, Local Reading, Offline Queue, Sync Status | เก็บ/อ่าน Reading ในเครื่องได้แม้ยังไม่มี UI workflow เต็มรูปแบบ | ดู offline-strategy.md |
| **Phase 3** | Core Meter Workflow: Home, Scan QR, Meter lookup, Month selection, Previous Reading, Reading validation, Confirm | จดมิเตอร์ได้ครบ flow บน Offline Data Layer จาก Phase 2 โดยตรง (ไม่ใช่ online-first) | ดู workflow.md |
| **Phase 4** | Camera + OCR: Camera, Full Original Image, OCR Region/Crop, Tesseract.js, Manual correction | ถ่ายภาพ + OCR ช่วยกรอกค่า + แก้ไขได้ก่อน confirm | ต้องเลือก OCR provider (ocr-strategy.md) |
| **Phase 5** | Sync: Online detection, Queue, Auto Sync, Retry, Error handling | Sync อัตโนมัติเมื่อกลับ online, retry เมื่อ SYNC_ERROR | ดู offline-strategy.md |
| **Phase 6** | Excel Export: Report Header, Group Header, Meter Reading columns, Electricity columns, Excel formatting | ไฟล์ Excel ตาม column ที่กำหนด | รอสูตรค่าไฟ + ตัวอย่างรายงานจริง (export-format.md) |
| **Phase 7** | Demo Polish: Mobile UX, Loading, Error, Empty state, Offline indicator, Demo scenarios | Demo-ready MVP | — |

---

## 6. Risks / Technical Notes

1. **Prisma 5.x เป็น legacy major version** — รับทราบและล็อกตามคำสั่งผู้ใช้แล้ว (ดู decision-log.md) จะประเมิน upgrade ในอนาคต ไม่ใช่ scope MVP
2. **OCR offline capability** — ถ้าเลือก OCR provider แบบ API-based จะ OCR ไม่ได้ตอน offline ซึ่งขัดกับ core requirement "Offline First" — ต้องตัดสินใจร่วมกับ requirement.md §5 ข้อ 4 ก่อนเริ่ม Phase 4 (Camera + OCR)
3. **สูตรคำนวณค่าไฟยังไม่ final** — ห้ามเดา ต้อง block เฉพาะ Phase 6 (Excel Export) ส่วนคำนวณ ไม่ block phase อื่น
4. **Tailwind 4.x CSS-first config** — ทีมต้องคุ้นเคยกับ `@theme` แทน `tailwind.config.js` แบบเดิม
