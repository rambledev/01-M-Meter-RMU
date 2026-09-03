# OCR Strategy — RMU Meter Collection

> สถานะ: **✅ Locked & Implemented (Phase 4, 2026-09-03)** — Tesseract.js (client-side, on-device) ยืนยันแล้วตอนเริ่ม Phase 4 และ implement จริงที่ `src/lib/ocr/`
> อ้างอิง business rules จาก [requirement.md](requirement.md) §3.3 และ [workflow.md](workflow.md) ขั้นตอน 5–6
> **ปรับปรุง 2026-09-02**: OCR Region/Crop เป็นข้อมูลชั่วคราวใน memory/client เท่านั้น **ไม่ persist ลง server หรือ IndexedDB อีกต่อไป** ไม่ว่าจะเลือก provider ใด (ดู [decision-log.md](decision-log.md))
> **ปรับปรุง Phase 4 (2026-09-03)**: ดู §5 สำหรับรายละเอียด implementation จริง (offline caveat, fixed region, native `rectangle` crop)

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

**สถานะ**: ✅ Locked — ผู้ใช้ยืนยัน Tesseract.js (client-side) ตอนเริ่ม Phase 4 kickoff (2026-09-03) ตรงตามข้อเสนอนี้เป๊ะ ดู §5 สำหรับรายละเอียด implementation จริง

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

---

## 5. Implementation จริง (Phase 4, 2026-09-03)

`tesseract.js@7.0.0` — `src/lib/ocr/{ocrRegion,ocrProvider}.ts`

### 5.1 Native crop แทน manual canvas crop
แทนที่จะ manual crop ภาพผ่าน `<canvas>` แล้วส่ง canvas/blob ที่ครอปแล้วเข้า Tesseract (ตามที่ §4 ร่างไว้เดิม) — implementation จริงส่ง **Original Image เต็มภาพ** เข้า `worker.recognize(imageBlob, { rectangle })` โดย Tesseract.js รองรับ parameter `rectangle` (`{ left, top, width, height }` หน่วยพิกเซล) ให้ crop เองภายใน WASM memory ไม่ต้องสร้าง canvas/Blob ที่ครอปไว้ในโค้ดของเราเองเลย — **เข้มงวดกว่าที่ §4 ระบุไว้อีก**: ไม่มี object รูปภาพที่ครอปแล้วปรากฏใน memory ของแอปเราแม้แต่ชั่วคราว

`regionToRectangle()` แปลง fixed region (`DEFAULT_OCR_REGION`, สัดส่วน 0-1 ของภาพ) เป็นพิกเซลตามขนาดภาพจริง พร้อม clamp ให้อยู่ในขอบเขตภาพเสมอ (ค้นพบระหว่าง browser test ว่า rectangle ที่หลุดขอบภาพทำให้ Tesseract/Leptonica **abort ทั้ง WASM worker** แทนที่จะโยน JS error ที่ดักได้ — แก้แล้วด้วยการ clamp ก่อนส่งเข้า Tesseract เสมอ)

### 5.2 Fixed OCR Region (ไม่มี UI ลากกรอบ)
`DEFAULT_OCR_REGION = { x: 0.15, y: 0.375, width: 0.7, height: 0.25 }` — กรอบสี่เหลี่ยมคงที่ แสดงเป็น overlay สีเหลืองทับ preview กล้อง ตามที่ §4 อนุญาตให้ทำแบบง่ายสำหรับ demo ไม่ต้องมีระบบลากกรอบอิสระ

### 5.3 Character whitelist
`tessedit_char_whitelist: "0123456789."` — จำกัดผลลัพธ์ให้เป็นตัวเลข+จุดทศนิยมเท่านั้น เพิ่มความแม่นยำสำหรับเลขมิเตอร์โดยเฉพาะ โดยไม่ต้องมี model พิเศษ

### 5.4 ⚠️ Offline caveat ที่บันทึกไว้ตามที่สั่ง (ยังไม่แก้ ไม่ block Phase 4)
Tesseract.js ใช้ **CDN default** สำหรับโหลด worker script, WASM core, และ "eng" trained-data (รวมไม่กี่ MB) ตอน**ใช้ OCR ครั้งแรก** — หมายความว่า:
- **ครั้งแรกที่ใช้ OCR ต้องมีอินเทอร์เน็ต** เพื่อดาวน์โหลด asset เหล่านี้
- หลังจากนั้น browser จะ cache asset ผ่าน Cache Storage API (พฤติกรรมมาตรฐานของ tesseract.js) ทำให้**ใช้ offline ได้หลังจากนั้น** ตรงตาม requirement "OCR ต้องรองรับ Offline หลังจาก assets/model พร้อมใช้งาน"
- **ยังไม่ได้ self-host asset เหล่านี้ในโปรเจกต์** (ซึ่งจะรับประกัน offline ได้ตั้งแต่ครั้งแรก) — ตัดสินใจเลื่อนเป็น future optimization ตามคำสั่งชัดเจนของผู้ใช้ที่ Phase 4 kickoff ("ถ้า...มีความซับซ้อนเกินกว่าจะทำให้ Demo เสร็จเร็ว ให้ทำ implementation ที่ใช้งาน Demo ได้ก่อน และบันทึกข้อจำกัดไว้ใน docs")
- ถ้า OCR ล้มเหลว (เช่น ครั้งแรกตอน offline) UI จะแสดงข้อความ "อ่านค่าอัตโนมัติไม่สำเร็จ...กรุณากรอกค่าด้วยตนเอง" — ผู้ใช้ยังกรอกค่าและบันทึก Reading ได้ปกติเสมอ ไม่ block workflow

### 5.5 Image compression (ไม่ใช่ crop)
`src/lib/image/compressImage.ts` — resize ภาพต้นฉบับให้ด้านยาวสุดไม่เกิน 1600px + re-encode เป็น JPEG quality 0.8 ก่อนเก็บ เป็นการแปลงภาพเต็มให้เล็กลง **ไม่ใช่การ crop** (ตาม Phase 4 spec ข้อ 8) — ภาพที่เก็บยังคงเป็นภาพเต็มของมิเตอร์เสมอ
