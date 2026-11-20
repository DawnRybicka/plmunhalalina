// =============================================================
// HALALina - Cryptographic Utilities
// Uses native Web Crypto API for real SHA-256 hashing and
// AES-GCM encryption (no external libraries needed)
// =============================================================

const CryptoUtils = (function () {

  // ---- UTF-8 helpers ----
  function strToBuf(str) {
    return new TextEncoder().encode(str);
  }
  function bufToStr(buf) {
    return new TextDecoder().decode(buf);
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

  // ---- SHA-256 with hex output (uppercase for receipts) ----
  async function sha256Upper(message) {
    const h = await sha256(message);
    return h.toUpperCase();
  }

  // ---- AES-GCM key derivation from a passphrase ----
  async function deriveKey(passphrase, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      strToBuf(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // ---- AES-GCM Encrypt (End-to-End Encryption simulation) ----
  // Returns: { ciphertextHex, ivHex, saltHex } all base16 strings.
  async function aesEncrypt(plaintext, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);

    const ctBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      strToBuf(plaintext)
    );

    return {
      ciphertextHex: bufToHex(ctBuf),
      ivHex: bufToHex(iv),
      saltHex: bufToHex(salt)
    };
  }

  // ---- AES-GCM Decrypt (for audit purposes, with correct passphrase) ----
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

  // ---- Generate a short, human-readable receipt code ----
  async function generateReceipt(input) {
    const h = await sha256Upper(input);
    // Format as XXXX-XXXX-XXXX-XXXX-XXXX for readability
    return h.slice(0, 4) + '-' + h.slice(4, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20);
  }

  // ---- Anonymize Student ID (SHA-256 of salted student ID) ----
  // The original ID is hashed so the blockchain cannot be reverse-engineered to identify voters.
  async function anonymizeStudentId(studentId, salt) {
    return sha256(salt + ':' + studentId + ':' + (salt.length));
  }

  // ---- Generate random 32-byte hex (used as salts) ----
  function randomSalt() {
    return bufToHex(crypto.getRandomValues(new Uint8Array(16)));
  }

  // ---- Generate a unique session token ----
  function sessionToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return bufToHex(bytes);
  }

  // ---- Generate a short nonce for blockchain mining ----
  function randomNonce() {
    return Math.floor(Math.random() * 1_000_000_000);
  }

  return {
    strToBuf,
    bufToStr,
    bufToHex,
    hexToBuf,
    sha256,
    sha256Upper,
    aesEncrypt,
    aesDecrypt,
    generateReceipt,
    anonymizeStudentId,
    randomSalt,
    sessionToken,
    randomNonce
  };
})();

// Expose globally (browser & Node)
if (typeof globalThis !== 'undefined') globalThis.CryptoUtils = CryptoUtils;
if (typeof module !== 'undefined' && module.exports) module.exports = CryptoUtils;
