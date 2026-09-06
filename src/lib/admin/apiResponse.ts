import { NextResponse } from "next/server";
import type { ApiErrorBody } from "./types";

// Shared JSON error shape for every /api/admin/** route — mirrors the
// pattern already used by src/app/api/readings/sync/route.ts.
export function apiError(
  status: number,
  error: ApiErrorBody["error"],
  message: string,
) {
  const body: ApiErrorBody = { ok: false, error, message };
  return NextResponse.json(body, { status });
}
