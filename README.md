# RMU Meter Collection

ระบบอ่านและจัดเก็บข้อมูลมิเตอร์ไฟฟ้า (Mobile-first, Offline-first) — ผู้จดมิเตอร์เลือก
มิเตอร์ ดูค่าที่จดครั้งก่อน ถ่ายภาพ/ให้ OCR ช่วยอ่านค่า ยืนยัน แล้วบันทึกได้แม้ไม่มีสัญญาณ
อินเทอร์เน็ต ระบบจะ sync ข้อมูลขึ้น PostgreSQL เมื่อกลับมาออนไลน์และผู้ใช้กด Sync เอง —
พร้อมคำนวณค่าไฟ (สูตรเบื้องต้นจากเอกสารตัวอย่าง ปรับอัตราได้) และ Export เป็น Excel

> **สถานะ: MVP Demo เสร็จสมบูรณ์แล้ว** (Phase 0–7) — ดูรายละเอียดสถาปัตยกรรม/decision
> ทั้งหมดใน [`docs/`](docs/), เริ่มที่ [`docs/decision-log.md`](docs/decision-log.md)

ธีมสีทั้งเว็บ: **ขาวเป็นหลัก เขียว (emerald) เป็นรอง** — ใช้สม่ำเสมอกันทุกหน้า/ทุก role
(ปุ่มหลัก/หัวข้อ/แท็บ active/กราฟ) ส่วนสีแดง/เหลืองอำพัน (error/warning) ยังคงไว้ตามความหมายเดิม

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
| QR generate / scan | qrcode / jsQR (client-side) | 1.5.4 / 1.4.0 |
| Charts (ผู้บริหาร) | Recharts | 3.10.1 |
| Google Sign-In (ผู้พักอาศัย) | google-auth-library | 11.0.2 |
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

**No database available?** Set `MOCK_DATA=true` in `.env` and skip the steps above — the
whole app runs on an in-memory mock dataset (`src/lib/db/mockStore.ts`), including a working
`/checker` login (`checker-demo` / `Demo1234!`). Nothing is persisted to disk; restarting the
dev server resets it back to the seed data. Set it back to `false` (or remove it) once a real
database is reachable again — no code changes needed either way.

**ผู้พักอาศัย (Resident) login** ต้องมี Google Cloud OAuth 2.0 Client ID — สร้างที่
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) แล้วใส่ใน `.env`:
`NEXT_PUBLIC_GOOGLE_CLIENT_ID=...`. อนุญาตเฉพาะอีเมล `@rmu.ac.th` เท่านั้น (ตรวจที่ server
ด้วย `google-auth-library`) ไม่มีค่านี้จะแสดงข้อความ "ยังไม่ได้ตั้งค่า" แทนปุ่ม Google ในหน้า
`/resident`.

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

1. เปิด [http://localhost:3000](http://localhost:3000) — หน้าแรกเป็นหน้าเลือกบทบาท (ไม่มี login จริงใน MVP นี้ ยกเว้นผู้จดมิเตอร์/ผู้พักอาศัย — ดูข้อ 2 และด้านล่าง): **ผู้ดูแลระบบ** / **ผู้จดมิเตอร์** / **ผู้บริหาร** / **ผู้พักอาศัย**
2. กด **"ผู้จดมิเตอร์"** — เข้าสู่ระบบด้วย Username/Password ก่อน (สร้างบัญชีที่ `/admin` แท็บ "ข้อมูลผู้ใช้งาน" กำหนด role ผู้จดมิเตอร์ + โซนที่รับผิดชอบ) เข้าครั้งเดียวแล้วเครื่องจะจำไว้ไม่ต้อง login ซ้ำ
3. หน้าแรกของผู้จดมิเตอร์เป็น **Dashboard มือถือ** สรุปมิเตอร์ในโซนที่รับผิดชอบของเดือนที่เลือก (เลือกเดือนอื่นได้) แสดง "จดแล้ว/ยังไม่จด" ต่อแถว
4. กด **"📷 เก็บมิเตอร์ (แสกน QR)"** เพื่อแสกน QR ของมิเตอร์ (ป้องกันจดผิดมิเตอร์), กรอกรหัสมิเตอร์เอง, หรือแตะแถวมิเตอร์ในรายการ — ทั้งหมดพาไปหน้าจดมิเตอร์ตัวนั้นที่ `/checker/reading`
5. ที่หน้าจดมิเตอร์ตัวนั้น: เลือกเดือน (default เดือนปัจจุบัน) — ระบบแสดงค่าที่จดครั้งก่อนให้อัตโนมัติ
6. ถ่ายภาพโดยวางตัวเลขมิเตอร์ในกรอบเหลือง (หรือเลือกภาพจากเครื่องถ้าไม่มีกล้อง) แล้วกด "อ่านตัวเลข" ให้ OCR อ่านเฉพาะในกรอบ ลดโอกาสอ่านผิด — แก้ไขค่าที่อ่านได้หรือพิมพ์เองก็ได้เสมอ
7. ดูหน่วยที่ใช้และค่าไฟที่คำนวณให้ในการ์ด "ตรวจสอบก่อนบันทึก" แล้วกด "ยืนยันและบันทึก" — บันทึกลงเครื่อง (IndexedDB) ทันที ใช้งานได้แม้ปิดอินเทอร์เน็ต, Dashboard จะแสดง "จดแล้ว" ทันทีแม้ยังไม่ sync
8. กด "กลับหน้าหลัก" กลับสู่ Dashboard แล้วกด "Sync ข้อมูล" เพื่อส่งขึ้น PostgreSQL เมื่อกลับมาออนไลน์
9. กด "ดูประวัติ / Export Excel / อธิบายค่าไฟ" จาก Dashboard เพื่อดูประวัติที่บันทึกในเครื่อง, กด "ดูวิธีคำนวณ"/"อธิบายการคิดค่าไฟ" เพื่อดูสูตรแบบละเอียด, หรือ Export Excel เลือกเดือนแล้วดาวน์โหลดไฟล์ `บัญชีเรียกเก็บเงินค่าไฟฟ้า-YYYY-MM.xlsx`

> อัตราค่าไฟเริ่มต้น (FT/ภาษี/ค่าฐาน/ช่วงอัตรา) เป็น **"สูตรเบื้องต้นจากเอกสารตัวอย่าง"**
> เท่านั้น ยังไม่ใช่สูตรทางการที่ได้รับการรับรอง — ปรับได้ที่หน้า `/admin` แท็บ "ตั้งค่าค่าไฟ"
> (ค่ากลางใน PostgreSQL มีผลกับผู้จดมิเตอร์ทุกเครื่องทันที ไม่ใช่ต่อเครื่องแบบเดิมอีกต่อไป)

ที่หน้า `/admin` แท็บ "จัดการมิเตอร์" — กดปุ่ม "QR" ต่อแถวมิเตอร์เพื่อดู/ดาวน์โหลด/พิมพ์ QR
ของมิเตอร์นั้น (รหัสมิเตอร์กำกับใต้ภาพ) หรือติ๊กเลือกหลายแถวแล้วกด "พิมพ์ QR ที่เลือก" เพื่อพิมพ์
พร้อมกันหลายตัว — พิมพ์ผ่าน dialog ของ browser (เลือก "Save as PDF" ได้ถ้าต้องการไฟล์)

กด **"ผู้บริหาร"** จากหน้าแรกเพื่อดูรายงานสรุปที่ `/executive` — การ์ด KPI (โซน/ห้องพัก/มิเตอร์/
รายการจดมิเตอร์/หน่วยไฟ/ค่าไฟรวม) พร้อมกราฟแนวโน้มรายเดือน (หน่วยไฟ/ค่าไฟ/จำนวนรายการ), กราฟ
เปรียบเทียบการใช้ไฟตามโซน และกราฟสถานะข้อมูล — เลือกโซนที่ dropdown ด้านบนเพื่อกรองดูเฉพาะโซนนั้น

กด **"ผู้พักอาศัย"** จากหน้าแรกเพื่อดูข้อมูลของตัวเองที่ `/resident` — เข้าสู่ระบบด้วย
**Google Sign-In เฉพาะอีเมล `@rmu.ac.th` เท่านั้น** (ไม่มี Username/Password) ล็อกอินครั้งแรก
ของอีเมลใหม่จะสร้างบัญชีผู้พักอาศัยให้อัตโนมัติ (Admin จะสร้างล่วงหน้าพร้อมกำหนดห้องเองก็ได้
ที่ `/admin` แท็บ "ข้อมูลผู้ใช้งาน" กำหนด role ผู้พักอาศัย + อีเมล) หลังล็อกอินถ้ายังไม่มีห้องผูกไว้
ระบบจะให้เลือกห้องของตัวเอง**ครั้งเดียวเท่านั้น** (อนุญาตหลายอีเมลเลือกห้องเดียวกันได้ เช่น
เพื่อนร่วมห้อง) — เลือกแล้วเปลี่ยนเองไม่ได้อีก บังคับที่ server จริง (403 ถ้าพยายามเปลี่ยน)
ไม่ใช่แค่ซ่อนปุ่ม UI ต้องให้ **Admin เท่านั้น** แก้ที่ `/admin` แท็บ "ข้อมูลผู้ใช้งาน" ถ้าเลือกผิด
แล้วเลือกเดือนดูค่าที่จดได้/หน่วยที่ใช้/ค่าไฟพร้อมวิธีคำนวณและประวัติทั้งหมดของห้องตัวเอง — เห็นได้
เฉพาะห้องของตัวเองเท่านั้น (บังคับที่ server ไม่ใช่แค่ UI)

## Project Structure

```
src/
├── app/                    # Next.js App Router (หน้าเว็บ + API routes)
│   ├── page.tsx            # หน้าแรก — เลือกบทบาท (ไม่มี login จริง ยกเว้นผู้จดมิเตอร์)
│   ├── checker/             # ผู้จดมิเตอร์ — login จริง + Dashboard มือถือ (สรุปมิเตอร์ตามโซนที่รับผิดชอบ)
│   │   ├── page.tsx         # Dashboard (หน้าแรก) — login gate + สรุปมิเตอร์ + แสกน QR/ค้นหา
│   │   ├── reading/         # จดมิเตอร์ทีละตัว (?meterId=) — เดือน/ค่าครั้งก่อน/ถ่ายภาพ+OCR ในกรอบ/ยืนยัน
│   │   └── history/         # ประวัติ/Export Excel/อธิบายค่าไฟ (ย้ายออกจาก Dashboard)
│   ├── admin/               # ผู้ดูแลระบบ — Dashboard + จัดการมิเตอร์ (Zone/Room/Meter CRUD + QR) + ประวัติการจดมิเตอร์ + ข้อมูลผู้ใช้งาน + ตั้งค่าค่าไฟ
│   ├── executive/           # ผู้บริหาร — รายงานสรุปแบบ Power BI (KPI + กราฟแนวโน้ม/เปรียบเทียบโซน + ตัวกรองโซน)
│   ├── resident/            # ผู้พักอาศัย — Google Sign-In (@rmu.ac.th) + เลือกห้องเองครั้งแรก + ประวัติ/ค่าไฟเฉพาะห้องตัวเอง เลือกเดือนได้
│   └── api/
│       ├── meters/         # รายชื่อมิเตอร์จริงทั้งหมด (ใช้โดย /checker — Room/Zone join)
│       ├── rooms/          # รายชื่อห้องทั้งหมด (public GET — resident room picker ใช้เลือกห้องของตัวเอง)
│       ├── billing-config/ # Billing Configuration ปัจจุบัน (public GET — /checker ใช้ + Admin ใช้โหลดฟอร์ม)
│       ├── checker/        # login (username/password) + dashboard (มิเตอร์ตามโซนที่รับผิดชอบ + สถานะจดเดือนนี้)
│       ├── executive/      # summary (KPI + แนวโน้มรายเดือน + เปรียบเทียบโซน + สถานะข้อมูล, ?zoneId= กรองได้)
│       ├── resident/       # google-login (ตรวจ Google ID token, จำกัด @rmu.ac.th) + room (PATCH เลือกห้องเองได้ครั้งแรกเท่านั้น — เปลี่ยนซ้ำถูกปฏิเสธ 403) + history (ประวัติ/ค่าไฟ เฉพาะ residentRoomId ของ user นั้น)
│       ├── readings/sync/  # รับ reading + ภาพจาก client (Phase 5)
│       ├── export/         # Excel export (Phase 6/6B)
│       └── admin/          # Zone/Room/Meter/User/BillingConfig CRUD + dashboard summary + reading history
├── components/              # UI components (mobile-first) — components/admin/ = /admin tab UI, components/checker/ = /checker auth gate
│   ├── QrScanner.tsx        # แสกน QR จากกล้อง (jsQR) — ใช้ใน /checker
│   ├── checker/CheckerAuthGate.tsx  # login gate ของทั้ง 3 หน้า /checker/**
│   ├── resident/GoogleSignInButton.tsx  # ปุ่ม "Sign in with Google" (Google Identity Services)
│   ├── resident/ResidentAuthGate.tsx  # login gate ของ /resident (ใช้ GoogleSignInButton)
│   └── admin/PrintQrModal.tsx, QrPrintGrid.tsx, BillingSettingsManagement.tsx  # พิมพ์ QR แบบ modal, ตั้งค่าค่าไฟ (ค่ากลาง PostgreSQL)
├── lib/
│   ├── db/                 # Prisma client (server-only) — mockStore.ts/mockPrisma.ts เมื่อ MOCK_DATA=true
│   ├── offline/             # Dexie/IndexedDB — readings, sync queue, billing config cache, cached meters, checker dashboard cache
│   ├── sync/                # Manual sync orchestration
│   ├── ocr/                 # Tesseract.js OCR wrapper
│   ├── meters/               # Meter/Room/Zone lookup — fetch จาก PostgreSQL จริง (ไม่ใช่ static list แล้ว)
│   ├── billing/              # Billing Configuration (types/default/validation/explanation/server + client fetch)
│   ├── checker/               # /checker session (login/localStorage) + dashboard client fetch + types
│   ├── executive/             # /executive types + summary client fetch (KPI/แนวโน้ม/เปรียบเทียบโซน)
│   ├── resident/              # googleAuth.ts (verify Google ID token, server-only) + /resident session (login/localStorage) + room picker client fetch + history client fetch + types
│   ├── admin/                # /admin API client + shared types/validation + password hash/verify
│   └── export/               # Calculation Service + Excel generation
prisma/
├── schema.prisma            # Zone/Room/Meter/Reading/ReadingImage/User(+email,+residentRoomId)/SyncLog/BillingConfig
├── seed.cjs                  # demo reference data (Zone/Room/Meter/User only — no Reading)
├── seedReadings.cjs          # demo-only: N months of chained Reading history for every Meter (temporary)
└── deleteSeedReadings.cjs    # removes exactly what seedReadings.cjs created
docker-compose.yml            # PostgreSQL 17 + app
Dockerfile                    # multi-stage, Next.js standalone output
```

Each `src/lib/*` folder has a short `README.md` explaining its responsibility — see
[`docs/tech-stack.md`](docs/tech-stack.md) for the full phase-by-phase history and
[`docs/decision-log.md`](docs/decision-log.md) for every implementation decision made
along the way.
