-- =============================================================
-- HALALina - Cloudflare D1 Schema (SQLite syntax)
-- =============================================================
-- Cloudflare D1 is a serverless SQLite database. This file creates
-- all the tables needed by the HALALina voting system:
--
--   MOCK_STUDENT_SIS    - 220 synthetic student records
--   ADMIN_USERS         - 2 admin / COMELEC accounts
--   VOTER_LOG           - off-chain "has_voted" tracking
--   CANDIDATE_PROFILE   - the 12 default candidates + admin-added ones
--   ELECTION_SCHEDULE  - election window
--   AUDIT_TRAIL         - immutable audit log
--   BLOCKCHAIN_BLOCKS   - the simulated blockchain's blocks
--   BLOCKCHAIN_TRANSACTIONS - per-vote transactions
--
-- Apply with: npx wrangler d1 execute halalina-sis --file=schema.sql --local
-- Then:        npx wrangler d1 execute halalina-sis --file=schema.sql --remote
-- =============================================================

-- Drop existing tables (so re-running the schema is safe during development)
DROP TABLE IF EXISTS BLOCKCHAIN_TRANSACTIONS;
DROP TABLE IF EXISTS BLOCKCHAIN_BLOCKS;
DROP TABLE IF EXISTS AUDIT_TRAIL;
DROP TABLE IF EXISTS VOTER_LOG;
DROP TABLE IF EXISTS ADDED_CANDIDATES;
DROP TABLE IF EXISTS CANDIDATE_PROFILE;
DROP TABLE IF EXISTS ADMIN_USERS;
DROP TABLE IF EXISTS MOCK_STUDENT_SIS;
DROP TABLE IF EXISTS ELECTION_SCHEDULE;

-- ----------------------------------------------------------------
-- MOCK_STUDENT_SIS
-- Synthetic student records (PLMun SIS mirror).
-- ----------------------------------------------------------------
CREATE TABLE MOCK_STUDENT_SIS (
  student_id         TEXT PRIMARY KEY,             -- format: 23XXXXXX (8 digits)
  first_name         TEXT NOT NULL,
  middle_initial     TEXT,
  last_name          TEXT NOT NULL,
  gender             TEXT NOT NULL,                -- 'M' or 'F'
  program            TEXT NOT NULL,                -- BSIT, BSCS, BSIS, ACT, BSEMCP, BSDS
  program_full       TEXT NOT NULL,
  year               INTEGER NOT NULL,             -- 1-4
  section            TEXT NOT NULL,                 -- A-D
  email              TEXT NOT NULL,
  pin                TEXT NOT NULL,                 -- 6-digit PIN (SHA-256 hash in production)
  eligibility_status TEXT NOT NULL DEFAULT 'ELIGIBLE',  -- 'ELIGIBLE' or 'INELIGIBLE'
  has_voted          INTEGER NOT NULL DEFAULT 0,    -- 0 or 1 (SQLite has no BOOLEAN)
  vote_hash          TEXT,                          -- tx hash after voting
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_student_eligibility ON MOCK_STUDENT_SIS(eligibility_status);
CREATE INDEX idx_student_program_year ON MOCK_STUDENT_SIS(program, year, section);

-- ----------------------------------------------------------------
-- ADMIN_USERS
-- Admin / COMELEC accounts. IDs start with 99.
-- ----------------------------------------------------------------
CREATE TABLE ADMIN_USERS (
  admin_id     TEXT PRIMARY KEY,                   -- format: 99XXXXXX
  full_name    TEXT NOT NULL,
  role         TEXT NOT NULL,                       -- 'ADMIN' or 'COMELEC'
  pin          TEXT NOT NULL,                       -- 6-digit PIN
  email        TEXT,
  department   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ----------------------------------------------------------------
-- VOTER_LOG
-- Off-chain metadata: who has voted + tx hash. Enforces "one person,
-- one vote" at the database layer via a UNIQUE constraint on student_id.
-- ----------------------------------------------------------------
CREATE TABLE VOTER_LOG (
  log_id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id          TEXT NOT NULL UNIQUE,
  hashed_voter_id     TEXT NOT NULL,                -- SHA-256(salt:student_id)
  has_voted           INTEGER NOT NULL DEFAULT 0,
  vote_timestamp      TEXT,
  transaction_hash    TEXT,
  registration_date   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (student_id) REFERENCES MOCK_STUDENT_SIS(student_id)
);
CREATE INDEX idx_voterlog_hashed ON VOTER_LOG(hashed_voter_id);

-- ----------------------------------------------------------------
-- CANDIDATE_PROFILE
-- The 12 default candidates + admin-added ones.
-- Stored as JSON strings since SQLite has no JSON column type.
-- ----------------------------------------------------------------
CREATE TABLE CANDIDATE_PROFILE (
  candidate_id       TEXT PRIMARY KEY,
  election_id        TEXT NOT NULL,
  full_name          TEXT NOT NULL,
  running_position   TEXT NOT NULL,
  party_affiliation  TEXT NOT NULL,
  program            TEXT,
  year_section        TEXT,
  photo_initials     TEXT,
  photo_color         TEXT,
  platform           TEXT,                          -- JSON array of strings
  credentials        TEXT,                          -- JSON object with leadership_experience + achievements
  is_admin_added     INTEGER NOT NULL DEFAULT 0,
  added_at           TEXT
);
CREATE INDEX idx_candidate_position ON CANDIDATE_PROFILE(running_position);
CREATE INDEX idx_candidate_election ON CANDIDATE_PROFILE(election_id);

-- ----------------------------------------------------------------
-- ADDED_CANDIDATES
-- Lightweight table to track admin-added candidates separately so
-- they can be removed without affecting the original 12.
-- (The full candidate data is also in CANDIDATE_PROFILE with is_admin_added=1.)
-- ----------------------------------------------------------------
CREATE TABLE ADDED_CANDIDATES (
  candidate_id   TEXT PRIMARY KEY,
  added_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (candidate_id) REFERENCES CANDIDATE_PROFILE(candidate_id)
);

-- ----------------------------------------------------------------
-- ELECTION_SCHEDULE
-- Election window configuration.
-- ----------------------------------------------------------------
CREATE TABLE ELECTION_SCHEDULE (
  schedule_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  election_id           TEXT NOT NULL UNIQUE,
  election_name         TEXT NOT NULL,
  start_time            TEXT NOT NULL,
  end_time              TEXT NOT NULL,
  is_active             INTEGER NOT NULL DEFAULT 1,
  cluster_department    TEXT NOT NULL DEFAULT 'All Colleges',
  smart_contract_address TEXT
);

-- ----------------------------------------------------------------
-- AUDIT_TRAIL
-- Immutable audit log of every system event.
-- The "visibility" column controls who can see each entry:
--   'system' = admin-only (LOGIN_*, VOTE_CAST, BLOCKCHAIN_*)
--   'public' = everyone (VOTE_VERIFIED, VOTE_NOT_FOUND, SYSTEM_ACTION)
-- ----------------------------------------------------------------
CREATE TABLE AUDIT_TRAIL (
  log_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ts_millis   INTEGER NOT NULL,                      -- milliseconds since epoch (for sorting)
  action      TEXT NOT NULL,
  actor       TEXT NOT NULL,                         -- 'anonymous', 'system', or hashed_voter_id (64-char hex)
  details     TEXT,                                  -- JSON object
  visibility  TEXT NOT NULL DEFAULT 'system'         -- 'system' or 'public'
);
CREATE INDEX idx_audit_ts ON AUDIT_TRAIL(ts_millis DESC);
CREATE INDEX idx_audit_action ON AUDIT_TRAIL(action);
CREATE INDEX idx_audit_visibility ON AUDIT_TRAIL(visibility);

-- ----------------------------------------------------------------
-- BLOCKCHAIN_BLOCKS
-- The simulated blockchain's blocks. Each vote becomes one block.
-- Stored as rows so the chain is shared across all voters (D1 is the
-- single source of truth, not the browser's localStorage).
-- ----------------------------------------------------------------
CREATE TABLE BLOCKCHAIN_BLOCKS (
  block_index   INTEGER PRIMARY KEY,                -- 0 = genesis, 1+ = vote blocks
  timestamp     INTEGER NOT NULL,                   -- ms since epoch
  previous_hash TEXT NOT NULL,
  nonce         INTEGER NOT NULL,
  hash          TEXT NOT NULL,                       -- SHA-256 of block contents, starts with "000"
  is_genesis    INTEGER NOT NULL DEFAULT 0,
  is_tampered   INTEGER NOT NULL DEFAULT 0           -- set by admin testing panel
);

-- ----------------------------------------------------------------
-- BLOCKCHAIN_TRANSACTIONS
-- Per-vote transactions. Each transaction belongs to exactly one block.
-- The candidateIds are kept encrypted (in encrypted_ballot) so the
-- public chain doesn't reveal who voted for whom.
-- ----------------------------------------------------------------
CREATE TABLE BLOCKCHAIN_TRANSACTIONS (
  transaction_hash  TEXT PRIMARY KEY,               -- SHA-256 of the ballot payload
  block_index       INTEGER NOT NULL,
  hashed_voter_id   TEXT NOT NULL,                   -- SHA-256(salt:student_id), anonymous
  encrypted_ballot  TEXT NOT NULL,                   -- JSON: { ciphertextHex, ivHex, saltHex }
  election_id       TEXT NOT NULL,
  timestamp         INTEGER NOT NULL,
  candidate_ids     TEXT,                             -- null on the public record (kept encrypted)
  FOREIGN KEY (block_index) REFERENCES BLOCKCHAIN_BLOCKS(block_index)
);
CREATE INDEX idx_tx_block ON BLOCKCHAIN_TRANSACTIONS(block_index);
CREATE INDEX idx_tx_voter ON BLOCKCHAIN_TRANSACTIONS(hashed_voter_id);

-- =============================================================
-- Done. Run seed.sql next to populate the tables.
-- =============================================================
