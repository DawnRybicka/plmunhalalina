// =============================================================
// HALALina - Authentication Module
// -------------------------------------------------------------
// Verifies student credentials against the Mock SIS through
// the SQL-style SIS query layer (js/sis.js). The SIS layer is
// backed by sql/schema.sql + sql/seed.sql (authoritative SQL
// definition) running alongside js/sis-data.js (runtime mirror).
//
// Issues a session token (stored in sessionStorage) and records
// login/logout events in the Audit Trail. To preserve voter
// anonymity per the user's request, audit entries NEVER log
// the raw student ID - they use the SHA-256 hashed voter ID
// (an anonymous pseudonym) instead.
// =============================================================

const Auth = (function () {
  const SESSION_KEY = 'halalina_session_v1';
  // Static salt for the demo (in production, this would come from a KMS)
  const SALT = 'HALALINA-PLMUN-2026-SIS-SALT';

  // -------- In-memory map: hashedVoterId <-> studentId --------
  // We keep this in sessionStorage (NOT localStorage, NOT audit trail)
  // so that the current logged-in user can be linked to their session
  // without leaking the student ID into the persistent audit log.
  // When the user logs out or closes the tab, this mapping is gone.
  const SESSION_HASHES_KEY = 'halalina_session_hashes_v1';

  function rememberHash(studentId, hashedVoterId) {
    try {
      const raw = sessionStorage.getItem(SESSION_HASHES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[studentId] = hashedVoterId;
      sessionStorage.setItem(SESSION_HASHES_KEY, JSON.stringify(map));
    } catch {}
  }
  function forgetHash(studentId) {
    try {
      const raw = sessionStorage.getItem(SESSION_HASHES_KEY);
      if (!raw) return;
      const map = JSON.parse(raw);
      delete map[studentId];
      sessionStorage.setItem(SESSION_HASHES_KEY, JSON.stringify(map));
    } catch {}
  }

  // -------- Lookup student in Mock SIS (via SQL-style query layer) --------
  // Equivalent SQL:
  //   SELECT * FROM MOCK_STUDENT_SIS
  //   WHERE student_id = '<sid>' AND pin = '<pin>' AND eligibility_status = 'ELIGIBLE';
  function lookupStudent(studentId, pin) {
    const sid = (studentId || '').trim();
    const p = (pin || '').trim();

    if (!/^23\d{6}$/.test(sid)) {
      return { ok: false, reason: 'Student ID must be in the format 23XXXXXX (8 digits, starting with 23).' };
    }
    if (!/^\d{4}$/.test(p)) {
      return { ok: false, reason: 'PIN must be exactly 4 digits.' };
    }

    // Use the SIS query layer (SQL-style) instead of touching MOCK_SIS directly
    const student = SIS.verifyCredentials(sid, p);
    if (!student) {
      return { ok: false, reason: 'Student ID not found in Mock SIS, or PIN is incorrect.' };
    }
    if (student.eligibility_status !== 'ELIGIBLE') {
      return { ok: false, reason: `Student is not eligible to vote (status: ${student.eligibility_status}).` };
    }
    return { ok: true, student };
  }

  // -------- Login --------
  async function login(studentId, pin) {
    const result = lookupStudent(studentId, pin);
    if (!result.ok) {
      // Log failed attempt - DO NOT include the student ID
      AuditTrail.log({
        action: 'LOGIN_FAILED',
        actor: 'anonymous',
        details: { reason: result.reason },
        timestamp: Date.now()
      });
      return result;
    }

    const student = result.student;

    // Hash the student ID once for use as an anonymous pseudonym
    const hashedVoterId = await CryptoUtils.anonymizeStudentId(student.student_id, SALT);

    // Check if student has already voted (off-chain VOTER_LOG equivalent)
    if (VoterLog.hasVoted(student.student_id)) {
      // Log rejection using the anonymous pseudonym, NOT the student ID
      AuditTrail.log({
        action: 'LOGIN_REJECTED_ALREADY_VOTED',
        actor: hashedVoterId,           // <-- anonymous pseudonym
        details: {},
        timestamp: Date.now()
      });
      return { ok: false, reason: 'You have already cast your vote in this election. Each student may vote only once.' };
    }

    // Create session
    const token = CryptoUtils.sessionToken();
    const session = {
      token,
      student_id: student.student_id,           // kept only in session (NOT in audit log)
      hashed_voter_id: hashedVoterId,
      full_name: `${student.first_name} ${student.middle_initial}. ${student.last_name}`,
      program: student.program,
      year_section: `${student.year}-${student.section}`,
      login_at: Date.now()
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    rememberHash(student.student_id, hashedVoterId);

    // Log the successful login using the anonymous pseudonym only
    AuditTrail.log({
      action: 'LOGIN_SUCCESS',
      actor: hashedVoterId,            // <-- anonymous pseudonym (no raw student ID)
      details: {},                     // <-- empty: no session token fragments either
      timestamp: Date.now()
    });

    return { ok: true, session, student };
  }

  // -------- Get current session --------
  function getSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // -------- Logout --------
  function logout() {
    const session = getSession();
    if (session) {
      // Log logout using the anonymous pseudonym, NOT the student ID
      AuditTrail.log({
        action: 'LOGOUT',
        actor: session.hashed_voter_id,    // <-- anonymous pseudonym
        details: {},
        timestamp: Date.now()
      });
      forgetHash(session.student_id);
    }
    sessionStorage.removeItem(SESSION_KEY);
  }

  // -------- Check if logged in --------
  function isLoggedIn() {
    return !!getSession();
  }

  return {
    login,
    logout,
    getSession,
    isLoggedIn,
    SALT
  };
})();

// Expose globally (browser & Node)
if (typeof globalThis !== 'undefined') globalThis.Auth = Auth;
if (typeof module !== 'undefined' && module.exports) module.exports = Auth;
