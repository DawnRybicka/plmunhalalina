// =============================================================
// HALALina - /api/admin-test
// -------------------------------------------------------------
//   POST /api/admin-test              - run an attack simulation
//   POST /api/admin-test/restore      - restore the chain
//
// Request body for /api/admin-test:
//   { attack: 'tamper-no-remine' | 'tamper-remine' |
//             'unauthorized-tx' | 'inject-bad-pow' | 'inject-bad-linkage' }
// =============================================================

const { testTamperBlock, testUnauthorizedTransaction, testInjectBlock, restoreChain } = require('../lib/blockchain');
const { json, error } = require('../lib/api-helpers');

async function onRequestPost({ request, env, data }) {
  const session = data.session;
  if (!session) return error('Not logged in.', 401);
  if (session.role !== 'admin') return error('Admin only.', 403);

  const url = new URL(request.url);
  const isRestore = url.pathname.endsWith('/restore');

  if (isRestore) {
    const ok = await restoreChain(env);
    return json({ ok });
  }

  const body = await request.json().catch(() => ({}));
  const attack = body.attack;

  let result;
  switch (attack) {
    case 'tamper-no-remine':
      result = await testTamperBlock(env, false);
      break;
    case 'tamper-remine':
      result = await testTamperBlock(env, true);
      break;
    case 'unauthorized-tx':
      result = await testUnauthorizedTransaction(env);
      break;
    case 'inject-bad-pow':
      result = await testInjectBlock(env, 'bad-pow');
      break;
    case 'inject-bad-linkage':
      result = await testInjectBlock(env, 'bad-linkage');
      break;
    default:
      return error(`Unknown attack: ${attack}`);
  }

  return json(result);
}

module.exports = { onRequestPost };
