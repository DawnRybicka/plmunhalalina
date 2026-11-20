// =============================================================
// HALALina - POST /api/vote
// -------------------------------------------------------------
// The client encrypts the ballot with AES-GCM (E2EE) and sends the
// encrypted envelope + hashed voter ID + receipt seed to the
// server. The server:
//   1. Validates the session (student only)
//   2. Verifies the voter hasn't already voted (D1 VOTER_LOG)
//   3. Mines a new block server-side (PoW: hash starts with "000")
//   4. Stores the block + transaction in D1
//   5. Marks the voter as having voted
//   6. Returns the receipt (transaction hash, block hash, etc.)
//
// Request body: { encryptedBallot, transactionHash }
//   - encryptedBallot: { ciphertextHex, ivHex, saltHex } (from client E2EE)
//   - transactionHash: SHA-256 of the ballot payload (computed client-side)
// =============================================================

const db = require('../lib/db');
const { logAudit, error, json } = require('../lib/api-helpers');
const { addVoteTransaction } = require('../lib/blockchain');
const { generateReceipt } = require('../lib/crypto');
const { ELECTION_ID } = require('../lib/constants');

async function onRequestPost({ request, env, data }) {
  // 1. Validate session
  const session = data.session;
  if (!session) return error('Not logged in.', 401);
  if (session.role !== 'student') return error('Admins cannot vote.', 403);

  // 2. Parse body
  const body = await request.json().catch(() => null);
  if (!body) return error('Invalid JSON body.');
  if (!body.encryptedBallot || !body.encryptedBallot.ciphertextHex) {
    return error('Missing encryptedBallot.');
  }
  if (!body.transactionHash) return error('Missing transactionHash.');

  // 3. Check the voter hasn't already voted (off-chain VOTER_LOG)
  const voterLog = await db.first(env, 'SELECT * FROM VOTER_LOG WHERE student_id = ?', session.id);
  if (voterLog && voterLog.has_voted) {
    await logAudit(env, {
      action: 'SYSTEM_ACTION',
      actor: session.hashed_voter_id,
      details: { note: 'Double-vote attempt blocked' }
    });
    return error('You have already voted. Each student may vote only once.', 409);
  }

  // 4. Build the transaction record for the blockchain
  const transaction = {
    transactionHash: body.transactionHash,
    hashedVoterId: session.hashed_voter_id,
    encryptedBallot: body.encryptedBallot,
    electionId: ELECTION_ID,
    timestamp: Date.now(),
    candidateIds: null  // intentionally null on the public record
  };

  // 5. Mine + store the block (atomic in D1)
  let block;
  try {
    block = await addVoteTransaction(env, transaction);
  } catch (e) {
    console.error('Vote mining failed:', e);
    return error('Failed to record vote: ' + (e.message || 'unknown'), 500);
  }

  // 6. Mark the voter as having voted (off-chain VOTER_LOG)
  if (voterLog) {
    // Existing record (probably with has_voted=0): update it
    await db.run(env,
      'UPDATE VOTER_LOG SET has_voted = 1, vote_timestamp = ?, transaction_hash = ? WHERE student_id = ?',
      transaction.timestamp, transaction.transactionHash, session.id
    );
  } else {
    // Insert a new record
    await db.run(env,
      'INSERT INTO VOTER_LOG (student_id, hashed_voter_id, has_voted, vote_timestamp, transaction_hash) VALUES (?, ?, 1, ?, ?)',
      session.id, session.hashed_voter_id, transaction.timestamp, transaction.transactionHash
    );
  }

  // Also update the MOCK_STUDENT_SIS has_voted flag (for fast lookups)
  await db.run(env, 'UPDATE MOCK_STUDENT_SIS SET has_voted = 1, vote_hash = ? WHERE student_id = ?',
    transaction.transactionHash, session.id);

  // 7. Generate the human-readable receipt
  const receiptCode = await generateReceipt(transaction.transactionHash + session.hashed_voter_id);

  // 8. Log the vote cast event (admin-only in the audit trail)
  await logAudit(env, {
    action: 'VOTE_CAST',
    actor: session.hashed_voter_id,
    details: { block_index: block.index }  // no tx hash, no receipt code - admin only sees block #
  });

  // 9. Return the receipt to the voter
  return json({
    ok: true,
    transactionHash: transaction.transactionHash,
    receiptCode,
    blockIndex: block.index,
    blockHash: block.hash,
    voteTimestamp: transaction.timestamp
  });
}

module.exports = { onRequestPost };
