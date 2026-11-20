// =============================================================
// HALALina - GET /api/tally
// -------------------------------------------------------------
// Decrypts every ballot on the chain (using the ELECTION_KEY
// env secret) and returns per-candidate counts per position.
//
// This is the "admin/audit view" of the live tally. The tally
// itself is anonymous - it shows only aggregate counts per
// candidate, never which voter voted for whom.
//
// In production, the ELECTION_KEY would be split across multiple
// trustees using Shamir's Secret Sharing so no single admin can
// decrypt individual ballots. For this demo, it's a single secret.
// =============================================================

const db = require('../lib/db');
const { aesDecrypt } = require('../lib/crypto');
const { error, json } = require('../lib/api-helpers');

async function onRequestGet({ env, data }) {
  const session = data.session;
  if (!session) return error('Not logged in.', 401);

  // Both students and admins can see the tally (it's anonymous)
  const electionKey = env.ELECTION_KEY || 'PLMUN-SSC-2026-E2EE-DEMO-KEY';

  // Load all transactions
  const txs = await db.all(env, 'SELECT transaction_hash, encrypted_ballot FROM BLOCKCHAIN_TRANSACTIONS ORDER BY block_index ASC');

  // Decrypt each ballot and tally the candidate IDs
  const tallies = {};
  for (const tx of txs) {
    if (!tx.encrypted_ballot) continue;
    try {
      const envelope = JSON.parse(tx.encrypted_ballot);
      const plaintext = await aesDecrypt(envelope, electionKey);
      const decoded = JSON.parse(plaintext);
      if (decoded && Array.isArray(decoded.candidateIds)) {
        for (const candId of decoded.candidateIds) {
          tallies[candId] = (tallies[candId] || 0) + 1;
        }
      }
    } catch (e) {
      // skip malformed
    }
  }

  return json({ ok: true, tallies });
}

module.exports = { onRequestGet };
