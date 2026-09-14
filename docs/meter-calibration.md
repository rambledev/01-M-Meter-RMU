# Meter Calibration Log — Field Calibration Phase

> สถานะ: 🟡 รอทดสอบจริง — ค่าทั้งหมดใน `src/lib/calibration/config.ts` ยังเป็นค่าประมาณเริ่มต้น (default) ที่**ยังไม่เคยผ่านการทดสอบกับอุปกรณ์จริงเลย** (ดู [decision-log.md](decision-log.md) หัวข้อ "Field Calibration — Testing Support tooling เท่านั้น")
> เอกสารนี้มีไว้บันทึกผลทดสอบจริงจาก Phase **Real Device Calibration** และเหตุผลของทุกครั้งที่แก้ค่าใน `config.ts`

---

## 1. จุดประสงค์

`src/lib/calibration/config.ts` คือ single source of truth ของทุก threshold ที่ pipeline OCR/กล้องใช้ตัดสินใจ:

| ค่า | field ใน config.ts | ใช้ที่ |
|---|---|---|
| OCR confidence (preview) | `ocr.previewConfidence` | `lib/ocr/ocrValidation.ts` |
| OCR confidence (stable) | `ocr.stableConfidence` | `lib/ocr/ocrStability.ts` |
| Stability count | `ocr.stabilityCount` | `lib/ocr/ocrStability.ts` |
| Live OCR interval | `ocr.liveIntervalMs` | `lib/ocr/useLiveOcr.ts` |
| Camera quality check interval | `cameraQuality.checkIntervalMs` | `lib/image/useCameraQuality.ts` |
| Brightness threshold (มืด/สว่าง) | `cameraQuality.darkThreshold` / `brightThreshold` | `lib/image/cameraQuality.ts` |
| Blur threshold | `cameraQuality.blurThreshold` | `lib/image/cameraQuality.ts` |

เอกสารนี้บันทึก**ผลทดสอบจริง**และ**เหตุผล**ทุกครั้งที่มีการแก้ค่าเหล่านี้ — ไม่ใช่แค่ตัวเลขสุดท้าย เพื่อให้ย้อนดูได้ว่าทำไมถึงเลือกค่านั้น

---

## 2. ตรวจสอบ Threshold Coverage

ยืนยันด้วย `grep -rn "DEFAULT_CALIBRATION_CONFIG" src` (ตรวจล่าสุด 2026-09-15) ว่าทุก threshold ที่ควรปรับได้จริงๆ อ่านค่าจาก `config.ts` ไม่มีจุดไหน hardcode ซ้ำในไฟล์ตัวเอง:

| Threshold | Field ใน config.ts | Consumer | สถานะ |
|---|---|---|---|
| OCR confidence (preview) | `ocr.previewConfidence` | `ocrValidation.ts:39` | ✅ centralized |
| OCR confidence (stable) | `ocr.stableConfidence` | `ocrStability.ts:29` | ✅ centralized |
| Stability count | `ocr.stabilityCount` | `ocrStability.ts:22` | ✅ centralized |
| Live OCR interval | `ocr.liveIntervalMs` | `useLiveOcr.ts:90` | ✅ centralized |
| Camera quality check interval | `cameraQuality.checkIntervalMs` | `useCameraQuality.ts:27` | ✅ centralized |
| Brightness threshold (dark/bright) | `cameraQuality.darkThreshold` / `brightThreshold` | `cameraQuality.ts:83` | ✅ centralized |
| Blur threshold | `cameraQuality.blurThreshold` | `cameraQuality.ts:83` | ✅ centralized |

**5/5 threshold ที่ขอไว้ชัดเจน** (OCR confidence, stability count, interval, brightness threshold, blur threshold) ปรับได้จาก `config.ts` ครบ ✅

**พบเพิ่มเติมระหว่างตรวจสอบ** (นอกเหนือ 5 รายการที่ขอ — ยังไม่แก้โค้ด รอบนี้เป็นแค่ audit):

| Parameter | ตำแหน่ง | สถานะ |
|---|---|---|
| Preprocessing upscale (`scale`, default 3x) | `lib/image/meterPreprocess.ts` (`PreprocessOptions.scale`) | ⚠️ ยังเป็น default ในไฟล์ตัวเอง ไม่อยู่ใน `config.ts` — มีผลต่อความแม่นยำ OCR โดยตรง น่าจะควร tune ด้วยเหมือนกัน |
| Contrast enhancement (`contrast`, default 60) | `lib/image/meterPreprocess.ts` (`PreprocessOptions.contrast`) | ⚠️ เช่นเดียวกับด้านบน |
| ความยาวตัวเลขที่ยอมรับ (4-6 หลัก) | `lib/ocr/ocrValidation.ts` (`MIN_DIGITS`/`MAX_DIGITS`) | ➖ ตั้งใจไม่รวม — เป็นกฎรูปแบบข้อมูล (มิเตอร์จริงมีกี่หลัก) ไม่ใช่ threshold ที่ปรับตาม hardware/สภาพแวดล้อม |
| Otsu threshold (binarization) | `lib/image/meterPreprocess.ts` | ➖ ไม่ต้อง config — คำนวณอัตโนมัติจาก histogram ของแต่ละภาพ ไม่ใช่ค่าคงที่ |

ถ้าระหว่างทดสอบจริงพบว่าความแม่นยำ OCR มีปัญหาที่ preprocessing เอง (ไม่ใช่แค่ confidence/stability threshold) ให้พิจารณาย้าย `scale`/`contrast` เข้า `config.ts` เป็นงานถัดไป — ยังไม่ทำตอนนี้ตามขอบเขตที่สั่ง ("ยังไม่ implement code ใหม่")

---

## 3. เตรียมตัวก่อนเริ่ม Phase Real Device Calibration (checklist)

- [ ] **HTTPS หรือ localhost เท่านั้น** — `getUserMedia()` (กล้อง) ใช้ได้เฉพาะบน secure context: `https://` หรือ `http://localhost` ของตัวเครื่องเอง มือถือจริงเปิด `http://<LAN-IP>:3000` ตรงๆ **จะไม่ขอ permission กล้องให้เลย** (เบราว์เซอร์บล็อกเงียบๆ) ต้องเลือกวิธีใดวิธีหนึ่ง:
  - Tunnel ที่ให้ HTTPS ฟรี เช่น `ngrok http 3000` หรือ `cloudflared tunnel --url http://localhost:3000` แล้วเปิด URL ที่ได้บนมือถือ
  - Android: `adb reverse tcp:3000 tcp:3000` แล้วต่อสาย USB เปิด `http://localhost:3000` บน Chrome มือถือ (นับเป็น localhost จริง ไม่ต้อง HTTPS)
  - iOS Safari: เปิด Web Inspector (Settings → Safari → Advanced) + Mac ต่อสาย USB ใช้ Safari remote debugging ชี้ไปที่ tunnel/HTTPS เดียวกับข้างต้น (iOS ไม่มี adb reverse เทียบเท่า)
- [ ] `npm run dev` (ต้องเป็น development build — production build จะไม่มี OCR Debug Panel/Metrics เลยตามที่ตั้งใจ)
- [ ] Login เข้า `/checker` — ถ้ายังไม่มี PostgreSQL จริงต่ออยู่ ตั้ง `MOCK_DATA=true` ใน `.env` แล้วใช้บัญชี mock `checker-demo` / `Demo1234!` (มีมิเตอร์ตัวอย่างพร้อมทดสอบทันที)
- [ ] ครั้งแรกที่กด "อ่านตัวเลข"/เปิดกล้อง ต้องมีอินเทอร์เน็ตเพื่อโหลด Tesseract worker/WASM/traineddata จาก CDN ครั้งเดียว (ดู [ocr-strategy.md](ocr-strategy.md) §5.4) — หลังจากนั้น browser cache ไว้ใช้ offline ได้

---

## 4. วิธีเก็บข้อมูลระหว่างทดสอบภาคสนาม

1. เปิด `/checker/reading?meterId=...` บนมือถือจริงตาม checklist ข้อ 3
2. ใช้ **OCR Debug Panel** (ท้ายหน้า, กางอัตโนมัติ) ดูภาพ Original/ROI/Preprocessed จริง + confidence + duration(ms) ของแต่ละ tick
3. ทดสอบกับมิเตอร์จริงหลายสภาพแสง/มุมกล้อง/ระยะห่าง — ใช้ **Calibration Checklist** (หัวข้อ 5) บันทึกทีละภาพ และเก็บภาพตัวอย่างตามแนวทางหัวข้อ 6
4. สรุปผลรวมของ session ลงตารางในหัวข้อ 8 (Real Device Calibration log)
5. ถ้าพบว่าค่า threshold ปัจจุบันทำให้ false positive/negative บ่อย ให้แก้ที่ `lib/calibration/config.ts` **จุดเดียว** แล้วบันทึก entry ใหม่ในหัวข้อ 8 พร้อมเหตุผล
6. รัน `npm test` ซ้ำทุกครั้งหลังแก้ค่า — เทสที่อิง threshold เดิม (เช่น `ocrValidation.test.ts`, `ocrStability.test.ts`, `cameraQuality.test.ts`, `config.test.ts`) อาจต้องปรับ assertion ให้ตรงกับค่าใหม่ด้วย

---

## 5. Calibration Checklist (บันทึกต่อภาพ/ต่อครั้งที่ทดสอบ)

ละเอียดกว่า session log ในหัวข้อ 8 (ซึ่งสรุปภาพรวมทั้ง session) — กรอกแถวใหม่ทุกครั้งที่ถ่ายภาพทดสอบ 1 ภาพ โดยอ่านค่า OCR result/Confidence/Processing time จาก **OCR Debug Panel** โดยตรง:

| Device | Browser | Meter model | Lighting condition | OCR result | Confidence | Processing time (ms) | Issue |
|---|---|---|---|---|---|---|---|
| เช่น iPhone 13 | Safari 18 | มิเตอร์ไฟฟ้า 1 เฟส จอตัวเลขกล | normal | 23188 | 96% | 850 | - |
| เช่น Samsung A54 | Chrome 130 | มิเตอร์ไฟฟ้า 1 เฟส จอตัวเลขกล | reflection | 23198 | 62% | 910 | อ่านผิด (8→9) เพราะแสงสะท้อน |
| | | | | | | | |

- **Lighting condition**: ใช้ 1 ใน 5 หมวดจากหัวข้อ 6 (`normal`/`blur`/`reflection`/`low light`/`tilted`) หรือบรรยายเพิ่มถ้าไม่เข้าหมวดไหนเป๊ะๆ
- **Issue**: ว่างไว้ถ้าอ่านถูกต้องไม่มีปัญหา — ถ้ามี ให้ระบุสั้นๆ เช่น "อ่านผิดเป็น 8 แทน 3", "ขึ้น stable ✓ แต่ค่าผิด (false stable)", "ภาพชัดแต่ยังโดน isBlurry เตือน (false positive)"

---

## 6. แนวทางการเก็บภาพตัวอย่างสำหรับ tune

ถ่ายภาพทดสอบครบทั้ง 5 เงื่อนไขต่อมิเตอร์ 1 ตัวอย่างน้อย เพื่อให้เห็นพฤติกรรม threshold ครบทุกด้าน — ใช้ Debug Panel ดูว่า brightness/blurScore/confidence ที่แสดงตรงกับสภาพจริงหรือไม่ในแต่ละเงื่อนไข:

| เงื่อนไข | วิธีถ่ายให้ได้ตามเงื่อนไข | สิ่งที่ควรสังเกตใน Debug Panel |
|---|---|---|
| **normal** | แสงสม่ำเสมอ กล้องตรง ไม่มีสิ่งกีดขวาง ระยะห่างปกติ — ใช้เป็น baseline เทียบกับอีก 4 เงื่อนไข | ควรได้ confidence สูง (≥85%), `isTooDark`/`isTooBright`/`isBlurry` ทั้งหมดเป็น false |
| **blur** | จงใจสั่นมือขณะถ่าย หรือถ่ายขณะเดิน/ไม่ให้กล้องนิ่งพอ | `blurScore` ควรต่ำกว่า `blurThreshold` (ปัจจุบัน 50), `isBlurry` ควรเป็น true และมีคำเตือนขึ้นบนจอ |
| **reflection** | ถ่ายตอนมีแสงแดด/ไฟสะท้อนหน้าปัดมิเตอร์ (กระจก/พลาสติกมันวาว) หามุมที่แสงสะท้อนเข้ากล้องพอดี | ⚠️ **ยังไม่มี threshold เฉพาะสำหรับ glare/reflection** — brightness/blur อาจดูปกติทั้งคู่ (ภาพอาจสว่างและคมชัดพร้อมกันได้) แต่ OCR อ่านผิดเพราะตัวเลขโดนแสงทับ ให้บันทึกไว้เป็น known gap ถ้าเจอเคสแบบนี้บ่อย |
| **low light** | ถ่ายตอนพลบค่ำ/ในที่ร่มไม่มีไฟ หรือปิดไฟบริเวณมิเตอร์ชั่วคราว (ถ้าทำได้อย่างปลอดภัย) | `brightness` ควรต่ำกว่า `darkThreshold` (ปัจจุบัน 60), `isTooDark` ควรเป็น true |
| **tilted** | ถ่ายเอียงกล้องประมาณ 15-30 องศาจากแนวตรง ไม่ตั้งฉากกับหน้าปัดมิเตอร์ | ดูว่า ROI crop (ภาพกลางใน Debug Panel) ยังครอบตัวเลขครบหรือไม่ — ถ้าตัวเลขหลุดกรอบบางส่วน เป็นปัญหาคนละแบบกับ blur/brightness (ROI แข็ง ไม่ได้ตามมุมภาพ) ให้บันทึกไว้เช่นกัน |

**ทุกภาพที่ถ่ายเพื่อ tune เหล่านี้เป็นภาพชั่วคราวใน memory เหมือน workflow ปกติ** — ไม่มีจุดไหนใน pipeline persist ภาพ crop ไว้ (ตาม decision-log.md) ถ้าต้องการเก็บภาพไว้เทียบย้อนหลังจริงๆ ให้ **ถ่ายเพิ่มด้วยกล้องมือถือแยกต่างหาก นอกแอป** (เช่น แอปกล้องปกติของเครื่อง) แล้วจดคู่กับผลจาก Debug Panel ลงในตารางหัวข้อ 5 — ไม่ใช่พึ่งพาแอปเก็บภาพให้

---

## 7. ค่าปัจจุบัน (default, ยังไม่ calibrate)

```ts
// จาก src/lib/calibration/config.ts ณ วันที่สร้างเอกสารนี้ (2026-09-14)
{
  ocr: {
    previewConfidence: 0.6,
    stableConfidence: 0.85,
    stabilityCount: 3,
    liveIntervalMs: 800,
  },
  cameraQuality: {
    checkIntervalMs: 500,
    darkThreshold: 60,
    brightThreshold: 200,
    blurThreshold: 50,
  },
}
```

⚠️ ตารางนี้เป็น snapshot ตอนสร้างเอกสาร — ค่าจริงปัจจุบันให้ดูที่ `config.ts` เสมอ อย่าเชื่อตัวเลขในเอกสารนี้ถ้าไม่ตรงกับโค้ด

---

## 8. บันทึกผลทดสอบจริง (Real Device Calibration)

> เพิ่ม entry ใหม่ต่อท้ายทุกครั้งที่ทดสอบ — ห้ามลบของเก่า (เป็น log ไม่ใช่ค่าล่าสุดอย่างเดียว)

### Session template — คัดลอกไปใช้ต่อ session

```
### YYYY-MM-DD — <อุปกรณ์/เบราว์เซอร์>

**สภาพแวดล้อม**: <แสง/สถานที่/ประเภทมิเตอร์>
**Config ที่ใช้ทดสอบ**: <ค่าที่ใช้ตอนนั้น ถ้าต่างจาก default>
**Calibration Checklist**: <ลิงก์/อ้างอิงแถวในหัวข้อ 5 ที่เกี่ยวกับ session นี้>

| ตัวชี้วัด | ผลที่สังเกต |
|---|---|
| ความแม่นยำ OCR (stable ตรงกับค่าจริง) | ?/? ครั้ง |
| False stable (ขึ้น ✓ แต่ค่าผิด) | ?/? ครั้ง |
| เวลาเฉลี่ยกว่าจะ stable | ? วินาที |
| Duration เฉลี่ยต่อ tick | ? ms |
| Brightness/blur ตอนที่มิเตอร์อ่านง่าย | brightness ~?, blurScore ~? |
| Brightness/blur ตอนที่มิเตอร์อ่านยาก | brightness ~?, blurScore ~? |

**สรุป/ข้อเสนอแก้ config**: <เช่น "blurThreshold 50 ต่ำไป ภาพเบลอชัดเจนยังผ่าน แนะนำเพิ่มเป็น 80">
**Action**: <แก้ config.ts แล้ว / ยังไม่แก้ รอข้อมูลเพิ่ม>
```

---

*(ยังไม่มี entry จริง — รอ Phase Real Device Calibration)*
