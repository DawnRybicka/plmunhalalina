// =============================================================
// HALALina - /api/candidates
// -------------------------------------------------------------
//   GET  /api/candidates       - returns all candidates (12 defaults
//                                + admin-added ones), grouped by position
//   POST /api/candidates       - admin only: add a new candidate
//   DELETE /api/candidates?id=X - admin only: remove an admin-added
//                                 candidate (the original 12 cannot be removed)
// =============================================================

const db = require('../lib/db');
const { error, json } = require('../lib/api-helpers');
const { ELECTION_ID } = require('../lib/constants');

// ---- Helper: load all candidates from D1 ----
async function loadAllCandidates(env) {
  const rows = await db.all(env, 'SELECT * FROM CANDIDATE_PROFILE ORDER BY candidate_id ASC');
  return rows.map(r => ({
    candidate_id: r.candidate_id,
    full_name: r.full_name,
    running_position: r.running_position,
    party_affiliation: r.party_affiliation,
    program: r.program,
    year_section: r.year_section,
    photo_initials: r.photo_initials,
    photo_color: r.photo_color,
    platform: db.parseJsonSafe(r.platform, []),
    credentials: db.parseJsonSafe(r.credentials, { leadership_experience: [], achievements: [] }),
    is_admin_added: !!r.is_admin_added
  }));
}

// ---- GET: list all candidates ----
async function onRequestGet({ env }) {
  const candidates = await loadAllCandidates(env);
  return json({ ok: true, candidates });
}

// ---- POST: admin adds a new candidate ----
async function onRequestPost({ request, env, data }) {
  const session = data.session;
  if (!session) return error('Not logged in.', 401);
  if (session.role !== 'admin') return error('Admin only.', 403);

  const body = await request.json().catch(() => null);
  if (!body) return error('Invalid JSON body.');

  // Validate required fields
  if (!body.full_name || !String(body.full_name).trim()) return error('Full name is required.');
  if (!body.running_position || !String(body.running_position).trim()) return error('Position is required.');
  if (!body.party_affiliation || !String(body.party_affiliation).trim()) return error('Party affiliation is required.');

  // Parse platform + credentials (one item per line, as the admin form sends)
  const platform = String(body.platform || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (platform.length === 0) return error('At least one platform item is required.');
  const credentialsList = String(body.credentials || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (credentialsList.length === 0) return error('At least one credential is required.');

  // Generate unique candidate ID
  const all = await loadAllCandidates(env);
  let nextId = all.length + 1;
  let candidateId;
  do {
    candidateId = 'C' + String(nextId).padStart(3, '0');
    nextId++;
  } while (all.some(c => c.candidate_id === candidateId));

  // Generate initials
  const nameParts = body.full_name.trim().split(/\s+/);
  const initials = nameParts.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
  const AVATAR_COLORS = ['#16a34a', '#0ea5e9', '#9333ea', '#dc2626', '#d97706', '#0891b2', '#65a30d', '#c026d3'];
  const color = AVATAR_COLORS[all.length % AVATAR_COLORS.length];

  const platformJson = JSON.stringify(platform);
  const credsJson = JSON.stringify({
    leadership_experience: credentialsList.slice(0, Math.ceil(credentialsList.length / 2)),
    achievements: credentialsList.slice(Math.ceil(credentialsList.length / 2))
  });

  await db.run(env,
    'INSERT INTO CANDIDATE_PROFILE (candidate_id, election_id, full_name, running_position, party_affiliation, program, year_section, photo_initials, photo_color, platform, credentials, is_admin_added, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
    candidateId, ELECTION_ID, body.full_name.trim(), body.running_position.trim(), body.party_affiliation.trim(),
    body.program || 'N/A', body.year_section || 'N/A', initials, color, platformJson, credsJson,
    new Date().toISOString()
  );

  // Track in ADDED_CANDIDATES so admins can remove it later
  await db.run(env, 'INSERT INTO ADDED_CANDIDATES (candidate_id) VALUES (?)', candidateId);

  return json({
    ok: true,
    candidate: {
      candidate_id: candidateId,
      full_name: body.full_name.trim(),
      running_position: body.running_position.trim(),
      party_affiliation: body.party_affiliation.trim()
    }
  });
}

// ---- DELETE: admin removes an admin-added candidate ----
async function onRequestDelete({ request, env, data }) {
  const session = data.session;
  if (!session) return error('Not logged in.', 401);
  if (session.role !== 'admin') return error('Admin only.', 403);

  const url = new URL(request.url);
  const candidateId = url.searchParams.get('id');
  if (!candidateId) return error('Missing "id" query parameter.');

  // Verify it's an admin-added candidate
  const added = await db.first(env, 'SELECT * FROM ADDED_CANDIDATES WHERE candidate_id = ?', candidateId);
  if (!added) {
    return error('Candidate not found, or it is one of the original candidates (cannot be removed).', 404);
  }

  // Delete from both ADDED_CANDIDATES and CANDIDATE_PROFILE
  await db.batch(env, [
    { sql: 'DELETE FROM ADDED_CANDIDATES WHERE candidate_id = ?', params: [candidateId] },
    { sql: 'DELETE FROM CANDIDATE_PROFILE WHERE candidate_id = ? AND is_admin_added = 1', params: [candidateId] }
  ]);

  return json({ ok: true, candidate_id: candidateId });
}

module.exports = { onRequestGet, onRequestPost, onRequestDelete };
