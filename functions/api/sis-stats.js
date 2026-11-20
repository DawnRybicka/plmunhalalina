// =============================================================
// HALALina - GET /api/sis-stats
// Admin only: returns aggregate stats about the Mock SIS.
// =============================================================

const db = require('../lib/db');
const { error, json } = require('../lib/api-helpers');

async function onRequestGet({ env, data }) {
  const session = data.session;
  if (!session) return error('Not logged in.', 401);
  if (session.role !== 'admin') return error('Admin only.', 403);

  const total = await db.first(env, 'SELECT COUNT(*) AS c FROM MOCK_STUDENT_SIS');
  const eligible = await db.first(env, "SELECT COUNT(*) AS c FROM MOCK_STUDENT_SIS WHERE eligibility_status = 'ELIGIBLE'");
  const ineligible = await db.first(env, "SELECT COUNT(*) AS c FROM MOCK_STUDENT_SIS WHERE eligibility_status = 'INELIGIBLE'");

  // By program
  const programRows = await db.all(env, "SELECT program, COUNT(*) AS c FROM MOCK_STUDENT_SIS GROUP BY program ORDER BY c DESC");
  const byProgram = {};
  for (const r of programRows) byProgram[r.program] = r.c;

  return json({
    ok: true,
    stats: {
      total_students: total ? total.c : 0,
      eligible_students: eligible ? eligible.c : 0,
      ineligible_students: ineligible ? ineligible.c : 0,
      by_program: byProgram
    }
  });
}

module.exports = { onRequestGet };
