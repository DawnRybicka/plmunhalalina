// =============================================================
// HALALina - /api/blockchain
// -------------------------------------------------------------
//   GET  /api/blockchain          - returns the full chain (for display)
//   POST /api/blockchain/validate - admin only: validate the chain,
//                                    log the result to audit, return
//                                    the validation details
// =============================================================

const { getChain, getStats, isChainValid } = require('../lib/blockchain');
const { logAudit, json, error } = require('../lib/api-helpers');

async function onRequestGet({ env, data }) {
  const session = data.session;
  if (!session) return error('Not logged in.', 401);

  // Both students and admins can see the chain (it's the public ledger)
  const chain = await getChain(env);
  const stats = await getStats(env);
  return json({ ok: true, chain, stats });
}

async function onRequestPost({ env, data }) {
  // POST is used for /api/blockchain/validate (admin only)
  const session = data.session;
  if (!session) return error('Not logged in.', 401);
  if (session.role !== 'admin') return error('Admin only.', 403);

  const result = await isChainValid(env);
  const stats = await getStats(env);

  await logAudit(env, {
    action: result.valid ? 'BLOCKCHAIN_VALID' : 'BLOCKCHAIN_INVALID',
    actor: 'system',
    details: { failure_count: result.failures.length }
  });

  return json({
    ok: true,
    valid: result.valid,
    failures: result.failures,
    stats
  });
}

module.exports = { onRequestGet, onRequestPost };
