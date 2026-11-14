// =============================================================
// HALALina - SIS Query Layer (SQL alongside JavaScript)
// -------------------------------------------------------------
// This module exposes a small SQL-style query API over the Mock
// Student Information System (SIS). It is the single point of
// access to SIS data for the rest of the application.
//
// The Mock SIS is backed by TWO data sources that run alongside
// each other:
//
//   1. The authoritative SQL definition in /sql/schema.sql +
//      /sql/seed.sql - a MySQL-compatible schema (with
//      MOCK_STUDENT_SIS, VOTER_LOG, CANDIDATE_PROFILE, and
//      ELECTION_SCHEDULE tables) plus INSERT statements for all
//      220 students. This is what you would actually load into
//      a real MySQL server for a production deployment.
//
//   2. The runtime JavaScript mirror in /js/sis-data.js - the
//      same 220 students as in-memory JS objects. Because GitHub
//      Pages has no backend database, this in-memory mirror lets
//      the system run entirely client-side while still being
//      governed by the SQL schema above.
//
// Both sources are kept in lockstep: the SQL file is generated
// from the same Python script that builds the JS file, so the
// data is identical. To regenerate both, run:
//
//   python3 scripts/generate_sis.py    # builds js/sis-data.js
//   python3 scripts/generate_sql.py    # builds sql/schema.sql + sql/seed.sql
//
// The API below mirrors the most common SQL queries the app
// would issue against a real SIS, so when you swap this JS
// shim for an actual `fetch('/api/sis/...')` call to a Node +
// Express + MySQL backend, only this file needs to change.
// =============================================================

const SIS = (function () {

  // ---- Schema metadata (mirrors sql/schema.sql) ----
  const SCHEMA = Object.freeze({
    database: 'halalina_sis',
    tables: {
      MOCK_STUDENT_SIS: {
        columns: [
          'student_id', 'first_name', 'middle_initial', 'last_name',
          'gender', 'program', 'program_full', 'year', 'section',
          'email', 'pin', 'eligibility_status', 'has_voted',
          'vote_hash', 'created_at'
        ],
        primaryKey: 'student_id'
      },
      VOTER_LOG: {
        columns: [
          'log_id', 'student_id', 'hashed_voter_id',
          'device_fingerprint', 'ip_address', 'verification_token',
          'registration_date', 'has_voted', 'vote_timestamp',
          'transaction_hash'
        ],
        primaryKey: 'log_id'
      },
      CANDIDATE_PROFILE: {
        columns: [
          'candidate_id', 'election_id', 'full_name',
          'running_position', 'party_affiliation', 'program',
          'year_section', 'platform', 'credentials', 'credibility'
        ],
        primaryKey: 'candidate_id'
      },
      ELECTION_SCHEDULE: {
        columns: [
          'schedule_id', 'election_id', 'election_name',
          'start_time', 'end_time', 'is_active',
          'cluster_department', 'smart_contract_address'
        ],
        primaryKey: 'schedule_id'
      }
    }
  });

  // ---- In-memory data (mirrors sql/seed.sql) ----
  // Loaded from the global MOCK_SIS that sis-data.js exposes.
  function rows() {
    if (typeof MOCK_SIS === 'undefined') {
      throw new Error('SIS data not loaded. Make sure js/sis-data.js is included before js/sis.js');
    }
    return MOCK_SIS;
  }

  // ---- SELECT * FROM MOCK_STUDENT_SIS WHERE student_id = ? ----
  function selectByStudentId(studentId) {
    const sid = String(studentId || '').trim();
    return rows().find(s => s.student_id === sid) || null;
  }

  // ---- SELECT * FROM MOCK_STUDENT_SIS WHERE student_id = ? AND pin = ? ----
  // (In production, the PIN column would store SHA-256 hashes, not plaintext.)
  function verifyCredentials(studentId, pin) {
    const sid = String(studentId || '').trim();
    const p = String(pin || '').trim();
    return rows().find(s => s.student_id === sid && s.pin === p) || null;
  }

  // ---- SELECT * FROM MOCK_STUDENT_SIS WHERE eligibility_status = 'ELIGIBLE' ----
  function selectEligible() {
    return rows().filter(s => s.eligibility_status === 'ELIGIBLE');
  }

  // ---- SELECT COUNT(*) FROM MOCK_STUDENT_SIS ----
  function countAll() {
    return rows().length;
  }

  // ---- SELECT COUNT(*) FROM MOCK_STUDENT_SIS WHERE eligibility_status = ? ----
  function countByEligibility(status) {
    return rows().filter(s => s.eligibility_status === status).length;
  }

  // ---- SELECT program, COUNT(*) FROM MOCK_STUDENT_SIS GROUP BY program ----
  function countByProgram() {
    const counts = {};
    for (const s of rows()) {
      counts[s.program] = (counts[s.program] || 0) + 1;
    }
    return counts;
  }

  // ---- General-purpose WHERE filter (mimics a parameterized SQL WHERE) ----
  // Example: SIS.selectWhere({ program: 'BSIT', year: 4 })
  function selectWhere(predicate) {
    return rows().filter(s => {
      for (const [k, v] of Object.entries(predicate)) {
        if (s[k] !== v) return false;
      }
      return true;
    });
  }

  // ---- UPDATE MOCK_STUDENT_SIS SET has_voted = TRUE, vote_hash = ?
  //      WHERE student_id = ?   (runtime only; in production this would be a
  //      real SQL UPDATE issued by the Node backend.)
  function markVoted(studentId, transactionHash) {
    // We mutate the in-memory copy. The real SIS would persist this in MySQL.
    // Note: because MOCK_SIS is Object.freeze'd, we can't mutate the records
    // directly. The persistent voter state lives in VoterLog (voter-log.js)
    // which is the off-chain VOTER_LOG table equivalent.
    return VoterLog.markVoted(studentId, transactionHash);
  }

  // ---- SELECT has_voted FROM VOTER_LOG WHERE student_id = ? ----
  function hasVoted(studentId) {
    return VoterLog.hasVoted(studentId);
  }

  // ---- Stats (for the audit tab display) ----
  function stats() {
    return {
      total_students: countAll(),
      eligible_students: countByEligibility('ELIGIBLE'),
      ineligible_students: countByEligibility('INELIGIBLE'),
      by_program: countByProgram()
    };
  }

  // ---- Run a raw SQL string against the in-memory mirror ----
  // This is a *very* small subset of SQL, just enough to let the audit
  // tab show what the equivalent SQL would be. It supports:
  //   SELECT [cols] FROM MOCK_STUDENT_SIS [WHERE col = 'val' [AND ...]] [LIMIT n]
  // Anything else throws an error to make it obvious this is a demo shim,
  // not a real SQL engine. For a real election you would replace this
  // with a fetch() call to your Node + Express + MySQL backend.
  function rawSql(sql) {
    const orig = sql;
    sql = sql.trim().replace(/;$/, '');
    const m = sql.match(/^SELECT\s+(.+?)\s+FROM\s+MOCK_STUDENT_SIS(?:\s+WHERE\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i);
    if (!m) {
      throw new Error(`rawSql() only supports simple SELECT ... FROM MOCK_STUDENT_SIS queries. Got: ${orig}`);
    }
    const [, colsPart, wherePart, limitPart] = m;

    // Resolve columns
    const cols = colsPart.trim() === '*' ? SCHEMA.tables.MOCK_STUDENT_SIS.columns : colsPart.split(',').map(c => c.trim());

    // Parse WHERE
    let result = rows().slice();
    if (wherePart) {
      // Split on AND (case-insensitive)
      const conditions = wherePart.split(/\s+AND\s+/i);
      for (const cond of conditions) {
        const cm = cond.match(/^(\w+)\s*=\s*'([^']*)'$/);
        if (!cm) {
          throw new Error(`rawSql() only supports simple WHERE col = 'value' conditions. Got: ${cond}`);
        }
        const [, col, val] = cm;
        if (!SCHEMA.tables.MOCK_STUDENT_SIS.columns.includes(col)) {
          throw new Error(`Unknown column: ${col}`);
        }
        result = result.filter(row => String(row[col]) === val);
      }
    }

    // Apply LIMIT
    if (limitPart) {
      result = result.slice(0, parseInt(limitPart, 10));
    }

    // Project columns
    return result.map(row => {
      const projected = {};
      for (const c of cols) {
        projected[c] = row[c];
      }
      return projected;
    });
  }

  return {
    SCHEMA,
    selectByStudentId,
    verifyCredentials,
    selectEligible,
    selectWhere,
    countAll,
    countByEligibility,
    countByProgram,
    markVoted,
    hasVoted,
    stats,
    rawSql
  };
})();

// Expose globally (browser & Node)
if (typeof globalThis !== 'undefined') globalThis.SIS = SIS;
if (typeof module !== 'undefined' && module.exports) module.exports = SIS;
