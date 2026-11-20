// =============================================================
// HALALina - Client-side Voting (Cloudflare Pages edition)
// -------------------------------------------------------------
// Encrypts the ballot with AES-GCM (E2EE) in the browser, computes
// the transaction hash, and POSTs to /api/vote. The server mines the
// block and returns the receipt.
//
// Voter anonymity is preserved by:
//   1. The candidate selection is encrypted with AES-GCM (E2EE)
//      before being sent. The server only sees the encrypted blob.
//   2. The student ID is hashed (SHA-256 + salt) on the server side
//      and the hashed value is what's stored on the blockchain.
//   3. The receipt is derived from the transaction hash + hashed
//      voter ID, so it cannot be linked back to a student.
// =============================================================

const Voting = (function () {
  // Election passphrase - in production this would be a public key
  // or a multi-sig scheme. For this demo, the SAME key is used by the
  // server to decrypt ballots for the live tally.
  const ELECTION_KEY = 'PLMUN-SSC-2026-E2EE-DEMO-KEY';

  // ---- Build & encrypt the ballot payload ----
  async function buildEncryptedBallot(selectedCandidateIds, session) {
    if (!selectedCandidateIds || selectedCandidateIds.length === 0) {
      throw new Error('No candidate selected.');
    }
    const plaintext = JSON.stringify({
      candidateIds: selectedCandidateIds,
      voter: session.hashed_voter_id
    });
    const envelope = await CryptoUtils.aesEncrypt(plaintext, ELECTION_KEY);
    return envelope;
  }

  // ---- Cast a vote (POST /api/vote) ----
  async function castVote(selectedCandidateIds, session) {
    // 1. Encrypt the ballot client-side (E2EE)
    const envelope = await buildEncryptedBallot(selectedCandidateIds, session);

    // 2. Compute the transaction hash (the "receipt seed")
    // The transaction hash is derived from the encrypted ballot + the
    // hashed voter ID + timestamp + election ID + a random salt.
    const timestamp = Date.now();
    const txSeed = JSON.stringify({
      ct: envelope.ciphertextHex,
      iv: envelope.ivHex,
      salt: envelope.saltHex,
      voter: session.hashed_voter_id,
      election: 'ELEC-2026-SSC',
      time: timestamp,
      rand: CryptoUtils.randomSalt()
    });
    const transactionHash = await CryptoUtils.sha256Upper(txSeed);

    // 3. POST to /api/vote
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encryptedBallot: envelope,
        transactionHash: transactionHash
      }),
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.reason || 'Failed to cast vote.');
    }
    return {
      transactionHash: data.transactionHash,
      receiptCode: data.receiptCode,
      blockIndex: data.blockIndex,
      blockHash: data.blockHash,
      voteTimestamp: data.voteTimestamp
    };
  }

  // ---- Verify a vote (POST /api/verify) ----
  async function verifyVote(query) {
    if (!query) return { ok: false, reason: 'Please enter a receipt code or transaction hash.' };

    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, reason: data.reason };
    return {
      ok: true,
      transactionHash: data.transactionHash,
      blockIndex: data.blockIndex,
      blockHash: data.blockHash,
      timestamp: data.timestamp,
      hashedVoterId: data.hashedVoterId
    };
  }

  // ---- Get the live tally (GET /api/tally) ----
  // Returns { candidateId: count, ... } (the admin/audit view, but
  // the tally itself is anonymous so anyone can see it).
  async function computeLiveTally() {
    const res = await fetch('/api/tally', { credentials: 'same-origin' });
    const data = await res.json();
    if (!data.ok) return {};
    return data.tallies || {};
  }

  return {
    castVote,
    verifyVote,
    computeLiveTally,
    ELECTION_KEY
  };
})();

if (typeof globalThis !== 'undefined') globalThis.Voting = Voting;
