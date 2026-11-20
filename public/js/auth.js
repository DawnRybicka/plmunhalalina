// =============================================================
// HALALina - Client-side Authentication (Cloudflare Pages edition)
// -------------------------------------------------------------
// Calls /api/login, /api/logout, /api/session instead of touching
// localStorage. The session is stored in an HttpOnly cookie set by
// the server; this module just keeps an in-memory copy of the
// session payload (fetched from /api/session on page load).
// =============================================================

const Auth = (function () {
  let cachedSession = null;

  // ---- POST /api/login ----
  async function login(studentId, pin) {
    const sid = (studentId || '').trim();
    const p = (pin || '').trim();

    // Pre-validate (matches the server-side checks)
    if (!/^(23|99)\d{6}$/.test(sid)) {
      return { ok: false, reason: 'ID must be 8 digits starting with 23 (student) or 99 (admin).' };
    }
    if (!/^\d{6}$/.test(p)) {
      return { ok: false, reason: 'PIN must be exactly 6 digits.' };
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: sid, pin: p }),
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (!data.ok) {
        return { ok: false, reason: data.reason || 'Login failed.' };
      }
      cachedSession = data.session;
      return {
        ok: true,
        session: data.session,
        role: data.role,
        student: data.student,
        admin: data.admin
      };
    } catch (e) {
      return { ok: false, reason: 'Network error: ' + e.message };
    }
  }

  // ---- POST /api/logout ----
  async function logout() {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    } catch {}
    cachedSession = null;
  }

  // ---- GET /api/session (used on page load to auto-login from cookie) ----
  async function fetchSession() {
    try {
      const res = await fetch('/api/session', { credentials: 'same-origin' });
      if (!res.ok) { cachedSession = null; return null; }
      const data = await res.json();
      if (data.ok) {
        cachedSession = data.session;
        return data.session;
      }
      cachedSession = null;
      return null;
    } catch {
      cachedSession = null;
      return null;
    }
  }

  // ---- Get the cached session (without a network call) ----
  function getSession() {
    return cachedSession;
  }

  // ---- isLoggedIn / isAdmin / isStudent (sync, use cached session) ----
  function isLoggedIn() { return !!cachedSession; }
  function isAdmin() { return !!(cachedSession && cachedSession.role === 'admin'); }
  function isStudent() { return !!(cachedSession && cachedSession.role === 'student'); }

  return {
    login,
    logout,
    fetchSession,
    getSession,
    isLoggedIn,
    isAdmin,
    isStudent
  };
})();

if (typeof globalThis !== 'undefined') globalThis.Auth = Auth;
