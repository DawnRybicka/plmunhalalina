// =============================================================
// HALALina - Server-side crypto helpers (Web Crypto API)
// -------------------------------------------------------------
// Cloudflare Workers runtime exposes the Web Crypto API, so we can
// reuse the same SHA-256 + AES-GCM code as the client side.
// =============================================================

// ---- UTF-8 helpers ----
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function strToBuf(str) {
  return encoder.encode(str);
}
function bufToStr(buf) {
  return decoder.decode(buf);
}
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

// ---- SHA-256 ----
async function sha256(message) {
  const buf = strToBuf(message);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return bufToHex(hashBuf);
}
async function sha256Upper(message) {
  return (await sha256(message)).toUpperCase();
}

// ---- Anonymize student ID: SHA-256(salt:student_id) ----
async function anonymizeStudentId(studentId, salt) {
  return sha256(salt + ':' + studentId + ':' + String(studentId).length);
}

// ---- AES-GCM decryption (used by /api/tally to decrypt ballots) ----
// The encryption happens client-side; the server only needs to decrypt
// for the admin tally view.
async function deriveKey(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', strToBuf(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function aesDecrypt(envelope, passphrase) {
  const salt = new Uint8Array(hexToBuf(envelope.saltHex));
  const iv = new Uint8Array(hexToBuf(envelope.ivHex));
  const key = await deriveKey(passphrase, salt);
  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    hexToBuf(envelope.ciphertextHex)
  );
  return bufToStr(ptBuf);
}

// ---- HMAC-SHA256 for signing session tokens ----
async function hmacSign(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw', strToBuf(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, strToBuf(message));
  return bufToHex(sig);
}
async function hmacVerify(message, signatureHex, secret) {
  const expected = await hmacSign(message, secret);
  // Constant-time-ish comparison
  if (expected.length !== signatureHex.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }
  return diff === 0;
}

// ---- Generate a random session token ----
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bufToHex(bytes);
}

// ---- Generate a short, human-readable receipt code ----
// Returns a 20-char hex string split into 5 groups of 4 chars
// (e.g. "804E-37C0-36B2-745B-0439"). Computed as the first 20
// chars of SHA-256(input) uppercased.
async function generateReceipt(input) {
  const h = await sha256Upper(input);
  return h.slice(0, 4) + '-' + h.slice(4, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20);
}

// ---- Generate a random 32-byte hex (used as salts) ----
function randomSalt() {
  return bufToHex(crypto.getRandomValues(new Uint8Array(16)));
}

module.exports = {
  strToBuf, bufToStr, bufToHex, hexToBuf,
  sha256, sha256Upper,
  anonymizeStudentId,
  aesDecrypt,
  hmacSign, hmacVerify,
  randomToken,
  generateReceipt,
  randomSalt
};
