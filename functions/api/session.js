// =============================================================
// HALALina - GET /api/session
// Returns the current session payload (or 401 if not logged in).
// The client uses this on page load to auto-login from the cookie.
// =============================================================

async function onRequestGet({ data }) {
  const session = data.session;
  if (!session) {
    return new Response(JSON.stringify({ ok: false, reason: 'Not logged in.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ ok: true, session }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}

module.exports = { onRequestGet };
