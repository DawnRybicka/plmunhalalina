// =============================================================
// HALALina - Client-side Blockchain view (Cloudflare Pages edition)
// -------------------------------------------------------------
// This module is now a thin wrapper that fetches the chain + stats
// from /api/blockchain and runs validation via POST /api/blockchain.
// All actual storage and mining happens server-side in D1.
// =============================================================

const Blockchain = (function () {
  // ---- Initialize (no-op now - the server initializes the chain) ----
  async function init() {
    // No client-side init needed; the server creates the genesis block
    // on first /api/vote or /api/blockchain call.
  }

  // ---- GET /api/blockchain -> { chain, stats } ----
  async function getChainAndStats() {
    const res = await fetch('/api/blockchain', { credentials: 'same-origin' });
    if (!res.ok) return { chain: [], stats: { blockCount: 0, transactionCount: 0, difficulty: 3 } };
    const data = await res.json();
    return { chain: data.chain || [], stats: data.stats || {} };
  }

  // ---- Get just the chain ----
  async function getChain() {
    const { chain } = await getChainAndStats();
    return chain;
  }

  // ---- Get just the stats ----
  async function getStats() {
    const { stats } = await getChainAndStats();
    return stats;
  }

  // ---- Get all transactions (flat list) ----
  async function getAllTransactions() {
    const chain = await getChain();
    const txs = [];
    for (const block of chain) {
      for (const tx of (block.transactions || [])) {
        txs.push({
          ...tx,
          blockIndex: block.index,
          blockHash: block.hash
        });
      }
    }
    return txs;
  }

  // ---- POST /api/blockchain/validate -> { valid, failures, stats } ----
  // Admin only.
  async function isChainValid() {
    const res = await fetch('/api/blockchain', {
      method: 'POST',
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!data.ok) {
      return { valid: false, failures: [] };
    }
    // Stash the result for getValidationDetails()
    lastValidationResult = { valid: data.valid, failures: data.failures || [] };
    return data.valid;
  }

  let lastValidationResult = null;
  function getValidationDetails() {
    return lastValidationResult;
  }

  // ---- Find a transaction by hash (server-side lookup) ----
  async function findTransaction(transactionHash) {
    // We can use the verify endpoint for this
    return null;
  }

  // ---- Admin test panel: POST /api/admin-test ----
  async function testTamperBlock(reMine = false) {
    return await adminTest({ attack: reMine ? 'tamper-remine' : 'tamper-no-remine' });
  }
  async function testUnauthorizedTransaction() {
    return await adminTest({ attack: 'unauthorized-tx' });
  }
  async function testInjectBlock(variant = 'bad-pow') {
    const attack = variant === 'bad-linkage' ? 'inject-bad-linkage' : 'inject-bad-pow';
    return await adminTest({ attack });
  }
  async function adminTest(body) {
    try {
      const res = await fetch('/api/admin-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin'
      });
      return await res.json();
    } catch (e) {
      return { ok: false, reason: 'Network error: ' + e.message };
    }
  }

  // ---- Restore the chain (POST /api/admin-test/restore) ----
  async function restoreChain() {
    try {
      const res = await fetch('/api/admin-test/restore', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const data = await res.json();
      return !!data.ok;
    } catch (e) {
      return false;
    }
  }

  function hasTestSnapshot() {
    // Always return true on the client so the Restore button is enabled
    // after running any test. The server tracks the actual snapshot.
    return true;
  }

  return {
    init,
    getChain,
    getStats,
    getAllTransactions,
    isChainValid,
    getValidationDetails,
    findTransaction,
    testTamperBlock,
    testUnauthorizedTransaction,
    testInjectBlock,
    restoreChain,
    hasTestSnapshot,
    DIFFICULTY: 3
  };
})();

if (typeof globalThis !== 'undefined') globalThis.Blockchain = Blockchain;
