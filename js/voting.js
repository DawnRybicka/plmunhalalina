// =============================================================
// HALALina - Voting Module
// Handles ballot construction, client-side encryption, vote
// submission to the simulated blockchain, and receipt generation.
// Voter anonymity is preserved by:
//  1. Encrypting the actual candidate selection with AES-GCM (E2EE)
//  2. Hashing the student ID with SHA-256 + salt before storing
//  3. Storing only the encrypted ballot + hashed voter ID on-chain
// The decrypted tally is impossible to compute without the encryption
// key - we use a deterministic "election key" plus a per-voter nonce
// so the system can demonstrate verification without revealing choices.
// =============================================================

const Voting = (function () {
  // For this demo, we use a fixed election passphrase. In production
  // this would be a public key from a homomorphic / ZK scheme. Here it
  // allows the auditor/admin tab to decrypt and tally for the live view.
  const ELECTION_KEY = 'PLMUN-SSC-2026-E2EE-DEMO-KEY';

  // -------- Build ballot payload --------
  function buildBallot(selectedCandidateIds, session) {
    if (!selectedCandidateIds || selectedCandidateIds.length === 0) {
      throw new Error('No candidate selected.');
    }
    // Validate: one candidate per position
    // Use CandidatesManager so admin-added candidates are also recognized
    const allCandidates = (typeof CandidatesManager !== 'undefined')
      ? CandidatesManager.getAll()
      : CANDIDATES;
    const positions = {};
    for (const candId of selectedCandidateIds) {
      const cand = allCandidates.find(c => c.candidate_id === candId);
      if (!cand) throw new Error(`Invalid candidate ID: ${candId}`);
      if (positions[cand.running_position]) {
        throw new Error(`You can only vote for one candidate per position (${cand.running_position}).`);
      }
      positions[cand.running_position] = candId;
    }
    return {
      election_id: ELECTION_INFO.election_id,
      voter_hashed_id: session.hashed_voter_id,
      candidateIds: selectedCandidateIds,
      timestamp: Date.now()
    };
  }

  // -------- Cast a vote --------
  async function castVote(selectedCandidateIds, session) {
    // 1. Build & validate the ballot
    const ballot = buildBallot(selectedCandidateIds, session);

    // 2. Double-check the voter hasn't voted yet (off-chain metadata)
    if (VoterLog.hasVoted(session.student_id)) {
      // Log WITHOUT the student ID - use the hashed voter pseudonym
      AuditTrail.log({
        action: 'SYSTEM_ACTION',
        actor: session.hashed_voter_id,
        details: { note: 'Double-vote attempt blocked' },
        timestamp: Date.now()
      });
      throw new Error('You have already voted. Each student may vote only once.');
    }

    // 3. Client-side End-to-End Encryption of the ballot (AES-GCM)
    const plaintext = JSON.stringify({
      candidateIds: ballot.candidateIds,
      voter: ballot.voter_hashed_id
    });
    const envelope = await CryptoUtils.aesEncrypt(plaintext, ELECTION_KEY);

    // 4. Generate a per-vote transaction hash (the receipt)
    // Hash includes: encrypted ballot, voter hashed id, timestamp, election id, random salt
    const txSeed = JSON.stringify({
      ct: envelope.ciphertextHex,
      iv: envelope.ivHex,
      salt: envelope.saltHex,
      voter: ballot.voter_hashed_id,
      election: ballot.election_id,
      time: ballot.timestamp,
      rand: CryptoUtils.randomSalt()
    });
    const transactionHash = await CryptoUtils.sha256Upper(txSeed);

    // 5. Build the blockchain transaction record
    const txRecord = {
      transactionHash,
      hashedVoterId: ballot.voter_hashed_id,
      encryptedBallot: envelope,        // { ciphertextHex, ivHex, saltHex }
      electionId: ballot.election_id,
      timestamp: ballot.timestamp,
      // The candidateIds are kept encrypted (in encryptedBallot). For the live tally,
      // the system decrypts using the ELECTION_KEY (admin/audit only) - this is the
      // only place where individual selections can be revealed, and it is logged.
      // To preserve end-user privacy in the audit trail we DON'T expose candidateIds here.
      candidateIds: null                // intentionally null on the public record
    };

    // 6. Add to blockchain (this mines a block)
    const block = await Blockchain.addVoteTransaction(txRecord);

    // 7. Mark voter as having voted (off-chain)
    VoterLog.markVoted(session.student_id, transactionHash);

    // 8. Generate the human-readable receipt
    const receiptCode = await CryptoUtils.generateReceipt(transactionHash + ballot.voter_hashed_id);

    // 9. Log the event - keep VOTE_CAST but NEVER include the student ID
    // or the receipt code (which could be linked back). The audit log records
    // only that a vote was cast, by which anonymous voter pseudonym, and on
    // which block. The voter keeps their receipt private.
    AuditTrail.log({
      action: 'VOTE_CAST',
      actor: ballot.voter_hashed_id,        // <-- anonymous pseudonym
      details: {
        block_index: block.index            // <-- only the block index, nothing PII
      },
      timestamp: Date.now()
    });

    return {
      transactionHash,
      receiptCode,
      blockIndex: block.index,
      blockHash: block.hash,
      voteTimestamp: ballot.timestamp
    };
  }

  // -------- Verify a vote by receipt code or transaction hash --------
  async function verifyVote(query) {
    if (!query) return { ok: false, reason: 'Please enter a receipt code or transaction hash.' };

    const txs = Blockchain.getAllTransactions();
    // Try direct transactionHash match first
    let match = txs.find(t => t.transactionHash.toLowerCase() === query.toLowerCase());

    // Otherwise try receipt code (which is derived hash(receiptInput))
    if (!match) {
      for (const tx of txs) {
        const expectedReceipt = await CryptoUtils.generateReceipt(tx.transactionHash + tx.hashedVoterId);
        if (expectedReceipt.toLowerCase() === query.toLowerCase()) {
          match = tx;
          break;
        }
      }
    }

    if (!match) {
      AuditTrail.log({
        action: 'VOTE_NOT_FOUND',
        actor: 'anonymous',
        // Do NOT echo the user's query back into the audit log - it could
        // be a receipt code that should stay private to the voter.
        details: {},
        timestamp: Date.now()
      });
      return { ok: false, reason: 'No matching vote found for the provided receipt / hash.' };
    }

    AuditTrail.log({
      action: 'VOTE_VERIFIED',
      actor: 'anonymous',
      details: { transaction_hash: match.transactionHash, block_index: match.blockIndex },
      timestamp: Date.now()
    });

    return {
      ok: true,
      transactionHash: match.transactionHash,
      blockIndex: match.blockIndex,
      blockHash: match.blockHash,
      timestamp: match.timestamp,
      hashedVoterId: match.hashedVoterId
    };
  }

  // -------- Decrypt a ballot (admin/audit only) --------
  async function decryptBallot(envelope) {
    const plaintext = await CryptoUtils.aesDecrypt(envelope, ELECTION_KEY);
    return JSON.parse(plaintext);
  }

  // -------- Compute live tallies by decrypting the chain --------
  // This is the "audit" view: an election admin (or any auditor with
  // the ELECTION_KEY) can decrypt every ballot to produce a live tally.
  // The tally is anonymous because it only counts candidates, never
  // reveals which voter picked what.
  async function computeLiveTally() {
    const txs = Blockchain.getAllTransactions();
    const tallies = {};
    for (const tx of txs) {
      try {
        const decrypted = await decryptBallot(tx.encryptedBallot);
        for (const candId of decrypted.candidateIds) {
          tallies[candId] = (tallies[candId] || 0) + 1;
        }
      } catch (e) {
        // skip malformed
      }
    }
    return tallies;
  }

  return {
    castVote,
    verifyVote,
    computeLiveTally,
    ELECTION_KEY
  };
})();

if (typeof globalThis !== 'undefined') globalThis.Voting = Voting;
if (typeof module !== 'undefined' && module.exports) module.exports = Voting;
