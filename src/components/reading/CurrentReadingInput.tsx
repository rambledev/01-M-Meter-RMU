"use client";

import type { ChangeEvent, KeyboardEvent } from "react";

interface CurrentReadingInputProps {
  id: string;
  value: string;
  onChange: (raw: string) => void;
  error?: string;
}

const ALLOWED_NAVIGATION_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Enter",
]);

// Best-effort UI filtering only — blocks obviously-wrong keystrokes so
// typing feels right, but this is NOT the source of truth for validity.
// It cannot catch paste, and deliberately doesn't try to: the real check
// is meterReadingValidation.ts's validateReadingFormat(), re-run on every
// change against the exact raw value (never trimmed/altered here).
function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey) return; // allow copy/paste/select-all/cut shortcuts
  if (ALLOWED_NAVIGATION_KEYS.has(e.key)) return;
  if (/^[0-9.]$/.test(e.key)) return;
  e.preventDefault();
}

// The main focus point of the page — large, centered, mobile-first. The
// value it holds is always exactly what the user typed/pasted; nothing
// here ever rewrites it (see meterReadingValidation.ts's file header for
// why — this is the SOURCE OF TRUTH for the reading, OCR only ever
// suggests into it, never overwrites silently).
export default function CurrentReadingInput({
  id,
  value,
  onChange,
  error,
}: CurrentReadingInputProps) {
  const errorId = `${id}-error`;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold" htmlFor={id}>
        ค่ามิเตอร์ครั้งนี้
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-lg border px-3 py-4 text-center text-3xl font-bold tracking-wide dark:bg-zinc-900 ${
          error
            ? "border-red-400 focus:border-red-500"
            : "border-zinc-300 focus:border-emerald-500 dark:border-zinc-700"
        }`}
        placeholder="0"
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm font-semibold text-red-600">
          ✕ {error}
        </p>
      )}
    </div>
  );
}
