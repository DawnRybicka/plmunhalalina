// =============================================================
// HALALina - Pages Functions middleware
// -------------------------------------------------------------
// Runs before every /api/* request. Responsible for:
//   - Setting CORS headers (so the same origin can call the API)
//   - Validating the session cookie and attaching it to the
//     request's data context (so handlers can check `data.session`)
// =============================================================

const { getSessionFromRequest } = require('./lib/auth');
const { ELECTION_ID } = require('./lib/constants');

// Cloudflare Pages Functions can export an onRequest handler that
// runs before each route handler. We use the onFetch format that
// passes through to the next handler via `next()`.

async function onRequest(context) {
  const { request, env, next } = context;

  // Handle CORS preflight (OPTIONS) requests quickly
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Cookie',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Attach the session to the context so handlers can read it.
  // The secret comes from env.SESSION_SECRET (a Cloudflare secret).
  // In local dev (without secrets), fall back to a default.
  const secret = env.SESSION_SECRET || 'dev-only-default-secret-change-me';
  const session = await getSessionFromRequest(request, secret);

  // Make session + secret available to downstream handlers
  context.data = context.data || {};
  context.data.session = session;
  context.data.sessionSecret = secret;
  context.data.env = env;

  // Call the next handler
  const response = await next();

  // Add CORS headers to the response too
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

module.exports = { onRequest };
