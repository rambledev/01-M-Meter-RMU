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

## 2. เตรียมตัวก่อนเริ่ม Phase Real Device Calibration (checklist)

- [ ] **HTTPS หรือ localhost เท่านั้น** — `getUserMedia()` (กล้อง) ใช้ได้เฉพาะบน secure context: `https://` หรือ `http://localhost` ของตัวเครื่องเอง มือถือจริงเปิด `http://<LAN-IP>:3000` ตรงๆ **จะไม่ขอ permission กล้องให้เลย** (เบราว์เซอร์บล็อกเงียบๆ) ต้องเลือกวิธีใดวิธีหนึ่ง:
  - Tunnel ที่ให้ HTTPS ฟรี เช่น `ngrok http 3000` หรือ `cloudflared tunnel --url http://localhost:3000` แล้วเปิด URL ที่ได้บนมือถือ
  - Android: `adb reverse tcp:3000 tcp:3000` แล้วต่อสาย USB เปิด `http://localhost:3000` บน Chrome มือถือ (นับเป็น localhost จริง ไม่ต้อง HTTPS)
  - iOS Safari: เปิด Web Inspector (Settings → Safari → Advanced) + Mac ต่อสาย USB ใช้ Safari remote debugging ชี้ไปที่ tunnel/HTTPS เดียวกับข้างต้น (iOS ไม่มี adb reverse เทียบเท่า)
- [ ] `npm run dev` (ต้องเป็น development build — production build จะไม่มี OCR Debug Panel/Metrics เลยตามที่ตั้งใจ)
- [ ] Login เข้า `/checker` — ถ้ายังไม่มี PostgreSQL จริงต่ออยู่ ตั้ง `MOCK_DATA=true` ใน `.env` แล้วใช้บัญชี mock `checker-demo` / `Demo1234!` (มีมิเตอร์ตัวอย่างพร้อมทดสอบทันที)
- [ ] ครั้งแรกที่กด "อ่านตัวเลข"/เปิดกล้อง ต้องมีอินเทอร์เน็ตเพื่อโหลด Tesseract worker/WASM/traineddata จาก CDN ครั้งเดียว (ดู [ocr-strategy.md](ocr-strategy.md) §5.4) — หลังจากนั้น browser cache ไว้ใช้ offline ได้

## 3. วิธีเก็บข้อมูลระหว่างทดสอบภาคสนาม

1. เปิด `/checker/reading?meterId=...` บนมือถือจริงตาม checklist ด้านบน
2. ใช้ **OCR Debug Panel** (ท้ายหน้า, กางอัตโนมัติ) ดูภาพ Original/ROI/Preprocessed จริง + confidence + duration(ms) ของแต่ละ tick
3. ทดสอบกับมิเตอร์จริงหลายสภาพแสง/มุมกล้อง/ระยะห่าง บันทึกผลลงตารางในหัวข้อ 5
4. ถ้าพบว่าค่า threshold ปัจจุบันทำให้ false positive/negative บ่อย ให้แก้ที่ `lib/calibration/config.ts` **จุดเดียว** แล้วบันทึก entry ใหม่ในหัวข้อ 5 พร้อมเหตุผล
5. รัน `npm test` ซ้ำทุกครั้งหลังแก้ค่า — เทสที่อิง threshold เดิม (เช่น `ocrValidation.test.ts`, `ocrStability.test.ts`, `cameraQuality.test.ts`) อาจต้องปรับ assertion ให้ตรงกับค่าใหม่ด้วย

---

## 4. ค่าปัจจุบัน (default, ยังไม่ calibrate)

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

## 5. บันทึกผลทดสอบจริง (Real Device Calibration)

> เพิ่ม entry ใหม่ต่อท้ายทุกครั้งที่ทดสอบ — ห้ามลบของเก่า (เป็น log ไม่ใช่ค่าล่าสุดอย่างเดียว)

### Session template — คัดลอกไปใช้ต่อ session

```
### YYYY-MM-DD — <อุปกรณ์/เบราว์เซอร์>

**สภาพแวดล้อม**: <แสง/สถานที่/ประเภทมิเตอร์>
**Config ที่ใช้ทดสอบ**: <ค่าที่ใช้ตอนนั้น ถ้าต่างจาก default>

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
