// =============================================================
// HALALina - POST /api/logout
// Clears the session cookie and logs a LOGOUT audit entry.
// =============================================================

const { buildDeleteCookieHeader } = require('../lib/auth');
const { logAudit } = require('../lib/api-helpers');

async function onRequestPost({ request, env, data }) {
  const session = data.session;
  if (session) {
    await logAudit(env, {
      action: 'LOGOUT',
      actor: session.hashed_voter_id || 'anonymous',
      details: { role: session.role }
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildDeleteCookieHeader()
    }
  });
}

module.exports = { onRequestPost };
