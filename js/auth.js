// =============================================================
// HALALina - Authentication Module
// Verifies student credentials against the Mock SIS database.
// Issues a session token (stored in sessionStorage) and records
// login/logout events in the Audit Trail.
// =============================================================

const Auth = (function () {
  const SESSION_KEY = 'halalina_session_v1';
  // Static salt for the demo (in production, this would come from a KMS)
  const SALT = 'HALALINA-PLMUN-2026-SIS-SALT';

  // -------- Lookup student in Mock SIS --------
  function lookupStudent(studentId, pin) {
    // Normalize
    const sid = (studentId || '').trim();
    const p = (pin || '').trim();

    if (!/^23\d{6}$/.test(sid)) {
      return { ok: false, reason: 'Student ID must be in the format 23XXXXXX (8 digits, starting with 23).' };
    }
    if (!/^\d{4}$/.test(p)) {
      return { ok: false, reason: 'PIN must be exactly 4 digits.' };
    }

    const student = MOCK_SIS.find(s => s.student_id === sid);
    if (!student) {
      return { ok: false, reason: 'Student ID not found in Mock SIS.' };
    }
    if (student.pin !== p) {
      return { ok: false, reason: 'Incorrect PIN.' };
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
      // Log failed attempt
      AuditTrail.log({
        action: 'LOGIN_FAILED',
        actor: studentId || 'unknown',
        details: { reason: result.reason },
        timestamp: Date.now()
      });
      return result;
    }

    const student = result.student;

    // Check if student has already voted (via voter log)
    if (VoterLog.hasVoted(student.student_id)) {
      AuditTrail.log({
        action: 'LOGIN_REJECTED_ALREADY_VOTED',
        actor: student.student_id,
        timestamp: Date.now()
      });
      return { ok: false, reason: 'You have already cast your vote in this election. Each student may vote only once.' };
    }

    // Create session (we store an anonymized hash, NOT the raw student ID)
    const token = CryptoUtils.sessionToken();
    const hashedVoterId = await CryptoUtils.anonymizeStudentId(student.student_id, SALT);

    const session = {
      token,
      student_id: student.student_id,           // kept only in session (NOT persisted on-chain)
      hashed_voter_id: hashedVoterId,
      full_name: `${student.first_name} ${student.middle_initial}. ${student.last_name}`,
      program: student.program,
      year_section: `${student.year}-${student.section}`,
      login_at: Date.now()
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    AuditTrail.log({
      action: 'LOGIN_SUCCESS',
      actor: student.student_id,
      details: { session_token: token.slice(0, 8) + '...' },
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
      AuditTrail.log({
        action: 'LOGOUT',
        actor: session.student_id,
        timestamp: Date.now()
      });
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
