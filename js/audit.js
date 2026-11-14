// =============================================================
// HALALina - Audit Trail Module
// Logs all system activities (login attempts, votes cast,
// vote verifications, system actions). Persists to localStorage.
// Provides filters for post-election verification without
// revealing voter identities (uses hashed voter IDs only).
// =============================================================

const AuditTrail = (function () {
  const KEY = 'halalina_audit_trail_v1';

  // -------- Load all logs --------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function save(logs) {
    localStorage.setItem(KEY, JSON.stringify(logs));
  }

  // -------- Append a log entry --------
  // entry = { action, actor, details, timestamp }
  // action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGIN_REJECTED_ALREADY_VOTED' |
  //         'LOGOUT' | 'VOTE_CAST' | 'VOTE_VERIFIED' | 'VOTE_NOT_FOUND' |
  //         'BLOCKCHAIN_VALID' | 'BLOCKCHAIN_INVALID' | 'SYSTEM_ACTION' | ...
  function log(entry) {
    const logs = load();
    const enriched = {
      log_id: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 9999),
      timestamp: entry.timestamp || Date.now(),
      action: entry.action || 'UNKNOWN',
      actor: entry.actor || 'system',
      details: entry.details || {}
    };
    logs.push(enriched);
    save(logs);
    return enriched;
  }

  // -------- Get all logs --------
  function getAll(filter) {
    let logs = load();
    if (filter) {
      if (filter.action) logs = logs.filter(l => l.action === filter.action);
      if (filter.actor) logs = logs.filter(l => l.actor === filter.actor);
      if (filter.from) logs = logs.filter(l => l.timestamp >= filter.from);
      if (filter.to) logs = logs.filter(l => l.timestamp <= filter.to);
    }
    return logs.slice().reverse(); // newest first
  }

  // -------- Get a specific count --------
  function count(action) {
    const logs = load();
    if (!action) return logs.length;
    return logs.filter(l => l.action === action).length;
  }

  // -------- Stats --------
  function stats() {
    const logs = load();
    return {
      total: logs.length,
      logins: logs.filter(l => l.action === 'LOGIN_SUCCESS').length,
      failed_logins: logs.filter(l => l.action === 'LOGIN_FAILED').length,
      votes_cast: logs.filter(l => l.action === 'VOTE_CAST').length,
      vote_verifications: logs.filter(l => l.action === 'VOTE_VERIFIED').length,
      logouts: logs.filter(l => l.action === 'LOGOUT').length
    };
  }

  // -------- Reset (admin) --------
  function reset() {
    localStorage.removeItem(KEY);
  }

  // -------- Format timestamp --------
  function formatTimestamp(ts) {
    const d = new Date(ts);
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  }

  // -------- Action label --------
  const ACTION_LABELS = {
    LOGIN_SUCCESS: 'Login Success',
    LOGIN_FAILED: 'Login Failed',
    LOGIN_REJECTED_ALREADY_VOTED: 'Login Rejected (Already Voted)',
    LOGOUT: 'Logout',
    VOTE_CAST: 'Vote Cast',
    VOTE_VERIFIED: 'Vote Verified',
    VOTE_NOT_FOUND: 'Vote Lookup - Not Found',
    BLOCKCHAIN_VALID: 'Blockchain Validated',
    BLOCKCHAIN_INVALID: 'Blockchain Validation FAILED',
    SYSTEM_ACTION: 'System Action'
  };

  function label(action) {
    return ACTION_LABELS[action] || action;
  }

  return {
    log,
    getAll,
    count,
    stats,
    reset,
    formatTimestamp,
    label
  };
})();

if (typeof globalThis !== 'undefined') globalThis.AuditTrail = AuditTrail;
if (typeof module !== 'undefined' && module.exports) module.exports = AuditTrail;
