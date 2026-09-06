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

⚠️ **ข้อมูลทดสอบยังคงอยู่ใน PostgreSQL จริงหลัง test** (4 Reading rows: ME-001/ME-002/ME-003×2 + ไฟล์ภาพ 4 ไฟล์ใน `public/upload/meter/`) — ตั้งใจไม่ลบทิ้งเพื่อให้ตรวจสอบได้ตามที่ Phase 5 spec ข้อ 15 ต้องการ ("หลัง browser test ให้ตรวจ PostgreSQL โดยตรง") รอผู้ใช้ยืนยันว่าจะให้ลบก่อนเริ่ม Phase 6 หรือไม่ — **หมายเหตุ: ผู้ใช้ยืนยันแล้วให้ลบก่อน Phase 6 เริ่ม ข้อมูลทดสอบ Phase 5 ถูกลบออกหมดแล้ว (Reading/ReadingImage 0 rows) ก่อนเริ่ม Phase 6**

---

## ✅ Phase 6 — Excel Export MVP: Implementation Decisions (2026-09-03)

**บริบท**: docs/export-format.md §6 ยังไม่ครบ (ยังไม่มีสูตรค่าไฟจริง/ไฟล์ตัวอย่างรายงานจริง) แต่ผู้ใช้อนุมัติให้ทำ Excel Export **แบบ MVP สำหรับ demo** โดยชัดเจนว่า **ห้ามคิดสูตรค่าไฟเอง** — ค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้นจึงเป็น placeholder ("-") ทั้งหมด ไม่ใช่การ implement บัญชีจริง (ดูรายละเอียดที่ export-format.md §7)

| การตัดสินใจ | เหตุผล |
|---|---|
| เลือก library `exceljs@4.4.0` (ไม่ใช่ `xlsx`/SheetJS) | รองรับ merge cell หลายชั้น + font/border/fill/numFmt ครบ ตรงกับ requirement group header 2 ชั้น ("อ่านมิเตอร์"/"ค่าไฟ") ซึ่ง SheetJS community edition ไม่รองรับ styling ระดับนี้ |
| **รับทราบ npm audit "2 moderate" บน `uuid <11.1.1`** (transitive dependency ของ exceljs, GHSA-w5hq-g745-h8pq) โดยไม่ downgrade | `npm audit fix --force` จะ downgrade exceljs เหลือ 3.4.0 (major เก่ากว่า, ฟีเจอร์น้อยกว่า) ช่องโหว่นี้ต้องการ attacker-controlled buffer เข้า uuid v3/v5/v6 ซึ่งโค้ดเราไม่เปิดช่องให้ inject ได้ (ไม่ได้เรียก uuid โดยตรงหรือรับ buffer จาก user ไปป้อน) — ความเสี่ยงจริงต่ำ เลือกคงเวอร์ชันปัจจุบันไว้ |
| Path `src/lib/export/calculation.ts` (ไม่ใช้ `src/lib/calculation/` ตามตัวอย่างใน kickoff message) | kickoff ใช้คำว่า "เช่น" (ตัวอย่าง ไม่ใช่บังคับ) และ path นี้ตรงกับที่ export-format.md §3/§5 ระบุไว้ล่วงหน้าแล้ว เลือกตาม doc เดิมเพื่อความสอดคล้อง |
| `calculateUsage()` ใน Calculation Service เป็น thin wrapper รอบ `src/lib/reading/readingMonth.ts` (ไม่เขียนสูตรซ้ำ) | สูตร `usage = confirmedValue - previousReading` ถูก lock และ implement แล้วตั้งแต่ Phase 1/3 ฝั่ง client — ป้องกันมีสูตรเดียวกัน 2 ที่ (client workflow กับ export) ที่อาจ drift ไม่ตรงกันในอนาคต |
| `calculateBilling()` return `{baseCharge:null, ftCharge:null, tax:null, total:null}` เสมอ, Excel layer render null เป็น `"-"` | ตรงตามคำสั่ง "ห้ามคิดสูตรค่าไฟเอง" แบบตรงตัวที่สุด — ไม่มี logic คำนวณใดๆ แม้แต่ demo formula ที่ดูสมเหตุสมผล เพื่อไม่ให้ใครเข้าใจผิดว่าเป็นตัวเลขจริง |
| คอลัมน์ "หน่วยที่ใช้" วางเป็นคอลัมน์เดี่ยว (ไม่ merge กลุ่ม) คั่นระหว่างกลุ่ม "อ่านมิเตอร์" กับ "ค่าไฟ" | column list ของ kickoff มีคอลัมน์นี้ชัดเจน แต่ header mockup ไม่ได้ระบุกลุ่มของมัน — ตีความตามช่องว่างที่เหลือให้สมเหตุสมผลที่สุด |
| ไม่มี Reading ในเดือนที่เลือก → API ตอบ `404 JSON {error:"NO_DATA", message:"ไม่พบข้อมูลการอ่านมิเตอร์สำหรับเดือนนี้"}` แทนการสร้างไฟล์ Excel เปล่า/Reading ปลอม | ตรงตามคำสั่งชัดเจน "ไม่ต้องสร้าง Reading ปลอมตอน Export" — client (`ExportExcelButton`) แยก JSON error ออกจาก binary xlsx ด้วย `Content-Type` header |
| `orderBy: { meterId: "asc" }` แบบง่าย แทนการ sort ผ่าน relation หลายชั้น (zone/room name) | ลดความเสี่ยงจาก Prisma nested-relation ordering ที่อาจซับซ้อนเกินความจำเป็นของ MVP — เป็นการลดความซับซ้อนที่ยอมรับได้ |
| Content-Disposition header ใช้ `filename="report.xlsx"; filename*=UTF-8''<encoded>` (dual filename) | ชื่อไฟล์เป็นภาษาไทย ต้อง encode UTF-8 ตาม RFC 6266 เพื่อให้ทุก browser ดาวน์โหลดชื่อไฟล์ถูกต้อง (ASCII fallback + UTF-8 extended param) |

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง** (`202.29.22.92:8024/rmu_meter`, DB ว่างเปล่าก่อนเริ่ม — 0 Reading):
- สร้าง Reading จริงผ่าน workflow เต็ม (ME-001, เดือนปัจจุบัน 2026-09, current=260, ไม่มี previous) → บันทึก offline → Sync → PostgreSQL มี `Reading` จริง (`status: SYNCED`)
- เปิดหน้าใหม่ (browser context ใหม่) → ปุ่ม Export Excel เลือกเดือนปัจจุบันอัตโนมัติ (ค่า default ของ `<input type="month">` ตรงกับเดือนวันนี้) → กด Export → ได้ download event จริงชื่อไฟล์ `บัญชีเรียกเก็บเงินค่าไฟฟ้า-2026-09.xlsx` ตรงตาม spec เป๊ะ
- เปิดไฟล์ .xlsx ที่ดาวน์โหลดจริงด้วย exceljs (อ่านกลับ ไม่ใช่ mock): ยืนยัน title merge แถว 1, เดือน+วันที่ออกรายงานแถว 2-3, ข้อความ placeholder แถว 4, group header "อ่านมิเตอร์"/"ค่าไฟ" ถูกต้องแถว 6-7, sub-header ครั้งหลัง/ครั้งก่อน/ค่าไฟพื้นฐาน/ค่า FT/ภาษี/รวมทั้งสิ้นถูกต้อง, แถวข้อมูล (แถว 8) มี roomName="ห้อง 101", currentValue=260, previousValue="-" (ไม่มี previous จริง), usage="-", billing ทุกคอลัมน์ = "-"
- ทดสอบ path ไม่มีข้อมูล: `curl /api/export?month=2020-01` → ได้ `404 {"ok":false,"error":"NO_DATA","message":"ไม่พบข้อมูลการอ่านมิเตอร์สำหรับเดือนนี้"}` ตรงตาม spec
- Console/page errors: ไม่มี (`[]` ทั้งสอง context)
- หลังทดสอบ: ลบ Reading/ReadingImage ทดสอบ (1 แถว) และไฟล์ภาพ `public/upload/meter/ME-001m09_2026.jpg` ออกจาก PostgreSQL/disk ตามที่ผู้ใช้ยืนยัน — DB กลับสู่ 0 Reading

**สถานะ**: ✅ ไม่มี billing formula จริงถูกสร้างขึ้น, ไม่มี accounting system/PDF/Dashboard/Admin/Resident/Advanced report/Scheduled export/Email/Cloud storage — ตรงตามข้อห้ามทั้งหมดของ Phase 6

---

## ✅ Phase 6B — Billing Calculation + Settings + Explanation: Implementation Decisions (2026-09-03)

**บริบท**: Phase 6 ทิ้ง `calculateBilling()` เป็น stub คืน null ทั้งหมดไว้ตั้งใจ (ไม่มีสูตรจริง) — Phase 6B เติมสูตรจริงเข้ามา แต่ผู้ใช้ระบุชัดเจนว่านี่คือ **"สูตรเบื้องต้นที่แกะจากเอกสารตัวอย่าง" ไม่ใช่สูตรทางการ** และห้าม hard-code ตัวเลขนี้ใน Calculation Logic — ต้องเก็บเป็น "Billing Configuration" ที่ปรับได้

| การตัดสินใจ | เหตุผล |
|---|---|
| แยก `src/lib/billing/` (types/defaultConfig/tierValidation/explanation/breakdown) ออกจาก `src/lib/export/calculation.ts` (Calculation Service เดิม) | Calculation Service รับ `BillingConfig` เป็น parameter เท่านั้น ไม่มีตัวเลขอัตราใดๆ ฝังอยู่ในไฟล์นั้นเลย — ตัวเลขจริงมีที่เดียวคือ `defaultConfig.ts` ตรงตามคำสั่ง "ห้าม hard-code ค่าเหล่านี้ใน Calculation Logic" |
| ค่าไฟพื้นฐาน = ค่าฐานคงที่ + ผลรวมตามช่วงอัตราแบบ progressive/graduated bracket มาตรฐาน (เหมือนขั้นบันไดภาษีเงินได้) | ผู้ใช้สั่งชัดเจนว่า "หากสูตร Progressive Tier แบบทั่วไปไม่สามารถ reproduce ตัวเลขในเอกสารได้พอดี อย่าฝืนแก้สูตรเพื่อให้ Test ผ่าน" — เลือก implementation ที่ง่ายและตรงไปตรงมาที่สุด ไม่ปรับแต่งให้ตรงกับตัวอย่างในเอกสารเป๊ะ |
| ไม่มี previousReading → billing ทั้งชุด (`baseCharge/ft/tax/total`) เป็น null ทั้งหมด ไม่ใช่แค่ `usage` | ค่าไฟพื้นฐานมีทั้งส่วนคงที่และส่วนตาม usage ผสมกัน — ถ้าโชว์แค่ส่วนคงที่ทั้งที่ไม่รู้ usage จริง จะทำให้เข้าใจผิดว่าเป็นบิลที่คำนวณได้ครบ จึงเลือกงดแสดงทั้งชุดแทน (เหมือนแนวทาง placeholder เดิมจาก Phase 6) |
| Billing Configuration เก็บใน Dexie table ใหม่ `billingConfig` (single-row, key `"singleton"`) ผ่าน `db.version(2)` ใหม่ (คง `version(1)` เดิมไว้ไม่แก้) | ตรงตามคำสั่ง "ห้ามเพิ่ม Prisma model ห้าม migration ใหม่" — ใช้ IndexedDB (Dexie) ที่มีอยู่แล้วจาก Phase 2, เพิ่ม version ใหม่แบบ non-destructive ต่อข้อมูลเดิม |
| Export ส่ง billing config จาก client ไปเป็น query param `config` (JSON) แทนที่จะให้ server มี config เป็นของตัวเอง | Billing Configuration เก็บใน IndexedDB (client-only, browser storage) — server (Next.js route, Node) เข้าถึง IndexedDB ไม่ได้ วิธีเดียวที่ทำให้ Excel กับหน้าเว็บใช้ "Calculation Service เดียวกันด้วยค่า config เดียวกัน" (ตามคำสั่ง "ห้ามมีสูตรค่าไฟอีกชุดหนึ่งใน Excel route") คือส่ง config ปัจจุบันแนบไปกับ request — ไม่ใช่สูตรที่สอง เป็นแค่ parameter เดียวกันที่ส่งข้ามชั้น client/server |
| Server fallback เป็น `DEFAULT_BILLING_CONFIG` เมื่อ query param `config` หายไปหรือ parse ไม่ได้ (ไม่ error) | เป็น enhancement ไม่ใช่ required input — ปลอดภัยกว่าการ fail export ทั้งหมดเพราะ query param เสีย/หาย ยังคงเรียก `calculateBilling()` ตัวเดียวกันเสมอ |
| tier สุดท้ายบังคับเป็น "ไม่จำกัด" (maxUnit=null) เสมอผ่าน UI logic ไม่ใช่ checkbox ให้ผู้ใช้เลือกเอง | ลดโอกาสที่ผู้ใช้ตั้งค่าผิดจน validateTiers() reject — ตรงตามคำสั่ง "กำหนด tier สุดท้ายเป็นไม่จำกัด" โดยไม่ต้องเพิ่ม UI ควบคุมซับซ้อน |
| ข้อความอธิบาย (`buildBillingExplanation`) และ breakdown (`buildBillingBreakdown`) เป็น pure function แยกจาก React component | unit-test ได้อิสระโดยไม่ต้อง render UI จริง — ตรงตาม requirement "explanation ใช้ค่าจาก config ปัจจุบัน" ที่ต้องพิสูจน์ได้ด้วย test |

**บั๊กที่พบระหว่าง browser test (เป็นปัญหาของ test script ไม่ใช่โค้ดแอป)**: การถ่าย screenshot แบบ `fullPage: true` ทันทีก่อนกดปุ่ม "บันทึกการตั้งค่า" ทำให้ click ถัดไปไม่ทำงาน (Chromium ต้อง resize/restore viewport ตอน fullPage screenshot แล้วมี race กับ action ถัดไป) — reproduce ได้แน่ชัดด้วยสคริปต์แยก (มี/ไม่มี screenshot ก่อนกด) ผลต่างชัดเจน — แก้โดยย้าย screenshot ไปถ่ายหลังกดปุ่มแทน ไม่ใช่การแก้โค้ดแอป

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง**:
- สร้าง Reading เดือนก่อน (ME-001, 200) และเดือนนี้ (ME-001, 260, previousReading=200 → usage=60) → เห็นค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้นทันทีบน saved-reading card (baseCharge=107.75, ft=5.83, tax=7.95, total=121.53 ที่ DEFAULT_BILLING_CONFIG)
- เปิด "ดูวิธีคำนวณ" เห็น breakdown ตาม tier จริง, เปิด "อธิบายการคิดค่าไฟ" เห็นสูตรที่ generate จาก config ปัจจุบัน
- Sync ทั้งสอง reading ขึ้น PostgreSQL จริงสำเร็จ
- แก้ FT=0.5, ภาษี=15%, อัตราช่วงแรก=9.99 ใน Settings → กด "บันทึกการตั้งค่า" → ข้อความยืนยันขึ้นจริง
- กด "คืนค่าเริ่มต้น" → FT กลับเป็น 0.0972 ตามเดิม
- Export Excel → เปิดไฟล์ .xlsx จริงด้วย exceljs ตรวจแถวข้อมูล: `baseCharge=107.75, ft=5.832, tax=7.9507..., total=121.53274` — **ตรงกับตัวเลขที่คำนวณบนหน้าเว็บเป๊ะ** ยืนยันว่า Excel กับ UI ใช้ Calculation Service + config เดียวกันจริง
- Console/page errors: ไม่มี (`[]`)
- หลังทดสอบ: ลบ Reading/ReadingImage ทดสอบ (2 แถว) และไฟล์ภาพทั้ง 2 ไฟล์ออกจาก PostgreSQL/disk ตามที่ผู้ใช้ยืนยัน — DB กลับสู่ 0 Reading

**สถานะ**: ✅ ไม่มี Prisma migration/model ใหม่, ไม่มี Invoice/PDF/Accounting/Payment/Admin permission/Background job/Cloud storage/Authentication/Dashboard ใหม่ — ตรงตามข้อห้ามทั้งหมดของ Phase 6B, สูตรค่าไฟยังคงระบุชัดเจนว่าเป็น "สูตรเบื้องต้นจากเอกสารตัวอย่าง" ไม่ใช่สูตรทางการทั้งใน UI และ Excel

---

## ✅ Phase 7 — Final Demo Polish: Implementation Decisions (2026-09-03)

**บริบท**: Phase สุดท้ายของ MVP Demo — ไม่มี architecture/feature ใหญ่ใหม่ เน้นความลื่นไหลของ demo, UI polish, error message, cleanup, documentation

| การตัดสินใจ | เหตุผล |
|---|---|
| แสดงค่าไฟ (ค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้น) ใน "การ์ดตรวจสอบก่อนบันทึก" (ก่อนกดยืนยัน) ไม่ใช่แค่หลังบันทึกแล้ว | Phase 7 kickoff ระบุลำดับที่ต้องเห็นบนหน้าหลักชัดเจน (...9.หน่วยที่ใช้ 10.ค่าไฟ 11.ยืนยัน) — ก่อนหน้านี้ (Phase 6B) billing breakdown แสดงเฉพาะหลัง save/ใน history เท่านั้น ใช้ `BillingBreakdownPanel` ตัวเดิม (ไม่สร้าง component ใหม่) เพียงเพิ่มเข้าไปใน section ที่มีอยู่แล้ว |
| ปุ่มเลือกมิเตอร์ตัวอย่าง (ME-001/002/003) แสดงชื่อห้อง + Zone ใต้รหัสมิเตอร์ | Phase 7 kickoff §5 ระบุชัดเจนว่าต้อง "แสดงตัวอย่าง ME-001/002/003 พร้อม Room/Zone" — ข้อมูลนี้มีอยู่แล้วใน `demoData.ts` เพียงแสดงผลเพิ่มเติม ไม่ต้องเพิ่ม data ใหม่ |
| Status badge ในหน้า History (PENDING_SYNC/SYNCED/ฯลฯ) เปลี่ยนจากข้อความล้วนเป็น badge สีตามสถานะ | Phase 7 kickoff §2 ระบุ "PENDING_SYNC / SYNCED เห็นชัด" — ใช้ชุดสีเดียวกับ `OnlineStatusBadge` ที่มีอยู่แล้ว (เขียว=SYNCED, เหลือง=PENDING_SYNC/SYNCING, แดง=SYNC_ERROR, เทา=DRAFT) เพื่อความสม่ำเสมอ |
| เพิ่ม disclaimer "สูตรเบื้องต้นจากเอกสารตัวอย่าง สามารถปรับอัตราได้ที่ตั้งค่าการคิดค่าไฟ" ใน `BillingBreakdownPanel` เอง (แสดงทุกที่ที่มีการคำนวณค่าไฟจริง) แทนที่จะแสดงแค่ใน `BillingExplanation` panel ที่ต้องกดเปิดก่อน | Phase 7 kickoff §7 (IMPORTANT) สั่งให้ต้องเห็น disclaimer นี้ — เดิมมีแค่ใน explanation panel ที่ซ่อนอยู่หลังปุ่ม "อธิบายการคิดค่าไฟ" ย้ายมาไว้จุดเดียวที่ component คำนวณใช้ร่วมกันทุกที่ (confirmation card, saved card, history) เพื่อไม่ต้องเขียนซ้ำ 3 ที่ |
| อัปเดต README.md ทั้งหมดใหม่ (สถานะจาก "Phase 0" เป็น MVP Demo เสร็จสมบูรณ์) + per-folder README ที่ค้างข้อความ "Not implemented yet" (`src/lib/sync/`, `src/lib/export/`, `src/lib/offline/`) | เอกสารเหล่านี้ค้างมาตั้งแต่ Phase 0 ไม่เคยอัปเดตทั้งที่ implement เสร็จหมดแล้วตั้งแต่ Phase 5/6/6B — Phase 7 kickoff §18 สั่งให้ตรวจสอบ documentation ให้ตรงกับสถานะจริง |
| ไม่แก้ layout/breakpoint responsive เพิ่มเติม | ตรวจแล้วว่า container `max-w-md` แบบ mobile-first ที่มีอยู่เดิมแสดงผลได้ดีทั้งบน mobile (375px) และ desktop (เป็น narrow centered card ซึ่งเป็นรูปแบบปกติของแอป mobile-first ที่เปิดบน desktop) ไม่มี horizontal overflow อยู่แล้ว (ตาราง tier settings มี `overflow-x-auto` wrapper อยู่แล้วจาก Phase 6B) — ไม่ต้องรื้อ layout ตามคำสั่ง "ห้ามเพิ่ม Architecture หรือ Feature ใหญ่" |
| ไม่พบ console.log/TODO/dead code ที่ต้องลบ | ตรวจสอบด้วย grep ทั่ว `src/` แล้ว — โค้ดจาก Phase ก่อนหน้าสะอาดอยู่แล้ว (lint ผ่านแบบไม่มี warning ตลอดมา) จึงไม่มีอะไรต้อง cleanup เพิ่มในหัวข้อนี้ |

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง — ครบ 1 scenario หลักตาม Phase 7 kickoff §16 (24 ขั้นตอน)**:
เปิดระบบ → เลือก ME-001 → เลือกเดือน (default) → เห็น Previous (200, จาก reading เดือนก่อนที่สร้างผ่าน workflow จริงไว้ล่วงหน้า) → Upload ภาพ → OCR (อ่านได้ "001234.5") → แก้ไขค่าเป็น 260 → เห็น "ใช้ไป 60 หน่วย" → เห็นค่าไฟพื้นฐาน/FT/ภาษี/รวมทั้งสิ้นในการ์ดตรวจสอบก่อนบันทึก → ยืนยัน → เห็นใน History → Offline → สร้าง Reading ที่สอง (ME-002) → เห็น PENDING_SYNC → Online → Sync → เห็น "Sync แล้ว" → เปิด "ดูวิธีคำนวณ" → เปิด "อธิบายการคิดค่าไฟ" (เห็น disclaimer) → แก้ FT เป็น 2 แล้วบันทึก → ยอดรวมเปลี่ยนจริง (121.53 → 243.69) → คืนค่าเริ่มต้น (FT กลับเป็น 0.0972) → Export Excel → เปิดไฟล์จริงตรวจ: ข้อมูล ME-001 (usage=60, baseCharge=107.75, ft=5.832, tax=7.9507, total=121.53274 — ตรงกับค่าที่เห็นบนหน้าเว็บหลัง reset เป๊ะ) และ ME-002 (ไม่มี previous → placeholder "-" ทุกคอลัมน์) — Console/page errors: ไม่มี (`[]`)

⚠️ **ข้อมูลทดสอบยังคงอยู่ใน PostgreSQL จริงหลัง test นี้ (3 Reading rows: ME-001×2, ME-002×1)** — ต่างจากทุก Phase ก่อนหน้าที่ลบทิ้งหลัง test เสมอ รอบนี้ผู้ใช้ขอให้ **เก็บไว้ก่อน** เพื่อใช้เป็นตัวอย่างข้อมูลตอน demo จริง (สร้างผ่าน workflow จริงทั้งหมด ไม่ใช่ fake data ที่ฝังตรงลง DB — ตรงตาม Phase 7 kickoff §12 "หากจำเป็นสำหรับ Demo ให้มีวิธีสร้างผ่าน workflow จริง") — ถ้าต้องการ DB ว่างเปล่าก่อน demo จริง ให้ลบ 3 rows นี้ทีหลังได้

**สถานะ**: ✅ ไม่มี Admin/Resident/Authentication/Dashboard/Advanced reporting/PDF/Payment/Accounting/Background Sync/Cloud Storage/Docker เปลี่ยนแปลงใหม่ — ตรงตามข้อห้ามทั้งหมดของ Phase 7, ไม่มีการเปลี่ยน workflow หลักหรือ architecture ใดๆ เป็นการ polish UI/documentation ล้วน

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

**Phase 5 (MVP Sync) เสร็จแล้ว**: seed reference data เข้า PostgreSQL จริง (อนุมัติแล้ว), API `/api/readings/sync` + client `syncService.ts` ทำงานครบ Online/Offline→Online/Duplicate — ยืนยันด้วย Playwright จริงต่อ PostgreSQL จริง (ไม่ใช่ mock): Reading+ReadingImage ถูกสร้างจริง, duplicate ไม่ซ้ำจริง, previousReading/usage ถูกต้องจริง — ทดสอบ 40 tests ผ่าน, typecheck/lint/build ผ่าน ยังไม่มี Auto/Background Sync, Excel, Billing, Dashboard (Phase 6 เป็นต้นไป) — ข้อมูลทดสอบถูกลบออกหมดแล้วก่อนเริ่ม Phase 6

**Phase 6 (Excel Export MVP) เสร็จแล้ว**: `/api/export?month=YYYY-MM` query PostgreSQL จริง (Reading→Meter→Room→Zone) สร้างไฟล์ `.xlsx` ด้วย exceljs ตรงตาม format ที่กำหนด (title, group header 2 ชั้น, border/numFmt/freeze/autoFilter), Calculation Service (`src/lib/export/calculation.ts`) แยกจาก Excel layout ชัดเจน, `calculateUsage()` ใช้สูตร lock เดิม, `calculateBilling()` เป็น placeholder null ทั้งหมด (ไม่มีสูตรค่าไฟจริง ตามคำสั่ง) — ยืนยันด้วย Playwright จริงต่อ PostgreSQL จริง: สร้าง Reading → Sync → Export → เปิดไฟล์จริงตรวจค่าถูกต้องครบ, ทดสอบ path ไม่มีข้อมูลได้ข้อความที่ถูกต้อง — ทดสอบ 56 tests ผ่าน, typecheck/lint/build ผ่าน ไม่มี billing formula จริง/accounting system/PDF/Dashboard/Admin/Resident/Advanced report/Scheduled export/Email/Cloud storage — ข้อมูลทดสอบถูกลบออกหมดแล้วหลัง browser test (ผู้ใช้ยืนยัน)

**Phase 6B (Billing Calculation + Settings + Explanation) เสร็จแล้ว**: `calculateBilling()` มีสูตรจริงแล้ว (ยังเป็น "สูตรเบื้องต้นจากเอกสารตัวอย่าง" ไม่ใช่สูตรทางการ) ผ่าน Billing Configuration ที่เก็บใน IndexedDB (`src/lib/offline/billingConfigRepository.ts`, ไม่มี Prisma migration ใหม่) และแก้ไขได้จาก UI ใหม่ 3 ส่วน (`BillingSettingsPanel`, `BillingExplanation`, `BillingBreakdownPanel`) — Excel export ใช้ Calculation Service + config เดียวกับ UI จริง (ส่งผ่าน query param ไม่ใช่สูตรที่สอง) — ยืนยันด้วย Playwright จริงต่อ PostgreSQL จริง: สร้าง Reading → เห็นบิล → ดูวิธีคำนวณ/อธิบาย → Sync → แก้ FT/ภาษี/อัตรา → บันทึก → ผลเปลี่ยน → Reset → Export Excel → ตัวเลขใน Excel ตรงกับหน้าเว็บเป๊ะ — ทดสอบ 97 tests ผ่าน, typecheck/lint/build ผ่าน ไม่มี Prisma migration/Invoice/PDF/Accounting/Payment/Admin permission/Background job/Cloud storage/Authentication/Dashboard ใหม่ — ข้อมูลทดสอบถูกลบออกหมดแล้วหลัง browser test (ผู้ใช้ยืนยัน)

**Phase 7 (Final Demo Polish) เสร็จแล้ว — MVP Demo เสร็จสมบูรณ์**: UI polish (ค่าไฟแสดงในการ์ดตรวจสอบก่อนบันทึก, ปุ่มเลือกมิเตอร์แสดง Room/Zone, status badge สีตามสถานะ, disclaimer สูตรเบื้องต้นแสดงทุกจุดที่มีการคำนวณค่าไฟ), อัปเดต README.md + per-folder README ที่ค้างสถานะเก่าให้ตรงกับความเป็นจริงทั้งหมด — ไม่มีการเปลี่ยน workflow หลัก/architecture — ยืนยันด้วย Playwright จริงต่อ PostgreSQL จริงครบ 1 scenario หลัก 24 ขั้นตอนตาม kickoff (เปิดระบบ→เลือกมิเตอร์→OCR→แก้ไข→เห็น usage/billing→ยืนยัน→offline→sync→ดูวิธีคำนวณ/อธิบาย→แก้ setting→reset→export→ตรวจ Excel) — ทดสอบ 97 tests ผ่าน, typecheck/lint/build ผ่าน, security check ผ่าน (.env ไม่ถูก commit, ไม่มี secret ในซอร์ส, upload dir อยู่ใน .gitignore) — **ข้อมูลทดสอบ 3 rows คงไว้ใน PostgreSQL ตามที่ผู้ใช้ขอ** (ใช้เป็นตัวอย่างตอน demo จริง, สร้างผ่าน workflow จริงทั้งหมด) — ไม่มี Admin/Resident/Authentication/Dashboard/PDF/Payment/Accounting/Background Sync/Cloud Storage เพิ่มใหม่ ตรงตามข้อห้ามทั้งหมด

---

## ✅ Role-based Routing Split (2026-09-04)

**บริบท**: ผู้ใช้ขอแบ่งระบบออกเป็น 3 บทบาทตามที่เคยวางแผนไว้ใน tech-stack.md §4 (`(role-select)/`) — หน้าแรกเดิม (meter reading workflow เต็มรูปแบบ) เปลี่ยนเป็นหน้าเลือกบทบาทแทน

| การตัดสินใจ | เหตุผล |
|---|---|
| หน้าแรก (`/`) เปลี่ยนเป็นหน้าเลือกบทบาทล้วนๆ (title/subtitle/3 ปุ่ม/footer ตามที่ผู้ใช้ระบุคำต่อคำ) | ตรงตามข้อความที่ผู้ใช้ส่งมาแบบคำต่อคำ ไม่ตีความเพิ่ม |
| Workflow การจดมิเตอร์เดิมทั้งหมด (meter lookup, OCR, billing, sync, export ฯลฯ) ย้ายไปที่ `/checker` แบบคัดลอกทั้งไฟล์ ไม่แก้ logic ใดๆ | ผู้ใช้ยืนยันชัดเจนให้ย้าย workflow เดิมทั้งหมดไปที่หน้า "ผู้จดมิเตอร์" — ป้องกันความเสี่ยงจากการรื้อ logic ที่ผ่าน browser test มาแล้วหลาย phase |
| `/admin` และ `/executive` เป็น placeholder page (ข้อความ "อยู่ระหว่างพัฒนา" + ปุ่มกลับหน้าเลือกบทบาท) เท่านั้น ยังไม่มี logic ใดๆ | ผู้ใช้ยืนยันให้ทำ placeholder ก่อน รอ spec รายละเอียดในรอบถัดไป (เช่นเดียวกับที่ทุก phase ก่อนหน้าได้ spec แบบละเอียดก่อนเริ่ม) — ไม่ฝ่าฝืนข้อห้าม "ไม่ต้องสร้างหน้า Admin" ของ Phase ก่อนๆ เพราะยังไม่มีฟังก์ชันจริงใดๆ อยู่ในหน้านี้ |
| ใช้ route ธรรมดา (`src/app/admin/`, `src/app/checker/`, `src/app/executive/`) แทน route group `(role-select)` ตามที่ร่างไว้ใน tech-stack.md เดิม | หน้าแรกอยู่ที่ `/` อยู่แล้วโดยธรรมชาติ ไม่จำเป็นต้องใช้ route group (ซึ่งมีไว้จัดกลุ่มไฟล์โดยไม่กระทบ URL) เมื่อมีแค่หน้าเดียวที่ root — เลือกความเรียบง่ายกว่า |

**ทดสอบ**: Playwright สมัยจริงต่อ dev server จริง — หน้าแรกแสดงข้อความครบ (title/subtitle/3 ปุ่ม/footer), กด "ผู้จดมิเตอร์" ไปหน้า `/checker` ได้ (workflow เดิมทำงานปกติ, เห็นปุ่ม ME-001), ลิงก์ "เปลี่ยนบทบาท" กลับหน้าแรกได้, กด "ผู้ดูแลระบบ"/"ผู้บริหาร" ไปหน้า placeholder ได้ถูกต้อง — ไม่มี console/page error, `npx tsc --noEmit`/`npm run lint`/`npm test` (97 tests)/`npm run build` ผ่านทั้งหมด (build แสดง route `/`, `/admin`, `/checker`, `/executive` ครบ)

**สถานะ**: ✅ ไม่มีการแก้ไข business logic ใดๆ ของ meter reading/billing/sync/export — เป็นการจัดวาง routing/UI ล้วน

---

## ✅ /admin — Data Management (Dashboard + Meter/Zone/Room CRUD + User CRUD) (2026-09-04)

**บริบท**: ผู้ใช้ขอให้หน้า `/admin` (เดิมเป็น placeholder) เป็นหน้าจัดการข้อมูลจริง แบ่งเป็น 3 แท็บ: Dashboard, จัดการมิเตอร์, ข้อมูลผู้ใช้งาน — ยืนยัน scope แล้วว่าทั้งจัดการมิเตอร์และข้อมูลผู้ใช้งานต้องเป็น **CRUD เต็มรูปแบบ** (ไม่ใช่แค่ดูอย่างเดียว) และ Dashboard แสดง**สรุปตัวเลขรวม**

| การตัดสินใจ | เหตุผล |
|---|---|
| ไม่มี Prisma migration ใหม่ — ใช้ Zone/Room/Meter/User model เดิมที่มีอยู่แล้วครบ | Field ที่ต้องการ (name, residentName, zoneId, code, roomId, role) มีอยู่ใน schema เดิมทั้งหมดตั้งแต่ Phase 1 |
| API routes ใหม่ทั้งหมดอยู่ใต้ `src/app/api/admin/**` (แยกจาก `readings/sync` และ `export` เดิมโดยสิ้นเชิง) | ไม่แตะ route/logic เดิมที่ผ่าน browser test มาแล้วหลาย phase ตามหลัก "ต่อยอด ไม่รื้อของเดิม" ที่ยึดมาตลอดโปรเจกต์ |
| "จัดการมิเตอร์" 1 แท็บ จัดการ 3 entity (Zone/Room/Meter) พร้อมกันในหน้าเดียว แทนที่จะแยกเป็น 3 แท็บย่อย | Zone→Room→Meter เป็นลำดับชั้นที่พึ่งพากัน (Room ต้องเลือก Zone, Meter ต้องเลือก Room) การจัดการแยกหน้าจะทำให้ต้องสลับหน้าไปมาเพื่อสร้างข้อมูลที่อ้างอิงกัน — เก็บไว้หน้าเดียวแล้วแชร์ state (fetch ครั้งเดียว, refetch ทั้งหมดหลังแก้ไขใดๆ) ทำให้ dropdown ของ Room/Meter อัปเดตทันทีเมื่อมีการเพิ่ม Zone/Room ใหม่ |
| ลบ (DELETE) ถูกบล็อกถ้ามีข้อมูลลูกผูกอยู่ (Zone มี Room, Room มี Meter, Meter มี Reading, User มี Reading) พร้อมข้อความไทยระบุจำนวนที่ผูกอยู่ | ป้องกัน foreign key constraint error ดิบๆ จาก PostgreSQL ไม่ให้หลุดถึงผู้ใช้ — Prisma schema ไม่ได้ตั้ง cascade delete ไว้ (ตั้งใจตั้งแต่ Phase 1 ไม่ให้ลบข้อมูลจริงหายไปเงียบๆ) จึงต้อง check เองที่ระดับ API ก่อน แล้วแปลเป็นข้อความที่เข้าใจง่าย |
| ทุก POST/PATCH/DELETE คืนค่า list ที่ query สดใหม่ทั้งหมดของ entity นั้น (ไม่ใช่แค่ record เดียวที่เพิ่ง insert/update) | ลด round-trip ฝั่ง client — component แค่แทนที่ state ทั้งก้อนด้วยสิ่งที่ server ส่งกลับ ไม่ต้องเขียน logic merge ที่ผิดพลาดได้ง่าย (data volume ในระบบนี้เล็กมาก ไม่กระทบ performance) |
| ไม่มี auth/permission gate บนหน้า `/admin` หรือ API routes เหล่านี้ | สอดคล้องกับ MVP ทั้งระบบที่ยังไม่มี login จริง (requirement.md §2: "ยังไม่ทำ Login จริง") — เป็นเงื่อนไขเดิมที่ยึดมาตลอด ไม่ใช่การผ่อนคลาย security ใหม่ |
| Validation แยกเป็น pure function ใน `src/lib/admin/validation.ts` (validateRequiredString, validateOptionalString, isValidRole) ใช้ร่วมกันทั้ง 4 entity | unit-test ได้อิสระจาก DB/route ตามแบบแผนเดิมของโปรเจกต์ (เหมือน parseMonthParam, calculateUsage ฯลฯ) |

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง**: Dashboard แสดงตัวเลขถูกต้องตรงกับ DB จริง → สร้าง/แก้ไข Zone → สร้าง/แก้ไข Room (ผูกกับ Zone ที่เพิ่งแก้ไข) → สร้าง/แก้ไข Meter (ผูกกับ Room ที่เพิ่งสร้าง) → **ทดสอบ delete guard จริง**: ลบ Room ที่มี Meter ผูกอยู่ถูกบล็อกด้วยข้อความ "ไม่สามารถลบห้องพักนี้ได้ เนื่องจากมีมิเตอร์ผูกอยู่..." (ยืนยันด้วย server ตอบ 409 จริง, ข้อมูลไม่หาย) → ลบ Meter → ลบ Room → ลบ Zone ตามลำดับสำเร็จ → สร้าง/แก้ไข/ลบ User สำเร็จ → ตรวจ PostgreSQL ยืนยันว่าข้อมูลทดสอบทั้งหมดถูกลบสะอาด กลับสู่ค่าเดิมก่อนทดสอบ (2 zones, 3 rooms, 3 meters, 1 user) — ไม่มี error ที่ไม่คาดคิด (409 ที่ปรากฏใน console เป็นพฤติกรรมที่ตั้งใจจากการทดสอบ delete guard) — `npx tsc --noEmit`/`npm run lint`/`npm test` (106 tests, +9 จาก validation.test.ts)/`npm run build` ผ่านทั้งหมด (build แสดง 8 route ใหม่ใต้ `/api/admin/**` ครบ)

**สถานะ**: ✅ ไม่มี Prisma migration ใหม่, ไม่แตะ business logic การจดมิเตอร์/billing/sync/export เดิม, ไม่มี auth/permission system ใหม่

---

## ✅ Zone/Room Cascade Delete (2026-09-04)

**บริบท**: ผู้ใช้ขอให้ลบ Zone/Room ได้ทันทีแม้มีข้อมูลผูกอยู่ (ห้องพัก/มิเตอร์/ผู้เข้าพัก) — เดิม (delete guard) บล็อกการลบถ้ามีข้อมูลลูกผูกอยู่ ยืนยัน scope แล้วว่าต้อง **ลบพ่วงลงไปถึงประวัติการอ่านมิเตอร์ (Reading)** และต้อง **แจ้งจำนวนที่จะถูกลบให้ชัดเจนก่อนยืนยัน**

| การตัดสินใจ | เหตุผล |
|---|---|
| ลบแบบ cascade ด้วย application code ภายใน `prisma.$transaction` (`src/lib/admin/cascadeDelete.ts`) แทนการเพิ่ม `onDelete: Cascade` ใน schema + migration ใหม่ | หลีกเลี่ยงการเปลี่ยน referential-integrity ระดับ schema บน PostgreSQL จริงที่ใช้งานอยู่ (โปรเจกต์นี้ปฏิบัติต่อ migration เป็นการตัดสินใจสำคัญมาตลอด) — application-level cascade ให้ผลลัพธ์เดียวกันโดยไม่แตะ schema, และยังต้องมี application code อยู่ดีเพื่อลบไฟล์ภาพจริงบน disk (schema cascade ทำแค่ระดับ DB ไม่ลบไฟล์ให้) |
| ลำดับการลบ: SyncLog → ReadingImage → Reading → Meter → Room → (Zone) ทั้งหมดใน 1 transaction แล้วค่อยลบไฟล์ภาพจริงบน disk **หลัง** transaction commit สำเร็จ | ป้องกันกรณี DB delete บางส่วนสำเร็จบางส่วนไม่สำเร็จ (atomicity) — ลบไฟล์หลัง commit เท่านั้นเพื่อไม่ให้ไฟล์หายไปก่อนที่จะรู้ว่า DB transaction จะสำเร็จจริงหรือไม่ (best-effort, ไม่ throw ถ้าไฟล์หายไปแล้ว) |
| Meter และ User ยังคง delete guard เดิม (บล็อกถ้ามีประวัติผูกอยู่) ไม่เปลี่ยน | ผู้ใช้ระบุเจาะจงแค่ Zone/Room เท่านั้น — การลบ Meter/User โดยตรงยังต้องการความระมัดระวังเท่าเดิม |
| แจ้งเตือนก่อนลบด้วยจำนวนจริงที่คำนวณจาก state ที่ client โหลดไว้แล้ว (`zones`/`rooms`/`meters` ใน `MeterManagement.tsx`) ไม่เรียก API เพิ่ม | ข้อมูลทั้งหมดที่ต้องใช้คำนวณ impact (จำนวนห้อง/มิเตอร์/reading) มีอยู่แล้วใน state ที่โหลดมาแสดงตารางอยู่แล้ว ไม่จำเป็นต้องเพิ่ม endpoint ใหม่แค่เพื่อ preview count |

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง** (ใช้ข้อมูลทดสอบที่สร้าง/ลบเองทั้งหมด ไม่แตะข้อมูล demo ที่เก็บไว้จาก Phase 7):
- ลบ Zone ที่มี Room+Meter (ไม่มี Reading) → confirm dialog แสดง "จะลบห้องพัก 1 ห้อง, มิเตอร์ 1 เครื่อง และประวัติการอ่านมิเตอร์ 0 รายการ" ถูกต้อง → ลบสำเร็จทั้งหมด
- สร้าง Reading+ReadingImage+SyncLog จริง (พร้อมไฟล์ภาพจริงบน disk) ผูกกับมิเตอร์ทดสอบ แล้วลบ Zone ที่ผูกอยู่ → confirm dialog แสดง "ประวัติการอ่านมิเตอร์ 1 รายการ" ถูกต้อง → หลังลบ: ตรวจ PostgreSQL ยืนยัน Reading/ReadingImage/SyncLog หายหมด, **ไฟล์ภาพจริงบน `public/upload/meter/` ถูกลบออกจริง**, จำนวน Reading รวมกลับสู่ 3 (ข้อมูล demo เดิมไม่กระทบ)
- Console/page errors: ไม่มี (`[]` ทุกครั้ง) — `npx tsc --noEmit`/`npm run lint`/`npm test` (106 tests)/`npm run build` ผ่านทั้งหมด

**สถานะ**: ✅ ไม่มี Prisma migration ใหม่ — Zone/Room ลบพ่วงได้จริงตามคำขอ, Meter/User ยังมี delete guard เดิม, ข้อมูล demo ที่เก็บไว้จาก Phase 7 ไม่ถูกกระทบ

---

## ✅ Meter Table — Grouped by Zone + Zone Filter + Search (2026-09-04)

**บริบท**: ผู้ใช้ขอปรับตาราง "มิเตอร์ (Meter)" ในแท็บจัดการมิเตอร์ ให้แบ่งแสดงตามโซน มีตัวกรองเลือกโซน และช่องค้นหาห้องพัก/รหัสมิเตอร์

| การตัดสินใจ | เหตุผล |
|---|---|
| กรอง/จัดกลุ่มทำที่ client (`useMemo` ใน `MeterManager.tsx`) จาก state ที่โหลดมาแล้ว ไม่เพิ่ม query param ฝั่ง API | ข้อมูล meters/zones ทั้งหมดถูกโหลดมาแสดงอยู่แล้วใน `MeterManagement.tsx` (data volume เล็ก) ไม่จำเป็นต้อง round-trip API เพิ่มสำหรับ filter/search |
| จัดกลุ่มเรียงตามลำดับของตาราง Zone จริง (ไม่ใช่ alphabetical) และซ่อนกลุ่มที่ไม่มีมิเตอร์ตรงเงื่อนไข | ให้ตรงกับลำดับที่ผู้ใช้เห็นในตาราง "โซน (Zone)" ด้านบนอยู่แล้ว ลดความสับสน |
| ค้นหาจับคู่แบบ substring (case-insensitive) กับทั้ง `roomName` และ `code` พร้อมกัน ไม่แยกช่องค้นหา 2 ช่อง | ตรงตามคำขอ "พิมพ์ค้นหาห้องพักได้ หรือ พิมรหัสมิเตอร์ได้" — ช่องเดียวค้นหาได้ทั้งสองแบบ ไม่ต้องสลับโหมด |
| ตัดคอลัมน์ "โซน" ออกจากแถวข้อมูลของแต่ละกลุ่ม (เหลือแค่ รหัสมิเตอร์/ห้องพัก/จำนวนประวัติ) เพราะชื่อโซนแสดงเป็นหัวกลุ่มอยู่แล้ว | ลด redundant ข้อมูลซ้ำในตาราง |
| ตัวกรอง/ค้นหามีผลเฉพาะตารางแสดงผลด้านบน ไม่กระทบฟอร์มเพิ่ม/แก้ไขมิเตอร์ด้านล่าง (ยังเลือกได้ทุกห้อง) | ฟอร์มเพิ่ม/แก้ไขต้องเลือกห้องพักที่มีอยู่จริงทั้งหมดเสมอ ไม่ใช่แค่ที่กรองอยู่ |

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง** (ข้อมูลทดสอบของตัวเองทั้งหมด ไม่แตะโซนจริงของผู้ใช้ที่กำลังตั้งค่าอยู่ - "บ้านพัก", "วรุณ 1-4"): สร้าง 2 โซนทดสอบพร้อมห้อง+มิเตอร์คนละโซน → ยืนยันตารางแบ่งกลุ่มตามโซนถูกต้อง → กรองเลือกโซนเดียวเห็นแค่กลุ่มนั้น → ค้นหาด้วยรหัสมิเตอร์เห็นแค่แถวที่ตรง → ค้นหาด้วยชื่อห้องพักเห็นแค่แถวที่ตรง → ลบข้อมูลทดสอบทิ้งหมด (cascade ผ่านฟีเจอร์ที่เพิ่งทำ) → ตรวจ PostgreSQL ยืนยันเหลือแค่โซนจริงของผู้ใช้ 5 โซนเดิม ไม่มีอะไรหลงเหลือ — ไม่มี error, `tsc`/`lint`/`test` (106 tests) ผ่านทั้งหมด

**สถานะ**: ✅ ไม่มีการเปลี่ยน API/schema ใดๆ — เป็นการปรับ client-side display logic ล้วน

---

## ✅ Add Meter — Moved to Room Row (2026-09-04)

**บริบท**: ผู้ใช้ขอตัดฟอร์ม "เพิ่มมิเตอร์ใหม่" ที่ท้ายตาราง Meter ออก แล้วเพิ่มปุ่ม "เพิ่มมิเตอร์" ในแต่ละแถวของตาราง "ห้องพัก (Room)" แทน (ข้าง "แก้ไข")

| การตัดสินใจ | เหตุผล |
|---|---|
| เพิ่มฟอร์มแบบ inline (แถวย่อยใต้แถวห้องพักนั้นๆ) แทนการเปิด modal/dialog | ห้องพักที่จะเพิ่มมิเตอร์ให้รู้อยู่แล้วจากบริบทของแถวที่กด ไม่ต้องเลือกห้องซ้ำ — ฟอร์มมีแค่ช่องเดียว (รหัสมิเตอร์) จึงพอดีกับ inline row ไม่ต้องใช้ modal |
| `MeterManager.tsx` เหลือแค่ "แก้ไข"/"ลบ" มิเตอร์ที่มีอยู่แล้ว (เอา flow "เพิ่ม" ออกทั้งหมด รวม `createMeter` import) | ตรงตามคำขอ "ตัดส่วนเพิ่มมิเตอร์ออก" — ฟอร์มแก้ไขยังต้องมีอยู่ (เปลี่ยนรหัส/ย้ายห้องของมิเตอร์เดิม) แต่ไม่มีทางเข้าสำหรับ "สร้างใหม่" จากตารางนี้อีกต่อไป |
| ปุ่ม "เพิ่มมิเตอร์" ของ Room เรียก `createMeter()` เดิมจาก `src/lib/admin/adminApi.ts` (ฟังก์ชันเดียวกับที่ MeterManager เคยใช้) แล้ว `onChange()` เพื่อ refetch ทั้งหมด | ไม่สร้างสูตร/endpoint ใหม่ซ้ำ ใช้ของเดิมที่มีอยู่แล้ว — refetch ทั้งหมดทำให้ตาราง Meter ด้านล่างอัปเดตกลุ่ม/จำนวนถูกต้องทันที |

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง** (ข้อมูลทดสอบของตัวเอง ไม่แตะข้อมูลจริงของผู้ใช้ — 5 โซน/9 ห้องพักที่มีชื่อผู้พักอาศัยจริงอยู่แล้ว): ยืนยันฟอร์ม "เพิ่มมิเตอร์ใหม่" แบบเดิมหายไปจากตาราง Meter แล้ว → กดปุ่ม "เพิ่มมิเตอร์" บนแถวห้องพักทดสอบ → กรอกรหัสมิเตอร์ → บันทึกสำเร็จ ปรากฏในตาราง Meter ที่จัดกลุ่มตามโซนถูกต้อง → แก้ไขมิเตอร์ตัวเดิมผ่านปุ่ม "แก้ไข" ในตาราง Meter ยังทำงานปกติ → ลบข้อมูลทดสอบทั้งหมด (cascade) → ตรวจ PostgreSQL ยืนยันเหลือแค่ข้อมูลจริงของผู้ใช้เดิม (5 zones, 9 rooms, 0 meters) ไม่มีอะไรหลงเหลือ — ไม่มี error, `tsc`/`lint`/`test` (106 tests)/`build` ผ่านทั้งหมด

**สถานะ**: ✅ ไม่มีการเปลี่ยน API/schema ใดๆ — ย้าย UI entry point ของการสร้าง Meter เท่านั้น ฟังก์ชัน backend เดิมไม่เปลี่ยน

---

## ✅ User Management Redesign — Modal + Username/Password + Responsible Zones (2026-09-04)

**บริบท**: ผู้ใช้ขอปรับแท็บ "ข้อมูลผู้ใช้งาน" ให้กดปุ่ม "เพิ่มผู้ใช้งาน" แล้วเปิดเป็น modal ฟอร์ม พร้อมเก็บ username/password และแบ่งโซนที่รับผิดชอบ (หลายโซนต่อผู้ใช้ 1 คนได้) — งานนี้**ต้องแก้ Prisma schema จริงและรัน migration บน PostgreSQL จริง** เพราะ field เหล่านี้ไม่เคยมีมาก่อน

### Schema เปลี่ยนแปลง (migration `20260904050834_add_user_credentials_and_responsible_zones`)
- `User.username` — `String? @unique` (nullable ที่ระดับ DB เพราะ user เดิมที่มีอยู่แล้วไม่มีค่านี้ — บังคับ required ที่ระดับ API สำหรับ user ใหม่/แก้ไข)
- `User.passwordHash` — `String?` เก็บ hash เท่านั้น ไม่เคยเก็บ/ส่ง plaintext
- ความสัมพันธ์ many-to-many `User.responsibleZones` ↔ `Zone.users` (implicit join table ของ Prisma ชื่อ `_UserResponsibleZones`) — ผู้ใช้ 1 คนรับผิดชอบได้หลายโซน, 1 โซนมีผู้รับผิดชอบได้หลายคน
- **Migration เป็นแบบ additive ล้วน** (เพิ่ม column nullable + ตาราง join ใหม่) ตรวจด้วย `prisma migrate diff` ก่อนรันจริงแล้วว่าไม่มีการลบ/แก้ข้อมูลเดิม — รันผ่าน `prisma migrate deploy` (non-interactive) แทน `migrate dev` เพราะ environment นี้รันแบบ non-interactive ไม่ได้ — ตรวจแล้วว่า user เดิม (`demo-user-1`) และข้อมูลจริงของผู้ใช้ (5 zones/9 rooms) ไม่ได้รับผลกระทบ

| การตัดสินใจ | เหตุผล |
|---|---|
| **Hash password ด้วย Node built-in `crypto.scrypt`** (salted, `src/lib/admin/password.ts`) แทนการเก็บ plaintext หรือเพิ่ม dependency เช่น bcrypt | เก็บ password เป็น plaintext เป็นช่องโหว่ความปลอดภัยที่ยอมรับไม่ได้ไม่ว่าระบบจะยังไม่มีฟีเจอร์ login จริงหรือไม่ — เลือก `crypto` ในตัวของ Node แทนเพิ่ม dependency ใหม่ เพราะไม่มีฟีเจอร์ login ให้ verify ในตอนนี้ (YAGNI สำหรับ `verifyPassword`) และ scrypt เป็นอัลกอริทึมที่ปลอดภัยเพียงพอสำหรับ use case นี้ |
| `passwordHash` **ไม่เคย include ใน `UserDTO`** และ API มี mapping แบบ field-by-field ชัดเจน (ไม่ใช้ Prisma object ตรงๆ) | ป้องกันไม่ให้ hash หลุดไปที่ client โดยไม่ตั้งใจแม้จะมีคนมาเพิ่ม field ใหม่ใน schema ภายหลัง — การ map เอง (ไม่ spread object) บังคับให้ทุก field ที่ expose ต้องเขียนชื่อไว้ตรงๆ |
| แก้ไขผู้ใช้งาน: ช่อง password เว้นว่างได้ = ไม่เปลี่ยน password เดิม | ฟอร์มแก้ไขไม่ควรบังคับให้กรอก password ใหม่ทุกครั้งที่แค่จะแก้ชื่อ/บทบาท/โซน — ตรงตาม UX ทั่วไปของฟอร์มแก้ไขบัญชีผู้ใช้ |
| โซนที่รับผิดชอบใช้ checkbox list (ไม่ใช่ `<select multiple>`) ใน modal | เลือกได้ชัดเจนกว่า, เห็นทุกตัวเลือกพร้อมกัน ไม่ต้องกด Ctrl/Cmd ค้างแบบ native multi-select ซึ่งไม่ friendly บนมือถือ/ทัชสกรีน |
| Modal เป็น component ใหม่ที่เรียบง่าย (fixed overlay + close on backdrop/ปุ่ม ✕ ไม่มี focus-trap library) | ตรงตามแนวทาง "ไม่ต้องทำ UI ซับซ้อน" ที่ยึดมาตลอดโปรเจกต์ — ใช้ซ้ำได้ถ้ามีการเพิ่ม modal อื่นในอนาคต |
| Username ซ้ำ → 409 DUPLICATE ด้วยข้อความ "มี Username นี้อยู่แล้วในระบบ" (จับจาก Prisma P2002) | ตรงตาม pattern เดิมของ error handling ในโปรเจกต์นี้ (เหมือน Meter.code unique) |

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง**: เปิด modal เพิ่มผู้ใช้งานสำเร็จ → กรอกชื่อ/username/password/บทบาท/เลือก 2 โซนจริง ("บ้านพัก", "วรุณ 1") → บันทึกสำเร็จ, modal ปิด, ตารางแสดง username/บทบาท/โซนถูกต้อง → เปิดแก้ไข ยืนยัน checkbox โซนติ๊กตรงกับที่บันทึกไว้จริง → แก้ไขชื่อโดยเว้น password ว่างไว้ สำเร็จ (password เดิมไม่เปลี่ยน) → สร้าง username ซ้ำถูกปฏิเสธด้วยข้อความที่ถูกต้อง (409) → ลบผู้ใช้ทดสอบสำเร็จ → ตรวจ PostgreSQL ตรงๆ ยืนยัน `passwordHash` เป็น hash จริง (`salt:hash` แบบ hex) ไม่ใช่ plaintext และไม่เคยหลุดออกมาใน API response เลย — ไม่มี error ที่ไม่คาดคิด, `tsc`/`lint`/`test` (112 tests, +6 จาก password.test.ts และ validateZoneIds)/`build` ผ่านทั้งหมด

**สถานะ**: ✅ Prisma migration ใหม่ถูก apply บน PostgreSQL จริงแล้ว (additive เท่านั้น ไม่มีข้อมูลเดิมเสียหาย), ไม่มี login/authentication feature ใหม่ (username/password เก็บไว้เป็นข้อมูล ยังไม่ได้ใช้ยืนยันตัวตนจริง), password ไม่เคยถูกเก็บ/ส่งเป็น plaintext

---

## ✅ แท็บ "ประวัติการจดมิเตอร์" (2026-09-04)

**บริบท**: ผู้ใช้ขอเพิ่มแท็บใหม่ในหน้า `/admin` แสดงประวัติการจดมิเตอร์ทั้งหมดเป็นตาราง มีตัวกรอง/ค้นหา และปุ่มดูประวัติย้อนหลังทั้งหมดต่อรายการ พร้อมกำหนดรูปแบบ "รอบ" การจดมิเตอร์เป็น `MM/BBBB` (เดือน 2 หลัก/ปี พ.ศ.) เช่น มกราคม 2569 = `01/2569`

| การตัดสินใจ | เหตุผล |
|---|---|
| ตารางหลักแสดง **1 แถวต่อ 1 มิเตอร์** (สรุปรอบล่าสุด + จำนวนรอบทั้งหมด) แทนที่จะแสดงทุก Reading แบบ flat list | ตรงตามคำขอ "ปุ่มของรายการเมื่อกดแล้วแสดงรายการย้อนหลังทั้งหมด" — ต้องมีมุมมองสรุปก่อน แล้วค่อย "ดูประวัติทั้งหมด" ของรายการนั้นแยกออกมา ถ้าตารางหลักแสดงทุก reading อยู่แล้วปุ่มนี้จะไม่มีความหมาย |
| กดปุ่ม "ดูประวัติทั้งหมด" แล้วขยายเป็นตารางย่อยใต้แถวเดิม (ไม่เปิดหน้าใหม่/modal) | สอดคล้องกับรูปแบบ expand/collapse ที่มีอยู่แล้วในระบบ (BillingBreakdownPanel, RoomManager's เพิ่มมิเตอร์) — ไม่ต้องนำทางออกจากตารางหลัก |
| สร้าง `src/lib/admin/period.ts` (`formatReadingPeriod`) แยกจาก `formatMonthThai` เดิมใน `src/lib/reading/readingMonth.ts` | รูปแบบ `MM/BBBB` เป็นความต้องการเฉพาะของหน้า admin นี้ ต่างจาก `formatMonthThai` ("มกราคม 2569") ที่ใช้ในหน้า checker/export เดิม — แยกฟังก์ชันเพื่อไม่ปนกัน แต่ยังคง `readingMonth` (Date, UTC, วันที่ 1 ของเดือน) เป็น source เดียวกัน |
| แยก `READING_STATUS_LABEL`/`READING_STATUS_COLOR` ออกมาเป็น `src/lib/reading/readingStatusLabels.ts` ใช้ร่วมกันทั้งหน้า checker (`ReadingHistoryList.tsx`) และหน้า admin ใหม่นี้ | ลด duplicate ของ mapping เดิมที่เคยประกาศซ้ำ 2 ที่ (เดิมมีแค่ใน `ReadingHistoryList.tsx`) — ป้องกัน label/สีไม่ตรงกันในอนาคต |
| Filter/ค้นหาทำที่ client (zone dropdown + search ช่องเดียวจับคู่ห้องพักหรือรหัสมิเตอร์) เหมือน pattern ของตาราง Meter ที่ทำไปก่อนหน้า | สม่ำเสมอกับ UX ที่มีอยู่แล้วในแท็บจัดการมิเตอร์ ผู้ใช้คุ้นเคยรูปแบบเดิม ไม่ต้องเรียนรู้ใหม่ |
| API ใหม่ `/api/admin/readings` เป็น **read-only** ไม่มี edit/delete | ไม่มีการร้องขอให้แก้ไข/ลบประวัติจากแท็บนี้ — เป็นแค่มุมมองดูข้อมูลอย่างเดียว |

### ⚠️ ข้อสังเกตสำคัญที่พบระหว่างทดสอบ (ไม่ใช่บั๊กของงานนี้ แต่กระทบการใช้งานจริง)
หน้า **ผู้จดมิเตอร์ (`/checker`)** ยังคง lookup มิเตอร์จากรายการ demo ที่ hardcode ไว้ (`src/lib/meters/demoData.ts`, มี `id` ตรงกับที่ seed ไว้ตอน Phase 5 เท่านั้น) — เมื่อผู้ใช้ลบ/สร้างมิเตอร์ ME-001/002/003 ใหม่ผ่านหน้า Admin (ซึ่งได้ `id` แบบ cuid ใหม่ทุกครั้ง ไม่ใช่ `id: "ME-001"` เดิม) หน้า `/checker` จะยังคงพยายามส่ง `meterId: "ME-001"` (ค่าเดิมจาก demoData.ts) ไปที่ `/api/readings/sync` ซึ่งจะหา Meter ไม่เจอ (`METER_NOT_FOUND`, 404) แม้จะมีมิเตอร์รหัส "ME-001" อยู่จริงในระบบก็ตาม — **นี่คือช่องว่างสถาปัตยกรรมเดิมที่ Phase 3 ออกแบบไว้ (meter lookup แบบ static list) ซึ่งไม่เคยรองรับข้อมูลมิเตอร์จริงจาก Admin CRUD ที่เพิ่งสร้างขึ้น** ยังไม่ได้แก้ไขในรอบนี้เพราะอยู่นอกขอบเขตที่ขอ (เพิ่มแท็บประวัติ) — ต้องแก้ให้ `/checker` ดึงรายการมิเตอร์จริงจาก `/api/admin/meters` (หรือ endpoint สาธารณะที่เทียบเท่า) แทน static list ถ้าต้องการให้ระบบจดมิเตอร์ใช้งานกับข้อมูลจริงได้ — ควรแจ้งผู้ใช้และรอคำสั่งก่อนแก้

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง**: แทรกข้อมูล Reading ทดสอบตรงผ่าน Prisma (เพราะ `/checker` ใช้กับมิเตอร์จริงที่ผู้ใช้สร้างเองไม่ได้ตามข้อสังเกตข้างต้น) 2 รอบสำหรับ ME-001 จริง (08/2569, 09/2569) → เปิดแท็บประวัติ ยืนยันแถวสรุปแสดง จำนวนรอบ=2, รอบล่าสุด=09/2569 ถูกต้องตามรูปแบบ MM/BBBB → ค้นหาด้วยรหัสมิเตอร์เจอ → ค้นหาด้วยชื่อห้องพักเจอ → กรองตามโซนของมิเตอร์นั้นเจอ → กดดูประวัติทั้งหมดเห็นครบ 2 รอบพร้อมค่าถูกต้อง (usage=60 ในรอบล่าสุด) → ลบข้อมูลทดสอบทิ้งหมด ตรวจ PostgreSQL ยืนยันกลับสู่ 0 readings — ไม่มี error, `tsc`/`lint`/`test` (115 tests, +3 จาก period.test.ts)/`build` ผ่านทั้งหมด

**สถานะ**: ✅ ไม่มี Prisma migration ใหม่ (ใช้ Reading model เดิม), เป็น read-only view ล้วน ไม่มี edit/delete ประวัติ — พบและบันทึกข้อจำกัดสำคัญเรื่อง `/checker` ↔ Admin meter data ไม่ sync กัน ไว้ให้ผู้ใช้ตัดสินใจว่าจะแก้ในรอบถัดไปหรือไม่

---

## ✅ ห้องที่ยังไม่จดมิเตอร์ประจำเดือน (2026-09-04)

**บริบท**: ผู้ใช้ขอให้ระบบแสดงว่าห้องไหนยังไม่จดมิเตอร์ประจำเดือน โดยเลือกเดือนได้

| การตัดสินใจ | เหตุผล |
|---|---|
| วางไว้ในแท็บ **Dashboard** (ใต้การ์ดสรุปตัวเลข) ไม่สร้างแท็บใหม่ | Dashboard เป็นที่ที่ผู้ใช้ดู "ภาพรวมสถานะ" อยู่แล้ว (มี "รายการอ่านมิเตอร์เดือนนี้" เป็นตัวเลขรวมอยู่แล้ว) — ฟีเจอร์นี้คือการ drill-down ของตัวเลขนั้นเองว่า "ห้องไหนบ้าง" จึงควรอยู่ที่เดียวกัน |
| Query ด้วย Prisma relation filter `meter: { readings: { none: { readingMonth } } }` (query เดียว) แทนการดึง meter+reading ทั้งหมดมา diff ที่ client | ตรงไปตรงมา, ให้ PostgreSQL หาคำตอบให้โดยตรง ไม่ต้องโหลดข้อมูลเกินความจำเป็นมาประมวลผลฝั่ง client |
| ใช้ `parseMonthParam` เดิมจาก `src/lib/export/monthParam.ts` ซ้ำ (ไม่เขียน parser ใหม่) | เป็น pure function ทั่วไปสำหรับ parse "YYYY-MM" → Date อยู่แล้ว ไม่ผูกกับ business logic ของ export โดยเฉพาะ ใช้ซ้ำได้ปลอดภัย |
| ค่าเริ่มต้นของตัวเลือกเดือนคือเดือนปัจจุบัน + จำกัด `max` ไม่ให้เลือกเดือนอนาคต | สอดคล้องกับกฎเดิมของระบบ (`requirement.md §3.1`: ห้ามเลือกเดือนอนาคตในหน้าจดมิเตอร์) แม้ตรงนี้จะเป็นแค่ตัวกรองดูข้อมูลไม่ใช่การบันทึก แต่เดือนอนาคตก็ไม่มีความหมายให้ตรวจสอบอยู่ดี |
| เพิ่มตัวกรองโซน + ช่องค้นหา (ห้องพัก/รหัสมิเตอร์) เหมือน pattern เดิมของแท็บอื่น | สม่ำเสมอกับ UX ที่มีอยู่แล้วทั้งแท็บจัดการมิเตอร์และประวัติการจดมิเตอร์ |

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง**: เดือนปัจจุบัน (ว่างเปล่า) แสดงมิเตอร์ทั้ง 3 ตัวเป็น "ยังไม่จด" ถูกต้อง → แทรก Reading ทดสอบให้ ME-001 เดือนปัจจุบัน → รีเฟรช เหลือ ME-002/ME-003 เป็น "ยังไม่จด" (ME-001 หายไปจากรายการถูกต้อง) → เปลี่ยนเดือนเป็นเดือนก่อนหน้า (ไม่มีข้อมูลเลย) → กลับมาเห็นครบทั้ง 3 ตัว → ค้นหาด้วยรหัสมิเตอร์กรองถูกต้อง → ลบ Reading ทดสอบทิ้ง ตรวจ PostgreSQL ยืนยันกลับสู่ 0 readings — ไม่มี error, `tsc`/`lint`/`test` (115 tests)/`build` ผ่านทั้งหมด (route ใหม่ `/api/admin/readings/missing` ขึ้นครบ)

**สถานะ**: ✅ ไม่มี Prisma migration ใหม่ (ใช้ query filter เดิม), read-only ล้วน

---

## ✅ QR Code มิเตอร์ + แก้ไข /checker ให้ดึงข้อมูลจริงจาก PostgreSQL (2026-09-04)

**บริบท**: ผู้ใช้ขอ QR code ต่อมิเตอร์ 1 ตัว เพื่อให้ต้องแสกน QR ก่อนถ่ายภาพ (ป้องกันจดผิดมิเตอร์), ดาวน์โหลด/พิมพ์ได้ทั้งทีละตัวและหลายตัวพร้อมกัน (มีรหัสมิเตอร์กำกับใต้ภาพ) — ยืนยัน scope แล้วว่า: (1) แสกน QR เป็น**ทางเลือกเพิ่ม** ไม่บังคับ ยังกรอกรหัส/เลือก quick-select ได้เหมือนเดิม (2) แก้ไขให้ **`/checker` ดึงมิเตอร์จริงจาก PostgreSQL** เป็นส่วนหนึ่งของงานนี้ (จำเป็นเพื่อให้ QR ใช้กับมิเตอร์จริงได้) (3) พิมพ์ผ่าน print dialog ของ browser ไม่สร้าง PDF เอง

### ส่วนที่ 1: แก้ไข `/checker` ให้ดึงมิเตอร์จริงจาก PostgreSQL (แก้ข้อจำกัดที่บันทึกไว้ตั้งแต่ Phase "ประวัติการจดมิเตอร์")

| การตัดสินใจ | เหตุผล |
|---|---|
| เพิ่ม `GET /api/meters` (public, ไม่ใช่ `/api/admin/**`) คืนรายชื่อมิเตอร์+ห้อง+โซนทั้งหมด แทนไฟล์ static `src/lib/meters/demoData.ts` เดิม | endpoint นี้ใช้โดยหน้า `/checker` (ผู้จดมิเตอร์) ไม่ใช่หน้า Admin — คอมเมนต์เดิมใน `demoData.ts` ("Replace this with a real Meter/Room/Zone lookup once the API exists") ระบุไว้ตั้งแต่ Phase 3 ว่านี่คือของที่รอทำอยู่แล้ว |
| `findMeterByCode`/`findMeterById`/`lookupMeter` ใน `meterLookup.ts` เปลี่ยนเป็น pure function ที่รับ `meters: MeterInfo[]` เป็น parameter แทนการ import static array ตรงๆ | ยังคง unit-test ได้ง่ายเหมือนเดิมโดยไม่ต้อง mock fetch/DB — แค่ส่ง fixture array เข้าไป — และเปิดทางให้ตัวเรียก (ทั้ง `/checker` และอนาคต) ควบคุมได้ว่าจะใช้ข้อมูลชุดไหน |
| เพิ่ม cache ฝั่ง client ที่ IndexedDB (`cachedMeters` table ใหม่, Dexie version 3) — ดึงจาก server ก่อนเสมอ, ถ้าล้มเหลว (offline) ค่อย fallback ไปอ่านจาก cache ล่าสุด | **สำคัญมาก**: Offline First เป็นหลักการสถาปัตยกรรมหลักของทั้งระบบ (tech-stack.md §5) — เปลี่ยนจาก static list (ใช้ได้เสมอ) เป็น API call (ต้องมีเน็ตครั้งแรก) โดยไม่มี fallback จะทำให้ผู้จดเลือกมิเตอร์ไม่ได้เลยถ้าเปิดแอปตอนไม่มีสัญญาณ — ต้อง cache ไว้เพื่อไม่ให้ regression กับ guarantee เดิมที่มีมาตั้งแต่ Phase 2 |
| ปุ่ม quick-select เปลี่ยนจาก "เลือกมิเตอร์ตัวอย่าง (Demo)" เป็น "เลือกมิเตอร์:" แสดงมิเตอร์จริงทั้งหมดจาก DB (ไม่ใช่ ME-001/002/003 คงที่ 3 ปุ่ม) | ข้อมูลจริงมีมิเตอร์มากกว่า/น้อยกว่า/ต่างจาก 3 ตัวเดิมแล้ว (ผู้ใช้สร้าง/ลบเองผ่าน Admin) — ปุ่ม quick-select ที่ตรงกับข้อมูลจริงมีประโยชน์กว่าของปลอมที่ตายตัว |
| `ReadingHistoryList.tsx` รับ `meters: MeterInfo[]` เป็น prop เพิ่ม (สำหรับ resolve ชื่อมิเตอร์/ห้องของประวัติในเครื่อง) แทนการ import static list ตรงๆ | ประวัติในเครื่อง (IndexedDB) เก็บแค่ `meterId` — ต้อง resolve เป็นชื่อที่อ่านได้จากรายชื่อมิเตอร์ชุดเดียวกับที่หน้า `/checker` ใช้อยู่ (มาจาก fetch/cache เดียวกัน ไม่ใช่ static list อีกต่อไป) |

### ส่วนที่ 2: QR Code (generate/scan/download/print)

| การตัดสินใจ | เหตุผล |
|---|---|
| เพิ่ม dependency `qrcode@1.5.4` (+ `@types/qrcode@1.5.6`) สำหรับ generate และ `jsqr@1.4.0` สำหรับ scan/decode | ทั้งคู่เป็น pure JS ไม่มี native dependency, generate/decode ได้ทั้งฝั่ง browser — ตรวจ `npm audit` แล้วไม่มีช่องโหว่ใหม่จากทั้งสอง package (มีแค่ `uuid`/`exceljs` เดิมที่รับทราบและยอมรับไว้แล้วตั้งแต่ Phase 6) |
| QR เข้ารหัสเป็น `"METER:<code>"` (ไม่ใช่แค่ code เปล่าๆ) | ใช้ prefix เดิมที่ `parseMeterScanPayload()` รองรับอยู่แล้วตั้งแต่ Phase 3/4 (ออกแบบไว้ล่วงหน้าเผื่อวันที่มี QR จริง) — ไม่ต้องเปลี่ยน parser |
| Generate QR **ฝั่ง client ทั้งหมด** (ไม่มี API route สร้างรูปฝั่ง server) | โค้ดมิเตอร์ (`code`) มีอยู่แล้วในข้อมูลที่โหลดมาแสดงตาราง ไม่ต้อง round-trip เพิ่มแค่เพื่อสร้างรูป QR ที่คำนวณได้จาก string ธรรมดา |
| หน้าแสกน QR (`QrScanner.tsx`) วาด frame จากกล้องลง canvas แล้วรัน `jsQR` ทุก animation frame (ไม่ใช้ `BarcodeDetector` ของ browser) | `BarcodeDetector` ยังรองรับไม่ครบทุก browser (โดยเฉพาะ Safari รุ่นเก่า) — jsQR ทำงานได้แน่นอนทุกที่ที่ getUserMedia ใช้ได้ ตรงกับแนวทางเดียวกับที่ `CameraCapture.tsx`/OCR เลือกใช้ canvas snapshot อยู่แล้ว |
| แสกน QR เป็นแค่ **อีกหนึ่งวิธีเลือกมิเตอร์** (เหมือนกรอกรหัส/กด quick-select) ไม่ใช่ step บังคับแยกต่างหาก ไม่เปลี่ยน flow เดิม | ตรงตามที่ผู้ใช้ยืนยัน — เมื่อแสกนสำเร็จจะเรียก `selectMeter()` ตัวเดียวกับที่ manual lookup/quick-select ใช้ ทุกอย่างหลังจากนั้น (เดือน/ครั้งก่อน/ถ่ายภาพ/ยืนยัน) ทำงานเหมือนเดิมทุกประการ |
| หน้า "จัดการมิเตอร์" เพิ่มปุ่ม "QR" ต่อแถว (เปิด modal: รูป+รหัสกำกับใต้ภาพ+ปุ่มดาวน์โหลด/พิมพ์) และ checkbox เลือกได้หลายแถว + ปุ่ม "พิมพ์ QR ที่เลือก" | ตรงตามคำขอ "ทั้งแบบทีละตัวและหลายตัวพร้อมกัน" — ทั้งสองทางเรียกไปที่หน้าเดียวกัน (`/admin/print-qr?codes=...`) ต่างกันแค่จำนวน code ที่ส่งไป ไม่ต้องมี route/logic แยก 2 ชุด |
| หน้าพิมพ์ (`/admin/print-qr`) ใช้ `window.print()` ของ browser ล้วนๆ (ไม่เพิ่ม PDF library) | ตามที่ผู้ใช้ยืนยันเลือก — ผู้ใช้ "Save as PDF" จาก print dialog เองได้ถ้าต้องการไฟล์ |

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง**:
- **Admin QR**: สร้างมิเตอร์ทดสอบ → กดปุ่ม QR เห็นรูป+รหัสกำกับใต้ภาพถูกต้อง → ดาวน์โหลดไฟล์ `.png` สำเร็จ → พิมพ์ทีละตัวเปิดหน้าใหม่พร้อม QR ที่ถูกต้อง → ติ๊กเลือก 2 มิเตอร์แล้วพิมพ์พร้อมกันเห็นครบ 2 รูปในหน้าเดียว → ลบมิเตอร์ทดสอบ ตรวจ PostgreSQL สะอาด
- **`/checker` ใช้ข้อมูลจริง (regression test สำคัญที่สุด)**: โหลดหน้าเห็นรายชื่อมิเตอร์จริงจาก DB (ไม่ใช่ "Zone A/B" ปลอมแบบเดิมอีกต่อไป) → กดปุ่ม "แสกน QR มิเตอร์" กล้องเปิดถูกต้อง → ยกเลิกกลับมากรอกรหัสมือ ค้นหามิเตอร์จริงสำเร็จ → **สร้าง reading ผ่าน quick-select มิเตอร์จริงแล้ว sync สำเร็จจริง** (ยืนยันว่า bug เดิมที่ sync ล้มเหลวเพราะ id ไม่ตรงกันถูกแก้แล้วจริง) → ลบข้อมูลทดสอบตามที่ผู้ใช้ยืนยัน
- **Offline cache fallback**: โหลดหน้าตอนออนไลน์ (cache มิเตอร์ลง IndexedDB) → reload พร้อม intercept ให้ `/api/meters` ล้มเหลว (จำลอง offline เฉพาะ request นั้น) → รายชื่อมิเตอร์ยังแสดงถูกต้องจาก cache, ไม่มี error น่ากลัวโผล่, เลือกมิเตอร์และดำเนินการต่อได้ตามปกติ
- Console/page errors: ไม่มี (ยกเว้น network-fail log ที่ตั้งใจจำลองเอง) — `npx tsc --noEmit`/`npm run lint`/`npm test` (124 tests, +12 จาก meterLookup.test.ts ที่เขียนใหม่ + meterCacheRepository.test.ts)/`npm run build` ผ่านทั้งหมด (route ใหม่ `/api/meters`, `/admin/print-qr` ขึ้นครบ)

**สถานะ**: ✅ ไม่มี Prisma migration ใหม่ (ใช้ `Meter.code` เดิมที่มีอยู่แล้ว), แก้ข้อจำกัดสำคัญที่เคยบันทึกไว้ (`/checker` ↔ Admin meter data ไม่ sync กัน) เรียบร้อยแล้ว, Offline First ยังคงเป็นจริงสำหรับ meter lookup ด้วย cache ใหม่

---

## ✅ พิมพ์ QR เปลี่ยนจากหน้าใหม่เป็น Modal Dialog (2026-09-04)

**บริบท**: ผู้ใช้ขอให้ "ส่วนพิมพ์มิเตอร์" เป็น modal dialog แทนการเปิดแท็บใหม่ (`/admin/print-qr`) เดิม โดยเปิดผ่านปุ่ม "ปริ้น QRcode"

| การตัดสินใจ | เหตุผล |
|---|---|
| ลบ route `src/app/admin/print-qr/` ทิ้งทั้งหมด แทนที่จะเก็บไว้เผื่อใช้ | ไม่มีจุดใดใน UI ลิงก์ไปหาแล้วหลังเปลี่ยนเป็น modal — เก็บ route ที่ไม่มีอะไรลิงก์ถึงไว้จะกลายเป็น dead code |
| แยก `QrPrintGrid.tsx` (render กริด QR+รหัสกำกับ) ออกจาก `PrintQrModal.tsx` (modal chrome + ปุ่มพิมพ์) | โค้ด render QR ทั้งหมด (สร้าง data URL ต่อ code, จัดกริด) ใช้ซ้ำได้ทั้งกรณีเดี่ยวและกรณีหลายตัวโดยไม่ต้องเขียนซ้ำ |
| ใช้เทคนิค CSS "print only this element" (`.print-area` ใน `globals.css`: ซ่อนทั้งหน้าด้วย `visibility:hidden` แล้วเปิดเฉพาะกริด QR กลับมาเป็น `visibility:visible` + `position:absolute`) แทนการยกเลิก fixed overlay ของ modal ตอนพิมพ์ | Modal เดิมใช้ `position:fixed` เต็มจอ ซึ่ง browser พิมพ์ fixed element ได้ไม่แน่นอน (มักโดนตัดให้เหลือแค่หน้าเดียวหรือเพี้ยน) — เทคนิคนี้เป็นวิธีมาตรฐานที่ทำให้พิมพ์ได้ปกติโดยไม่ต้องรื้อโครงสร้าง Modal component เดิม |
| ปุ่มเปิด modal (ทั้งจากมิเตอร์ตัวเดียวใน `MeterQrModal` และหลายตัวใน `MeterManager`) ใช้คำว่า "ปริ้น QRcode" ตรงตามที่ผู้ใช้ระบุ (bulk เพิ่ม "ที่เลือก (N)" ต่อท้ายเพื่อบอกจำนวน) | ตรงตามคำขอผู้ใช้แบบคำต่อคำ |
| กด "ปริ้น QRcode" ใน `MeterQrModal` (ดู QR ทีละตัว) จะปิด modal เดิมแล้วเปิด `PrintQrModal` แทน (ไม่ซ้อน modal 2 ชั้น) | ซ้อน `fixed inset-0` สอง overlay พร้อมกันดูสับสน — ปิดอันเก่าก่อนเปิดอันใหม่ชัดเจนกว่า |

**ทดสอบจริงด้วย Playwright ต่อ PostgreSQL จริง**: กด QR ของมิเตอร์ทดสอบ 1 ตัว → กด "ปริ้น QRcode" → เปิด **modal** (ไม่ใช่แท็บใหม่ — ตรวจนับหน้าต่างที่เปิดจริง = 0 หน้าต่างใหม่) หัวข้อ modal แสดง "(1 รายการ)" ถูกต้อง → ปิดแล้วติ๊กเลือก 2 มิเตอร์ กด "ปริ้น QRcode ที่เลือก (2)" → เปิด modal เดียวกันแสดง QR 2 รูปถูกต้อง ไม่ใช่แท็บใหม่เช่นกัน → ยืนยัน `GET /admin/print-qr` ตอบ 404 จริง (route ถูกลบแล้วจริง ไม่ใช่แค่ไม่มีลิงก์ไปหา) → ลบมิเตอร์ทดสอบ ตรวจ PostgreSQL สะอาด — ไม่มี error, `tsc`/`lint`/`test` (124 tests)/`build` ผ่านทั้งหมด

**สถานะ**: ✅ ไม่มีการเปลี่ยน API/schema ใดๆ — เป็นการปรับ UI/CSS ล้วน, ฟังก์ชัน generate/download QR เดิมไม่กระทบ

---

## ✅ เปลี่ยนตัวเลือกเดือนจาก `<input type="month">` เป็น select ชื่อเดือนไทยเต็ม (2026-09-06)

**บริบท**: ผู้ใช้ขอให้ "ส่วนเลือกเดือน" ทุกที่เป็น select option ใส่ชื่อเดือนเป็นภาษาไทยแบบเต็ม ครบทั้ง 12 เดือน แทน native `<input type="month">` เดิมซึ่งเบราว์เซอร์บางตัวแสดงผล picker ไม่สม่ำเสมอ

| การตัดสินใจ | เหตุผล |
|---|---|
| สร้าง component ใหม่ `src/components/MonthYearSelect.tsx` ใช้ร่วมกันทั้ง 3 จุด (`/checker` เดือนอ่าน, `ExportExcelButton` เดือน export, `AdminDashboard` เดือนของห้องที่ยังไม่จดมิเตอร์) แทนเขียน `<select>` แยกกัน 3 ที่ | เดิม 3 ที่ทำสิ่งเดียวกัน (native month input ผูกกับ state string "YYYY-MM") — ตรงกับแนวทางที่ทำมาตลอด session นี้เมื่อพบความต้องการซ้ำ (เช่น `Modal.tsx`, `QrPrintGrid.tsx`, `readingStatusLabels.ts`) คือแยกเป็น shared component เดียว |
| ค่า/onChange ของ component ยังเป็น string "YYYY-MM" (Gregorian) เหมือนเดิมทุกประการ ไม่เปลี่ยน format ที่เก็บ | ทุก caller เดิม (`currentMonthValue()`, `isFutureMonth()`, `handleMonthChange()`, `formatMonthThai()`, `parseMonthParam()` ฝั่ง API) ทำงานกับ format นี้อยู่แล้ว — เปลี่ยนแค่ UI ไม่เปลี่ยน data contract |
| select เดือนใช้ `Intl.DateTimeFormat("th-TH", { month: "long" })` สร้างชื่อเดือนไทยเต็ม 12 เดือน (ไม่ hardcode ชื่อเดือนเป็น string ตรงๆ ในโค้ด) | สอดคล้องกับที่ `formatMonthThai()`/`formatReadingPeriod()` เดิมใช้ `Intl` อยู่แล้วสำหรับแสดงผลภาษาไทย — จุดเดียวที่พึ่งพา locale data ของ JS engine ไม่ใช่ hardcode ซ้ำอีกที่ |
| select ปีแสดง**ปี พ.ศ.** (label = ค.ศ. + 543) แต่ค่าที่เก็บภายในยังเป็นปี ค.ศ. เดิม | ผู้ใช้คิดเป็นปี พ.ศ. อยู่แล้ว (ตรงกับที่ `formatReadingPeriod`/`formatMonthThai` แสดงปี พ.ศ. ทั่วทั้งระบบ) แต่ state/API ยังใช้ปี ค.ศ. เดิมเพื่อไม่กระทบ query/validation ที่มีอยู่ |
| เมื่อมี `max` (ปีปัจจุบันตรงกับปีที่เลือก) จะจำกัด option เดือนใน select ให้เหลือถึงเดือนปัจจุบันเท่านั้น (ปีอื่นแสดงครบ 12 เดือนเสมอ) — ใช้ต่อใน `/checker` (เดิมมี `max={currentMonthValue()}`) และ `AdminDashboard` (เดิมมี `max={currentMonthValue()}` เช่นกัน) | คงพฤติกรรม "ห้ามเลือกเดือนอนาคต" เดิมไว้ทุกประการ เพียงย้ายจาก HTML `max` attribute ของ native input มาเป็น logic กรอง option ของ select เอง — `ExportExcelButton` เดิมไม่มี `max` จึงไม่ส่ง prop นี้ (ปีปัจจุบันแสดงครบ 12 เดือนเหมือนเดิม) |

**ทดสอบจริงด้วย Playwright ต่อ dev server จริง**: เข้า `/checker` เลือกมิเตอร์จริงจาก DB → ช่อง "เดือนอ่าน" เป็น `<select>` แล้ว แสดงชื่อเดือนไทยเต็ม (ตัดที่ "กันยายน" เพราะเดือนปัจจุบันคือกันยายน 2569 — ตรงตามข้อจำกัด "ห้ามเดือนอนาคต" เดิม), select ปีแสดง 2569/2568/2567/... ถูกต้อง → เลือกปีก่อนหน้าไม่มี error → `ExportExcelButton` เห็น select เดือน export ครบ 12 เดือนจริง (ไม่มีข้อจำกัด max) → เข้า `/admin` แท็บ dashboard ช่อง "ห้องที่ยังไม่จดมิเตอร์ประจำเดือน" เป็น select แล้ว ตัดที่กันยายนเช่นกัน, เลือกปีก่อนหน้าปลดล็อกครบ 12 เดือนถูกต้อง → ไม่มี console error, ไม่มีการสร้าง/ลบข้อมูลทดสอบใดๆ (เป็นการนำทางอย่างเดียว) — `npx tsc --noEmit`/`npm run lint`/`npm test` (124 tests)/`npm run build` ผ่านทั้งหมด

**สถานะ**: ✅ ไม่มีการเปลี่ยน API/schema ใดๆ — เป็นการเปลี่ยน UI ล้วน, format ค่า "YYYY-MM" เดิมไม่กระทบ

---

## ✅ ย้าย "ตั้งค่าการคิดค่าไฟ" มาเป็นแท็บใน Admin — เปลี่ยนจาก per-device เป็นค่ากลาง (2026-09-06)

**บริบท**: เดิม "ตั้งค่าการคิดค่าไฟ" อยู่เป็น panel แทรกอยู่ในหน้า `/checker` เก็บค่าไว้ใน IndexedDB ของเครื่อง/browser ที่ใช้ (แต่ละเครื่องตั้งค่าต่างกันได้) ผู้ใช้ขอให้ย้ายมาเป็นแท็บใน Admin — ถามยืนยันแล้วว่าต้องการให้เป็น **ค่ากลาง เก็บใน PostgreSQL** (ไม่ใช่แค่ย้าย UI มาแต่ยังผูกกับเครื่อง) และให้ **ตัดออกจาก `/checker` ทั้งหมด**

| การตัดสินใจ | เหตุผล |
|---|---|
| เพิ่ม model `BillingConfig` (Prisma) เป็น **1 แถวเดียวเสมอ** (`id` default `"singleton"`, เก็บ `tiers` เป็น `Json`) แทนที่จะขยาย schema เดิม | ตรงกับรูปแบบ config เดี่ยวที่ไม่มีความสัมพันธ์กับ entity อื่น — ใช้ pattern เดียวกับที่ IndexedDB เดิมใช้ (`id: "singleton"`) เพียงย้ายมาเก็บกลางที่ PostgreSQL |
| `GET /api/billing-config` เป็น **public route** (ไม่ใช่ `/api/admin/**`) ส่วน `PUT /api/admin/billing-config` อยู่ใต้ path admin | ทั้ง `/checker` และแท็บตั้งค่าใน Admin ต้อง**อ่าน**ค่าเดียวกัน — ตรงกับ pattern ของ `/api/meters` (public GET) vs `/api/admin/meters` (mutation) ที่ทำไว้ก่อนหน้านี้แล้ว ไม่ต้องมี route อ่านซ้ำ 2 ชุด |
| `src/lib/offline/billingConfigRepository.ts` (Dexie) เปลี่ยนบทบาทจาก "แหล่งข้อมูลจริง" เป็น **cache สำหรับใช้ตอน offline เท่านั้น** (`getCachedBillingConfig`/`saveCachedBillingConfig` แทน `getBillingConfig`/`saveBillingConfig`/`resetBillingConfig` เดิม) | `/checker` ยังต้องทำงานได้ตอนออฟไลน์ (หลักการ Offline First) — ใช้ pattern เดียวกับที่ `meterApi.ts`/`meterCacheRepository.ts` ทำไว้แล้วตอนเปลี่ยน meter lookup จาก static list เป็น DB จริง: fetch จาก server ก่อนเสมอ, ถ้าพลาดค่อย fallback ไป cache, ถ้า cache ก็ไม่มี (เครื่องนี้ไม่เคย fetch สำเร็จเลย) ค่อย fallback ไป `DEFAULT_BILLING_CONFIG` ในโค้ด (ไม่ block workflow การจดมิเตอร์) |
| ตัด `BillingSettingsPanel.tsx` ออกจาก `/checker` ทั้งหมด (ลบไฟล์ทิ้ง ไม่ใช่ซ่อนไว้) ย้ายไปเป็น `src/components/admin/BillingSettingsManagement.tsx` แท็บใหม่ "ตั้งค่าค่าไฟ" ใน Admin | ตรงตามที่ผู้ใช้ยืนยัน — Admin เป็น role ที่ดูแลค่ากลางของระบบ ผู้จดมิเตอร์ไม่ควรมีปุ่มแก้อัตราที่กระทบทุกเครื่องพร้อมกัน |
| ปุ่ม "คืนค่าเริ่มต้น" ในแท็บ Admin **บันทึกขึ้น PostgreSQL ทันที** (ไม่ใช่แค่เปลี่ยนค่าในฟอร์มรอกด "บันทึก" อีกที) | คงพฤติกรรมเดิมของปุ่มนี้ไว้ (กดครั้งเดียวคืนค่าเริ่มต้นจริง) — Admin เป็น role ที่ตั้งใจกดปุ่มนี้อยู่แล้ว ไม่ใช่การกดพลาดโดยไม่ได้ตั้งใจ |
| Validation (ห้ามติดลบ, ตรวจ tier ทับซ้อน/ลำดับผ่าน `validateTiers` เดิม) ทำ**ทั้งฝั่ง client และ server** (`PUT /api/admin/billing-config`) | เดิม validate แค่ฝั่ง client (เพราะเขียนตรงไปที่ IndexedDB ของตัวเอง) — ตอนนี้เป็น API endpoint ที่แก้ค่ากลางกระทบทุกเครื่อง จึงต้อง validate ฝั่ง server ด้วยเสมอ ห้ามพึ่งพา client-side validation อย่างเดียว |

**ทดสอบจริงด้วย Playwright ต่อ dev server + PostgreSQL จริง** (จับค่าปัจจุบันไว้ก่อนทดสอบ แล้วคืนค่าเดิมหลังทดสอบเสร็จ ไม่ใช่ลบข้อมูลทดสอบเพราะเป็น config แถวเดียวของระบบ ไม่ใช่ข้อมูลที่สร้าง/ลบได้):
- `/checker` ไม่มี panel "ตั้งค่าการคิดค่าไฟ" หลงเหลืออีกแล้ว
- เข้าแท็บ "ตั้งค่าค่าไฟ" ใน Admin เห็นค่าเดิมจาก PostgreSQL (FT 0.0972) → แก้ FT เป็น 1.111 + ภาษีเป็น 12% กด "บันทึกการตั้งค่า" → เห็นข้อความยืนยัน → queryตรงไปที่ `/api/billing-config` ยืนยันค่าเปลี่ยนจริงใน DB → reload หน้า Admin เห็นค่าที่บันทึกไว้ (ไม่ใช่ค่าเดิม, ไม่ใช่ค่า default)
- **ทดสอบจุดสำคัญที่สุด (ค่ากลาง ไม่ใช่ per-device)**: หลัง Admin บันทึกค่าใหม่แล้ว `/checker` ที่ fetch เอง (คนละ mount/คนละ "device" จำลอง) ได้ค่า FT 1.111 เดียวกันทันที — ยืนยันว่าเป็นค่ากลางจริง ไม่ใช่แค่ locale ต่อ browser แบบเดิม
- ทดสอบ validation: กรอก FT ติดลบ (-5) แล้วกด "บันทึก" → ขึ้น error "ค่า FT ต้องไม่ติดลบ" ฝั่ง client ทันที และตรวจยืนยันว่า DB **ไม่ถูกเขียนทับ** ด้วยค่าที่ผิด (ยังเป็น 1.111 เดิม)
- กด "คืนค่าเริ่มต้น" → ยืนยันค่าใน DB กลับไปเป็นค่า default (FT 0.0972) ตรงกับค่าที่จับไว้ก่อนเริ่มทดสอบ — ระบบไม่มีการเปลี่ยนแปลงค่าจริงหลงเหลือจากการทดสอบ
- ไม่มี console/page error — `npx tsc --noEmit`/`npm run lint`/`npm test` (122 tests — ปรับ `billingConfigRepository.test.ts` ให้ตรงกับ role cache-only ใหม่)/`npm run build` ผ่านทั้งหมด (route ใหม่ `/api/billing-config`, `/api/admin/billing-config` ขึ้นครบ)

**สถานะ**: ✅ Migration ใหม่ (`prisma/migrations/20260906213825_add_billing_config/`) เป็นการเพิ่มตารางใหม่ล้วนๆ (ไม่แก้/ลบของเดิม) — applied กับ PostgreSQL จริงแล้ว, Offline First ยังคงเป็นจริงสำหรับ billing config ด้วย cache ใหม่เช่นเดียวกับที่ทำไว้กับ meter lookup ก่อนหน้านี้

---

## ✅ /checker: ออกแบบใหม่เน้นมือถือ — Dashboard + Login จริง (2026-09-06)

**บริบท**: ผู้ใช้ขอให้ role ผู้จดมิเตอร์ (`/checker`) เน้นออกแบบสำหรับมือถือเป็นหลัก เพราะผู้จดมิเตอร์ต้องออกพื้นที่จริง โดยหน้าแรกต้องเป็น **dashboard สรุปมิเตอร์ที่ตัวเองรับผิดชอบ** (ตาม zone ที่ Admin กำหนด) มีปุ่ม "เก็บมิเตอร์" เปิดแสกน QR ทันที ส่วนกรอบช่วย OCR ที่ขอมาก็มีอยู่แล้วจาก Phase 4 (ดูด้านล่าง) — งานหลักของรอบนี้คือ dashboard + navigation ใหม่ ไม่ใช่ OCR

การจะรู้ว่า "มิเตอร์ที่ตัวเองรับผิดชอบ" ต้องรู้ว่าเครื่องกำลังใช้งานโดยใคร แต่ `/checker` ไม่มีระบบ login เลยมาก่อน (ถามผู้ใช้แล้วยืนยันให้ทำ **login จริงด้วย username/password**, จำ session ไว้ในเครื่องไม่ต้อง login ซ้ำ) และให้ย้ายส่วนประวัติ/Export/อธิบายค่าไฟไปหน้าย่อยแยก เข้าถึงผ่านลิงก์จาก dashboard

| การตัดสินใจ | เหตุผล |
|---|---|
| แยก `/checker` เดิม (647 บรรทัด, ทำทุกอย่างในหน้าเดียว) เป็น 3 route: `/checker` (dashboard, login gate), `/checker/reading?meterId=` (workflow จดมิเตอร์ทีละตัว — ของเดิมย้ายมาแทบทั้งหมด), `/checker/history` (ประวัติ/Export/อธิบายค่าไฟ) | ตรงกับโครงสร้างมือถือที่ผู้ใช้ยืนยัน: dashboard เป็นหลัก → กดมิเตอร์/แสกน QR → จดทีละตัว → กลับ dashboard; ส่วนที่ไม่ใช่งานหลักประจำวัน (ประวัติ/รายงาน) แยกออกไปไม่ให้ปนกับหน้าที่ต้องรีบใช้งานตอนอยู่หน้างาน |
| Login ใช้ `User.username`/`passwordHash` ที่มีอยู่แล้ว (เพิ่มไว้ตั้งแต่งาน Admin user management, 2026-09-04) — ไม่เพิ่ม field ใหม่ ไม่มี migration ใหม่ | โครงสร้างข้อมูลรองรับไว้แล้วล่วงหน้า (`passwordHash` มี comment เดิมว่า "required at the application layer for new users") เพียงยังไม่มีหน้า login มาใช้งานจริง |
| เพิ่ม `verifyPassword()` ใน `src/lib/admin/password.ts` (scrypt เดิม + `timingSafeEqual`) คู่กับ `hashPassword()` ที่มีอยู่แล้ว | ใช้ crypto built-in ตัวเดิม ไม่เพิ่ม dependency, constant-time compare ป้องกัน timing attack ตอน login |
| `POST /api/checker/login` จำกัดเฉพาะ `role === "METER_READER"` เท่านั้น ไม่รับ Admin/Resident login ผ่านทางนี้ | Dashboard ผูกกับความหมายของ "โซนที่รับผิดชอบ" ของผู้จดมิเตอร์โดยเฉพาะ — role อื่นล็อกอินผ่านทางนี้แล้วเห็น dashboard ที่ไม่มีความหมายกับ role ตัวเอง |
| ไม่มี session/cookie ฝั่ง server เลย — client เก็บ `{id,name,zones}` ที่ route คืนมาไว้ใน `localStorage` เฉยๆ ไม่หมดอายุ (`src/lib/checker/checkerSession.ts`) | ตรงกับจุดยืนเรื่อง auth ของทั้งระบบ (Admin panel เองก็ไม่มี auth gate) — เพิ่มแค่การตรวจรหัสผ่านจริงตอน login ครั้งแรก ไม่เพิ่มความซับซ้อนเรื่อง session ทั้งระบบ |
| `GET /api/checker/dashboard?userId=&month=` คืนเฉพาะมิเตอร์ใน `responsibleZones` ของ user นั้น พร้อม flag `readThisMonth` (มี reading ของเดือนนั้นแล้วหรือยัง) | ใช้ตรรกะเดียวกับ Admin's "ห้องที่ยังไม่จดมิเตอร์" (`/api/admin/readings/missing`) แต่ scope แค่โซนของ user คนเดียว ไม่ใช่ทั้งระบบ — ไม่มี auth token แท้จริง ผู้ใช้ (client) ต้องส่ง `userId` มาเอง ตรงกับ trust model เดียวกันกับ Admin API ทั้งหมดที่ไม่มี auth gate จริงอยู่แล้วในระบบนี้ |
| Dashboard **merge** ผลจาก server กับ local IndexedDB (`getReadings()` ของเดือนนั้น) — meter ที่จดแล้วแต่ยังไม่ sync ต้องแสดง "จดแล้ว" ทันที ไม่ใช่รอ sync สำเร็จก่อน | Server รู้จักแค่ reading ที่ sync แล้ว — ถ้าไม่ merge กับ local, checker ที่อยู่นอกพื้นที่ไม่มีเน็ต จดมิเตอร์เสร็จแล้วกลับมาที่ dashboard จะเห็นมิเตอร์ตัวเดิม "ยังไม่จด" ทั้งที่จดไปแล้วจริง — สร้างความสับสน/เสี่ยงจดซ้ำ |
| เพิ่ม cache ออฟไลน์ของ dashboard เอง (`checkerDashboard` table ใน Dexie, `src/lib/checker/checkerDashboardApi.ts` แบบ network-first-fallback-cache เดียวกับ `fetchMeters()`/`fetchBillingConfig()`) | Dashboard เป็นหน้าแรกที่ checker เจอตอนออกพื้นที่ที่สัญญาณอาจไม่มี — ต้องเปิดดูรายชื่อมิเตอร์ที่ต้องจดได้แม้ออฟไลน์ ตรงกับหลัก Offline First ที่ยึดมาตลอดทั้งระบบ |
| ลบ `src/lib/meters/demoData.ts` (`demoUser`/`resolveRecorderName` เดิม) ทั้งไฟล์ แทนที่ด้วย `src/lib/checker/resolveRecorderName.ts` ที่รับ `CheckerSession` ปัจจุบันเป็นพารามิเตอร์ | `recordedBy` ตอนบันทึก reading เปลี่ยนจาก `demoUser.id` คงที่ เป็น `session.id` ของผู้ล็อกอินจริงแล้ว — ฟังก์ชัน resolve ชื่อก็ต้องพึ่ง session จริงแทนค่าคงที่ตัวเดียว |
| `CheckerAuthGate.tsx` ใช้ render-prop (`children(session, logout)`) ไม่ใช้ React Context | มีแค่ 3 หน้าที่ต้องใช้ (dashboard/reading/history) — Context/Provider เป็นความซับซ้อนที่ไม่จำเป็นสำหรับ 3 จุดใช้งาน ทั้งระบบนี้ก็ไม่มี Context ใช้อยู่เดิมเลยที่จุดอื่น |
| กรอบช่วย OCR (ถ่ายภาพวางในกรอบ → OCR crop เฉพาะกรอบ → แสดงผลลัพธ์ → แก้ไข/กรอกเองได้) **ไม่ได้แก้ไขในรอบนี้** — มีอยู่แล้วตั้งแต่ Phase 4 (`CameraCapture.tsx` เส้นกรอบเหลือง + `DEFAULT_OCR_REGION`/`ocrProvider.ts`) | ตรวจสอบแล้วว่าตรงกับที่ผู้ใช้ขอมาทุกประการอยู่แล้ว (กรอบ, ถ่ายในกรอบ, OCR, แก้ไขค่าเอง) — ไม่มีอะไรต้องเปลี่ยน |

**ทดสอบจริงด้วย Playwright ต่อ dev server + PostgreSQL จริง** (สร้าง user ทดสอบ 1 คนผ่าน Admin API เพื่อทดสอบ login โดยไม่แตะ user จริงของผู้ใช้ "superadmin"; ลบ user ทดสอบ + reading ทดสอบหลังจบ ตามที่ผู้ใช้ยืนยัน):
- `/checker` ไม่ login → เห็นฟอร์ม login; ใส่รหัสผ่านผิด → error "Username หรือ Password ไม่ถูกต้อง"; ใส่ถูก → เข้า dashboard เห็น "สวัสดี, ทดสอบ ผู้จด E2E" + โซนที่รับผิดชอบ
- Dashboard กรองมิเตอร์ตาม responsibleZones ถูกต้อง: user ทดสอบผูกกับโซน "วรุณ 2" → เห็น ME-002/ME-003 เท่านั้น ไม่เห็น ME-001 (โซนอื่น)
- Reload หน้า → ยัง login อยู่ (session ใน localStorage ไม่หาย ไม่ต้อง login ซ้ำ)
- กดแถวมิเตอร์ ME-002 → ไปหน้า `/checker/reading?meterId=...` → ถ่ายภาพ (jpeg จริงที่ generate จาก canvas ของ browser เอง เพื่อให้ผ่าน `createImageBitmap`/OCR ได้จริง ไม่ใช่ mock ปลอม) → กรอกค่าเอง → บันทึกสำเร็จ → กด "กลับหน้าหลัก"
- **จุดสำคัญที่สุด**: กลับมาที่ dashboard **ก่อน sync** มิเตอร์ที่จดไปแล้ว (ME-003 ทดสอบแยก) แสดง "จดแล้ว" ทันที (ยืนยันว่า local-merge ทำงานถูกต้อง ไม่ต้องรอ sync ก่อนจึงเห็นสถานะถูกต้อง)
- กด "Sync ข้อมูล" จาก dashboard สำเร็จ → เข้าหน้าประวัติเห็นรายการที่จดพร้อม "บันทึกโดย ทดสอบ ผู้จด E2E" (resolve ชื่อจาก session ถูกต้อง ไม่ใช่ id ดิบ)
- กด "ออกจากระบบ" → กลับไปหน้า login ทันที
- ไม่มี console/page error (ยกเว้น 401 ที่ตั้งใจทดสอบรหัสผ่านผิด) — `npx tsc --noEmit`/`npm run lint`/`npm test` (125 tests — เพิ่ม `verifyPassword` 3 เคส)/`npm run build` ผ่านทั้งหมด (route ใหม่ `/api/checker/login`, `/api/checker/dashboard`, `/checker/reading`, `/checker/history` ขึ้นครบ)

**สถานะ**: ✅ ไม่มี Prisma migration ใหม่ (ใช้ field/schema เดิมทั้งหมด) — Dexie เพิ่ม `version(4)` เก็บ cache ของ dashboard เท่านั้น, ลบ user ทดสอบ + reading ทดสอบออกจาก PostgreSQL จริงหลังทดสอบเรียบร้อยแล้ว ยืนยันสะอาด

---

## ✅ /executive: รายงานสรุปสำหรับผู้บริหารแบบ Power BI (2026-09-06)

**บริบท**: ผู้ใช้ขอให้ role ผู้บริหาร (`/executive`, เดิมเป็นหน้า placeholder) แสดงข้อมูลสรุป รายงาน และแนวโน้มของข้อมูลทั้งหมด "ในรูปแบบ power bi" — ตีความเป็น: การ์ด KPI ด้านบน + กราฟแนวโน้ม/เปรียบเทียบหลายแผงเป็นตาราง grid + ตัวกรอง (slicer) เหมือนหน้ารายงาน Power BI ทั่วไป

| การตัดสินใจ | เหตุผล |
|---|---|
| เพิ่ม dependency `recharts@3.10.1` (pinned ตรงตามที่ทำมาตลอด ไม่ใช้ `^`) | ไลบรารีกราฟ React แบบ SVG ที่นิยมที่สุด รองรับ React 19 แล้ว (peerDependencies ยืนยัน), ไม่ต้อง import CSS แยก เข้ากับ Tailwind ได้ทันที — ตรวจ `npm audit` แล้วไม่มีช่องโหว่ใหม่จาก recharts เอง (2 รายการที่เจอเป็นของ `exceljs`/`uuid` เดิมที่รับทราบตั้งแต่ Phase 6) |
| สร้าง `GET /api/executive/summary?zoneId=` เส้นทางเดียว คำนวณทุกอย่าง (KPI + แนวโน้มรายเดือน + เปรียบเทียบตามโซน + สถานะข้อมูล) ในคำขอเดียว ไม่แยกเป็นหลาย endpoint | หน้ารายงานโหลดพร้อมกันทั้งหมดอยู่แล้ว ไม่มีส่วนใดโหลดทีหลัง/lazy — endpoint เดียวลดจำนวน round-trip และหลีกเลี่ยงปัญหาข้อมูลแต่ละกราฟไม่ sync กัน (เช่น filter เดือน/โซนไม่ตรงกันระหว่าง 2 คำขอ) |
| ไม่มี auth/login gate ที่ `/executive` เหมือนกับ Admin | role นี้เป็นมุมมองข้อมูลระดับองค์กร (ไม่ใช่ "ข้อมูลของฉันเอง" แบบ `/checker`) — ไม่มีความจำเป็นต้องรู้ว่าใครล็อกอิน ตรงกับจุดยืนเรื่อง auth เดิมของทั้งระบบที่ยังไม่มี real login ยกเว้นจุดที่จำเป็นจริง (`/checker` เท่านั้น) |
| ค่าไฟรวม (`totalBilling`) คำนวณจาก Calculation Service เดิม (`calculateBilling()`) ด้วย Billing Configuration **ปัจจุบัน** (ค่ากลางจาก PostgreSQL) ไล่คำนวณทุก reading ที่มีค่าแล้วรวมกัน — ไม่มีสูตรแยกชุดที่สอง | ตรงกับกฎเดิมของระบบทั้งหมด (Phase 6B kickoff §10): "ห้ามมีสูตรค่าไฟอีกชุดหนึ่ง" — แม้จะเป็นแค่หน้าสรุปก็ต้องเรียกสูตรเดียวกัน ไม่ใช่ประมาณเอง |
| ตัวกรองโซน (slicer) มีผลกับ KPI/กราฟแนวโน้ม/กราฟสถานะข้อมูลทั้งหมด **ยกเว้น** กราฟ "เปรียบเทียบการใช้ไฟตามโซน" (ซึ่งแค่ narrow ให้เหลือโซนเดียวถ้าเลือกกรอง) | กราฟเปรียบเทียบโซนมีไว้เพื่อเปรียบเทียบข้ามโซนโดยเฉพาะ — กรองให้เหลือโซนเดียวจะทำให้กราฟนี้ไม่มีประโยชน์อะไรเลย จึงปล่อยให้แสดงแค่แถบเดียวแทนที่จะซ่อนกราฟทั้งอัน (ผู้ใช้ยังเห็นตัวเลขที่ต้องการอยู่) |
| กราฟเปรียบเทียบโซน (`zoneBreakdown`) ใช้ยอดสะสม**ทั้งหมด**ตลอดประวัติ (ไม่ใช่แค่เดือนปัจจุบัน) ส่วนกราฟแนวโน้มรายเดือน (`monthlyTrend`) แยกเป็นรายเดือนสำหรับดูแนวโน้ม | ตอบคำถามคนละแบบ: "โซนไหนใช้ไฟมากสุดสะสม" (เปรียบเทียบ, ไม่สนเวลา) กับ "แนวโน้มเปลี่ยนแปลงอย่างไรในแต่ละเดือน" (ไล่เวลา, ไม่แยกโซน) — รวมสองมุมมองในกราฟเดียวจะทำให้อ่านยากขึ้นโดยไม่จำเป็น |
| สถานะข้อมูล (`statusBreakdown`) นับจาก **ทุก** Reading (ไม่กรอง `confirmedValue not null` เหมือนกราฟอื่น) ผ่าน `prisma.reading.groupBy` | มีไว้เพื่อดู "สุขภาพของข้อมูล" (มี DRAFT/SYNC_ERROR ตกค้างอยู่ไหม) — ถ้ากรองแค่ confirmedValue ไม่ null จะไม่เห็น DRAFT ที่ยังไม่ confirm เลย ซึ่งเป็นสถานะที่ผู้บริหารอยากรู้มากที่สุด |
| ทุกแผงกราฟวางเป็น local sub-component ในไฟล์ `page.tsx` เดียว (ไม่แยกเป็นไฟล์ component ย่อยรายกราฟ) | มีจุดใช้งานแค่ที่เดียว ตรงกับ pattern เดิมที่ `AdminDashboard.tsx` ใช้ (เช่น `MissingReadingsPanel` เป็น sub-component ในไฟล์เดียวกัน) — ไม่จำเป็นต้องแยกไฟล์เมื่อไม่มีการใช้ซ้ำ |

**ทดสอบจริงด้วย Playwright ต่อ dev server + PostgreSQL จริง** (เพิ่ม reading ทดสอบ 3 รายการตรงเข้า DB บนมิเตอร์จริงเพื่อดูกราฟ/คำนวณจริง แล้วลบออกหลังทดสอบตามที่ผู้ใช้ยืนยัน — ไม่แก้ไขมิเตอร์จริงใดๆ):
- `/executive` โหลดสำเร็จ เห็นการ์ด KPI ครบ (โซน/ห้องพัก/มิเตอร์/รายการทั้งหมด/จดแล้วเดือนนี้/ยังไม่จดเดือนนี้ — เด่นสีเหลืองเมื่อ > 0/หน่วยไฟรวม/ค่าไฟรวม) และกราฟทั้ง 5 แผง (เส้นแนวโน้มหน่วยไฟ, เส้นแนวโน้มค่าไฟ, แท่งจำนวนรายการต่อเดือน, แท่งเปรียบเทียบโซน, วงกลมสถานะข้อมูล) เรนเดอร์ถูกต้องตรงกับตัวเลขจาก API
- ตัวเลขคำนวณถูกต้องตรวจสอบแล้ว: reading แรกของมิเตอร์ (ไม่มีค่าก่อนหน้า) usage/billing เป็น 0 ไม่ใช่ error หรือค่าประมาณ (ตรงกับกฎ "ห้ามเดาค่า previous")
- เลือกตัวกรองโซนที่ dropdown → KPI/กราฟแนวโน้มปรับตามโซนที่เลือกถูกต้อง (zoneCount เหลือ 1, roomCount/meterCount/totalReadingCount ลดลงตามจริง) กราฟเปรียบเทียบโซนเหลือแค่แถบเดียวตามที่ออกแบบไว้
- ไม่มี console/page error — `npx tsc --noEmit`/`npm run lint`/`npm test` (125 tests)/`npm run build` ผ่านทั้งหมด (route ใหม่ `/api/executive/summary` ขึ้นครบ)

**สถานะ**: ✅ ไม่มี Prisma migration ใหม่ (query อ่านอย่างเดียว ไม่มี schema เปลี่ยน) — ลบ reading ทดสอบออกจาก PostgreSQL จริงหลังทดสอบเรียบร้อยแล้ว ยืนยันสะอาด (0 reading เหลือ ตรงกับก่อนทดสอบ)

---

## ✅ ปรับธีมสีทั้งเว็บ — ขาวเป็นหลัก เขียวเป็นรอง (2026-09-07)

**บริบท**: ผู้ใช้ขอปรับธีมสีทั้งเว็บ (ทุกหน้า ทุก role) ให้เป็น "สีขาวเป็นหลัก สีเขียวเป็นรอง ธีมอ่านง่าย สะอาด" พร้อมตกแต่งให้สวยงามขึ้น แล้ว push code

| การตัดสินใจ | เหตุผล |
|---|---|
| เลือกโทน **emerald** (Tailwind) เป็นสีเขียวหลักของแบรนด์ ทั้งเว็บใช้โทนเดียวกันหมด (แปลง `green-*` เดิมทั้งหมดเป็น `emerald-*` ด้วย เพื่อไม่ให้มี "เขียว" 2 เฉดปนกัน) | โทนสดใส อ่านง่าย ตัดกับพื้นขาวได้ดี ไม่หม่นเกินไป และมีคอนทราสต์กับตัวหนังสือขาวเพียงพอสำหรับปุ่ม |
| ปุ่มหลัก (primary action) ทุกปุ่มทั้งเว็บ (เดิมเป็นสีดำ/เกือบดำ `bg-zinc-900` สลับเป็นสีขาวตอน dark mode) เปลี่ยนเป็น **emerald-600 พื้นเดียวกันทั้ง light/dark mode** ไม่มี `dark:` override แยกอีกต่อไป | ทำผ่านสคริปต์ regex คำสั่งเดียวครอบคลุมทั้ง 16 จุดใน 13 ไฟล์แบบแม่นยำ (ยึด pattern `bg-zinc-900...text-white...dark:bg-zinc-100 dark:text-zinc-900` เป๊ะๆ ไม่ไปแตะปุ่ม/พื้นหลังอื่นที่ไม่ใช่ primary button) — ปุ่มสีเดียวกันทั้ง 2 โหมดยังอ่านง่าย ไม่ต้องคำนวณคอนทราสต์แยก 2 ชุด |
| สีความหมาย (semantic) — แดง (error), เหลืองอำพัน/amber (warning), เหลือง (กรอบกล้อง OCR/QR scan) — **ไม่แตะ** ยังคงไว้ตามเดิมทั้งหมด | สีเหล่านี้สื่อความหมายที่เข้าใจกันสากล (error/warning) หรือมีหน้าที่ใช้งานจริง (กรอบเหลืองช่วยมองเห็นชัดตัดกับพื้นหลังหลากสี) ไม่ใช่ส่วนของ "ธีมแบรนด์" — บังคับให้เป็นเขียวหมดจะขัดกับหลัก "อ่านง่าย" ที่ผู้ใช้ขอมาโดยตรง (แยกสถานะไม่ออก) |
| ปุ่ม "Sync ข้อมูล" (เดิม `bg-blue-600`) เปลี่ยนเป็น emerald เช่นกัน | ไม่ใช่สถานะ error/warning และผู้ใช้ระบุให้ธีมทั้งเว็บเหลือแค่ 2 สีหลัก (ขาว+เขียว) — คงสีน้ำเงินไว้จะทำให้กลายเป็นธีม 3 สี ขัดกับที่ขอมา |
| กราฟในหน้าผู้บริหาร (Recharts) เปลี่ยนจากหลายสีปนกัน (น้ำเงิน/ม่วง/ส้ม) เป็นโทนเขียวตระกูลเดียวกันที่ยังแยกแยะกันได้ (usage = emerald-600, ค่าไฟ = teal-600, จำนวนรายการ = lime-600, เปรียบเทียบโซน = amber-600 ตั้งใจให้ต่างจาก 2 กราฟเส้นข้างบนเพื่อไม่ให้สับสน) ส่วนกราฟสถานะข้อมูล (pie) **ไม่เปลี่ยน** ยังคงสีตามความหมายสถานะเดิม | กราฟหลายชุดข้อมูลในหน้าเดียวกัน ถ้าใช้สีเดียวกันหมดจะแยกเส้น/แท่งไม่ออก ขัดกับ "อ่านง่าย" — เลือกโทนที่อยู่ในตระกูลเขียว-น้ำเงินอมเขียวที่ยังพอเป็นธีมเดียวกันได้ แต่ contrast กันพอจะอ่านกราฟออก |
| เพิ่ม visual polish ทั่วเว็บ: การ์ด/แถวตารางมี `shadow-sm` + hover elevation (`hover:-translate-y-0.5 hover:shadow-md` สำหรับการ์ดที่กดได้, `hover:bg-emerald-50/60` สำหรับแถวตาราง), หัวข้อ section (`<h3>`) และ header ของทุกหน้าใช้สีเขียวเน้น + เส้นใต้ emerald, การ์ด KPI มีแถบสีบนขอบ (`border-t-4`) แบบ Power BI, หน้าแรกและฟอร์ม login มีไอคอนวงกลมสีเขียว + gradient พื้นหลังอ่อนๆ | ตรงกับคำขอ "ตกแต่งให้สวยงาม อ่านง่าย" — เพิ่มลำดับชั้นการมองเห็น (visual hierarchy) และ affordance ว่าอะไรกดได้ โดยไม่เปลี่ยนโครงสร้าง/ฟังก์ชันเดิม |
| หน้าแรก (`/`) เพิ่มไอคอน + คำอธิบายสั้นต่อปุ่มเลือกบทบาท (🛠️ ผู้ดูแลระบบ, ⚡ ผู้จดมิเตอร์, 📊 ผู้บริหาร) เปลี่ยนจากปุ่มบล็อกทึบเป็นการ์ดสีขาวขอบบาง + ไอคอนวงกลมเขียวอ่อน | หน้าแรกเป็นจุดแรกที่ทุกคนเห็น — ทำให้ดูสมเป็น "ระบบ" มากขึ้น (ตรงกับ "ตกแต่งให้สวยงาม") และไอคอนช่วยให้แยกบทบาทได้เร็วขึ้นโดยไม่ต้องอ่านตัวหนังสือ |

**ทดสอบจริงด้วย Playwright ต่อ dev server + PostgreSQL จริง** (สร้าง user ทดสอบชั่วคราวเพื่อดูหน้าที่ต้อง login เท่านั้น ลบออกหลังเสร็จ ยืนยันสะอาด):
- ตรวจภาพหน้าจอทุกหน้า/ทุก role: `/` (หน้าเลือกบทบาท), `/checker` (ฟอร์ม login + Dashboard), `/checker/reading`, `/checker/history`, `/admin` (ทุกแท็บ), `/executive` — สีขาวเป็นพื้นหลักหลักทุกหน้า เขียวเป็นสีเน้น (ปุ่ม/หัวข้อ/แท็บ active/กราฟ) สม่ำเสมอกันทั้งเว็บ ไม่มีจุดที่ยังเป็นปุ่มดำ/เทาเข้มหลงเหลือ
- ตรวจว่าสีสถานะ (error/warning/สถานะ sync) ยังคงเดิมครบ ไม่ได้ถูกกลืนเป็นเขียวไปด้วย
- ไม่มี console/page error — `npx tsc --noEmit`/`npm run lint`/`npm test` (125 tests)/`npm run build` ผ่านทั้งหมด

**สถานะ**: ✅ ไม่มีการเปลี่ยน API/schema/logic ใดๆ — เป็นการปรับ CSS class (Tailwind utility) ล้วน ไม่กระทบพฤติกรรมของระบบ
