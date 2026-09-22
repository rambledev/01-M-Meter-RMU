"use client";

import { useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";

interface CurrentReadingInputProps {
  id: string;
  value: string;
  onChange: (raw: string) => void;
  error?: string;
}

const DEFAULT_DIGIT_COUNT = 6;
const MAX_DIGIT_COUNT = 12;

function emptyDigits(count: number): string[] {
  return Array.from({ length: count }, () => "");
}

// Blank boxes are left digits the checker didn't need to type (a meter
// reading of "1234" on a 6-digit dial is really "001234") — they collapse
// to "0" in the combined value, never block saving. All-blank still means
// "untouched" (empty string out), same "idle" contract the free-text input
// had, so meterReadingValidation.ts needs no changes.
function combine(digits: string[]): string {
  if (digits.every((d) => d === "")) return "";
  return digits.map((d) => (d === "" ? "0" : d)).join("");
}

// The main focus point of the page — large, centered, mobile-first. One box
// per digit (default 6, matching a typical dial meter; "เพิ่มหลัก" grows it
// for meters with more digits) instead of a single free-text field. The
// combined value it reports upward is still exactly what
// meterReadingValidation.ts expects: nothing here changes the SOURCE OF
// TRUTH contract, only how the checker types it in.
export default function CurrentReadingInput({
  id,
  value,
  onChange,
  error,
}: CurrentReadingInputProps) {
  const errorId = `${id}-error`;
  const [digits, setDigits] = useState<string[]>(() => emptyDigits(DEFAULT_DIGIT_COUNT));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Adjusting state during render (React's supported pattern for "reset
  // state when a prop changes") rather than an effect — only reacts to an
  // external reset (page.tsx clears the field back to "" after a
  // successful save or a duplicate hit), never fights the user's own
  // typing, since every keystroke here already calls onChange itself.
  const [lastExternalValue, setLastExternalValue] = useState(value);
  if (value !== lastExternalValue) {
    setLastExternalValue(value);
    if (value === "" && digits.some((d) => d !== "")) {
      setDigits(emptyDigits(digits.length >= DEFAULT_DIGIT_COUNT ? digits.length : DEFAULT_DIGIT_COUNT));
    }
  }

  function commit(next: string[]) {
    setDigits(next);
    onChange(combine(next));
  }

  function handleDigitChange(index: number, raw: string) {
    const char = raw.replace(/[^0-9]/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    commit(next);
    if (char && index < digits.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && digits[index] === "" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      const next = [...digits];
      next[index - 1] = "";
      commit(next);
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      return;
    }
    if (e.key === "ArrowRight" && index < digits.length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(index: number, e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "");
    if (!pasted) return;
    e.preventDefault();

    let next = [...digits];
    const needed = index + pasted.length;
    if (needed > next.length) {
      next = [...next, ...emptyDigits(Math.min(needed, MAX_DIGIT_COUNT) - next.length)];
    }
    for (let i = 0; i < pasted.length && index + i < next.length; i++) {
      next[index + i] = pasted[i];
    }
    commit(next);
    const lastFilled = Math.min(index + pasted.length, next.length) - 1;
    inputRefs.current[lastFilled]?.focus();
  }

  function addDigit() {
    if (digits.length >= MAX_DIGIT_COUNT) return;
    const next = [...digits, ""];
    setDigits(next);
    onChange(combine(next));
  }

  function removeDigit() {
    if (digits.length <= DEFAULT_DIGIT_COUNT) return;
    const next = digits.slice(0, -1);
    setDigits(next);
    onChange(combine(next));
  }

  // Steps one digit's own value 0-9, wrapping around (mechanical
  // dial-wheel behavior) — a blank box starts from 0, so "เพิ่ม" on an
  // untouched box lands on "1", and "ลด" on it wraps to "9".
  function stepDigit(index: number, delta: 1 | -1) {
    const current = Number(digits[index] || "0");
    const stepped = (current + delta + 10) % 10;
    const next = [...digits];
    next[index] = String(stepped);
    commit(next);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold" id={`${id}-label`}>
        ค่ามิเตอร์ครั้งนี้
      </label>
      <div className="flex flex-wrap items-start justify-center gap-2" role="group" aria-labelledby={`${id}-label`}>
        {digits.map((digit, index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => stepDigit(index, 1)}
              aria-label={`เพิ่มค่าหลักที่ ${index + 1}`}
              className="flex h-6 w-10 items-center justify-center rounded border border-zinc-300 text-sm font-bold leading-none dark:border-zinc-700"
            >
              +
            </button>
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              id={index === 0 ? id : undefined}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={(e) => handlePaste(index, e)}
              aria-label={`หลักที่ ${index + 1}`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={`h-14 w-10 rounded-lg border text-center text-2xl font-bold tracking-wide dark:bg-zinc-900 ${
                error
                  ? "border-red-400 focus:border-red-500"
                  : "border-zinc-300 focus:border-emerald-500 dark:border-zinc-700"
              }`}
              placeholder="0"
            />
            <button
              type="button"
              onClick={() => stepDigit(index, -1)}
              aria-label={`ลดค่าหลักที่ ${index + 1}`}
              className="flex h-6 w-10 items-center justify-center rounded border border-zinc-300 text-sm font-bold leading-none dark:border-zinc-700"
            >
              −
            </button>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-zinc-500">ไม่ต้องกรอกครบทุกหลัก ช่องที่เว้นว่างจะถือเป็น 0</p>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={addDigit}
          disabled={digits.length >= MAX_DIGIT_COUNT}
          aria-label="เพิ่มหลักมิเตอร์"
          className="flex h-8 items-center justify-center rounded border border-zinc-300 px-3 text-sm font-bold leading-none disabled:opacity-30 dark:border-zinc-700"
        >
          เพิ่ม
        </button>
        <button
          type="button"
          onClick={removeDigit}
          disabled={digits.length <= DEFAULT_DIGIT_COUNT}
          aria-label="ลดหลักมิเตอร์"
          className="flex h-8 items-center justify-center rounded border border-zinc-300 px-3 text-sm font-bold leading-none disabled:opacity-30 dark:border-zinc-700"
        >
          ลด
        </button>
      </div>
      <p className="text-center text-xs text-zinc-500">เพิ่มหลักมิเตอร์</p>
      {error && (
        <p id={errorId} role="alert" className="text-sm font-semibold text-red-600">
          ✕ {error}
        </p>
      )}
    </div>
  );
}
