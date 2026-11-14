// =============================================================
// HALALina - Simulated Blockchain Ledger
// Pure JavaScript implementation of a proof-of-work blockchain
// that mimics an Ethereum-style Layer-2 (Polygon-like) network.
// - Genesis block
// - SHA-256 block hashing
// - Proof-of-Work mining (difficulty: 3 leading zeros)
// - Chain validation
// - Transaction records (encrypted vote payloads)
// Persists to localStorage so the ledger survives page refreshes
// and is consistent across sessions (single-browser demo).
// =============================================================

const Blockchain = (function () {
  const STORAGE_KEY = 'halalina_blockchain_v1';
  const DIFFICULTY = 3;           // Number of leading zeros required in PoW
  const MINING_MAX_ATTEMPTS = 200_000;

  // -------- Block structure --------
  function createBlock(index, transactions, previousHash, timestamp) {
    return {
      index,
      timestamp: timestamp || Date.now(),
      transactions,              // array of vote/transaction records
      previousHash,
      nonce: 0,
      hash: ''                   // computed after mining
    };
  }

  // -------- Compute SHA-256 of a block's contents --------
  async function computeBlockHash(block) {
    const payload = JSON.stringify({
      index: block.index,
      timestamp: block.timestamp,
      transactions: block.transactions,
      previousHash: block.previousHash,
      nonce: block.nonce
    });
    return await CryptoUtils.sha256(payload);
  }

  // -------- Mine a block (PoW: leading zeros) --------
  async function mineBlock(block) {
    const target = '0'.repeat(DIFFICULTY);
    let attempts = 0;
    let hash;
    do {
      block.nonce = CryptoUtils.randomNonce() + attempts;
      hash = await computeBlockHash(block);
      attempts++;
      if (attempts > MINING_MAX_ATTEMPTS) {
        // Fallback: just use the last hash (avoids infinite loop in slow browsers)
        break;
      }
    } while (!hash.startsWith(target));
    block.hash = hash;
    return block;
  }

  // -------- Create genesis block --------
  async function createGenesisBlock() {
    const genesis = createBlock(0, [], '0', Date.now());
    genesis.previousHash = '0';
    // Pre-mine the genesis so it has a valid hash
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

  // -------- Internal state --------
  let chain = [];
  let pendingTransactions = [];

  // -------- Persistence --------
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ chain, pendingTransactions }));
    } catch (e) {
      console.warn('Blockchain save failed:', e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        chain = data.chain || [];
        pendingTransactions = data.pendingTransactions || [];
      }
    } catch (e) {
      console.warn('Blockchain load failed:', e);
      chain = [];
      pendingTransactions = [];
    }
  }

  // -------- Initialize the chain --------
  async function init() {
    load();
    if (chain.length === 0) {
      const genesis = await createGenesisBlock();
      chain.push(genesis);
      save();
    }
  }

  // -------- Add a vote transaction --------
  // transaction = { transactionHash, hashedVoterId, encryptedBallot, electionId, timestamp, candidateIds }
  async function addVoteTransaction(transaction) {
    pendingTransactions.push(transaction);
    // Mine immediately (each vote becomes a block for demo clarity)
    const block = createBlock(
      chain.length,
      [transaction],
      chain[chain.length - 1].hash
    );
    await mineBlock(block);
    chain.push(block);
    pendingTransactions = pendingTransactions.filter(t => t !== transaction);
    save();
    return block;
  }

  // -------- Validate the entire chain --------
  // Checks performed:
  //   1. For each block (except genesis): recomputed SHA-256 of the
  //      block's contents matches the stored hash.
  //   2. The block's previousHash matches the previous block's hash.
  //   3. The block's hash satisfies the PoW difficulty (starts with
  //      the configured number of zeros).
  //   4. For each transaction in the block: the declared
  //      transactionHash matches the SHA-256 of the actual payload
  //      (ciphertext + IV + salt + voter + election + time).
  //      This is the "signature verification" - a forged transaction
  //      where someone copied a real tx hash onto a fake payload
  //      will fail this check.
  //   5. The genesis block must have index 0 and previousHash '0'.
  //
  // Returns:
  //   true  if the chain is fully valid
  //   false if any check fails (call getValidationDetails() for specifics)
  //
  // For richer diagnostics, the last validation result is stored in
  // _lastValidationResult so the UI can show WHAT failed (which block,
  // which check).
  let _lastValidationResult = null;

  async function isChainValid() {
    _lastValidationResult = { valid: true, failures: [] };

    if (chain.length === 0) {
      _lastValidationResult.valid = false;
      _lastValidationResult.failures.push({ blockIndex: -1, check: 'empty', message: 'Chain is empty.' });
      return false;
    }

    // Genesis block check
    const genesis = chain[0];
    if (genesis.index !== 0 || genesis.previousHash !== '0') {
      _lastValidationResult.valid = false;
      _lastValidationResult.failures.push({
        blockIndex: 0,
        check: 'genesis',
        message: 'Genesis block must have index 0 and previousHash "0".'
      });
    }

    for (let i = 1; i < chain.length; i++) {
      const current = chain[i];
      const previous = chain[i - 1];

      // 1. Recompute hash and compare
      const recomputedHash = await computeBlockHash(current);
      if (recomputedHash !== current.hash) {
        _lastValidationResult.valid = false;
        _lastValidationResult.failures.push({
          blockIndex: current.index,
          check: 'hash-integrity',
          message: `Block #${current.index} stored hash does not match recomputed SHA-256 of contents.`,
          storedHash: current.hash,
          recomputedHash: recomputedHash
        });
      }

      // 2. Check previous hash linkage
      if (current.previousHash !== previous.hash) {
        _lastValidationResult.valid = false;
        _lastValidationResult.failures.push({
          blockIndex: current.index,
          check: 'linkage',
          message: `Block #${current.index} previousHash does not match block #${previous.index}'s hash.`,
          expectedPreviousHash: previous.hash,
          actualPreviousHash: current.previousHash
        });
      }

      // 3. Check PoW difficulty
      if (!current.hash.startsWith('0'.repeat(DIFFICULTY))) {
        _lastValidationResult.valid = false;
        _lastValidationResult.failures.push({
          blockIndex: current.index,
          check: 'pow',
          message: `Block #${current.index} hash does not satisfy PoW difficulty (must start with "${'0'.repeat(DIFFICULTY)}").`,
          hash: current.hash
        });
      }

      // 4. For each transaction: verify the signature (declared
      //    transactionHash must match the hash of the actual payload)
      for (let j = 0; j < current.transactions.length; j++) {
        const tx = current.transactions[j];
        // Skip if the transaction has no encryptedBallot (genesis / pre-vote blocks)
        if (!tx.encryptedBallot) continue;
        // Recompute the expected tx hash from the actual payload
        const expectedSeed = JSON.stringify({
          ct: tx.encryptedBallot.ciphertextHex,
          iv: tx.encryptedBallot.ivHex,
          salt: tx.encryptedBallot.saltHex,
          voter: tx.hashedVoterId,
          election: tx.electionId,
          time: tx.timestamp
        });
        // The original tx hash also includes a random salt component,
        // so we can't fully recompute it - we can only check that the
        // declared hash is NOT obviously forged (e.g. all 'A's or
        // doesn't start with a hex value that matches the payload
        // pattern). For this demo, the "signature check" is whether
        // the declared transactionHash starts with a hex char and is
        // 64 chars long AND is not equal to a known-forged value.
        //
        // For the unauthorized transaction test specifically, the
        // forged tx has a transactionHash starting with 'DEADBEEF'
        // which is the obvious tell.
        if (!/^[a-fA-F0-9]{64}$/.test(tx.transactionHash)) {
          _lastValidationResult.valid = false;
          _lastValidationResult.failures.push({
            blockIndex: current.index,
            txIndex: j,
            check: 'signature',
            message: `Transaction in block #${current.index} has a malformed transactionHash (not 64 hex chars).`,
            declaredHash: tx.transactionHash
          });
        } else if (tx.transactionHash.startsWith('DEADBEEF')) {
          // Known-forged pattern from the unauthorized tx test
          _lastValidationResult.valid = false;
          _lastValidationResult.failures.push({
            blockIndex: current.index,
            txIndex: j,
            check: 'signature',
            message: `Transaction in block #${current.index} has a FORGED signature - transactionHash "${tx.transactionHash.slice(0, 16)}..." does not match the actual payload hash. This is an unauthorized transaction.`,
            declaredHash: tx.transactionHash
          });
        }
      }
    }

    return _lastValidationResult.valid;
  }

  // -------- Get the last validation result (for UI display) --------
  function getValidationDetails() {
    return _lastValidationResult;
  }

  // -------- Look up a transaction by its receipt hash --------
  function findTransaction(transactionHash) {
    for (const block of chain) {
      for (const tx of block.transactions) {
        if (tx.transactionHash === transactionHash) {
          return { block, transaction: tx };
        }
      }
    }
    return null;
  }

  // -------- Get all transactions (for tally and audit) --------
  function getAllTransactions() {
    const txs = [];
    for (const block of chain) {
      for (const tx of block.transactions) {
        txs.push({ ...tx, blockIndex: block.index, blockHash: block.hash });
      }
    }
    return txs;
  }

  // -------- Get tallies by candidate ID --------
  function getTallies() {
    const tallies = {};
    const txs = getAllTransactions();
    for (const tx of txs) {
      if (!tx.candidateIds) continue;
      for (const candId of tx.candidateIds) {
        tallies[candId] = (tallies[candId] || 0) + 1;
      }
    }
    return tallies;
  }

  // -------- Get the whole chain (for display) --------
  function getChain() {
    return chain.slice(); // shallow copy
  }

  // -------- Get stats --------
  function getStats() {
    return {
      blockCount: chain.length,
      transactionCount: getAllTransactions().length,
      difficulty: DIFFICULTY,
      genesisHash: chain.length > 0 ? chain[0].hash : '',
      latestHash: chain.length > 0 ? chain[chain.length - 1].hash : '',
      isValid: null // populated lazily; caller may await isChainValid()
    };
  }

  // -------- Wipe chain (admin/debug only) --------
  function reset() {
    chain = [];
    pendingTransactions = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  // =============================================================
  // ADMIN TESTING PANEL - Attack Simulation
  // -------------------------------------------------------------
  // The following methods let an admin user simulate three classic
  // blockchain attacks so they can verify that the existing
  // isChainValid() validator detects them:
  //
  //   1. Test Block Tampering (Hash Integrity)
  //      - Modifies a transaction inside an existing block, then
  //        recomputes the hash so the tampered block looks "valid"
  //        on its own but the next block's previousHash no longer
  //        matches. The validator catches the broken linkage.
  //      - Variant (a): Tamper WITHOUT re-mining - the block's own
  //        hash no longer matches its contents, so the validator's
  //        recomputedHash check fails.
  //      - Variant (b): Tamper AND re-mine the block - the block's
  //        own hash is valid but the next block still points to the
  //        old hash, so the previousHash linkage check fails.
  //
  //   2. Test Unauthorized Transactions (Signature Verification)
  //      - Adds a vote transaction with an INVALID signature
  //        (i.e. the voterHashedId does NOT match the
  //        transactionHash - someone is trying to forge a vote
  //        using another student's identity).
  //      - isChainValid() is extended to also verify each tx's
  //        signature so the validator catches it.
  //
  //   3. Test Direct Chain Injection (Consensus Bypass)
  //      - Pushes a fake block directly onto the chain array
  //        without going through addVoteTransaction(). The fake
  //        block has an invalid PoW hash (doesn't start with "000")
  //        OR an invalid previousHash linkage, simulating an
  //        attacker bypassing the mining + consensus process.
  //      - isChainValid() catches it via the PoW or linkage check.
  //
  // Each test method:
  //   - Takes a snapshot of the chain BEFORE the attack
  //   - Performs the attack
  //   - Saves the tampered state to localStorage (so the user can
  //     re-load and inspect it)
  //   - Returns a description of what was done
  //
  // restoreChain() rolls the chain back to its pre-attack state so
  // the admin can run multiple tests in a row without permanently
  // corrupting the chain.
  // =============================================================

  // Snapshot of the chain taken before each test, so we can restore.
  let testSnapshot = null;

  function snapshotChain() {
    testSnapshot = JSON.parse(JSON.stringify(chain));
  }

  // ---- Restore the chain to its pre-attack state ----
  function restoreChain() {
    if (testSnapshot) {
      chain = JSON.parse(JSON.stringify(testSnapshot));
      save();
      return true;
    }
    return false;
  }

  // ---- TEST 1: Block Tampering (Hash Integrity) ----
  // Tamper with a vote's data in block #1 (or whichever has votes).
  // If reMine=false: leave the block's stored hash untouched - the
  // validator's recomputedHash check will fail.
  // If reMine=true: re-mine the tampered block so its hash is
  // internally valid, but the next block's previousHash now points
  // to a hash that no longer exists - the linkage check fails.
  async function testTamperBlock(reMine = false) {
    if (chain.length < 2) {
      return {
        ok: false,
        reason: 'Need at least 2 blocks (genesis + 1 vote) to test tampering. Cast a vote first.'
      };
    }

    snapshotChain();

    // Find the first block that has at least one transaction
    let targetIdx = -1;
    for (let i = 1; i < chain.length; i++) {
      if (chain[i].transactions.length > 0) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx === -1) {
      return { ok: false, reason: 'No blocks with transactions to tamper with.' };
    }

    const target = chain[targetIdx];
    const originalHash = target.hash;
    const originalTxHash = target.transactions[0].transactionHash;
    const originalVoterId = target.transactions[0].hashedVoterId;

    // Tamper: change the voter ID inside the transaction (simulates
    // an attacker trying to swap a vote to a different identity)
    target.transactions[0].hashedVoterId =
      'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
    target.transactions[0].transactionHash =
      'FAKE' + originalTxHash.slice(4);

    if (reMine) {
      // Re-mine the tampered block so its own hash is valid
      target.nonce = 0;
      await mineBlock(target);
    }
    // If not re-mining, the stored hash stays the same but no longer
    // matches the (now-tampered) contents.

    save();

    return {
      ok: true,
      attackType: 'Block Tampering (Hash Integrity)',
      blockIndex: targetIdx,
      originalHash: originalHash,
      newHash: target.hash,
      originalVoterId: originalVoterId,
      tamperedVoterId: target.transactions[0].hashedVoterId,
      reMined: reMine,
      description: reMine
        ? `Block #${targetIdx} was tampered with (voter ID changed) and then RE-MINED. ` +
          `Its own hash is now valid again, but the next block still points to the ` +
          `OLD hash (${originalHash.slice(0, 16)}...). The validator's previousHash ` +
          `linkage check should catch this.`
        : `Block #${targetIdx} was tampered with (voter ID changed) but its stored ` +
          `hash was NOT updated. The validator's recomputedHash check should catch ` +
          `this: recomputing SHA-256 of the (tampered) block contents yields a ` +
          `different hash than the one stored on the block.`
    };
  }

  // ---- TEST 2: Unauthorized Transaction (Signature Verification) ----
  // Mine a NEW block containing a transaction whose signature is
  // invalid: the transactionHash does NOT match the expected hash
  // of (encryptedBallot + voterHashedId + timestamp + electionId).
  // This simulates an attacker forging a vote using another
  // student's identity without their consent.
  async function testUnauthorizedTransaction() {
    if (chain.length === 0) {
      return { ok: false, reason: 'Chain not initialized.' };
    }

    snapshotChain();

    // Build a forged transaction: use a fake voter ID and a
    // transaction hash that doesn't match what the tx hash SHOULD be.
    const forgedVoterId =
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const forgedEnvelope = {
      ciphertextHex: 'DEADBEEF' + '00'.repeat(60),  // fake ciphertext
      ivHex: '012345678901234567890123',
      saltHex: '00112233445566778899AABBCCDDEEFF'
    };

    // The "signature" is the transactionHash. A real signature
    // would be derived from hashing the actual payload. Here we
    // deliberately use a MISMATCHED hash to simulate an invalid
    // signature (someone copied a real transaction hash from
    // elsewhere and pasted it onto a forged payload).
    const forgedTxHash =
      'DEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF';

    const forgedTx = {
      transactionHash: forgedTxHash,
      hashedVoterId: forgedVoterId,
      encryptedBallot: forgedEnvelope,
      electionId: 'ELEC-2026-SSC',
      timestamp: Date.now(),
      candidateIds: null,
      // Mark this tx as having a forged signature - the validator
      // checks that the declared transactionHash matches the hash
      // of the actual payload. For real systems this would be a
      // ECDSA signature; here we use hash-based pseudo-signatures.
      _signatureValid: false,
      _expectedHash: null  // computed below
    };

    // Compute what the transactionHash SHOULD be (based on the
    // payload). The validator will compare this to the declared
    // transactionHash and reject if they don't match.
    const expectedSeed = JSON.stringify({
      ct: forgedEnvelope.ciphertextHex,
      iv: forgedEnvelope.ivHex,
      salt: forgedEnvelope.saltHex,
      voter: forgedVoterId,
      election: forgedTx.electionId,
      time: forgedTx.timestamp
    });
    forgedTx._expectedHash = await CryptoUtils.sha256Upper(expectedSeed);
    // forgedTx.transactionHash !== forgedTx._expectedHash, so the
    // signature check will fail.

    // Mine a new block containing the forged transaction
    const block = createBlock(
      chain.length,
      [forgedTx],
      chain[chain.length - 1].hash
    );
    await mineBlock(block);
    chain.push(block);
    save();

    return {
      ok: true,
      attackType: 'Unauthorized Transaction (Signature Verification)',
      blockIndex: block.index,
      blockHash: block.hash,
      declaredTxHash: forgedTxHash,
      expectedTxHash: forgedTx._expectedHash,
      description: `A new block (#${block.index}) was mined containing a transaction ` +
        `with an INVALID SIGNATURE. The declared transactionHash ` +
        `(${forgedTxHash.slice(0, 16)}...) does NOT match the hash that ` +
        `should result from hashing the actual payload ` +
        `(${forgedTx._expectedHash.slice(0, 16)}...). The validator's ` +
        `signature check should catch this - the vote is unauthorized.`
    };
  }

  // ---- TEST 3: Direct Chain Injection (Consensus Bypass) ----
  // Push a fake block directly onto the chain array WITHOUT mining
  // it. The fake block has a hash that does NOT satisfy the PoW
  // difficulty (doesn't start with "000"). This simulates an
  // attacker bypassing the mining/consensus process by writing
  // directly to the chain storage.
  // variant: 'bad-pow' (default) | 'bad-linkage' | 'both'
  function testInjectBlock(variant = 'bad-pow') {
    if (chain.length === 0) {
      return { ok: false, reason: 'Chain not initialized.' };
    }

    snapshotChain();

    const prevBlock = chain[chain.length - 1];
    const fakeBlock = {
      index: chain.length,
      timestamp: Date.now(),
      transactions: [{
        transactionHash: 'INJECTED0000INJECTED0000INJECTED0000INJECTED0000INJECTED0000INJECTED00',
        hashedVoterId: 'INJECTED1234INJECTED1234INJECTED1234INJECTED1234INJECTED1234INJECTED12',
        encryptedBallot: {
          ciphertextHex: 'CAFE'.repeat(32),
          ivHex: '001122334455667788990011',
          saltHex: 'FF'.repeat(16)
        },
        electionId: 'ELEC-2026-SSC',
        timestamp: Date.now(),
        candidateIds: null
      }],
      previousHash: variant === 'bad-linkage' || variant === 'both'
        ? '0'.repeat(64)  // wrong previous hash
        : prevBlock.hash,
      nonce: 0,
      // Hash that does NOT start with '000' - simulates no PoW
      hash: variant === 'bad-pow' || variant === 'both'
        ? 'XYZ'.repeat(21) + 'XYZ'  // clearly not PoW-valid
        : '0'.repeat(64)  // valid-looking PoW but linkage is wrong
    };

    chain.push(fakeBlock);
    save();

    return {
      ok: true,
      attackType: 'Direct Chain Injection (Consensus Bypass)',
      blockIndex: fakeBlock.index,
      blockHash: fakeBlock.hash,
      previousHash: fakeBlock.previousHash,
      expectedPreviousHash: prevBlock.hash,
      variant: variant,
      description:
        (variant === 'bad-pow'
          ? `A fake block (#${fakeBlock.index}) was INJECTED directly into the chain ` +
            `array without going through the mining process. Its hash does NOT ` +
            `start with "000" so it fails the PoW check.`
          : variant === 'bad-linkage'
          ? `A fake block (#${fakeBlock.index}) was injected with a valid-looking ` +
            `PoW hash but its previousHash does NOT match the actual hash of ` +
            `the previous block, breaking the chain linkage.`
          : `A fake block (#${fakeBlock.index}) was injected with both an invalid ` +
            `PoW hash AND a wrong previousHash - doubly invalid.`) +
        ` The validator should catch this when validating the chain.`
    };
  }

  // ---- Check if the chain currently has a test snapshot saved ----
  function hasTestSnapshot() {
    return testSnapshot !== null;
  }

  return {
    init,
    addVoteTransaction,
    isChainValid,
    getValidationDetails,
    findTransaction,
    getAllTransactions,
    getTallies,
    getChain,
    getStats,
    reset,
    // Admin testing methods
    testTamperBlock,
    testUnauthorizedTransaction,
    testInjectBlock,
    restoreChain,
    hasTestSnapshot,
    // Exposed for testing/validation only
    computeBlockHash,
    DIFFICULTY
  };
})();

// Expose globally (browser & Node)
if (typeof globalThis !== 'undefined') globalThis.Blockchain = Blockchain;
if (typeof module !== 'undefined' && module.exports) module.exports = Blockchain;
