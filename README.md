# RMU Meter Collection

ระบบอ่านและจัดเก็บข้อมูลมิเตอร์ไฟฟ้า (Mobile-first, Offline-first) — ผู้จดมิเตอร์เลือก
มิเตอร์ ดูค่าที่จดครั้งก่อน ถ่ายภาพ/ให้ OCR ช่วยอ่านค่า ยืนยัน แล้วบันทึกได้แม้ไม่มีสัญญาณ
อินเทอร์เน็ต ระบบจะ sync ข้อมูลขึ้น PostgreSQL เมื่อกลับมาออนไลน์และผู้ใช้กด Sync เอง —
พร้อมคำนวณค่าไฟ (สูตรเบื้องต้นจากเอกสารตัวอย่าง ปรับอัตราได้) และ Export เป็น Excel

> **สถานะ: MVP Demo เสร็จสมบูรณ์แล้ว** (Phase 0–7) — ดูรายละเอียดสถาปัตยกรรม/decision
> ทั้งหมดใน [`docs/`](docs/), เริ่มที่ [`docs/decision-log.md`](docs/decision-log.md)

## Tech Stack (locked — see `docs/decision-log.md`)

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 22.x |
| Framework | Next.js (App Router) | 16.3.4 |
| UI | React | 19.2.8 |
| Language | TypeScript | 5.9.3 |
| Styling | Tailwind CSS | 4.3.3 |
| ORM | Prisma / @prisma/client | 5.22.0 |
| Database | PostgreSQL | 17 |
| Offline storage | Dexie.js (IndexedDB) | 4.4.5 |
| OCR | Tesseract.js (client-side) | 7.0.0 |
| Excel export | ExcelJS | 4.4.0 |
| Package Manager | npm | — |

## Prerequisites

- Node.js 22.x, npm
- Docker + Docker Compose (for PostgreSQL, and optionally the app container)

## Run

```bash
npm install
cp .env.example .env   # edit DATABASE_URL / POSTGRES_* to point at your PostgreSQL 17
docker compose up -d db   # or point DATABASE_URL at an existing PostgreSQL 17 instance
npx prisma migrate deploy
node prisma/seed.cjs    # seeds demo Zone/Room/Meter/User reference data (no Reading rows)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm test              # Vitest — unit tests (offline repositories, calculation, export, billing)
npx tsc --noEmit       # TypeScript check
npm run lint           # ESLint
```

## Build

```bash
npm run build   # production build (Next.js)
npm run start   # run the production build
```

## Demo walkthrough

1. เปิด [http://localhost:3000](http://localhost:3000) — หน้าแรกแสดงสถานะ ONLINE/OFFLINE
2. เลือกมิเตอร์ตัวอย่าง (ME-001 / ME-002 / ME-003) — ระบบแสดงห้อง/Zone ให้อัตโนมัติ
3. เลือกเดือน (default เดือนปัจจุบัน) — ระบบแสดงค่าที่จดครั้งก่อนให้อัตโนมัติ
4. ถ่ายภาพ (หรือเลือกภาพจากเครื่องถ้าไม่มีกล้อง) แล้วกด "อ่านตัวเลข" ให้ OCR ช่วยกรอก
5. แก้ไขค่าที่อ่านได้ถ้าจำเป็น แล้วดูหน่วยที่ใช้และค่าไฟที่คำนวณให้ในการ์ด "ตรวจสอบก่อนบันทึก"
6. กด "ยืนยันและบันทึก" — บันทึกลงเครื่อง (IndexedDB) ทันที ใช้งานได้แม้ปิดอินเทอร์เน็ต
7. กด "Sync ข้อมูล" เพื่อส่งขึ้น PostgreSQL เมื่อกลับมาออนไลน์
8. ที่ประวัติ/รายละเอียดค่าไฟ กด "ดูวิธีคำนวณ" หรือ "อธิบายการคิดค่าไฟ" เพื่อดูสูตรแบบละเอียด
9. ปรับ FT/ภาษี/อัตราค่าไฟได้ที่ส่วน "ตั้งค่าการคิดค่าไฟ" แล้วกดบันทึก (หรือคืนค่าเริ่มต้น)
10. กด "Export Excel" เลือกเดือน แล้วดาวน์โหลดไฟล์ `บัญชีเรียกเก็บเงินค่าไฟฟ้า-YYYY-MM.xlsx`

> อัตราค่าไฟเริ่มต้น (FT/ภาษี/ค่าฐาน/ช่วงอัตรา) เป็น **"สูตรเบื้องต้นจากเอกสารตัวอย่าง"**
> เท่านั้น ยังไม่ใช่สูตรทางการที่ได้รับการรับรอง — ปรับได้ที่หน้าตั้งค่าการคิดค่าไฟ

## Project Structure

```
src/
├── app/                    # Next.js App Router (หน้าเว็บ + API routes)
│   ├── page.tsx            # หน้าหลัก — meter reading workflow ทั้งหมด
│   └── api/
│       ├── readings/sync/  # รับ reading + ภาพจาก client (Phase 5)
│       └── export/         # Excel export (Phase 6/6B)
├── components/              # UI components (mobile-first)
├── lib/
│   ├── db/                 # Prisma client (server-only)
│   ├── offline/             # Dexie/IndexedDB — readings, sync queue, billing config
│   ├── sync/                # Manual sync orchestration
│   ├── ocr/                 # Tesseract.js OCR wrapper
│   ├── billing/              # Billing Configuration (types/default/validation/explanation)
│   └── export/               # Calculation Service + Excel generation
prisma/
├── schema.prisma            # Zone/Room/Meter/Reading/ReadingImage/User/SyncLog
└── seed.cjs                  # demo reference data (Zone/Room/Meter/User only — no Reading)
docker-compose.yml            # PostgreSQL 17 + app
Dockerfile                    # multi-stage, Next.js standalone output
```

Each `src/lib/*` folder has a short `README.md` explaining its responsibility — see
[`docs/tech-stack.md`](docs/tech-stack.md) for the full phase-by-phase history and
[`docs/decision-log.md`](docs/decision-log.md) for every implementation decision made
along the way.
