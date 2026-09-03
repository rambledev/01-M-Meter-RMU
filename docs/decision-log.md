# Decision Log — RMU Meter Collection

> อัปเดตล่าสุด: 2026-09-02 — ผู้ใช้อนุมัติ (approve) รายการ tech stack ทั้งหมดแล้ว
> สถานะเอกสาร: **ปิดรอบ decision สำหรับ tech stack — ห้ามถามซ้ำรายการด้านล่างนี้อีก**

---

## ✅ Locked Decisions (Approved 2026-09-02 — ไม่ต้องถามซ้ำ)

ผู้ใช้ยืนยันและล็อกรายการต่อไปนี้แบบ final สำหรับทั้งโปรเจกต์:

| รายการ | เวอร์ชันที่ล็อก |
|---|---|
| Node.js | 22.x |
| Next.js | 16.3.4 |
| React | 19.2.8 |
| TypeScript | 5.9.3 |
| Tailwind CSS | 4.3.3 |
| Prisma | **5.22.0** |
| @prisma/client | **5.22.0** |
| PostgreSQL | 17 |
| Package Manager | npm |
| Docker | Docker + Docker Compose |

**ห้ามเสนอเปลี่ยนแปลงรายการข้างต้นอีกในการสนทนาครั้งถัดไป** เว้นแต่ผู้ใช้เป็นผู้เปิดประเด็นเอง — รวมถึง:
- ห้ามเสนอ Prisma 6/7/8 แทน 5.x
- ห้ามเสนอ TypeScript 7 แทน 5.x
- ห้ามเสนอ Tailwind 3 แทน 4.x
- ห้ามเสนอ pnpm แทน npm

### หมายเหตุเฉพาะ: Prisma 5.22.0 เป็น Legacy Major Version

บันทึกไว้ตามที่ผู้ใช้กำหนด:

- **Prisma 5.22.0 เป็นข้อกำหนด (requirement) ของโปรเจกต์นี้** ไม่ใช่การเลือกโดยไม่ทราบข้อมูล
- **รับทราบแล้วว่า Prisma 5.x เป็น legacy major version** — สาย 5.x หยุด release มาตั้งแต่ 2024-11-05 และปัจจุบันมี major version ใหม่กว่าอย่างน้อย 2 รุ่น (6.x, 7.x) แซงหน้าไปแล้ว (ดูรายละเอียดการตรวจสอบเดิมในหัวข้อ "บริบทการตัดสินใจ (เพื่ออ้างอิง)" ด้านล่าง)
- **การเลือกใช้ Prisma 5.22.0 เป็นการตัดสินใจด้าน compatibility / project requirement** ของผู้ใช้ ไม่ใช่ผลจากข้อจำกัดทางเทคนิคที่ตรวจพบใหม่
- **จะประเมินการ upgrade Prisma ในอนาคต** เป็นเรื่องที่ต้องพิจารณาแยกในภายหลัง ไม่ใช่ scope ของ MVP รอบนี้

---

## ✅ Decision — ไม่จัดเก็บ OCR Crop Image แบบถาวร (2026-09-02)

**Decision**: ระบบจะ**ไม่จัดเก็บ OCR Crop Image (OCR Region) แบบถาวร**ทั้งที่ server และที่ client (IndexedDB) — เก็บถาวรเฉพาะ **Original Image** (ภาพมิเตอร์เต็มภาพ) เป็นหลักฐาน ส่วน OCR Region เป็นการ crop ที่เกิดขึ้นชั่วคราวใน memory/client ระหว่างประมวลผล OCR เท่านั้น แล้วทิ้งทันทีหลังได้ผลลัพธ์ (`ocrValue`)

**เหตุผล**:
- ลดพื้นที่จัดเก็บ (storage) ทั้งฝั่ง server และมือถือของผู้จด
- ลดความซับซ้อนของระบบ (ไม่ต้องมี type/field แยกสำหรับภาพ crop, ไม่ต้องจัดการ sync ภาพ crop แยกจากภาพต้นฉบับ)
- รูปต้นฉบับ (Original Image) ยังใช้ตรวจสอบย้อนหลังได้เต็มรูปแบบอยู่แล้ว (เป็นหลักฐานที่ครบถ้วนกว่า crop)
- OCR Crop สามารถสร้างใหม่ได้เสมอจากรูปต้นฉบับ หากในอนาคตต้องตรวจสอบว่า crop ตอนนั้นมาจากบริเวณไหน
- เหมาะกับ MVP (ลด scope ที่ต้อง implement) และหลักการ Offline-first (ลดขนาดข้อมูลที่ต้อง sync ต่อ Reading)

**ผลกระทบต่อเอกสาร/schema**:
- `data-model.md` §3.2: ตัด `ReadingImageType` enum และ field `type`/`cropRegion` ออกจาก `ReadingImage` — เหลือแค่ `path` (String) ที่อ้างอิงไฟล์ Original Image เท่านั้น
- `offline-strategy.md`: `LocalReading` เปลี่ยนจาก `images: LocalReadingImage[]` (มี `type`/`cropRegion`) เป็น `originalImageBlob: Blob` เดี่ยว — ไม่มี crop blob เก็บใน IndexedDB
- `ocr-strategy.md` §4: OCR Pipeline ระบุชัดว่าขั้นตอน crop เป็น "ชั่วคราวใน memory/client เท่านั้น" ไม่มี persist step ใดๆ สำหรับภาพ crop
- `requirement.md` §3.3: เปลี่ยนจาก "เก็บ 4 ส่วน" เป็น "เก็บถาวร 3 ส่วน" (Original Image, OCR Value, Confirmed Value)

**การจัดเก็บ Original Image (ยืนยันแล้ว)**:
- Path: `public/upload/meter/`
- ชื่อไฟล์: `{MeterID}m{MM}_{YYYY}.{ext}` (เช่น `ME-001m09_2026.jpg`) — **server เป็นผู้สร้างชื่อไฟล์เสมอ**, client ห้ามกำหนดเอง (รูปแบบนี้อัปเดตเพิ่มปี ค.ศ. แล้ว — ดูหัวข้อ "เพิ่มปี ค.ศ. ในชื่อไฟล์รูปภาพมิเตอร์" ด้านล่าง)
- Database เก็บ path ของไฟล์ (เช่น `/upload/meter/ME-001m09_2026.jpg`) ผ่าน `ReadingImage.path`

**Production Storage**: Deploy ด้วย **Coolify** — ใช้ **Persistent Storage ของ Coolify** (volume mount) สำหรับ `public/upload/meter/` เพื่อป้องกันรูปหายเมื่อ container redeploy **ยังไม่ใช้ S3/MinIO** ในรอบ MVP นี้ (จะประเมินในอนาคตถ้าจำเป็น) — การ config volume จริงยังไม่ implement ในรอบนี้ (เอกสารเท่านั้น)

**สถานะ**: ✅ Locked — เป็น requirement ที่ยืนยันแล้ว ไม่ใช่ข้อเสนอ

---

## ✅ Decision — เพิ่มปี ค.ศ. ในชื่อไฟล์รูปภาพมิเตอร์ (2026-09-02)

**Decision**: เปลี่ยนรูปแบบชื่อไฟล์ Original Image จาก `{MeterID}m{MM}.{ext}` เป็น **`{MeterID}m{MM}_{YYYY}.{ext}`**

**Format**: `{MeterID}m{MM}_{YYYY}.{ext}`
- `MeterID` = รหัสมิเตอร์ (`Meter.code`)
- `MM` = เดือนของ `Reading.readingMonth` แบบ 2 หลัก (01–12)
- `YYYY` = ปี ค.ศ. 4 หลักของ `Reading.readingMonth`
- `ext` = นามสกุลไฟล์จริง เช่น jpg, jpeg, png

**ตัวอย่าง**:
- `readingMonth = 2026-09`, `MeterID = ME-001` → `ME-001m09_2026.jpg`
- `readingMonth = 2026-10`, `MeterID = ME-001` → `ME-001m10_2026.jpg`
- `readingMonth = 2027-09`, `MeterID = ME-001` → `ME-001m09_2027.jpg`

**Reason**: ป้องกันชื่อไฟล์ซ้ำข้ามปี และทำให้สามารถระบุ Meter, เดือน และปีจากชื่อไฟล์ได้โดยตรง

**กติกาที่ยังคงเดิม** (ไม่เปลี่ยนจาก decision ก่อนหน้า):
- **Server เป็นผู้สร้างชื่อไฟล์เสมอ** — client ห้ามกำหนดชื่อไฟล์เอง ส่งแค่ binary ภาพ
- **ชื่อไฟล์สร้างจาก `Reading.readingMonth` ที่ผู้ใช้เลือกเสมอ ไม่ใช่วันที่ upload/sync จริง** — สำคัญมากสำหรับกรณี offline ที่ sync ช้ากว่าวันที่ถ่ายจริง

**ผลกระทบต่อเอกสาร**: `data-model.md` §3.2, `offline-strategy.md` (upload/sync note), `workflow.md` (ตาราง §2), `tech-stack.md` (project structure + risks) — อัปเดตรูปแบบชื่อไฟล์ให้ตรงกันหมดแล้ว และ**ลบคำเตือนเดิมเรื่อง "overwrite ข้ามปี"** ออกจากทุกไฟล์ (แทนที่ด้วยข้อความว่า resolved แล้ว)

**สถานะ**: ✅ Locked — แก้ปัญหา overwrite ข้ามปีที่เคยเป็น open risk ก่อนหน้านี้แล้ว ไม่ใช่ข้อเสนอ

---

## ✅ Decision — Persist `previousReading` และ `usage` บน Reading (Phase 1, 2026-09-02)

**บริบท**: ตอนเริ่ม Phase 1 (Core Data Model) พบว่า field list ที่ผู้ใช้กำหนดให้ Reading ต้องมี (`previousReading`, `usage`, `recordedBy`, `recordedAt`) **ขัดแย้งกับเอกสารที่ล็อกไว้ก่อนหน้า**:
- `data-model.md` §6 (ฉบับก่อน Phase 1) ระบุว่า `usage` "ไม่ persist ซ้ำใน DB" คำนวณตอน export เท่านั้น
- `workflow.md`/`requirement.md` ไม่เคยมี field `previousReading` — ออกแบบให้ query สดจาก Reading เดือนก่อนหน้าเสมอ เพื่อให้ได้ค่าล่าสุดถ้า reading เดือนก่อนถูกแก้ไขภายหลัง

ผู้ใช้ยืนยันชัดเจน (ผ่านคำถามที่ถามก่อนเขียน schema) ว่าให้ **persist ทั้งสอง field** บน `Reading` เป็น snapshot ณ เวลา confirm

**Decision**:
- `Reading.previousReading` (`Decimal?`) — snapshot ของ `Reading.confirmedValue` เดือนก่อนหน้า ณ เวลา confirm
- `Reading.usage` (`Decimal?`) — `confirmedValue - previousReading` ณ เวลา confirm
- ทั้งสอง nullable เพราะ reading แรกของมิเตอร์ไม่มีเดือนก่อนหน้าให้ snapshot

**Trade-off ที่รับทราบแล้ว**: ถ้า reading เดือนก่อนหน้าถูกแก้ไขภายหลัง `previousReading`/`usage` ที่ persist ไว้ในเดือนถัดไป **จะไม่ auto-update ตาม** (เป็น snapshot ณ เวลา confirm ไม่ใช่ live query) — เป็นความเสี่ยงด้าน data staleness ที่ผู้ใช้ยอมรับแลกกับความเรียบง่ายและ audit trail ที่ตรงกับค่าที่ผู้ใช้เห็นจริง ณ ตอน confirm

**Field naming เพิ่มเติม**: rename `readerId`/`reader` → `recordedBy`/`recorder`, เพิ่ม `recordedAt` (business timestamp เวลาที่ผู้ใช้บันทึก/ยืนยัน — แยกจาก `createdAt` ซึ่งเป็นเวลาที่ record เขียนลง DB จริง อาจต่างกันถ้า sync จาก offline queue ช้ากว่า) — ไม่ใช่ความขัดแย้งเชิงสถาปัตยกรรม เป็นแค่ rename

**ผลกระทบต่อเอกสาร**: `data-model.md` (§1, §3.1, §5, §6), `export-format.md` (§2, §3) อัปเดตให้ตรงกับ schema จริงแล้ว

**สถานะ**: ✅ Locked — ยืนยันจากผู้ใช้โดยตรงก่อนเขียน `prisma/schema.prisma`

---

## ✅ Decision — Schema Review Fixes: `confirmedValue` nullable, `readingMonth @db.Date` (Phase 1, 2026-09-02)

หลังตรวจ Phase 1 schema รอบแรก ผู้ใช้สั่งแก้ 2 จุดก่อน commit:

1. **`Reading.confirmedValue`**: `Decimal` (required) → **`Decimal?`** (nullable) — เหตุผล: Reading อยู่ในสถานะ `DRAFT` ได้ก่อนที่ผู้ใช้จะ confirm ดังนั้น `confirmedValue` ยังไม่ต้องมีค่าตั้งแต่สร้าง record กติกา "ต้องมีค่าเมื่อ confirm แล้ว" จะบังคับที่ **application/service layer ใน Phase 3** ไม่ใช่ DB CHECK constraint (หลีกเลี่ยงความซับซ้อนเกินจำเป็นใน Phase 1) — `usage` ยังคง `Decimal?` เดิม (NULL ได้ทั้งตอนยังไม่ confirm และตอนไม่มี `previousReading`)
2. **`Reading.readingMonth`**: `DateTime` → **`DateTime @db.Date`** — เหตุผล: `readingMonth` คือ "เดือนที่ reading อ้างอิง" ไม่ใช่ timestamp การใช้ PostgreSQL `DATE` (แทน `timestamp(3)`) ตัดปัญหา time-of-day/timezone ทิ้งไปเลย เหมาะกับ `@@unique([meterId, readingMonth])` มากกว่า — ชื่อ field และ unique constraint ไม่เปลี่ยน, application/service layer ยังต้อง normalize เป็นวันที่ 1 ของเดือนเสมอ

**ผลกระทบต่อเอกสาร**: `data-model.md` §3.1 (code block) และ §5 (rationale table) sync ให้ตรงกับ `prisma/schema.prisma` แล้ว

**สถานะ**: ✅ Locked — `npx prisma validate`/`generate` ผ่านทั้งคู่หลังแก้

---

## บริบทการตัดสินใจ (เพื่ออ้างอิง — ไม่ใช่ประเด็นที่ต้องตัดสินใจอีกแล้ว)

ส่วนนี้เก็บผลการตรวจสอบเดิม (2026-09-01) ไว้เพื่อเป็นบริบทว่าทำไมแต่ละรายการถึงมีทางเลือกอื่น แต่ **สถานะทั้งหมดคือ resolved/approved แล้ว** ตามหัวข้อ Locked Decisions ด้านบน

### Prisma
| Major | เวอร์ชันล่าสุดของสาย | วันที่ release |
|---|---|---|
| 5.x (เลือกใช้) | 5.22.0 | 2024-11-05 |
| 6.x | 6.19.3 | 2024-11-28 |
| 7.x | 7.10.0 | 2025-11-19 |
| 8.x | 8.0.0-rc.12 | 2026-08-26 |

`npm audit` กับ `prisma@5.22.0` + `@prisma/client@5.22.0` ไม่พบ known vulnerability ณ วันที่ตรวจสอบ — แต่ไม่มีเอกสาร official EOL/security policy ของ Prisma สำหรับสาย 5.x อย่างชัดเจน ผู้ใช้รับทราบความเสี่ยงนี้แล้วตามหมายเหตุด้านบน

### TypeScript
`latest` tag = 7.0.2 (native/Go-based compiler ใหม่) แต่เลือกใช้ **5.9.3** เพื่อความเข้ากันได้กับ tooling ปัจจุบัน (Next.js 16 plugin, ESLint ฯลฯ)

### Tailwind CSS
เลือกใช้สาย 4.x (**4.3.3**, CSS-first config ผ่าน `@theme`) แทนสาย 3.x LTS

### Package Manager
เลือก **npm** ตาม default ของ Global instruction (เครื่องไม่มี pnpm ติดตั้งอยู่)

### Next.js / React — ล็อกจาก security advisory (ไม่ใช่ประเด็น preference)
- Next.js ต้อง **≥ 16.3.3** เนื่องจากช่องโหว่ RCE ระดับ critical ที่กระทบ self-hosted/Docker deployment (August 2026 security release) — **16.3.4 ที่เลือกใช้ ปลอดภัย**
- React ต้อง **≥ 19.2.6** เนื่องจากช่องโหว่ DoS (CVE-2026-23870) ใน React Server Components — **19.2.8 ที่เลือกใช้ ปลอดภัย**

---

## ⏸️ ประเด็นที่ยังรอข้อมูล/คำตอบจากผู้ใช้ (ไม่ใช่เรื่อง tech stack — อยู่นอกขอบเขต decision รอบนี้)

รายการเหล่านี้เป็นช่องว่างด้าน **requirement/business logic** ที่พบระหว่างวิเคราะห์ ยังไม่ถูก resolve โดยการอนุมัติ tech stack ครั้งนี้ ดูรายละเอียดเต็มใน [requirement.md](requirement.md) §5:

1. สูตรคำนวณค่าไฟ (ค่าไฟพื้นฐาน / ค่า FT / ภาษี / รวมทั้งสิ้น) — ห้ามเดา ต้องรอสูตรจริง
2. ไฟล์ตัวอย่างรายงาน Excel จริง (สำหรับ mapping format/merge cell)
3. ขอบเขตสิทธิ์ของแต่ละ Role (โดยเฉพาะ `RESIDENT` และสิทธิ์แก้ไข reading ที่ confirm แล้ว)
4. OCR provider/engine (on-device เช่น ML Kit/Tesseract.js vs API ภายนอก) — ดูตัวเลือกที่เสนอไว้ใน [ocr-strategy.md](ocr-strategy.md)
5. QR Code: ใครเป็นผู้สร้าง/พิมพ์ QR
6. จำนวนผู้ใช้พร้อมกันโดยประมาณ และขนาดข้อมูล (จำนวนมิเตอร์/zone)

**หมายเหตุ**: รายการเหล่านี้ไม่ได้บล็อกการเขียน documentation/architecture spec รอบนี้ แต่จะบล็อกการ implement ส่วนที่เกี่ยวข้องโดยตรง (เช่น Phase 6 Excel Export ต้องรอข้อ 1–2)

---

## ✅ Phase 0 — Implementation Decisions (2026-09-02)

Phase 0 (Project Setup) เสร็จแล้ว รายการนี้บันทึกการตัดสินใจทางเทคนิคที่เกิดขึ้นระหว่าง implement ซึ่งไม่ได้ระบุรายละเอียดไว้ในเอกสารรอบก่อนหน้า — ไม่มีผลต่อ tech stack ที่ล็อกไว้ (Locked Decisions ด้านบน) เป็นแค่รายละเอียด configuration ระดับ infra:

| การตัดสินใจ | เหตุผล |
|---|---|
| ใช้ `create-next-app@16.3.4` scaffold แล้วตรวจสอบ/pin version ที่ resolve จริงในภายหลัง แทนการเขียน package.json มือทั้งหมด | ได้ config มาตรฐานของ Next.js (eslint.config.mjs, tsconfig.json, postcss.config.mjs) ที่ตรงกับ Next 16.3.4 ทุกตัว แล้วตรวจสอบด้วย `npm ls` ว่า next/react/react-dom/typescript/tailwindcss ตรงเวอร์ชันที่ล็อกไว้เป๊ะ (ไม่มี caret range หลงเหลือสำหรับ 6 รายการที่ล็อก) |
| Docker base image: `node:22-alpine` | ตรงตาม Node 22.x ที่ล็อกไว้ (Global instruction) และ image เล็กเหมาะกับ production |
| `@types/node` ใช้ `^22` (resolve เป็น 22.20.1) แทน `^20` ที่ create-next-app ติดตั้งมาโดย default | ให้ตรงกับ Node runtime 22.x ที่ล็อกไว้ ไม่ใช่ค่า default ของ scaffold |
| `next.config.ts` เพิ่ม `output: "standalone"` | จำเป็นสำหรับ multi-stage Docker build ให้ได้ image ขนาดเล็ก (รวมเฉพาะไฟล์ที่ runtime ต้องใช้จริง) |
| `prisma/schema.prisma` มีเฉพาะ `datasource`/`generator` block ไม่มี model ใดๆ | ตามคำสั่งชัดเจนของผู้ใช้ว่า Phase 0 ห้ามสร้าง Data Model จริง — ทดสอบแล้วว่า `prisma generate` จะ error ถ้าไม่มี model เลย (เป็นพฤติกรรมปกติของ Prisma 5.x) จึงยังไม่รันคำสั่งนี้จนกว่าจะถึง Phase 1 |
| Dockerfile รัน `prisma generate` แบบมีเงื่อนไข (เช็คว่ามี `model ` ใน schema.prisma หรือยัง) แทนการรันตรงๆ | ทำให้ `docker build` ผ่านได้ตั้งแต่ Phase 0 (ไม่มี model) และจะรัน generate อัตโนมัติเองตั้งแต่ Phase 1 เป็นต้นไปโดยไม่ต้องแก้ Dockerfile ซ้ำ |
| แยก `DATABASE_URL` เป็น 2 ค่า: `.env` (host, `localhost:5432` สำหรับ `npm run dev` นอก Docker) กับ `docker-compose.yml` (`db:5432` สำหรับ service `app` ใน network เดียวกัน) | รองรับทั้ง workflow "รัน Next.js บนเครื่องแต่ต่อ DB ผ่าน Docker" และ "รันทุกอย่างใน Docker Compose" โดยไม่ต้องสลับ env มือ |
| ยังไม่ `git init` ในโปรเจกต์ | ไม่ได้อยู่ใน scope 13 ข้อของ Phase 0 ที่ผู้ใช้ระบุ — รอให้ผู้ใช้ยืนยันก่อน (ดูหัวข้อ "Any issues or risks" ใน final response ของ Phase 0) |

---

## ✅ Phase 2 — Offline-first Data Layer: Implementation Decisions (2026-09-03)

| การตัดสินใจ | เหตุผล |
|---|---|
| **ID strategy: ไม่แก้ Prisma schema** — ใช้ `localId` (client-generated, `crypto.randomUUID()`) แยกจาก `serverId` (เติมทีหลังหลัง sync) | ตรวจ `prisma/schema.prisma` แล้วพบว่า `Reading.id` เป็น `String @id @default(cuid())` — เป็น string ธรรมดา ไม่ใช่ auto-increment/sequence จึงไม่มีข้อจำกัดทางเทคนิคที่บังคับให้ client ต้อง "เดา" ค่า id ที่ server จะใช้ การแยก `localId`/`serverId` (ตามที่ offline-strategy.md ออกแบบไว้ตั้งแต่แรก) แก้ปัญหา ID ชนกันได้ครบโดยไม่ต้องเปลี่ยน schema ใดๆ — **ไม่ใช่ architectural decision ใหม่** เป็นการยืนยันว่าดีไซน์เดิมเพียงพอแล้ว |
| `readingImages` แยกเป็น Dexie table ต่างหาก (ไม่ embed `originalImageBlob` ใน `LocalReading` ตามตัวอย่างเดิมใน offline-strategy.md) | Mirror ความสัมพันธ์ 1:N ระหว่าง `Reading`↔`ReadingImage` บนฝั่ง server (data-model.md §3.2) ได้ตรงกว่า — ตัวอย่างเดิมใน offline-strategy.md ระบุไว้ชัดเจนว่าเป็นแค่ตัวอย่าง ("ยังไม่สร้างไฟล์จริง") ไม่ใช่ locked design จึงปรับได้โดยไม่ถือเป็นการเปลี่ยน architecture ที่ล็อกไว้ |
| เพิ่ม dev dependency `vitest` + `fake-indexeddb` สำหรับเทส | จำเป็นต่อการเขียน test ตามที่สั่ง (Dexie/IndexedDB ไม่มีใน Node โดย native — `fake-indexeddb` คือ polyfill มาตรฐานของวงการสำหรับเทส Dexie นอก browser) — ไม่ใช่ tech stack ที่ล็อกไว้ใน decision-log (Next/React/TS/Tailwind/Prisma) จึงไม่ขัดกับ locked decisions |
| Repository functions เป็น plain async function ล้วน ไม่มี class/interface/DI abstraction | ตรงตามหลัก "อย่า over-engineer, อย่าสร้าง abstraction หลายชั้น" ที่ผู้ใช้ระบุใน Phase 2 kickoff |
| Sync Queue repository (`syncQueueRepository.ts`) มีแค่ data structure + CRUD (`enqueueForSync`, `getQueueItem`, `getPendingQueueItems`, `updateQueueItem`) | ไม่มี network call, retry logic, หรือ conflict resolution ใดๆ ตามที่สั่งชัดเจนว่ายังไม่ต้องทำใน Phase 2 — เตรียมพร้อมให้ Phase 5 ใช้งานต่อเท่านั้น |

**สถานะ**: ✅ ไม่มี architectural decision ใหม่ที่ขัดกับของเดิม — เป็นการ implement ตาม design ที่ล็อกไว้แล้ว บวกกับ 1 การยืนยัน (ID strategy) และ 1 การปรับ implementation detail (แยก readingImages table) ที่ไม่กระทบ business rule ใดๆ

---

## ✅ Phase 3 — Meter Reading Workflow: Implementation Decisions (2026-09-03)

| การตัดสินใจ | เหตุผล |
|---|---|
| เพิ่ม `findReadingByMeterAndMonth(meterId, readingMonth)` บน repository เดิม (ไม่สร้าง storage layer ใหม่) | Previous Reading lookup (requirement.md §3.1) และ duplicate check (§3.2) ต้องการ query ตาม compound index `[meterId+readingMonth]` ที่ Phase 2 เตรียมไว้แล้วแต่ยังไม่มี accessor — เป็นการต่อยอด repository ที่มีอยู่ ไม่ใช่ layer ใหม่ |
| Demo data (Zone/Room/Meter/User) เป็น static TS module (`src/lib/meters/demoData.ts`) ไม่ใช่ DB records | ยังไม่มี API/seed workflow ตามที่ระบุชัดเจนใน Phase 3 kickoff — เพียงพอสำหรับ demo, ไม่ต้องสร้างหน้า Admin |
| Reading workflow แยกเป็น layer ต่างหาก (`src/lib/reading/readingWorkflow.ts`) คั่นระหว่าง UI กับ repository | ตรงตาม architecture diagram ที่ระบุไว้ใน Phase 3 kickoff (UI → Meter lookup/Reading workflow → Repository → Dexie → IndexedDB) |
| `OnlineStatusBadge` ใช้ `useSyncExternalStore` แทน `useState`+`useEffect` | หลีกเลี่ยง ESLint rule `react-hooks/set-state-in-effect` (Next.js 16/React 19 tooling) — เป็นวิธีมาตรฐานสำหรับ subscribe ค่าจาก browser API โดยไม่มี setState ในตัว effect เอง |

**บั๊กที่พบระหว่าง browser test (แก้ก่อน commit)**: หลังบันทึกสำเร็จ UI สลับไปแสดงการ์ด "มีการบันทึกมิเตอร์นี้แล้ว" ทันทีแทนที่จะแสดงข้อความ "บันทึกสำเร็จ" เพราะ code ตั้ง `duplicateReading` เป็น reading ที่เพิ่ง save เอง — แก้โดยแยก state `savedReading` ให้แสดงผลก่อน `duplicateReading` เสมอ

**สถานะ**: ✅ ไม่มี architectural decision ใหม่ที่ขัดกับของเดิม, ไม่แก้ Prisma schema, ไม่สร้าง storage layer ใหม่

---

## ✅ Phase 4 — Camera + OCR: Implementation Decisions (2026-09-03)

| การตัดสินใจ | เหตุผล |
|---|---|
| **OCR provider ล็อกแล้ว: Tesseract.js (client-side)** | ผู้ใช้ยืนยันชัดเจนตอนเริ่ม Phase 4 kickoff — แก้ ⏸️ pending status ใน ocr-strategy.md ให้เป็น ✅ Locked ตรงกับข้อเสนอเดิมที่แนะนำไว้ตั้งแต่ก่อน Phase 0 |
| ใช้ Tesseract.js `rectangle` option ส่ง Original Image เต็มภาพ + พิกัดเข้า `recognize()` แทนการ manual crop ผ่าน `<canvas>` | Tesseract crop เองภายใน WASM memory — เข้มงวดกว่าที่ ocr-strategy.md §4 ร่างไว้อีก เพราะไม่มี object รูปครอปเกิดขึ้นในโค้ดแอปเราเลยแม้แต่ชั่วคราว |
| CDN default สำหรับโหลด Tesseract worker/core/traineddata (ไม่ self-host) | ตามคำสั่งชัดเจนของผู้ใช้ที่ Phase 4 kickoff: ถ้า offline model ซับซ้อนเกินไปสำหรับ demo ให้ทำ implementation ที่ใช้งานได้ก่อนแล้วบันทึกข้อจำกัด (ดู ocr-strategy.md §5.4) — first-use ต้องมีเน็ต, หลังจากนั้น browser cache ให้ offline ได้เอง |
| Fixed OCR region (`DEFAULT_OCR_REGION`) ไม่มี UI ลากกรอบ | ตรงตามที่อนุญาตไว้ใน Phase 4 kickoff ("ไม่จำเป็นต้องทำระบบลากกรอบอิสระที่ซับซ้อน") |
| เพิ่ม dependency `tesseract.js@7.0.0` (pinned exact) | จำเป็นสำหรับ client-side OCR ตามที่สั่งชัดเจน ตรวจ package.json ก่อนแล้วว่ายังไม่มี |
| Image compression (`src/lib/image/compressImage.ts`) resize+re-encode ภาพเต็ม ไม่ crop | ตรงตาม Phase 4 spec ข้อ 8 ("ถ้าทำ compression ให้เป็นการแปลง Original Image ไม่ใช่ OCR crop") |
| `saveOfflineReading()` (Phase 3) ขยายให้รับ `ocrValue` + `image` (required) แทนการสร้างฟังก์ชัน save คู่ขนาน | เป็น entrypoint การบันทึกเดียวที่มีอยู่แล้ว การขยาย input ตรงไปตรงมากว่าการมี 2 ฟังก์ชันซ้ำซ้อน — caller เดียว (page.tsx) จึงไม่กระทบโค้ดอื่น |

**บั๊กที่พบระหว่าง browser test (แก้ก่อน commit)**: ทดสอบด้วยภาพขนาดเล็กผิดปกติ (ใกล้ 1x1 พิกเซล) ทำให้ rectangle ที่คำนวณได้หลุดขอบภาพ และ Tesseract/Leptonica **abort ทั้ง WASM worker** แทนที่จะโยน error ที่ดักได้ — แก้โดยเพิ่ม clamp ใน `regionToRectangle()` ให้ rectangle อยู่ในขอบเขตภาพเสมอ (มีผลเฉพาะภาพที่เล็กผิดปกติมาก ภาพจากกล้องจริงไม่ชนกรณีนี้) และเพิ่มข้อความแจ้งเตือนเมื่อกดชัตเตอร์ตอนวิดีโอยังไม่พร้อม (`videoWidth === 0`) แทนการไม่ทำอะไรแบบเงียบๆ

**ทดสอบจริงด้วย Playwright**: fake camera device (`--use-fake-device-for-media-stream`) ยืนยัน permission/preview/overlay/shutter UI ทำงานถูกต้อง (แม้ frame capture จาก fake device จะไม่ผ่านเนื่องจาก `videoWidth` ไม่ populate ในสภาพแวดล้อม headless — เป็นข้อจำกัดของ environment ไม่ใช่บั๊กของโค้ด) จึงทดสอบ flow เต็มต่อผ่าน file-upload fallback (ตามที่ได้รับอนุญาตไว้) ด้วยภาพสังเคราะห์ที่มีตัวเลข "001234.5" จริง — **OCR อ่านค่าได้ถูกต้อง 100%** ยืนยัน `ocrValue`/`confirmedValue` แยกกันจริง มีแค่ 1 `ReadingImage` (ต้นฉบับ ไม่มี crop) และ SyncQueue ถูกสร้างสำเร็จ

**สถานะ**: ✅ ไม่มี architectural decision ใหม่ที่ขัดกับของเดิม, ไม่มี OCR API/backend, ไม่มี S3/MinIO, ไม่แก้ Prisma schema

---

## ✅ Phase 5 — MVP Sync: Implementation Decisions (2026-09-03)

**การตัดสินใจที่ขอ approve จากผู้ใช้ก่อนทำ (ได้รับอนุมัติแล้ว)**:

| การตัดสินใจ | เหตุผล |
|---|---|
| **Seed ข้อมูล Zone/Room/Meter/User เข้า PostgreSQL จริง** (`prisma/seed.cjs`, id ตรงกับ `demoData.ts` เป๊ะ: `zone-a/b`, `room-101/102/201`, `ME-001/002/003`, `demo-user-1`) | ตรวจพบว่า database จริงมี 0 rows ทุกตาราง — demo data เดิมมีแค่ฝั่ง client (Phase 3) การ sync จะ fail 100% ด้วย "Meter ไม่พบ"/"User ไม่พบ" ทุกครั้งถ้าไม่มี row เหล่านี้ในฐานจริง เป็น**เงื่อนไขจำเป็น**ที่ทำให้ Phase 5 demo ได้เลย ไม่ใช่ทางเลือก — **หยุดถามผู้ใช้ก่อนแล้วจึงรัน** (ต่างจาก Phase 1 ที่ "ห้าม seed" เพราะตอนนั้นเป็น schema-only phase ยังไม่มี sync feature ให้ seed รองรับ) |

**Implementation decisions อื่นๆ**:

| การตัดสินใจ | เหตุผล |
|---|---|
| Manual sync trigger (ปุ่ม "Sync ข้อมูล") แทน auto-trigger ตอนกลับ online | ผู้ใช้ระบุชัดเจนที่ Phase 5 kickoff ว่า "ยังไม่ต้องทำ automatic background sync" — offline-strategy.md §4 อัปเดตแล้วว่า auto-trigger เป็นแผนอนาคต ไม่ใช่ Phase 5 |
| Sync API: `POST /api/readings/sync` รับ `multipart/form-data` (field `reading` = JSON string, field `image` = File) แทน JSON + base64 | รองรับไฟล์ภาพโดยตรงไม่ต้อง encode/decode base64 (เพิ่ม ~33% payload โดยไม่จำเป็น) — Next.js Route Handler อ่าน `request.formData()` ได้ built-in ไม่ต้องเพิ่ม dependency |
| Transaction/atomicity: สร้าง `Reading` ก่อน → เขียนไฟล์ภาพ → สร้าง `ReadingImage` — ถ้าขั้นไหนหลัง `Reading` ถูกสร้างแล้ว fail ให้ **ลบ `Reading` (และไฟล์ถ้าเขียนไปแล้ว) แบบ compensating rollback** แทนการทำ true distributed transaction | Prisma `$transaction` ครอบคลุมแค่ DB ไม่ครอบคลุม `fs.writeFile` — ทำ true atomic (เช่น 2-phase commit) เกินความจำเป็นสำหรับ MVP demo ตามที่ผู้ใช้อนุญาตไว้ชัดเจน ("ถ้าต้องเลือกระหว่าง architecture ซับซ้อนกับง่าย ให้เลือกง่าย") ผลคือไม่มี `Reading` แบบไม่มีรูปหลงเหลือใน DB เงียบๆ (ตรงตามข้อกำหนด item 4) — worst case ที่เหลือคือไฟล์ orphan บน disk ถ้า DB step ที่ 2 (`ReadingImage`) fail หลังเขียนไฟล์ไปแล้ว (โอกาสเกิดต่ำมาก, ไม่กระทบความถูกต้องของข้อมูลใน DB) |
| Duplicate จาก server (`409 DUPLICATE`): client set local reading เป็น `SYNCED` ทันที (ไม่ retry, ไม่ error) | ทางเลือกที่ง่ายที่สุดตามที่อนุญาตไว้ ("ให้เลือกแนวทางที่ง่ายที่สุดและสอดคล้องกับ repository ปัจจุบัน") — ข้อมูลมีอยู่บน server แล้วจริง (แค่มาจาก sync attempt อื่น/device อื่น) จึงถือว่า "sync สำเร็จ" จาก mental model ของผู้ใช้ ไม่ใช่ error ที่ต้องแก้ไข |
| Sync queue "completed" = update `status: "SYNCED"` (ไม่ได้ลบ row ออกจาก IndexedDB) | ใช้ `updateQueueItem()` ที่มีอยู่แล้วจาก Phase 2 แทนการเพิ่มฟังก์ชัน delete ใหม่ — `getPendingQueueItems()` filter เฉพาะ `PENDING_SYNC`/`SYNC_ERROR` อยู่แล้ว จึงได้ผลลัพธ์เดียวกับ "remove" ในทางปฏิบัติ |
| ยังไม่ลบ `originalImageBlob` ออกจาก IndexedDB หลัง `SYNCED` | offline-strategy.md §3 เคยเสนอไว้เป็น optimization ("ได้" ไม่ใช่ "ต้อง") — deferred เพื่อความง่าย ไม่กระทบความถูกต้อง แค่ใช้พื้นที่ IndexedDB มากกว่าที่จำเป็นเล็กน้อย |
| ไม่ทำ Service Worker / Web Worker / background sync ใดๆ | ตรงตามข้อห้ามที่ระบุชัดเจนใน Phase 5 kickoff |

**สถานะ**: ✅ ล็อกแล้วหลังยืนยันจากผู้ใช้ (การ seed) — ไม่มี architectural decision อื่นที่ขัดกับของเดิม, ไม่แก้ unique constraint เดิม, ไม่แก้ Prisma `Reading.id`

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง** (`202.29.22.92:8024/rmu_meter`):
- **Online**: สร้าง reading (ME-001) → sync → PostgreSQL มี `Reading`+`ReadingImage` จริง, ไฟล์ `/upload/meter/ME-001m09_2026.jpg` อยู่บน disk จริง
- **Offline→Online**: ปิด network จริงผ่าน Playwright → สร้าง reading (ME-002, offline) → `PENDING_SYNC` → เปิด network → กด Sync → `SYNCED` → reload หน้า → ข้อมูลยังอยู่ถูกต้อง
- **Duplicate**: browser context ที่ 2 (IndexedDB คนละตัว จำลอง "อีกเครื่อง") สร้าง reading ซ้ำ meter+month เดิมกับที่ sync ไปแล้ว → server ตอบ 409 DUPLICATE → **ไม่มี row ที่ 3 ถูกสร้างใน PostgreSQL** (ตรวจนับแล้ว: 2 readings ไม่ใช่ 3) → client set เป็น SYNCED เอง
- **previousReading/usage**: สร้าง reading เดือน ก.ค. (ME-003, ไม่มี previous) แล้วเดือน ส.ค. (มี previous) → sync ทั้งคู่ → ตรวจ PostgreSQL ยืนยัน `previousReading=200, confirmedValue=260, usage=60` ถูกต้องครบ

⚠️ **ข้อมูลทดสอบยังคงอยู่ใน PostgreSQL จริงหลัง test** (4 Reading rows: ME-001/ME-002/ME-003×2 + ไฟล์ภาพ 4 ไฟล์ใน `public/upload/meter/`) — ตั้งใจไม่ลบทิ้งเพื่อให้ตรวจสอบได้ตามที่ Phase 5 spec ข้อ 15 ต้องการ ("หลัง browser test ให้ตรวจ PostgreSQL โดยตรง") รอผู้ใช้ยืนยันว่าจะให้ลบก่อนเริ่ม Phase 6 หรือไม่

---

## สถานะ Coding

**Phase 0 (Project Setup) เสร็จสมบูรณ์แล้ว** — โปรเจกต์ Next.js/TypeScript/Tailwind/Prisma package/Docker ถูกสร้างขึ้นจริงตามที่ approve (ดู `README.md` และรายงาน Phase 0)

**Git/GitHub ตั้งค่าแล้ว** — repo เชื่อมกับ `origin` ที่ https://github.com/rambledev/01-M-Meter-RMU.git และ push commit แรก (`chore: initialize project foundation`) ขึ้น `main` แล้ว (ดูรายละเอียดในรายงาน Phase 0)

**อัปเดต 2026-09-02 (เพิ่มเติมหลัง Phase 0)**: ปรับ requirement เรื่อง OCR Image Storage — ดูหัวข้อ "ไม่จัดเก็บ OCR Crop Image แบบถาวร" ด้านบน เป็นการปรับ documentation/architecture เท่านั้น **ยังไม่ได้แก้ schema จริง ไม่มี migration** (ตรงตามที่ระบุ)

**Phase 1 (Core Data Model) — schema สร้างแล้ว, ยังไม่ migrate**: `prisma/schema.prisma` มี model ครบ (Zone/Room/Meter/Reading/ReadingImage/User/SyncLog) ตรงกับ data-model.md แล้ว, `npx prisma validate` และ `npx prisma generate` ผ่านทั้งคู่ (ไม่แตะ database จริง) — **ยังไม่รัน `prisma migrate`/`db push`/`db pull` ใดๆ ทั้งสิ้น** และ**ยังไม่ seed ข้อมูลลง PostgreSQL จริง** ตามคำสั่งของผู้ใช้ รอการตรวจสอบ schema จากผู้ใช้ก่อนทำ migration หรือเริ่ม Phase 2

**Phase 1 — Migration Applied (2026-09-03)**: `CREATE DATABASE rmu_meter` + initial migration (`20260902094529_init`) apply สำเร็จบน PostgreSQL จริง (202.29.22.92:8024) — ตาราง/enum/index/FK ครบตาม schema, ไม่มีข้อมูล application ใดๆ (0 rows ทุกตาราง), commit แล้วขึ้น `main`

**Phase 2 (Offline-first Data Layer) เสร็จแล้ว**: Dexie.js + `src/lib/offline/{db,readingRepository,syncQueueRepository}.ts` implement ตาม offline-strategy.md, test ผ่านครบ (`npm test`), typecheck/lint/build ผ่าน — ยังไม่มี UI/Camera/OCR/API/Auto-sync เรียกใช้งานจริง (Phase 3 เป็นต้นไป) ไม่มี architectural decision ใหม่ที่ขัดกับของเดิม (ดูหัวข้อด้านบน)

**Phase 3 (Meter Reading Workflow) เสร็จแล้ว**: หน้าหลัก (`src/app/page.tsx`) ใช้งานได้ครบ Meter lookup → Month → Previous Reading → Current Reading → Duplicate check → Confirm → Save Offline → History ยืนยันด้วย Playwright จริงรวมถึงกรณี offline — ทดสอบ 29 tests ผ่าน, typecheck/lint/build ผ่าน ยังไม่มี Camera/OCR/API/Auto-sync (Phase 4 เป็นต้นไป)

**Phase 4 (Camera + OCR) เสร็จแล้ว**: Tesseract.js locked + implement จริง, Camera capture พร้อม permission/error handling + file fallback, OCR แยกจาก confirmedValue อย่างเคร่งครัด, เก็บเฉพาะ Original Image (ไม่มี crop ถูก persist) — ยืนยันด้วย Playwright จริงรวมถึง OCR อ่านค่าได้ถูกต้องจากภาพทดสอบ — ทดสอบ 35 tests ผ่าน, typecheck/lint/build ผ่าน ยังไม่มี Auto Sync/API upload (Phase 5 เป็นต้นไป)

**Phase 5 (MVP Sync) เสร็จแล้ว**: seed reference data เข้า PostgreSQL จริง (อนุมัติแล้ว), API `/api/readings/sync` + client `syncService.ts` ทำงานครบ Online/Offline→Online/Duplicate — ยืนยันด้วย Playwright จริงต่อ PostgreSQL จริง (ไม่ใช่ mock): Reading+ReadingImage ถูกสร้างจริง, duplicate ไม่ซ้ำจริง, previousReading/usage ถูกต้องจริง — ทดสอบ 40 tests ผ่าน, typecheck/lint/build ผ่าน ยังไม่มี Auto/Background Sync, Excel, Billing, Dashboard (Phase 6 เป็นต้นไป) — **มีข้อมูลทดสอบค้างอยู่ใน PostgreSQL จริง** ดูหัวข้อ Phase 5 ด้านบนสำหรับรายละเอียดและขอคำยืนยันเรื่องการลบ
