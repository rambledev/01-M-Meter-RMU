import { OAuth2Client } from "google-auth-library";

const ALLOWED_DOMAIN = "rmu.ac.th";

// (2026-09-17) Per-email exception to the @rmu.ac.th-only rule above —
// requested explicitly by the user to let one specific Admin account log
// in with a non-RMU Gmail address. Deliberately a small hardcoded
// allowlist (not a config toggle that broadens the whole domain rule):
// every other account still must be @rmu.ac.th, this list only ever adds
// specific already-approved individual addresses, never a pattern/domain.
const EXTRA_ALLOWED_EMAILS = new Set(["techodev.2024@gmail.com"]);

export interface VerifiedGoogleUser {
  email: string;
  name: string;
}

// Verifies a Google Identity Services ID token server-side (signature +
// audience, via the official google-auth-library — never hand-rolled JWT
// verification for something security-critical like this) and enforces
// the @rmu.ac.th domain restriction the user asked for ("เท่านั้น" — only).
// Returns null for anything invalid/wrong-domain rather than throwing, so
// the route can respond with one consistent "เข้าสู่ระบบไม่สำเร็จ" message
// without leaking which specific check failed.
export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleUser | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("[resident] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set — cannot verify Google login");
    return null;
  }

  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) return null;

    const email = payload.email.toLowerCase();
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`) && !EXTRA_ALLOWED_EMAILS.has(email)) return null;

    return { email, name: payload.name ?? email };
  } catch (err) {
    console.error("[resident] Google ID token verification failed", err);
    return null;
  }
}
