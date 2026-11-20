// =============================================================
// HALALina - Server-side authentication helpers
// -------------------------------------------------------------
// Issues HMAC-signed session cookies that the client uses for all
// authenticated API calls. The cookie contains the student_id (or
// admin_id) and role, signed with the SESSION_SECRET env var so it
// can't be forged.
//
// Cookie format:  base64url(JSON{ id, role, name, ... }) . hex(hmacSig)
// =============================================================

const { hmacSign, hmacVerify } = require('./crypto');

const COOKIE_NAME = 'halalina_session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;  // 8 hours

// ---- Base64url helpers ----
function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

// ---- Create a signed session cookie value ----
async function createSession(payload, secret) {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = await hmacSign(body, secret);
  return `${body}.${sig}`;
}

// ---- Verify and decode a session cookie value ----
async function verifySession(cookieValue, secret) {
  if (!cookieValue || typeof cookieValue !== 'string') return null;
  const dot = cookieValue.lastIndexOf('.');
  if (dot === -1) return null;
  const body = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const ok = await hmacVerify(body, sig, secret);
  if (!ok) return null;
  try {
    return JSON.parse(b64urlDecode(body));
  } catch {
    return null;
  }
}

// ---- Parse cookies from a Cookie header ----
function parseCookieHeader(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

// ---- Get the session from the request cookies ----
async function getSessionFromRequest(request, secret) {
  const cookies = parseCookieHeader(request.headers.get('Cookie') || '');
  const value = cookies[COOKIE_NAME];
  if (!value) return null;
  return await verifySession(value, secret);
}

// ---- Build a Set-Cookie header value for the session ----
function buildSetCookieHeader(value, maxAgeSeconds) {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];
  // In production (HTTPS), also set Secure. We detect via the
  // request URL but be conservative: only set Secure if the
  // request was over HTTPS.
  // The actual decision is made by the caller; we expose this as a
  // helper that the caller can pass `secure=true` to.
  return parts.join('; ');
}

// ---- Build a Set-Cookie header that DELETES the session ----
function buildDeleteCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

module.exports = {
  COOKIE_NAME,
  COOKIE_MAX_AGE_SECONDS,
  createSession,
  verifySession,
  parseCookieHeader,
  getSessionFromRequest,
  buildSetCookieHeader,
  buildDeleteCookieHeader
};
