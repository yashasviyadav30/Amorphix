// Signed guest identity. Anyone can try Amorphix without logging in; the app gives each browser a random guest id
// in an HMAC-signed cookie. The agents accept a request only with a valid cookie, so nobody can drive the
// model from outside the app.

export const GUEST_COOKIE = "amorphix_guest";

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, value: string) {
  if (!secret || secret.length < 32) throw new Error("AMORPHIX_SESSION_SECRET must be at least 32 characters");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}

// Constant-time comparison so a wrong signature takes as long to reject as a nearly right one.
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const ID = /^[0-9a-f-]{36}$/;

export async function signGuest(id: string, secret: string) {
  if (!ID.test(id)) throw new Error("guest id must be a UUID");
  return `${id}.${await hmac(secret, id)}`;
}

export async function verifyGuest(cookie: string | undefined | null, secret: string): Promise<string | null> {
  if (!cookie) return null;
  const dot = cookie.indexOf(".");
  if (dot < 0) return null;
  const id = cookie.slice(0, dot);
  if (!ID.test(id)) return null;
  return same(cookie.slice(dot + 1), await hmac(secret, id)) ? id : null;
}

export function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

// Decide what a request needs: keep a valid guest cookie, or mint a new signed one.
export async function ensureGuest(cookie: string | null | undefined, secret: string, newId: () => string = () => crypto.randomUUID()) {
  const id = await verifyGuest(cookie, secret);
  if (id) return { id, set: null };
  const fresh = newId();
  return { id: fresh, set: await signGuest(fresh, secret) };
}

// Signed-in users get their own cookie, signed under a separate label so a guest cookie can never pass as a user.
export const USER_COOKIE = "amorphix_user";

export async function signUser(id: string, secret: string) {
  if (!ID.test(id)) throw new Error("user id must be a UUID");
  return `${id}.${await hmac(secret, `user:${id}`)}`;
}

export async function verifyUser(cookie: string | undefined | null, secret: string): Promise<string | null> {
  if (!cookie) return null;
  const dot = cookie.indexOf(".");
  if (dot < 0) return null;
  const id = cookie.slice(0, dot);
  if (!ID.test(id)) return null;
  return same(cookie.slice(dot + 1), await hmac(secret, `user:${id}`)) ? id : null;
}
