// =============================================================
// HALALina - GET /api/added-candidates
// Admin only: returns the list of admin-added candidates (for the
// Admin Tool on the candidates page to show the "Remove" buttons).
// =============================================================

const db = require('../lib/db');
const { error, json } = require('../lib/api-helpers');

async function onRequestGet({ env, data }) {
  const session = data.session;
  if (!session) return error('Not logged in.', 401);
  if (session.role !== 'admin') return error('Admin only.', 403);

  const rows = await db.all(env,
    `SELECT cp.candidate_id, cp.full_name, cp.running_position, cp.party_affiliation, cp.added_at
     FROM CANDIDATE_PROFILE cp
     JOIN ADDED_CANDIDATES ac ON cp.candidate_id = ac.candidate_id
     WHERE cp.is_admin_added = 1
     ORDER BY cp.candidate_id ASC`);

  return json({
    ok: true,
    added: rows.map(r => ({
      candidate_id: r.candidate_id,
      full_name: r.full_name,
      running_position: r.running_position,
      party_affiliation: r.party_affiliation,
      added_at: r.added_at
    }))
  });
}

module.exports = { onRequestGet };
