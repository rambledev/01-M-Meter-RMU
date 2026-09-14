import { OAuth2Client } from "google-auth-library";

const ALLOWED_DOMAIN = "rmu.ac.th";

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
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) return null;

    return { email, name: payload.name ?? email };
  } catch (err) {
    console.error("[resident] Google ID token verification failed", err);
    return null;
  }
}
