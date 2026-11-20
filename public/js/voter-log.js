// =============================================================
// HALALina - Client-side Voter Log stub (Cloudflare Pages edition)
// -------------------------------------------------------------
// The voter log is now stored server-side in D1 (VOTER_LOG table).
// This module is kept as a stub so the existing app.js code that
// calls VoterLog.hasVoted() doesn't break.
//
// In the Cloudflare edition, the server enforces "one person, one
// vote" at /api/vote time, so the client doesn't need to know
// whether a student has voted. The session payload has a has_voted
// flag that's set by /api/login based on the D1 VOTER_LOG state.
// =============================================================

const VoterLog = (function () {
  // Returns true if the current session's student has already voted.
  // This reads from the session payload (set by the server), NOT
  // from localStorage.
  function hasVoted(studentId) {
    const session = (typeof Auth !== 'undefined') ? Auth.getSession() : null;
    if (session && session.id === studentId) {
      return !!session.has_voted;
    }
    // Fallback: we can't check the voter log client-side anymore
    return false;
  }

  function markVoted(studentId, transactionHash) {
    // No-op - the server marks the voter as having voted during
    // POST /api/vote. After a successful vote, we update the
    // cached session locally so subsequent checks work.
    const session = (typeof Auth !== 'undefined') ? Auth.getSession() : null;
    if (session) session.has_voted = true;
  }

  function getVoterRecord(studentId) { return null; }
  function getAllVoterRecords() { return []; }
  function getCount() { return 0; }
  function reset() { /* no-op */ }

  return { hasVoted, markVoted, getVoterRecord, getAllVoterRecords, getCount, reset };
})();

if (typeof globalThis !== 'undefined') globalThis.VoterLog = VoterLog;
