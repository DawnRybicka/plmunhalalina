// =============================================================
// HALALina - Audit Trail Module
// Logs all system activities (login attempts, votes cast,
// vote verifications, system actions). Persists to localStorage.
// Provides filters for post-election verification without
// revealing voter identities (uses hashed voter IDs only).
//
// VISIBILITY LEVELS (per the user's request to separate admin
// vs student views):
//
//   - PUBLIC  : Visible to all logged-in users (students + admins).
//               Includes VOTE_VERIFIED, VOTE_NOT_FOUND, SYSTEM_ACTION.
//               These are the "anonymous" audit entries that don't
//               reference any specific voter.
//
//   - SYSTEM  : Visible only to admin accounts.
//               Includes LOGIN_SUCCESS, LOGIN_FAILED,
//               LOGIN_REJECTED_ALREADY_VOTED, LOGOUT, VOTE_CAST,
//               BLOCKCHAIN_VALID, BLOCKCHAIN_INVALID.
//               These are the "system audit trail" entries that
//               the user asked to mark as admin-only.
//
// The visibility is determined by the action name (see
// ACTION_VISIBILITY below) and is enforced by the AuditTrail.getAll()
// function when called with a { role: 'student' } filter.
// =============================================================

const AuditTrail = (function () {
  const KEY = 'halalina_audit_trail_v1';

  // ---- Visibility map ----
  // Determines which actions a student vs admin can see.
  const ACTION_VISIBILITY = {
    // System audit trail (admin-only)
    LOGIN_SUCCESS: 'system',
    LOGIN_FAILED: 'system',
    LOGIN_REJECTED_ALREADY_VOTED: 'system',
    LOGOUT: 'system',
    VOTE_CAST: 'system',
    BLOCKCHAIN_VALID: 'system',
    BLOCKCHAIN_INVALID: 'system',

    // Public audit trail (visible to all)
    VOTE_VERIFIED: 'public',
    VOTE_NOT_FOUND: 'public',
    SYSTEM_ACTION: 'public'
  };

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
  function log(entry) {
    const logs = load();
    const action = entry.action || 'UNKNOWN';
    const enriched = {
      log_id: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 9999),
      timestamp: entry.timestamp || Date.now(),
      action: action,
      actor: entry.actor || 'system',
      details: entry.details || {},
      visibility: ACTION_VISIBILITY[action] || 'system'  // default to system if unknown
    };
    logs.push(enriched);
    save(logs);
    return enriched;
  }

  // -------- Get all logs (optionally filtered by role) --------
  // filter = {
  //   action?: string,         // filter by action type
  //   actor?: string,          // filter by actor
  //   from?: number,           // filter by timestamp >=
  //   to?: number,             // filter by timestamp <=
  //   role?: 'student'|'admin' // role-based visibility filter
  // }
  // When role === 'student', only 'public' visibility entries are returned.
  // When role === 'admin' (or undefined), all entries are returned.
  function getAll(filter) {
    let logs = load();
    if (filter) {
      if (filter.action) logs = logs.filter(l => l.action === filter.action);
      if (filter.actor) logs = logs.filter(l => l.actor === filter.actor);
      if (filter.from) logs = logs.filter(l => l.timestamp >= filter.from);
      if (filter.to) logs = logs.filter(l => l.timestamp <= filter.to);
      if (filter.role === 'student') {
        logs = logs.filter(l => (l.visibility || ACTION_VISIBILITY[l.action] || 'system') === 'public');
      }
    }
    return logs.slice().reverse(); // newest first
  }

  // -------- Get a specific count --------
  function count(action) {
    const logs = load();
    if (!action) return logs.length;
    return logs.filter(l => l.action === action).length;
  }

  // -------- Stats (admin view: counts everything) --------
  function stats() {
    const logs = load();
    return {
      total: logs.length,
      logins: logs.filter(l => l.action === 'LOGIN_SUCCESS').length,
      failed_logins: logs.filter(l => l.action === 'LOGIN_FAILED').length,
      votes_cast: logs.filter(l => l.action === 'VOTE_CAST').length,
      vote_verifications: logs.filter(l => l.action === 'VOTE_VERIFIED').length,
      logouts: logs.filter(l => l.action === 'LOGOUT').length,
      system_only: logs.filter(l => (l.visibility || ACTION_VISIBILITY[l.action] || 'system') === 'system').length,
      public_only: logs.filter(l => (l.visibility || ACTION_VISIBILITY[l.action] || 'system') === 'public').length
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

  // -------- Visibility label --------
  function visibilityOf(action) {
    return ACTION_VISIBILITY[action] || 'system';
  }

  return {
    log,
    getAll,
    count,
    stats,
    reset,
    formatTimestamp,
    label,
    visibilityOf,
    ACTION_VISIBILITY
  };
})();

if (typeof globalThis !== 'undefined') globalThis.AuditTrail = AuditTrail;
if (typeof module !== 'undefined' && module.exports) module.exports = AuditTrail;
