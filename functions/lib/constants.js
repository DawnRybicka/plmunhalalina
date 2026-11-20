// =============================================================
// HALALina - Server-side constants
// -------------------------------------------------------------
// These constants are shared across all Pages Functions.
// Values come from wrangler.toml [vars] (with sensible defaults
// for local development via wrangler pages dev).
// =============================================================

// Static salt for voter ID hashing. In production, store this as
// a Cloudflare Pages secret (don't rely on the wrangler.toml value).
// We use the env value if available, falling back to a default.
const SALT = (typeof HALALINA_SALT !== 'undefined' && HALALINA_SALT) || 'HALALINA-PLMUN-2026-SIS-SALT';

// PoW difficulty: each block hash must start with this many zeros.
const DIFFICULTY = 3;

// Election ID (matches the ELECTION_SCHEDULE row in D1).
const ELECTION_ID = 'ELEC-2026-SSC';

// Maximum attempts for PoW mining before giving up (avoids infinite
// loops in slow environments).
const MINING_MAX_ATTEMPTS = 500_000;

// Audit-trail visibility categories per the user's spec:
//   'system' = admin-only: LOGIN_*, VOTE_CAST, BLOCKCHAIN_*
//   'public' = everyone: VOTE_VERIFIED, VOTE_NOT_FOUND, SYSTEM_ACTION
const ACTION_VISIBILITY = {
  LOGIN_SUCCESS: 'system',
  LOGIN_FAILED: 'system',
  LOGIN_REJECTED_ALREADY_VOTED: 'system',
  LOGOUT: 'system',
  VOTE_CAST: 'system',
  BLOCKCHAIN_VALID: 'system',
  BLOCKCHAIN_INVALID: 'system',
  // Public actions visible to all logged-in users:
  VOTE_VERIFIED: 'public',
  VOTE_NOT_FOUND: 'public',
  SYSTEM_ACTION: 'public'
};

module.exports = {
  SALT,
  DIFFICULTY,
  ELECTION_ID,
  MINING_MAX_ATTEMPTS,
  ACTION_VISIBILITY
};

// Expose globally too (for Pages Functions which use ES module syntax)
if (typeof globalThis !== 'undefined') {
  globalThis.HALALINA_CONSTANTS = module.exports;
}
