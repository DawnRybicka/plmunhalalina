// =============================================================
// HALALina - Voter Log (off-chain metadata store)
// In the proposed production system this would be a MySQL table.
// In this simulated version we use localStorage. Records:
//   { log_id, student_id, has_voted, vote_timestamp, transaction_hash }
// One row per verified student - enforces "one person, one vote"
// at the off-chain metadata layer (before the blockchain is touched).
// =============================================================

const VoterLog = (function () {
  const KEY = 'halalina_voter_log_v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function save(log) {
    localStorage.setItem(KEY, JSON.stringify(log));
  }

  function hasVoted(studentId) {
    const log = load();
    return !!(log[studentId] && log[studentId].has_voted);
  }

  function markVoted(studentId, transactionHash) {
    const log = load();
    log[studentId] = {
      student_id: studentId,
      has_voted: true,
      vote_timestamp: Date.now(),
      transaction_hash: transactionHash,
      registration_date: log[studentId]?.registration_date || Date.now()
    };
    save(log);
  }

  function getVoterRecord(studentId) {
    const log = load();
    return log[studentId] || null;
  }

  function getAllVoterRecords() {
    return Object.values(load());
  }

  function getCount() {
    return Object.keys(load()).length;
  }

  function reset() {
    localStorage.removeItem(KEY);
  }

  return {
    hasVoted,
    markVoted,
    getVoterRecord,
    getAllVoterRecords,
    getCount,
    reset
  };
})();

if (typeof globalThis !== 'undefined') globalThis.VoterLog = VoterLog;
if (typeof module !== 'undefined' && module.exports) module.exports = VoterLog;
