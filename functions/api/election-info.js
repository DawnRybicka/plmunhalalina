// =============================================================
// HALALina - GET /api/election-info
// Returns the current election schedule + list of positions.
// =============================================================

const db = require('../lib/db');
const { error, json } = require('../lib/api-helpers');

async function onRequestGet({ env, data }) {
  const session = data.session;
  if (!session) return error('Not logged in.', 401);

  const election = await db.first(env, 'SELECT * FROM ELECTION_SCHEDULE LIMIT 1');
  if (!election) return error('No election configured.', 500);

  // Build the positions list from the candidates table
  const positionRows = await db.all(env,
    "SELECT DISTINCT running_position FROM CANDIDATE_PROFILE ORDER BY candidate_id ASC");
  // Use the original 6 positions (in order) - matches the seed
  const positions = [
    'President', 'Vice President', 'Secretary',
    'Treasurer', 'Auditor', 'Public Relations Officer (PRO)'
  ];

  return json({
    ok: true,
    election: {
      election_id: election.election_id,
      election_name: election.election_name,
      start_time: election.start_time,
      end_time: election.end_time,
      is_active: !!election.is_active,
      cluster_department: election.cluster_department,
      positions
    }
  });
}

module.exports = { onRequestGet };
