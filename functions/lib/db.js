// =============================================================
// HALALina - D1 database query helpers
// -------------------------------------------------------------
// Thin wrappers around env.DB.prepare(...).bind(...).first()/all()/run()
// to make the API endpoints more readable.
// =============================================================

// ---- Run a parameterized query and return all rows ----
async function all(env, sql, ...params) {
  const stmt = env.DB.prepare(sql);
  const result = await stmt.bind(...params).all();
  return result.results || [];
}

// ---- Run a query and return the first row (or null) ----
async function first(env, sql, ...params) {
  const stmt = env.DB.prepare(sql);
  return await stmt.bind(...params).first();
}

// ---- Run an INSERT/UPDATE/DELETE and return the meta ----
async function run(env, sql, ...params) {
  const stmt = env.DB.prepare(sql);
  return await stmt.bind(...params).run();
}

// ---- Run multiple statements in a single D1 batch (atomic) ----
async function batch(env, statements) {
  // statements = [{ sql: '...', params: [...] }, ...]
  return await env.DB.batch(statements.map(s => env.DB.prepare(s.sql).bind(...(s.params || []))));
}

// ---- JSON helpers (D1 stores JSON as TEXT; we parse it on read) ----
function parseJsonSafe(text, fallback) {
  if (!text) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}
function stringifyJson(value) {
  return JSON.stringify(value);
}

module.exports = {
  all, first, run, batch,
  parseJsonSafe, stringifyJson
};
