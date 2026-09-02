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

## สถานะ Coding

**Phase 0 (Project Setup) เสร็จสมบูรณ์แล้ว** — โปรเจกต์ Next.js/TypeScript/Tailwind/Prisma package/Docker ถูกสร้างขึ้นจริงตามที่ approve (ดู `README.md` และรายงาน Phase 0)

**Git/GitHub ตั้งค่าแล้ว** — repo เชื่อมกับ `origin` ที่ https://github.com/rambledev/01-M-Meter-RMU.git และ push commit แรก (`chore: initialize project foundation`) ขึ้น `main` แล้ว (ดูรายละเอียดในรายงาน Phase 0)

**ยังไม่มีการสร้าง Prisma Data Model จริง, ยังไม่มี migration, ยังไม่มี application/business logic ใดๆ** — สิ่งเหล่านี้อยู่ใน scope ของ Phase 1 เป็นต้นไป ตามคำสั่งของผู้ใช้ ห้ามเริ่มจนกว่าจะได้รับคำสั่ง "เริ่ม Phase 1"

**อัปเดต 2026-09-02 (เพิ่มเติมหลัง Phase 0)**: ปรับ requirement เรื่อง OCR Image Storage — ดูหัวข้อ "ไม่จัดเก็บ OCR Crop Image แบบถาวร" ด้านบน เป็นการปรับ documentation/architecture เท่านั้น **ยังไม่ได้แก้ schema จริง ไม่มี migration** (ตรงตามที่ระบุ)
