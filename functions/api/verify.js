// =============================================================
// HALALina - POST /api/verify
// Looks up a vote by transaction hash (or receipt code) and returns
// the block info if found, without revealing who voted.
// =============================================================

const { findTransaction } = require('../lib/blockchain');
const { generateReceipt } = require('../lib/crypto');
const { logAudit, error, json } = require('../lib/api-helpers');
const db = require('../lib/db');

async function onRequestPost({ request, env, data }) {
  const session = data.session;
  if (!session) return error('Not logged in.', 401);

  const body = await request.json().catch(() => null);
  if (!body || !body.query) return error('Missing "query" (receipt code or transaction hash).');

  const query = String(body.query).trim();

  // Try matching the query directly as a transaction hash
  let match = await findTransaction(env, query);

  // If not found, try matching as a receipt code (the receipt is derived
  // from the transaction hash + hashed voter ID). We iterate over all
  // transactions and compute the receipt for each, looking for a match.
  // This is O(n) but fine for a demo.
  if (!match) {
    const allTxs = await db.all(env, 'SELECT transaction_hash, hashed_voter_id, block_index, timestamp FROM BLOCKCHAIN_TRANSACTIONS');
    for (const tx of allTxs) {
      const expectedReceipt = await generateReceipt(tx.transaction_hash + tx.hashed_voter_id);
      if (expectedReceipt.toLowerCase() === query.toLowerCase()) {
        match = await findTransaction(env, tx.transaction_hash);
        break;
      }
    }
  }

  if (!match) {
    await logAudit(env, {
      action: 'VOTE_NOT_FOUND',
      actor: 'anonymous',
      details: {}  // don't echo the query (could be a receipt code)
    });
    return json({ ok: false, reason: 'No matching vote found for the provided receipt / hash.' }, 404);
  }

  await logAudit(env, {
    action: 'VOTE_VERIFIED',
    actor: 'anonymous',
    details: { block_index: match.blockIndex }  // don't include the tx hash (private)
  });

  return json({
    ok: true,
    transactionHash: match.transactionHash,
    blockIndex: match.blockIndex,
    blockHash: match.blockHash,
    timestamp: match.timestamp,
    hashedVoterId: match.hashedVoterId
  });
}

module.exports = { onRequestPost };
