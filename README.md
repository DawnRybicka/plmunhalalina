# HALALina - Web-based Transparent Voting System (Cloudflare Pages Edition)

A Web-based Transparent Voting System for the **Pamantasan ng Lungsod ng Muntinlupa (PLMun)** Student Council Elections. This edition runs on **Cloudflare Pages** with a real backend (Pages Functions) and a real SQL database (Cloudflare D1).

The blockchain is server-side and shared — every voter writes to the same D1-backed chain, instead of each browser keeping its own private chain (as in the static-only GitHub Pages edition).

---

## Table of Contents

1. [What's Different From the GitHub Pages Edition](#whats-different)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Local Development](#local-development)
5. [Deployment to Cloudflare Pages](#deployment-to-cloudflare-pages)
6. [Test Accounts](#test-accounts)
7. [Project Structure](#project-structure)
8. [API Reference](#api-reference)
9. [Database Schema](#database-schema)
10. [How the Blockchain Works](#how-the-blockchain-works)
11. [Anonymity & Cryptography](#anonymity--cryptography)
12. [Limitations](#limitations)
13. [Migrating from the GitHub Pages Edition](#migrating)
14. [License](#license)

---

## What's Different

This Cloudflare Pages edition is a complete backend rewrite of the original GitHub Pages (static-only) edition:

| Aspect | GitHub Pages edition | Cloudflare Pages edition (this one) |
|---|---|---|
| Storage | Per-browser `localStorage` | Shared **Cloudflare D1** SQLite database |
| Authentication | Client-side (browser sees all 220 PINs) | Server-side via **Pages Functions** (browser never sees other students' PINs) |
| Blockchain | Per-browser chain | Shared chain in D1 — all voters see the same ledger |
| Mining | Client-side PoW | Server-side PoW (in Pages Functions) |
| Voting | Client-side encrypt + write to localStorage | Client encrypts (E2EE), server mines block + stores in D1 |
| Audit Trail | Client-side localStorage | D1 `AUDIT_TRAIL` table, queried via `/api/audit` |
| Admin Tool | `localStorage`-only candidates | D1 `CANDIDATE_PROFILE` table, admin can add/remove |
| Mock SIS | Static `js/sis-data.js` file with 220 students | Real D1 `MOCK_STUDENT_SIS` table (seeded from `seed.sql`) |
| SQL Schema | Documentation only | **Authoritative** — loaded into D1 via `wrangler d1 execute` |
| Hosting | GitHub Pages (static) | Cloudflare Pages + Pages Functions + D1 |

The UI, the white & green theme, the PLMun logo, the login flow, the candidates grid, the audit trail, the admin testing panel, and the candidate management tool are all preserved.

---

## Architecture

```
                 +-----------------------------+
                 |   Cloudflare Pages (CDN)    |
                 |   serves static files from  |
                 |   /public (HTML/CSS/JS)     |
                 +--------------+--------------+
                                |
                                |  fetch('/api/...')
                                v
                 +-----------------------------+
                 | Cloudflare Pages Functions  |
                 | (serverless, /functions)    |
                 |                             |
                 |  /api/login    /api/vote    |
                 |  /api/verify   /api/tally   |
                 |  /api/candidates            |
                 |  /api/audit   /api/blockchain
                 |  /api/sis-stats (admin)    |
                 |  /api/admin-test (admin)   |
                 +--------------+--------------+
                                |
                                |  env.DB.prepare("SQL").bind()
                                v
                 +-----------------------------+
                 | Cloudflare D1 (SQLite)      |
                 |                             |
                 |  MOCK_STUDENT_SIS  (220)    |
                 |  ADMIN_USERS        (2)    |
                 |  VOTER_LOG                  |
                 |  CANDIDATE_PROFILE (12+)   |
                 |  AUDIT_TRAIL                |
                 |  BLOCKCHAIN_BLOCKS         |
                 |  BLOCKCHAIN_TRANSACTIONS   |
                 |  ELECTION_SCHEDULE  (1)    |
                 +-----------------------------+
```

The browser never directly accesses D1. It calls `/api/*` endpoints which run as Pages Functions on Cloudflare's edge network. Each Function validates the session cookie, performs the requested operation against D1, and returns JSON.

End-to-end encryption (AES-GCM) still happens in the browser: the server only sees the encrypted ballot. SHA-256 hashing of student IDs happens on the server (so the browser doesn't need to know the salt).

---

## Prerequisites

1. **A Cloudflare account** (free tier is fine — D1 has a generous free quota: 5M reads/day, 100K writes/day, 5GB storage).
2. **Node.js 18+** installed locally (for `wrangler` CLI).
3. **An empty GitHub repo** (optional — needed only if you want auto-deploy on every git push; you can also deploy directly with `wrangler pages deploy`).

---

## Local Development

You can run the entire stack (frontend + Pages Functions + D1) locally without a Cloudflare account, using `wrangler pages dev`.

```bash
# 1. Install dependencies
npm install

# 2. Create a local D1 database + apply the schema + seed
npm run db:schema:local
npm run db:seed:local

# 3. Set up local secrets (for the session cookie signing + tally decryption)
# These are stored in .dev.vars (gitignored). Create the file with:
cat > .dev.vars <<EOF
SESSION_SECRET=any-long-random-string-for-dev
ELECTION_KEY=PLMUN-SSC-2026-E2EE-DEMO-KEY
EOF

# 4. Start the dev server
npm run dev
# -> opens at http://localhost:8787
```

The local D1 database lives in `.wrangler/` (gitignored). All changes you make (votes, candidates, audit logs) persist locally until you reset the DB.

To reset the local DB and start fresh:
```bash
npm run db:reset:local
npm run db:schema:local
npm run db:seed:local
```

---

## Deployment to Cloudflare Pages

This is a one-time setup. Once connected, every `git push` to your main branch will auto-deploy.

### Step 1 - Install the CLI

```bash
npm install
```

### Step 2 - Authenticate with Cloudflare

```bash
npx wrangler login
# Opens a browser window; sign in to your Cloudflare account and authorize wrangler.
```

### Step 3 - Create the D1 database

```bash
npx wrangler d1 create halalina-sis
```

This outputs something like:
```
[[d1_databases]]
binding = "DB"
database_name = "halalina-sis"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` value and paste it into your `wrangler.toml` (replace the `REPLACE_WITH_YOUR_D1_DATABASE_ID` placeholder).

### Step 4 - Apply the schema + seed the database

```bash
# Apply the schema (creates all 8 tables)
npx wrangler d1 execute halalina-sis --file=schema.sql --remote

# Seed the data (220 students, 2 admins, 12 candidates, 1 election)
npx wrangler d1 execute halalina-sis --file=seed.sql --remote
```

### Step 5 - Set the production secrets

These secrets are used by the Pages Functions to sign session cookies and decrypt ballots for the tally. Generate strong random values for production.

```bash
# Session cookie signing secret (use a long random string)
npx wrangler pages secret put SESSION_SECRET --project-name halalina
# -> paste a 32+ char random string when prompted

# Election key for AES-GCM ballot decryption
npx wrangler pages secret put ELECTION_KEY --project-name halalina
# -> paste any passphrase (e.g. PLMUN-SSC-2026-E2EE-DEMO-KEY)
```

### Step 6 - Deploy

You have two options:

**Option A - Direct deploy with wrangler:**
```bash
npx wrangler pages deploy public --project-name halalina
```

**Option B - Connect to GitHub for auto-deploy:**
1. Push this folder to a GitHub repo.
2. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select your repo. Cloudflare auto-detects Pages Functions from the `functions/` directory.
4. Set the build command to `npm install` and the build output directory to `public`.
5. Add the same D1 binding from Step 3 to the project's **Settings → Functions → D1 database bindings**.
6. Add the secrets `SESSION_SECRET` and `ELECTION_KEY` under **Settings → Environment variables** (Production).
7. Click **Save and Deploy**.

Your site will be live at `https://halalina.<your-subdomain>.workers.dev` (or your custom domain).

### Step 7 - Verify

Visit your deployed URL and login with one of the test accounts below. Cast a vote, verify it on the Verify Vote tab, then login as admin to see the audit trail and the Admin Testing Panel.

---

## Test Accounts

### Admin / COMELEC (IDs start with `99`)
| ID | PIN | Name | Role |
|---|---|---|---|
| `99000001` | `123456` | Dr. Maria Elena Santos | ADMIN |
| `99000002` | `567890` | Prof. Ronaldo Reyes | COMELEC |

### Sample students (IDs start with `23`)
The D1 database contains 220 students. Sample accounts (regenerated each time `generate_seed.py` runs):

| ID | PIN | Name |
|---|---|---|
| `23008484` | `649857` | Jaspher Walangitan |
| `23016328` | `800005` | Eduard Tiangco |
| `23016400` | `688153` | Andrei Yaptinchay |
| `23020539` | `881886` | Carlos Yaptinchay |
| `23025039` | `694223` | Kim Rivera |

To find more, query D1 directly:
```bash
npx wrangler d1 execute halalina-sis --remote --command "SELECT student_id, first_name, last_name, pin FROM MOCK_STUDENT_SIS WHERE eligibility_status = 'ELIGIBLE' LIMIT 10"
```

---

## Project Structure

```
halalina-voting-system/
├── public/                          # Static files served by Cloudflare Pages
│   ├── index.html
│   ├── css/style.css
│   ├── assets/plmun-logo.png
│   └── js/
│       ├── crypto-utils.js          # Client-side SHA-256 + AES-GCM (Web Crypto API)
│       ├── sis.js                   # Stub - data is in D1 now
│       ├── candidates.js            # Static fallback list + CandidatesManager (calls /api/candidates)
│       ├── voter-log.js             # Stub - server enforces one-vote-per-student
│       ├── audit.js                 # Fetches from /api/audit
│       ├── blockchain.js            # Fetches from /api/blockchain
│       ├── auth.js                  # Calls /api/login, /api/logout, /api/session
│       ├── voting.js                # Client-side E2EE + POST /api/vote
│       ├── app.js                   # Main app router + UI wiring
│       └── legacy/sis-data.js       # The original 220-student JS file (kept for reference)
├── functions/                       # Cloudflare Pages Functions (serverless backend)
│   ├── _middleware.js               # CORS + session context setup
│   ├── lib/
│   │   ├── constants.js             # Shared constants (salt, difficulty, etc.)
│   │   ├── crypto.js                # Server-side SHA-256 + AES-GCM + HMAC
│   │   ├── db.js                    # D1 query helpers
│   │   ├── auth.js                  # HMAC-signed session cookies
│   │   ├── blockchain.js            # Server-side PoW mining + validation
│   │   └── api-helpers.js           # JSON responses + audit logging
│   └── api/
│       ├── login.js                 # POST /api/login
│       ├── logout.js                # POST /api/logout
│       ├── session.js               # GET /api/session
│       ├── vote.js                  # POST /api/vote
│       ├── verify.js                # POST /api/verify
│       ├── tally.js                 # GET /api/tally
│       ├── candidates.js            # GET / POST / DELETE /api/candidates
│       ├── added-candidates.js      # GET /api/added-candidates (admin)
│       ├── audit.js                 # GET /api/audit
│       ├── blockchain.js            # GET / POST /api/blockchain
│       ├── sis-stats.js             # GET /api/sis-stats (admin)
│       ├── admin-test.js            # POST /api/admin-test (admin)
│       └── election-info.js         # GET /api/election-info
├── schema.sql                       # D1 schema (SQLite syntax)
├── seed.sql                         # D1 seed data (220 students + 12 candidates + 2 admins)
├── wrangler.toml                    # Cloudflare Pages config (D1 binding)
├── package.json                     # npm scripts for wrangler
├── .gitignore
└── README.md                        # This file
```

---

## API Reference

All endpoints are mounted at `/api/*` and return JSON. All authenticated endpoints require the `halalina_session` cookie (set by `/api/login`).

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/login` | none | Validate credentials, set session cookie |
| `POST` | `/api/logout` | any | Clear session cookie |
| `GET`  | `/api/session` | any | Return current session payload (or 401) |
| `POST` | `/api/vote` | student | Encrypt ballot client-side, server mines block + stores in D1 |
| `POST` | `/api/verify` | any | Look up a vote by receipt code or transaction hash |
| `GET`  | `/api/tally` | any | Decrypt all ballots and return per-candidate counts |
| `GET`  | `/api/candidates` | any | List all candidates (original + admin-added) |
| `POST` | `/api/candidates` | admin | Add a new candidate |
| `DELETE` | `/api/candidates?id=X` | admin | Remove an admin-added candidate |
| `GET`  | `/api/added-candidates` | admin | List admin-added candidates (for the admin tool UI) |
| `GET`  | `/api/audit` | any | List audit log entries (filtered by role: students see only public) |
| `GET`  | `/api/blockchain` | any | List all blocks + transactions |
| `POST` | `/api/blockchain` | admin | Validate the chain, return failures |
| `GET`  | `/api/sis-stats` | admin | Return aggregate Mock SIS stats |
| `POST` | `/api/admin-test` | admin | Run an attack simulation (tamper/inject/etc.) |
| `POST` | `/api/admin-test/restore` | admin | Restore the chain to pre-attack state |
| `GET`  | `/api/election-info` | any | Return the election schedule + positions list |

---

## Database Schema

8 tables, defined in `schema.sql` (SQLite syntax for D1):

| Table | Purpose | Rows (after seed) |
|---|---|---|
| `MOCK_STUDENT_SIS` | 220 synthetic student records | 220 |
| `ADMIN_USERS` | 2 admin / COMELEC accounts | 2 |
| `VOTER_LOG` | Off-chain "has_voted" tracking | 0 (grows with votes) |
| `CANDIDATE_PROFILE` | The 12 default candidates + admin-added ones | 12 |
| `ADDED_CANDIDATES` | Lightweight tracker for admin-added candidates | 0 |
| `ELECTION_SCHEDULE` | Election window | 1 |
| `AUDIT_TRAIL` | Immutable audit log | 0 (grows with activity) |
| `BLOCKCHAIN_BLOCKS` | The blockchain's blocks | 0 (genesis auto-created on first vote) |
| `BLOCKCHAIN_TRANSACTIONS` | Per-vote transactions | 0 (grows with votes) |

To re-apply the schema (wipes all data):
```bash
npx wrangler d1 execute halalina-sis --file=schema.sql --remote
npx wrangler d1 execute halalina-sis --file=seed.sql --remote
```

To regenerate `seed.sql` from the latest `js/candidates.js` + `js/legacy/sis-data.js`:
```bash
python3 scripts/generate_seed.py
```

---

## How the Blockchain Works

Same as the static edition, but server-side and shared:

1. **Genesis block** — created automatically on the first vote (or first `/api/blockchain` call). Its hash satisfies PoW difficulty 3 (starts with `000`).
2. **Each vote** becomes one block, mined server-side in the Pages Function. The block's hash must start with `000`.
3. **Block contents** — index, timestamp, the single vote transaction, previous block's hash, nonce, and the resulting hash.
4. **Transaction contents** — `transactionHash` (client-computed SHA-256 of the encrypted ballot), `hashedVoterId` (SHA-256 of the student ID + salt), `encryptedBallot` (AES-GCM ciphertext + IV + salt), `electionId`, `timestamp`. The candidate selection is **never** stored unencrypted — only the encrypted blob is on the public chain.
5. **Validation** — `/api/blockchain` POST (admin only) re-hashes every block, checks the previousHash linkage, verifies the PoW difficulty, and checks each transaction's signature. Returns a list of any failures.
6. **Admin Testing Panel** — admins can simulate tampering, unauthorized transactions, and direct chain injection. Each attack mutates the D1-backed chain; the validator then catches it. Use **Restore Chain** to roll back.

---

## Anonymity & Cryptography

The anonymity design is preserved:

1. **End-to-End Encryption (AES-GCM)** — the browser encrypts the ballot before sending. The server only sees the encrypted blob. The election key (for tally decryption) is stored as a Cloudflare secret, accessible only to the `/api/tally` endpoint.
2. **SHA-256 voter ID hashing** — the server hashes the student ID with a static salt before storing the hashed value on the chain. The raw student ID never leaves the `/api/login` endpoint.
3. **HMAC-signed session cookies** — the session cookie is signed with the `SESSION_SECRET` so it can't be tampered with. The cookie is `HttpOnly` so JavaScript can't read it (only the browser sends it with each request).
4. **Audit trail anonymity** — the audit log records the hashed voter pseudonym (or `anonymous`/`system`), never the raw student ID. `VOTE_CAST` entries contain only `block_index`, never the transaction hash or receipt code.
5. **Role-based visibility** — students only see `public` audit entries (`VOTE_VERIFIED`, `VOTE_NOT_FOUND`, `SYSTEM_ACTION`); admins see all entries including `LOGIN_*`, `VOTE_CAST`, `BLOCKCHAIN_*`.

---

## Limitations

- The election key is a single secret in Cloudflare. In production, this would be split across multiple trustees using **Shamir's Secret Sharing** so no single admin can decrypt individual ballots.
- The `SALT` for voter ID hashing is in `wrangler.toml` `[vars]` (visible to anyone with read access to your Cloudflare dashboard). In production, move it to a Cloudflare **secret**.
- The PINs in D1 are plaintext (for the demo). In production, store SHA-256 hashes (with per-user salt) and compare hashes during login.
- D1 has a 4MB write limit per transaction. Each vote is ~1KB so this is fine, but if you batch many votes in one request you'd need to chunk them.
- Pages Functions have a 30-second CPU time limit per invocation (free tier). Mining at difficulty 3 takes <100ms, so this isn't a concern.

---

## Migrating

If you already deployed the GitHub Pages (static-only) edition and want to switch to this Cloudflare Pages edition:

1. The UI is identical, so users won't notice any visual change.
2. The data does **not** carry over — the per-browser `localStorage` chain from the GitHub Pages edition is completely separate from the D1-backed chain in this edition.
3. To migrate, just deploy this folder to Cloudflare Pages (per the tutorial above) and re-cast votes.

---

## License

MIT License. Attribution to the original capstone team (Malate, Maminta, Rubica — PLMun BSIT 2026) is appreciated.
