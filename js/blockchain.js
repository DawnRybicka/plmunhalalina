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
  async function isChainValid() {
    for (let i = 1; i < chain.length; i++) {
      const current = chain[i];
      const previous = chain[i - 1];

      // Recompute hash
      const recomputedHash = await computeBlockHash(current);
      if (recomputedHash !== current.hash) return false;

      // Check previous hash linkage
      if (current.previousHash !== previous.hash) return false;

      // Check PoW difficulty
      if (!current.hash.startsWith('0'.repeat(DIFFICULTY))) return false;
    }
    return true;
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

  return {
    init,
    addVoteTransaction,
    isChainValid,
    findTransaction,
    getAllTransactions,
    getTallies,
    getChain,
    getStats,
    reset
  };
})();

// Expose globally (browser & Node)
if (typeof globalThis !== 'undefined') globalThis.Blockchain = Blockchain;
if (typeof module !== 'undefined' && module.exports) module.exports = Blockchain;
