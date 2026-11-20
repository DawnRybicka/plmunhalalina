// =============================================================
// HALALina - Client-side Audit Trail (Cloudflare Pages edition)
// -------------------------------------------------------------
// Fetches the audit log from /api/audit. The server filters entries
// by role: students only see 'public' entries, admins see all.
// =============================================================

const AuditTrail = (function () {
  let cachedLogs = [];
  let cachedStats = null;

  // ---- GET /api/audit -> { logs, stats } ----
  async function fetchLogs(filter) {
    const params = new URLSearchParams();
    if (filter && filter.action) params.set('action', filter.action);
    if (filter && filter.limit) params.set('limit', String(filter.limit));
    const url = '/api/audit' + (params.toString() ? '?' + params.toString() : '');
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return { logs: [], stats: null };
    const data = await res.json();
    cachedLogs = data.logs || [];
    cachedStats = data.stats || null;
    return { logs: cachedLogs, stats: cachedStats };
  }

  // ---- Get cached logs (without a network call) ----
  function getAll(filter) {
    let logs = cachedLogs.slice();
    if (filter) {
      if (filter.action) logs = logs.filter(l => l.action === filter.action);
      if (filter.from) logs = logs.filter(l => l.timestamp >= filter.from);
      if (filter.to) logs = logs.filter(l => l.timestamp <= filter.to);
    }
    return logs.reverse();  // newest first
  }

  function count(action) {
    if (!action) return cachedLogs.length;
    return cachedLogs.filter(l => l.action === action).length;
  }

  function stats() {
    return cachedStats || {
      total: 0, logins: 0, failed_logins: 0, votes_cast: 0,
      vote_verifications: 0, logouts: 0, system_only: 0, public_only: 0
    };
  }

  function reset() {
    // No-op - the audit trail is server-side. Reset would require an
    // admin endpoint to clear the table.
  }

  function formatTimestamp(ts) {
    const d = new Date(ts);
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  }

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
  function label(action) { return ACTION_LABELS[action] || action; }

  const ACTION_VISIBILITY = {
    LOGIN_SUCCESS: 'system',
    LOGIN_FAILED: 'system',
    LOGIN_REJECTED_ALREADY_VOTED: 'system',
    LOGOUT: 'system',
    VOTE_CAST: 'system',
    BLOCKCHAIN_VALID: 'system',
    BLOCKCHAIN_INVALID: 'system',
    VOTE_VERIFIED: 'public',
    VOTE_NOT_FOUND: 'public',
    SYSTEM_ACTION: 'public'
  };
  function visibilityOf(action) { return ACTION_VISIBILITY[action] || 'system'; }

  return {
    fetchLogs,
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
