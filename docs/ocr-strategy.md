# OCR Strategy — RMU Meter Collection

> สถานะ: **⏸️ ยังไม่ล็อก provider — รอการยืนยันจากผู้ใช้** (ดู [requirement.md](requirement.md) §5 ข้อ 4)
> เอกสารนี้เป็นการวิเคราะห์ตัวเลือกเพื่อประกอบการตัดสินใจ ไม่ใช่การเดาหรือ implement ล่วงหน้า
> อ้างอิง business rules จาก [requirement.md](requirement.md) §3.3 และ [workflow.md](workflow.md) ขั้นตอน 5–6
> **ปรับปรุง 2026-09-02**: OCR Region/Crop เป็นข้อมูลชั่วคราวใน memory/client เท่านั้น **ไม่ persist ลง server หรือ IndexedDB อีกต่อไป** ไม่ว่าจะเลือก provider ใด (ดู [decision-log.md](decision-log.md))

---

## 1. ข้อกำหนดที่ OCR ต้องตอบให้ได้

จาก requirement.md §3.3 และหลักการ "Offline First":

1. ต้องอ่านค่าเฉพาะบริเวณที่ครอปมา (OCR Region) ไม่ใช่ทั้งภาพ — crop นี้เป็นข้อมูลชั่วคราวใน memory เท่านั้น ไม่ persist ลง server/IndexedDB (ดู §4)
2. ผลลัพธ์ OCR (OCR Value) ต้องเป็นแค่ค่าเริ่มต้น — ผู้จดต้องแก้ไขได้เสมอก่อน confirm (ไม่ใช่ auto-submit)
3. **ควรทำงานได้ตอน offline** เพื่อให้ตรงกับ core requirement ทั้งระบบ — ถ้าเลือก provider ที่ต้องพึ่ง API ภายนอก ผู้จดจะบันทึก Reading ได้ตอน offline แต่ **จะไม่มี OCR Value ช่วยกรอกให้ระหว่าง offline** ต้องกรอกค่าด้วยตัวเองล้วนๆ ในสถานการณ์นั้น

---

## 2. ตัวเลือกที่วิเคราะห์

### ตัวเลือก A: On-device OCR (แนะนำเป็นค่าเริ่มต้น)

| ประเด็น | รายละเอียด |
|---|---|
| ทำงานตอน offline | ✅ ได้ — ตรงกับ core requirement โดยตรง |
| ตัวเลือก library | Tesseract.js (WASM, รันใน browser ได้ ไม่ต้อง native app) หรือ ML Kit (ต้องเป็น native mobile app — **ไม่เข้ากับสถาปัตยกรรม Next.js/PWA ที่เลือกไว้** เว้นแต่จะทำ native wrapper เพิ่ม) |
| ความแม่นยำ | ต่ำกว่า cloud OCR API โดยทั่วไป โดยเฉพาะกับตัวเลขบนหน้าปัดมิเตอร์ไฟฟ้าที่อาจมีแสงสะท้อน/มุมกล้องไม่ตรง — ต้องทดสอบจริงกับภาพตัวอย่างก่อนสรุป |
| Cost | ไม่มีค่าใช้จ่ายต่อ request (รันในเครื่อง) |
| Latency | ขึ้นกับอุปกรณ์ผู้ใช้ (มือถือรุ่นเก่าอาจช้า) แต่ไม่ต้องรอ network round-trip |

**เหตุผลที่แนะนำ**: เข้ากับ Tesseract.js ในบริบท Next.js/PWA ได้โดยไม่ต้องมี native app แยก และตอบโจทย์ offline-first ได้ครบ 100% ไม่มีจุดที่ flow ขาดตอนตอนไม่มีเน็ต

### ตัวเลือก B: Cloud OCR API (เช่น Google Cloud Vision, Azure Computer Vision)

| ประเด็น | รายละเอียด |
|---|---|
| ทำงานตอน offline | ❌ ไม่ได้ — ต้องมีเน็ตตอนถ่ายภาพเพื่อเรียก OCR |
| ความแม่นยำ | สูงกว่า on-device โดยทั่วไป |
| Cost | มีค่าใช้จ่ายต่อ request (ต้องประเมินตามจำนวนมิเตอร์ — requirement.md §5 ข้อ 6 ยังไม่ทราบตัวเลขจริง) |
| ผลกระทบต่อ UX offline | ต้องออกแบบ flow เพิ่ม: ถ้า offline ตอนถ่ายภาพ ผู้จดจะไม่เห็น OCR Value ช่วยกรอกทันที ต้องรอ sync ก่อนถึงจะรัน OCR ได้ (แปลว่า field `ocrValue` อาจว่างจนกว่าจะ sync สำเร็จ) — เพิ่มความซับซ้อนของ state machine ใน offline-strategy.md |

### ตัวเลือก C: Hybrid (on-device เป็นหลัก + fallback cloud API ตอน online และผลลัพธ์ on-device ไม่มั่นใจ)

| ประเด็น | รายละเอียด |
|---|---|
| ทำงานตอน offline | ✅ ได้ (ใช้ on-device เป็น baseline) |
| ความซับซ้อน | สูงสุดในสามตัวเลือก — ต้องมี confidence score จาก on-device engine เพื่อตัดสินใจว่าจะเรียก fallback หรือไม่ |
| เหมาะกับ | โปรเจกต์ที่ต้องการความแม่นยำสูงและมีเวลา/งบพัฒนาเพิ่ม ไม่เหมาะกับ MVP รอบแรก |

---

## 3. ข้อเสนอ (รอ confirm จากผู้ใช้ — ยังไม่ใช่ decision ที่ล็อกแล้ว)

**แนะนำ ตัวเลือก A (Tesseract.js, on-device)** สำหรับ MVP เพราะ:
- ตรงกับ core requirement "Offline First" 100% โดยไม่ต้องออกแบบ state พิเศษเพิ่มสำหรับกรณี "sync แล้วแต่ยังไม่มี OCR value"
- ไม่มี cost ต่อ request ซึ่งเหมาะกับช่วง MVP ที่ยังไม่ทราบ scale จริง (requirement.md §5 ข้อ 6)
- ความแม่นยำที่อาจต่ำกว่า cloud API ไม่ใช่ปัญหาใหญ่ เพราะ requirement.md §3.3 บังคับให้ผู้จดต้องตรวจ/แก้ไขค่าก่อน confirm อยู่แล้ว (OCR เป็นแค่ตัวช่วยกรอก ไม่ใช่ค่าสุดท้าย)

**สถานะ**: ⏸️ นี่คือข้อเสนอ ไม่ใช่การล็อก — ยังไม่ต้อง block Phase 0 เพราะ OCR provider ยังไม่ต้อง lock ตอนนี้ แต่ต้องได้รับการยืนยันจากผู้ใช้ก่อนเริ่ม **Phase 4 (Camera + OCR)** (ดู tech-stack.md §5 Development Phases)

---

## 4. OCR Pipeline (Architecture — ต้องรองรับไม่ว่าจะเลือก provider ใด)

สถาปัตยกรรมต้องรองรับ pipeline นี้เสมอ โดยไม่ผูกกับ provider เฉพาะเจาะจง — **ขั้นตอน Crop เป็นข้อมูลชั่วคราวใน memory/client เท่านั้น ไม่มีจุดใดใน pipeline นี้ persist ภาพ crop ลง IndexedDB หรือ server**:

```
Original Image (persist → ReadingImage, data-model.md §3.2)
        │
        ▼
Crop เฉพาะบริเวณตัวเลข ── ชั่วคราวใน memory/client เท่านั้น (ไม่ persist ที่ใดทั้งสิ้น)
        │
        ▼
OCR Provider (wrapper กลาง — swap ได้: Tesseract.js on-device / cloud API / hybrid)
        │
        ▼
OCR Value (Reading.ocrValue — ผลลัพธ์ดิบ, persist)
        │
        ▼
Manual Correction (ผู้จดแก้ไขได้เสมอ — requirement.md §3.3)
        │
        ▼
Confirmed Value (Reading.confirmedValue — ค่าที่ใช้จริงในการคำนวณ/รายงาน, persist)
        │
        ▼
บันทึก Reading + Original Image (ReadingImage) — ไม่มี OCR Crop Image ถูกบันทึกเป็นไฟล์ถาวร
```

- `ReadingImage` (data-model.md §3.2) เก็บเฉพาะภาพต้นฉบับ (**ORIGINAL เท่านั้น**) — ไม่มี record สำหรับภาพ crop อีกต่อไป (เดิมมี `type=OCR_REGION` แต่ตัดออกแล้วตาม decision-log.md "ไม่จัดเก็บ OCR Crop Image แบบถาวร")
- การ crop ทำโดยอ่าน pixel ตรงจาก Original Image (`<canvas>`/ImageData ใน browser หรือเทียบเท่าบน native) แล้วส่งเฉพาะ crop นั้นเข้า OCR Provider ทันที — ผลลัพธ์ (`ocrValue`) เท่านั้นที่ persist ต่อ ไม่ใช่ตัวภาพ crop
- ถ้าต้องตรวจสอบย้อนหลังว่า crop ตอนนั้นมาจากบริเวณไหนของภาพ ให้ crop ใหม่จาก Original Image ที่เก็บไว้ (แทนที่จะเก็บภาพ crop คู่กันไว้ล่วงหน้า)
- `src/lib/ocr/` เป็น wrapper กลางที่ครอบ engine ที่เลือก เพื่อให้ swap provider ได้ในอนาคตโดยไม่กระทบ UI layer หรือ data model (workflow.md ขั้นตอน 5)
- `Reading.ocrValue` เป็น `String?` (nullable) — รองรับทั้งกรณี on-device (มีค่าเสมอทันที แม้ offline) และ cloud API (อาจว่างชั่วคราวถ้าเลือกตัวเลือก B/C และ offline ตอนถ่ายภาพ)
- **มีแนวโน้มใช้ Tesseract.js แบบ on-device** (ตามข้อเสนอ §3) แต่**ยังไม่ต้องบังคับติดตั้งใน Phase 0** — การล็อก provider จริงจะเกิดก่อนเริ่ม Phase 4 เท่านั้น
