// =============================================================
// HALALina - Client-side SIS stub (Cloudflare Pages edition)
// -------------------------------------------------------------
// The Mock SIS is now a real D1 database. This module is kept as a
// stub so existing app.js code that calls SIS.stats() etc. doesn't
// break. Where the client needs real data, it fetches from /api/*.
// =============================================================

const SIS = (function () {
  // Admin accounts are no longer stored in the client (they live in D1).
  // This is a static list kept only for the login page to do client-side
  // role-prefix detection. The actual PIN check happens server-side.
  const ADMIN_USERS = Object.freeze([
    { admin_id: '99000001', full_name: 'Dr. Maria Elena Santos', role: 'ADMIN' },
    { admin_id: '99000002', full_name: 'Prof. Ronaldo Reyes', role: 'COMELEC' }
  ]);

  function selectAdminByCredentials(adminId, pin) {
    // No-op - the server validates admin credentials
    return null;
  }
  function selectByStudentId(studentId) { return null; }
  function verifyCredentials(studentId, pin) { return null; }
  function selectEligible() { return []; }
  function selectWhere(predicate) { return []; }
  function countAll() { return 0; }
  function countByEligibility(status) { return 0; }
  function countByProgram() { return {}; }
  function markVoted(studentId, transactionHash) { /* no-op */ }
  function hasVoted(studentId) { return false; }

  // Stats - fetched from /api/sis-stats (admin only)
  async function stats() {
    try {
      const res = await fetch('/api/sis-stats', { credentials: 'same-origin' });
      if (!res.ok) return { total_students: 0, eligible_students: 0, ineligible_students: 0, by_program: {} };
      const data = await res.json();
      return data.stats || {};
    } catch {
      return { total_students: 0, eligible_students: 0, ineligible_students: 0, by_program: {} };
    }
  }

  function rawSql(sql) { throw new Error('rawSql not supported in Cloudflare edition - use the /api/sis-stats endpoint.'); }

  const SCHEMA = {
    database: 'halalina-sis',
    tables: {
      MOCK_STUDENT_SIS: { columns: ['student_id', 'first_name', 'last_name', 'pin', 'eligibility_status'], primaryKey: 'student_id' },
      ADMIN_USERS: { columns: ['admin_id', 'full_name', 'role', 'pin'], primaryKey: 'admin_id' },
      VOTER_LOG: { columns: ['student_id', 'has_voted', 'transaction_hash'], primaryKey: 'log_id' },
      CANDIDATE_PROFILE: { columns: ['candidate_id', 'full_name', 'running_position'], primaryKey: 'candidate_id' }
    }
  };

  return {
    SCHEMA, ADMIN_USERS,
    selectAdminByCredentials,
    selectByStudentId, verifyCredentials,
    selectEligible, selectWhere,
    countAll, countByEligibility, countByProgram,
    markVoted, hasVoted, stats, rawSql
  };
})();

if (typeof globalThis !== 'undefined') globalThis.SIS = SIS;
