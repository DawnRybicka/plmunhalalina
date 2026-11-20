// =============================================================
// HALALina - POST /api/login
// -------------------------------------------------------------
// Validates credentials against the D1 database (MOCK_STUDENT_SIS
// for students, ADMIN_USERS for admins) and sets an HttpOnly
// HMAC-signed session cookie.
//
// Request body: { student_id, pin }
// Response:     { ok, role, full_name, ... }
// =============================================================

const db = require('../lib/db');
const { createSession, buildSetCookieHeader, COOKIE_MAX_AGE_SECONDS } = require('../lib/auth');
const { anonymizeStudentId } = require('../lib/crypto');
const { logAudit } = require('../lib/api-helpers');
const { SALT, ELECTION_ID } = require('../lib/constants');

async function onRequestPost({ request, env, data }) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ ok: false, reason: 'Invalid JSON body.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const sid = String(body.student_id || '').trim();
  const pin = String(body.pin || '').trim();

  // Pre-validate format
  if (!/^(23|99)\d{6}$/.test(sid)) {
    return new Response(JSON.stringify({ ok: false, reason: 'ID must be 8 digits starting with 23 (student) or 99 (admin).' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (!/^\d{6}$/.test(pin)) {
    return new Response(JSON.stringify({ ok: false, reason: 'PIN must be exactly 6 digits.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const isAdminAttempt = /^99\d{6}$/.test(sid);

  if (isAdminAttempt) {
    // ---- Admin login path ----
    const admin = await db.first(env, 'SELECT * FROM ADMIN_USERS WHERE admin_id = ? AND pin = ?', sid, pin);
    if (!admin) {
      await logAudit(env, { action: 'LOGIN_FAILED', actor: 'anonymous', details: { reason: 'Admin ID not found, or PIN is incorrect.' } });
      return new Response(JSON.stringify({ ok: false, reason: 'Admin ID not found, or PIN is incorrect.' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    const hashedAdminId = await anonymizeStudentId(admin.admin_id, env.SALT || SALT);
    const payload = {
      id: admin.admin_id,
      role: 'admin',
      adminRole: admin.role,                    // 'ADMIN' or 'COMELEC'
      full_name: admin.full_name,
      program: admin.role,
      year_section: admin.department,
      hashed_voter_id: hashedAdminId,
      issued_at: Date.now()
    };
    const secret = data.sessionSecret;
    const cookieValue = await createSession(payload, secret);
    await logAudit(env, { action: 'LOGIN_SUCCESS', actor: hashedAdminId, details: { role: 'admin' } });
    const response = {
      ok: true,
      role: 'admin',
      session: payload,
      admin: { admin_id: admin.admin_id, full_name: admin.full_name, role: admin.role }
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildSetCookieHeader(cookieValue, COOKIE_MAX_AGE_SECONDS)
      }
    });
  }

  // ---- Student login path ----
  const student = await db.first(env, 'SELECT * FROM MOCK_STUDENT_SIS WHERE student_id = ? AND pin = ?', sid, pin);
  if (!student) {
    await logAudit(env, { action: 'LOGIN_FAILED', actor: 'anonymous', details: { reason: 'Student ID not found, or PIN is incorrect.' } });
    return new Response(JSON.stringify({ ok: false, reason: 'Student ID not found, or PIN is incorrect.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (student.eligibility_status !== 'ELIGIBLE') {
    await logAudit(env, { action: 'LOGIN_FAILED', actor: 'anonymous', details: { reason: `Student is not eligible (status: ${student.eligibility_status}).` } });
    return new Response(JSON.stringify({ ok: false, reason: `Student is not eligible to vote (status: ${student.eligibility_status}).` }), {
      status: 403, headers: { 'Content-Type': 'application/json' }
    });
  }

  const hashedVoterId = await anonymizeStudentId(student.student_id, env.SALT || SALT);

  // Check if student has already voted (don't reject - they can re-login to verify)
  const voterLog = await db.first(env, 'SELECT * FROM VOTER_LOG WHERE student_id = ?', student.student_id);
  const hasAlreadyVoted = !!(voterLog && voterLog.has_voted);

  const payload = {
    id: student.student_id,
    role: 'student',
    full_name: `${student.first_name} ${student.middle_initial ? student.middle_initial + '.' : ''} ${student.last_name}`.trim(),
    program: student.program,
    year_section: `${student.year}-${student.section}`,
    hashed_voter_id: hashedVoterId,
    has_voted: hasAlreadyVoted,
    issued_at: Date.now()
  };

  const secret = data.sessionSecret;
  const cookieValue = await createSession(payload, secret);

  await logAudit(env, {
    action: 'LOGIN_SUCCESS',
    actor: hashedVoterId,
    details: { role: 'student', has_voted: hasAlreadyVoted }
  });

  const response = {
    ok: true,
    role: 'student',
    session: payload,
    student: {
      student_id: student.student_id,
      first_name: student.first_name,
      eligibility_status: student.eligibility_status
    }
  };
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildSetCookieHeader(cookieValue, COOKIE_MAX_AGE_SECONDS)
    }
  });
}

module.exports = { onRequestPost };
