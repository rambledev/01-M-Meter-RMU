"use client";

import { useSyncExternalStore } from "react";

// UI-only network indicator (item 10 of the Phase 3 spec) — no auto-sync
// triggering here, that is Phase 5's job.
function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

// Assume online during SSR/first paint; corrected immediately on the client.
function getServerSnapshot() {
  return true;
}

export default function OnlineStatusBadge() {
  const isOnline = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        isOnline
          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-600" : "bg-amber-600"}`}
      />
      {isOnline ? "ONLINE" : "OFFLINE"}
    </span>
  );
}
