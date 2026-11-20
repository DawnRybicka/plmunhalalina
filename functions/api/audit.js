// =============================================================
// HALALina - GET /api/audit
// -------------------------------------------------------------
// Returns audit log entries, filtered by the caller's role:
//   - students see only 'public' visibility entries
//   - admins see everything
//
// Query params:
//   ?action=LOGIN_SUCCESS   - filter by action
//   ?limit=50                - max entries (default 50, max 1000)
// =============================================================

const { getAuditLog, getAuditStats, json, error } = require('../lib/api-helpers');

async function onRequestGet({ request, env, data }) {
  const session = data.session;
  if (!session) return error('Not logged in.', 401);

  const url = new URL(request.url);
  const filter = {
    action: url.searchParams.get('action') || '',
    role: session.role,  // 'admin' sees everything, 'student' sees only public
    limit: Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 1000)
  };

  const logs = await getAuditLog(env, filter);
  const stats = await getAuditStats(env);

  return json({ ok: true, logs, stats });
}

module.exports = { onRequestGet };
