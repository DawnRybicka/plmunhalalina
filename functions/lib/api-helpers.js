// =============================================================
// HALALina - Shared helpers for Pages Function endpoints
// -------------------------------------------------------------
// JSON response builder, CORS headers, audit logging, etc.
// =============================================================

const db = require('./db');
const { ACTION_VISIBILITY } = require('./constants');

// ---- Build a JSON Response ----
function json(data, status = 200, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    ...extraHeaders
  };
  return new Response(JSON.stringify(data), { status, headers });
}

// ---- Build an error JSON Response ----
function error(message, status = 400, extraHeaders = {}) {
  return json({ ok: false, reason: message }, status, extraHeaders);
}

// ---- Read a JSON request body ----
async function readJsonBody(request) {
  try {
    const text = await request.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---- Get the current timestamp in milliseconds ----
function now() {
  return Date.now();
}

// ---- Log an audit-trail entry ----
// env: the Cloudflare Pages env (with the D1 binding)
// entry: { action, actor, details }
async function logAudit(env, entry) {
  const action = entry.action || 'UNKNOWN';
  const visibility = ACTION_VISIBILITY[action] || 'system';
  await db.run(
    env,
    'INSERT INTO AUDIT_TRAIL (timestamp, ts_millis, action, actor, details, visibility) VALUES (?, ?, ?, ?, ?, ?)',
    new Date().toISOString(),
    entry.timestamp || now(),
    action,
    entry.actor || 'system',
    entry.details ? db.stringifyJson(entry.details) : null,
    visibility
  );
}

// ---- Get audit log entries, filtered by role ----
// role = 'admin' (sees everything) or 'student' (sees only 'public')
async function getAuditLog(env, filter = {}) {
  let sql = 'SELECT * FROM AUDIT_TRAIL';
  const where = [];
  const params = [];
  if (filter.action) {
    where.push('action = ?');
    params.push(filter.action);
  }
  if (filter.role === 'student') {
    where.push("visibility = 'public'");
  }
  if (filter.from) {
    where.push('ts_millis >= ?');
    params.push(filter.from);
  }
  if (where.length > 0) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY ts_millis DESC';
  if (filter.limit) sql += ' LIMIT ' + parseInt(filter.limit, 10);

  const rows = await db.all(env, sql, ...params);
  return rows.map(r => ({
    log_id: 'LOG-' + r.ts_millis + '-' + r.log_id,
    timestamp: r.ts_millis,
    action: r.action,
    actor: r.actor,
    details: db.parseJsonSafe(r.details, {}),
    visibility: r.visibility
  }));
}

// ---- Format a millisecond timestamp as ISO UTC string ----
function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// ---- Compute audit-trail stats ----
async function getAuditStats(env) {
  const total = await db.first(env, 'SELECT COUNT(*) AS c FROM AUDIT_TRAIL');
  const logins = await db.first(env, "SELECT COUNT(*) AS c FROM AUDIT_TRAIL WHERE action = 'LOGIN_SUCCESS'");
  const failed = await db.first(env, "SELECT COUNT(*) AS c FROM AUDIT_TRAIL WHERE action = 'LOGIN_FAILED'");
  const votes = await db.first(env, "SELECT COUNT(*) AS c FROM AUDIT_TRAIL WHERE action = 'VOTE_CAST'");
  const verifications = await db.first(env, "SELECT COUNT(*) AS c FROM AUDIT_TRAIL WHERE action = 'VOTE_VERIFIED'");
  const logouts = await db.first(env, "SELECT COUNT(*) AS c FROM AUDIT_TRAIL WHERE action = 'LOGOUT'");
  const system = await db.first(env, "SELECT COUNT(*) AS c FROM AUDIT_TRAIL WHERE visibility = 'system'");
  const pub = await db.first(env, "SELECT COUNT(*) AS c FROM AUDIT_TRAIL WHERE visibility = 'public'");
  return {
    total: total ? total.c : 0,
    logins: logins ? logins.c : 0,
    failed_logins: failed ? failed.c : 0,
    votes_cast: votes ? votes.c : 0,
    vote_verifications: verifications ? verifications.c : 0,
    logouts: logouts ? logouts.c : 0,
    system_only: system ? system.c : 0,
    public_only: pub ? pub.c : 0
  };
}

module.exports = {
  json, error, readJsonBody,
  now,
  logAudit, getAuditLog, getAuditStats, formatTimestamp
};
