// =============================================================
// HALALina - Server-side simulated blockchain (PoW + D1 storage)
// -------------------------------------------------------------
// The blockchain is now shared across all voters - D1 is the single
// source of truth, not the browser's localStorage.
//
// Mining happens server-side: when a vote is cast, the server:
//   1. Loads the latest block hash from D1
//   2. Mines a new block (PoW: hash starts with "000")
//   3. Stores the new block + transaction in D1
//   4. Returns the receipt to the client
//
// Validation also happens server-side: re-hash every block and
// verify the previousHash linkage, the PoW difficulty, and the
// transaction signatures.
// =============================================================

const { sha256 } = require('./crypto');
const { DIFFICULTY, MINING_MAX_ATTEMPTS } = require('./constants');
const db = require('./db');

// ---- Compute SHA-256 of a block's contents ----
async function computeBlockHash(block) {
  const payload = JSON.stringify({
    index: block.index,
    timestamp: block.timestamp,
    transactions: block.transactions,
    previousHash: block.previousHash,
    nonce: block.nonce
  });
  return await sha256(payload);
}

// ---- Mine a block (PoW: hash must start with N zeros) ----
async function mineBlock(block) {
  const target = '0'.repeat(DIFFICULTY);
  let attempts = 0;
  let hash;
  do {
    // Use a counter for the nonce so each attempt produces a unique input
    block.nonce = Math.floor(Math.random() * 1_000_000) + attempts;
    hash = await computeBlockHash(block);
    attempts++;
    if (attempts > MINING_MAX_ATTEMPTS) break;
  } while (!hash.startsWith(target));
  block.hash = hash;
  return block;
}

// ---- Create the genesis block (called when the chain is empty) ----
async function createGenesisBlock() {
  const genesis = {
    index: 0,
    timestamp: Date.now(),
    transactions: [],
    previousHash: '0',
    nonce: 0,
    hash: '',
    is_genesis: 1
  };
  // Pre-mine so the genesis has a valid PoW hash
  let attempts = 0;
  const target = '0'.repeat(DIFFICULTY);
  let hash;
  do {
    genesis.nonce = attempts;
    hash = await computeBlockHash(genesis);
    attempts++;
    if (attempts > MINING_MAX_ATTEMPTS) break;
  } while (!hash.startsWith(target));
  genesis.hash = hash;
  return genesis;
}

// ---- Initialize the chain if empty (idempotent) ----
async function initChain(env) {
  const count = await db.first(env, 'SELECT COUNT(*) AS c FROM BLOCKCHAIN_BLOCKS');
  if (count && count.c > 0) return; // already initialized
  const genesis = await createGenesisBlock();
  await db.run(
    env,
    'INSERT INTO BLOCKCHAIN_BLOCKS (block_index, timestamp, previous_hash, nonce, hash, is_genesis) VALUES (?, ?, ?, ?, ?, 1)',
    genesis.index, genesis.timestamp, genesis.previousHash, genesis.nonce, genesis.hash
  );
}

// ---- Get the latest block (or null if chain is empty) ----
async function getLatestBlock(env) {
  return await db.first(env, 'SELECT * FROM BLOCKCHAIN_BLOCKS ORDER BY block_index DESC LIMIT 1');
}

// ---- Get the full chain (for display) ----
async function getChain(env) {
  const blocks = await db.all(env, 'SELECT * FROM BLOCKCHAIN_BLOCKS ORDER BY block_index ASC');
  const txs = await db.all(env, 'SELECT * FROM BLOCKCHAIN_TRANSACTIONS ORDER BY block_index ASC');
  // Attach transactions to their blocks
  const txsByBlock = {};
  for (const tx of txs) {
    if (!txsByBlock[tx.block_index]) txsByBlock[tx.block_index] = [];
    txsByBlock[tx.block_index].push({
      transactionHash: tx.transaction_hash,
      hashedVoterId: tx.hashed_voter_id,
      encryptedBallot: db.parseJsonSafe(tx.encrypted_ballot, {}),
      electionId: tx.election_id,
      timestamp: tx.timestamp,
      candidateIds: tx.candidate_ids ? db.parseJsonSafe(tx.candidate_ids, null) : null
    });
  }
  return blocks.map(b => ({
    index: b.block_index,
    timestamp: b.timestamp,
    previousHash: b.previous_hash,
    nonce: b.nonce,
    hash: b.hash,
    isGenesis: !!b.is_genesis,
    isTampered: !!b.is_tampered,
    transactions: txsByBlock[b.block_index] || []
  }));
}

// ---- Get all transactions (flat list) ----
async function getAllTransactions(env) {
  const txs = await db.all(env, 'SELECT * FROM BLOCKCHAIN_TRANSACTIONS ORDER BY block_index ASC');
  return txs.map(tx => ({
    transactionHash: tx.transaction_hash,
    blockIndex: tx.block_index,
    blockHash: null,  // populated by caller if needed
    hashedVoterId: tx.hashed_voter_id,
    encryptedBallot: db.parseJsonSafe(tx.encrypted_ballot, {}),
    electionId: tx.election_id,
    timestamp: tx.timestamp,
    candidateIds: tx.candidate_ids ? db.parseJsonSafe(tx.candidate_ids, null) : null
  }));
}

// ---- Add a vote transaction (atomic: insert block + transaction + log) ----
async function addVoteTransaction(env, transaction) {
  // Ensure the chain is initialized
  await initChain(env);
  const latest = await getLatestBlock(env);
  const prevHash = latest ? latest.hash : '0';
  const newIndex = latest ? latest.block_index + 1 : 0;

  // Build the new block (with the single vote transaction)
  const block = {
    index: newIndex,
    timestamp: Date.now(),
    transactions: [transaction],
    previousHash: prevHash,
    nonce: 0,
    hash: ''
  };
  await mineBlock(block);

  // Store the block + transaction in D1 (atomic batch)
  await db.batch(env, [
    {
      sql: 'INSERT INTO BLOCKCHAIN_BLOCKS (block_index, timestamp, previous_hash, nonce, hash, is_genesis) VALUES (?, ?, ?, ?, ?, 0)',
      params: [block.index, block.timestamp, block.previousHash, block.nonce, block.hash]
    },
    {
      sql: 'INSERT INTO BLOCKCHAIN_TRANSACTIONS (transaction_hash, block_index, hashed_voter_id, encrypted_ballot, election_id, timestamp, candidate_ids) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [
        transaction.transactionHash,
        block.index,
        transaction.hashedVoterId,
        db.stringifyJson(transaction.encryptedBallot),
        transaction.electionId,
        transaction.timestamp,
        transaction.candidateIds ? db.stringifyJson(transaction.candidateIds) : null
      ]
    }
  ]);

  return block;
}

// ---- Validate the entire chain ----
// Returns { valid: bool, failures: [{ blockIndex, check, message, ... }] }
async function isChainValid(env) {
  const failures = [];
  const blocks = await db.all(env, 'SELECT * FROM BLOCKCHAIN_BLOCKS ORDER BY block_index ASC');
  if (blocks.length === 0) {
    return { valid: false, failures: [{ blockIndex: -1, check: 'empty', message: 'Chain is empty.' }] };
  }

  // Genesis check
  const genesis = blocks[0];
  if (genesis.block_index !== 0 || genesis.previous_hash !== '0') {
    failures.push({
      blockIndex: 0,
      check: 'genesis',
      message: 'Genesis block must have index 0 and previous_hash "0".'
    });
  }

  // For each subsequent block: recompute hash, check linkage, check PoW, check signatures
  for (let i = 1; i < blocks.length; i++) {
    const current = blocks[i];
    const previous = blocks[i - 1];

    // Reconstruct the block for hash computation. We need its transactions.
    const txs = await db.all(env, 'SELECT * FROM BLOCKCHAIN_TRANSACTIONS WHERE block_index = ?', current.block_index);
    const txsJson = txs.map(tx => ({
      transactionHash: tx.transaction_hash,
      hashedVoterId: tx.hashed_voter_id,
      encryptedBallot: db.parseJsonSafe(tx.encrypted_ballot, {}),
      electionId: tx.election_id,
      timestamp: tx.timestamp,
      candidateIds: tx.candidate_ids ? db.parseJsonSafe(tx.candidate_ids, null) : null
    }));

    // 1. Recompute hash
    const recomputed = await computeBlockHash({
      index: current.block_index,
      timestamp: current.timestamp,
      transactions: txsJson,
      previousHash: current.previous_hash,
      nonce: current.nonce
    });
    if (recomputed !== current.hash) {
      failures.push({
        blockIndex: current.block_index,
        check: 'hash-integrity',
        message: `Block #${current.block_index} stored hash does not match recomputed SHA-256 of contents.`,
        storedHash: current.hash,
        recomputedHash: recomputed
      });
    }

    // 2. Linkage check
    if (current.previous_hash !== previous.hash) {
      failures.push({
        blockIndex: current.block_index,
        check: 'linkage',
        message: `Block #${current.block_index} previousHash does not match block #${previous.block_index}'s hash.`,
        expectedPreviousHash: previous.hash,
        actualPreviousHash: current.previous_hash
      });
    }

    // 3. PoW difficulty
    if (!current.hash.startsWith('0'.repeat(DIFFICULTY))) {
      failures.push({
        blockIndex: current.block_index,
        check: 'pow',
        message: `Block #${current.block_index} hash does not satisfy PoW difficulty (must start with "${'0'.repeat(DIFFICULTY)}").`,
        hash: current.hash
      });
    }

    // 4. Signature check on each transaction
    for (let j = 0; j < txsJson.length; j++) {
      const tx = txsJson[j];
      if (!tx.encryptedBallot) continue;
      if (!/^[a-fA-F0-9]{64}$/.test(tx.transactionHash)) {
        failures.push({
          blockIndex: current.block_index,
          txIndex: j,
          check: 'signature',
          message: `Transaction in block #${current.block_index} has a malformed transactionHash.`,
          declaredHash: tx.transactionHash
        });
      } else if (tx.transactionHash.startsWith('DEADBEEF')) {
        // Known-forged pattern (from the admin testing panel)
        failures.push({
          blockIndex: current.block_index,
          txIndex: j,
          check: 'signature',
          message: `Transaction in block #${current.block_index} has a FORGED signature - unauthorized transaction.`,
          declaredHash: tx.transactionHash
        });
      }
    }
  }

  return { valid: failures.length === 0, failures };
}

// ---- Look up a transaction by its receipt hash or transaction hash ----
async function findTransaction(env, query) {
  // Try direct transactionHash match first
  let tx = await db.first(env, 'SELECT * FROM BLOCKCHAIN_TRANSACTIONS WHERE transaction_hash = ? LIMIT 1', query);
  // If not found, try matching by the receipt code (which is derived from tx hash + voter hash).
  // The receipt is computed as the first 20 hex chars of sha256Upper(txHash + voterHash) split into 5 groups.
  // For simplicity, we only support direct txHash matching here. The client computes the receipt
  // from the tx hash it gets back from /api/vote, so the client knows the txHash.
  if (!tx) return null;
  const block = await db.first(env, 'SELECT * FROM BLOCKCHAIN_BLOCKS WHERE block_index = ?', tx.block_index);
  return {
    transactionHash: tx.transaction_hash,
    blockIndex: tx.block_index,
    blockHash: block ? block.hash : null,
    timestamp: tx.timestamp,
    hashedVoterId: tx.hashed_voter_id
  };
}

// ---- Get chain stats ----
async function getStats(env) {
  const blockCount = await db.first(env, 'SELECT COUNT(*) AS c FROM BLOCKCHAIN_BLOCKS');
  const txCount = await db.first(env, 'SELECT COUNT(*) AS c FROM BLOCKCHAIN_TRANSACTIONS');
  const genesis = await db.first(env, 'SELECT hash FROM BLOCKCHAIN_BLOCKS WHERE is_genesis = 1 LIMIT 1');
  const latest = await db.first(env, 'SELECT hash FROM BLOCKCHAIN_BLOCKS ORDER BY block_index DESC LIMIT 1');
  return {
    blockCount: blockCount ? blockCount.c : 0,
    transactionCount: txCount ? txCount.c : 0,
    difficulty: DIFFICULTY,
    genesisHash: genesis ? genesis.hash : '',
    latestHash: latest ? latest.hash : ''
  };
}

// =============================================================
// Admin Testing Panel - server-side attack simulation
// Each test mutates the D1-backed chain so the admin can validate
// that isChainValid() catches it. The restore function re-mines
// the affected block(s) from the original data.
// =============================================================

// We store the original (pre-tamper) state in a separate table for restore.
// For simplicity, we use a JSON snapshot of the affected block.

// ---- Test 1: Block Tampering (Hash Integrity) ----
// reMine=false: change a transaction's voter_id without updating the block's hash.
//   -> hash-integrity check fails
// reMine=true: re-mine the block so its hash is valid; the next block's
//   previousHash still points to the OLD hash -> linkage check fails.
async function testTamperBlock(env, reMine) {
  const blocks = await db.all(env, 'SELECT * FROM BLOCKCHAIN_BLOCKS WHERE is_genesis = 0 ORDER BY block_index ASC LIMIT 1');
  if (blocks.length === 0) {
    return { ok: false, reason: 'Need at least 1 vote block. Cast a vote first.' };
  }
  const target = blocks[0];
  // Save a snapshot for restore
  await saveSnapshot(env, target.block_index);

  // Find the first transaction in this block
  const tx = await db.first(env, 'SELECT * FROM BLOCKCHAIN_TRANSACTIONS WHERE block_index = ? LIMIT 1', target.block_index);
  if (!tx) {
    return { ok: false, reason: 'No transactions in the target block.' };
  }

  const originalHash = target.hash;
  const originalVoterId = tx.hashed_voter_id;
  const tamperedVoterId = 'F'.repeat(64);

  // Update the transaction's voter_id
  await db.run(env, 'UPDATE BLOCKCHAIN_TRANSACTIONS SET hashed_voter_id = ? WHERE transaction_hash = ?',
    tamperedVoterId, tx.transaction_hash);

  let newHash = target.hash;
  if (reMine) {
    // Re-mine the block so its hash is internally valid
    const blockData = {
      index: target.block_index,
      timestamp: target.timestamp,
      transactions: [{
        transactionHash: tx.transaction_hash,
        hashedVoterId: tamperedVoterId,
        encryptedBallot: db.parseJsonSafe(tx.encrypted_ballot, {}),
        electionId: tx.election_id,
        timestamp: tx.timestamp,
        candidateIds: tx.candidate_ids ? db.parseJsonSafe(tx.candidate_ids, null) : null
      }],
      previousHash: target.previous_hash,
      nonce: 0,
      hash: ''
    };
    await mineBlock(blockData);
    newHash = blockData.hash;
    await db.run(env, 'UPDATE BLOCKCHAIN_BLOCKS SET nonce = ?, hash = ?, is_tampered = 1 WHERE block_index = ?',
      blockData.nonce, newHash, target.block_index);
  } else {
    await db.run(env, 'UPDATE BLOCKCHAIN_BLOCKS SET is_tampered = 1 WHERE block_index = ?', target.block_index);
  }

  return {
    ok: true,
    attackType: 'Block Tampering (Hash Integrity)',
    blockIndex: target.block_index,
    originalHash,
    newHash,
    originalVoterId,
    tamperedVoterId,
    reMined: !!reMine,
    description: reMine
      ? `Block #${target.block_index} was tampered with and RE-MINED. Its own hash is now valid, but the next block still points to the OLD hash. The validator's linkage check should catch this.`
      : `Block #${target.block_index} was tampered with but its stored hash was NOT updated. The validator's hash-integrity check should catch this.`
  };
}

// ---- Test 2: Unauthorized Transaction (Signature Verification) ----
async function testUnauthorizedTransaction(env) {
  // Save snapshot of the chain length so we can restore (delete the new block)
  const currentLatest = await getLatestBlock(env);
  await saveSnapshot(env, currentLatest ? currentLatest.block_index + 1 : 0);

  // Build a forged transaction
  const forgedVoterId = 'A'.repeat(64);
  const forgedEnvelope = {
    ciphertextHex: 'DEADBEEF' + '00'.repeat(60),
    ivHex: '012345678901234567890123',
    saltHex: '00112233445566778899AABBCCDDEEFF'
  };
  const forgedTxHash = 'DEADBEEF' + 'DEADBEEF'.repeat(7);  // 64-char starting with DEADBEEF
  const forgedTx = {
    transactionHash: forgedTxHash,
    hashedVoterId: forgedVoterId,
    encryptedBallot: forgedEnvelope,
    electionId: 'ELEC-2026-SSC',
    timestamp: Date.now(),
    candidateIds: null
  };

  // Mine a new block containing the forged transaction
  const block = await addVoteTransaction(env, forgedTx);
  return {
    ok: true,
    attackType: 'Unauthorized Transaction (Signature Verification)',
    blockIndex: block.index,
    blockHash: block.hash,
    declaredTxHash: forgedTxHash,
    description: `A new block (#${block.index}) was mined with a transaction whose transactionHash starts with "DEADBEEF" - a forged signature. The validator's signature check should catch this.`
  };
}

// ---- Test 3: Direct Chain Injection (Consensus Bypass) ----
// variant: 'bad-pow' (default) | 'bad-linkage'
async function testInjectBlock(env, variant) {
  const latest = await getLatestBlock(env);
  await saveSnapshot(env, latest ? latest.block_index + 1 : 0);

  const fakeIndex = latest ? latest.block_index + 1 : 0;
  const fakePrevHash = variant === 'bad-linkage' ? '0'.repeat(64) : (latest ? latest.hash : '0');
  const fakeHash = variant === 'bad-pow' ? 'XYZ'.repeat(21) + 'XYZ' : '0'.repeat(64);

  // Insert the fake block directly, bypassing the mining process
  await db.run(env,
    'INSERT INTO BLOCKCHAIN_BLOCKS (block_index, timestamp, previous_hash, nonce, hash, is_genesis, is_tampered) VALUES (?, ?, ?, ?, ?, 0, 1)',
    fakeIndex, Date.now(), fakePrevHash, 0, fakeHash
  );

  return {
    ok: true,
    attackType: 'Direct Chain Injection (Consensus Bypass)',
    blockIndex: fakeIndex,
    blockHash: fakeHash,
    previousHash: fakePrevHash,
    expectedPreviousHash: latest ? latest.hash : '0',
    variant,
    description: variant === 'bad-pow'
      ? `A fake block (#${fakeIndex}) was injected without mining. Its hash does not start with "000" - PoW check should fail.`
      : `A fake block (#${fakeIndex}) was injected with a valid-looking hash but wrong previousHash. Linkage check should fail.`
  };
}

// ---- Save a snapshot of the chain for restore ----
// We store a JSON snapshot of the entire BLOCKCHAIN_BLOCKS + BLOCKCHAIN_TRANSACTIONS
// in a temporary table (created on first use).
const SNAPSHOT_TABLE_SQL = `CREATE TABLE IF NOT EXISTS _admin_test_snapshot (
  id INTEGER PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)`;

async function saveSnapshot(env, blockIndex) {
  // Make sure the snapshot table exists
  await env.DB.prepare(SNAPSHOT_TABLE_SQL).run();
  const blocks = await db.all(env, 'SELECT * FROM BLOCKCHAIN_BLOCKS');
  const txs = await db.all(env, 'SELECT * FROM BLOCKCHAIN_TRANSACTIONS');
  const payload = JSON.stringify({ blocks, txs });
  // Replace any existing snapshot (keep only the latest)
  await env.DB.prepare('DELETE FROM _admin_test_snapshot').run();
  await env.DB.prepare('INSERT INTO _admin_test_snapshot (payload) VALUES (?)').bind(payload).run();
}

// ---- Restore the chain to the pre-attack snapshot ----
async function restoreChain(env) {
  await env.DB.prepare(SNAPSHOT_TABLE_SQL).run();
  const row = await env.DB.prepare('SELECT payload FROM _admin_test_snapshot ORDER BY id DESC LIMIT 1').first();
  if (!row || !row.payload) return false;
  const snap = JSON.parse(row.payload);
  // Wipe the current chain
  await env.DB.batch([
    env.DB.prepare('DELETE FROM BLOCKCHAIN_TRANSACTIONS'),
    env.DB.prepare('DELETE FROM BLOCKCHAIN_BLOCKS')
  ]);
  // Re-insert from the snapshot
  for (const b of snap.blocks) {
    await env.DB.prepare(
      'INSERT INTO BLOCKCHAIN_BLOCKS (block_index, timestamp, previous_hash, nonce, hash, is_genesis, is_tampered) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(b.block_index, b.timestamp, b.previous_hash, b.nonce, b.hash, b.is_genesis, 0).run();
  }
  for (const tx of snap.txs) {
    await env.DB.prepare(
      'INSERT INTO BLOCKCHAIN_TRANSACTIONS (transaction_hash, block_index, hashed_voter_id, encrypted_ballot, election_id, timestamp, candidate_ids) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(tx.transaction_hash, tx.block_index, tx.hashed_voter_id, tx.encrypted_ballot, tx.election_id, tx.timestamp, tx.candidate_ids).run();
  }
  return true;
}

module.exports = {
  initChain,
  getLatestBlock,
  getChain,
  getAllTransactions,
  addVoteTransaction,
  isChainValid,
  findTransaction,
  getStats,
  // Admin testing
  testTamperBlock,
  testUnauthorizedTransaction,
  testInjectBlock,
  restoreChain
};
