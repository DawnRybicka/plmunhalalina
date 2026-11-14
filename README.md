# HALALina - Web-Based Transparent Voting System (Simulated Blockchain)

A Web-based Transparent Voting System for the **Pamantasan ng Lungsod ng Muntinlupa (PLMun)** Student Council Elections. The system uses **simulated blockchain technology** (pure JavaScript, no mainnet/testnet) to provide immutable, tamper-proof vote recording, end-to-end encryption of ballots, and a transparent audit trail while preserving voter anonymity.

This is a **capstone project deliverable** built to satisfy the requirements described in *Group 7 Chapter 1 - 3 (HALALina: The Design and Development of a Web-Based Blockchain Voting System)*, with the deliberate substitution of a **JavaScript-simulated blockchain** for the production Solidity / Polygon network so the project can be deployed entirely on GitHub Pages with zero server infrastructure.

---

## Table of Contents

1. [Features](#features)
2. [Quick Start (Local)](#quick-start-local)
3. [GitHub Pages Deployment Tutorial](#github-pages-deployment-tutorial)
4. [Test Accounts](#test-accounts)
5. [Project Structure](#project-structure)
6. [SQL Schema (alongside JavaScript)](#sql-schema-alongside-javascript)
7. [How the Simulated Blockchain Works](#how-the-simulated-blockchain-works)
8. [Anonymity & Cryptography](#anonymity--cryptography)
9. [Mock SIS Database](#mock-sis-database)
10. [Tab-by-Tab Walkthrough](#tab-by-tab-walkthrough)
11. [Limitations](#limitations)
12. [Extending to a Real Blockchain](#extending-to-a-real-blockchain)
13. [License](#license)

---

## Features

### Security & Election Integrity
- **One student, one vote** - enforced both off-chain (Voter Log) and on-chain (blockchain transactions reference a SHA-256 hashed voter ID).
- **Mock SIS authentication** - Students log in with a `23XXXXXX` student ID + 4-digit PIN, validated against a 220-student Mock SIS database.
- **Eligibility verification** - Only `ELIGIBLE` (enrolled) students can vote. The 8% `INELIGIBLE` students in the mock data are rejected at login.
- **Duplicate-voting prevention** - Once a student casts a vote, the voter log + blockchain reject any further attempts.

### Transparency & Auditability
- **Cryptographic receipts** - After voting, the student receives a 20-character receipt code (e.g. `804E-37C0-36B2-745B-0439`) plus a 64-character transaction hash.
- **Public verification** - Any student can paste a receipt or hash into the **Verify Vote** tab to confirm their vote was recorded on the ledger, without revealing their candidate selections or identity.
- **Immutable audit trail** - Every login attempt, vote cast, verification, and chain validation is logged with timestamp + actor.
- **Anonymity-preserving tally** - The live tally decrypts ballots with the election key (admin/audit only) and displays only aggregate counts per candidate, never linking a voter to a vote.

### Reliability & Scalability
- **100% client-side** - No backend server needed. Works on GitHub Pages, any static host, or even from `file://`.
- **localStorage persistence** - The blockchain, voter log, and audit trail survive page refreshes.
- **Concurrent-read friendly** - All computation runs in the browser; "concurrent users" simply means multiple browsers each maintaining their own copy of the chain. For a real election you would replace the simulated chain with a shared Layer-2 network (see [Extending to a Real Blockchain](#extending-to-a-real-blockchain)).

### Simulated Blockchain
- **Proof-of-Work mining** - Each block hash must start with `"000"` (difficulty 3).
- **SHA-256 block hashing** - Real SHA-256 via the browser's native `crypto.subtle` API.
- **Genesis block** - Mined on first load and stored in `localStorage`.
- **Chain validation** - The "Validate Blockchain" button (admin only) re-hashes every block and verifies the previous-hash linkage, PoW difficulty, AND transaction signatures. Tampering with any block instantly invalidates the chain.
- **Admin Testing Panel** - Admins can simulate three classic blockchain attacks to verify the validator catches them:
  - **Block Tampering (Hash Integrity)** - Modify a block's contents; the recomputedHash check fails.
  - **Unauthorized Transaction (Signature Verification)** - Mine a block with a forged transaction hash; the signature check fails.
  - **Direct Chain Injection (Consensus Bypass)** - Push a fake block without mining; the PoW check or linkage check fails.
  - After each test, click **Validate Blockchain** to see the failure, then **Restore Chain** to roll back.

### End-to-End Encryption (E2EE)
- **AES-GCM 256** - Ballots are encrypted client-side using the Web Crypto API before being written to the chain.
- **PBKDF2 key derivation** - 100,000 iterations + random salt per ballot.
- **Random IV** - 96-bit initialization vector per ballot.
- The blockchain ledger contains only ciphertext; the candidate selections are never stored in plaintext on-chain.

### Audit Trail System
- Logs every action: login success / failure, logout, vote cast, vote verified, blockchain validation, system actions.
- **Anonymized actors**: Every audit entry records the actor as either `anonymous`, `system`, or a `voter_<8-char-hash>` pseudonym (the SHA-256 hash of the student ID + salt). The raw student ID is **never** written to the audit log.
- **Stripped details**: `VOTE_CAST` entries record only the `block_index` - never the transaction hash, receipt code, or student ID. The voter keeps their receipt private; the audit trail records only that "a vote was cast by voter_<hash> in block #N".
- Each log entry includes a UTC timestamp, the anonymized actor, and structured details.
- Filterable by action type and count.
- **Role-based visibility** (admin vs student):
  - **Public audit trail** (visible to everyone): `VOTE_VERIFIED`, `VOTE_NOT_FOUND`, `SYSTEM_ACTION`. These are anonymous events that don't reference any specific voter.
  - **System audit trail** (admin-only): `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_REJECTED_ALREADY_VOTED`, `LOGOUT`, `VOTE_CAST`, `BLOCKCHAIN_VALID`, `BLOCKCHAIN_INVALID`. Admins see these tagged with a `[system]` badge; students see an info banner explaining that these entries are admin-only.
- **Admin-only UI elements**: The Mock Student SIS panel, the Validate Blockchain button, and the admin-action filter options are all hidden from student accounts.

### Admin & Student Roles
- **Student accounts** - Student IDs starting with `23` (e.g. `23005045`). Can vote, view live tally, verify their vote, and see public audit entries. Cannot see login logs, vote cast logs, or blockchain validation entries.
- **Admin / COMELEC accounts** - IDs starting with `99` (e.g. `99000001`). Cannot vote (the Vote tab is hidden for them). Can see all audit entries including system audit trails, validate the blockchain, and view the Mock Student SIS panel. Default tab for admins is the Audit Trail & Live Tally tab.
- The role is shown in the topbar as a colored badge (green "STUDENT" or amber "ADMIN").

### Mock Student Information System (SIS) - SQL + JS
- **220 synthetic student records** with IDs in the format `23XXXXXX` (8 digits, starting with 23).
- Each student has: student ID, first/last name, program (BSIT, BSCS, BSIS, ACT, BSEMCP, BSDS), year, section, email, 4-digit PIN, and eligibility status.
- 201 students are `ELIGIBLE`; 19 are `INELIGIBLE` (for testing eligibility verification).
- Data is **synthetic and anonymized** - no real PLMun student data is used.
- **Backed by both SQL and JavaScript running alongside each other**:
  - `sql/schema.sql` - real MySQL 8+ DDL with `MOCK_STUDENT_SIS`, `VOTER_LOG`, `CANDIDATE_PROFILE`, `ELECTION_SCHEDULE` tables (mirrors the capstone ERD)
  - `sql/seed.sql` - 220 `INSERT` statements that populate the SQL database with the same students
  - `js/sis-data.js` - in-memory JS mirror of the same 220 students (lets the system run entirely client-side on GitHub Pages)
  - `js/sis.js` - a SQL-style query layer (`SIS.selectByStudentId`, `SIS.verifyCredentials`, `SIS.rawSql(...)`) that the rest of the app uses - swap this file for `fetch('/api/sis/...')` calls to a Node + Express + MySQL backend and nothing else needs to change.

### White & Green LMS-Style Interface
- White background with green (`#16a34a`) primary accents.
- Login landing page → main app with three tabs (Vote, Candidates, Audit Trail & Live Tally) plus a Verify Vote tab.
- Responsive layout works on desktop, tablet, and mobile.

---

## Quick Start (Local)

The simplest way to run the project is to spin up a tiny HTTP server in the project folder. Choose one of these commands:

### Option 1: Python (already installed on most systems)

```bash
cd halalina-voting-system
python3 -m http.server 8765
# Then open http://localhost:8765/ in your browser
```

### Option 2: Node.js

```bash
cd halalina-voting-system
npx http-server -p 8765
```

### Option 3: VS Code Live Server extension

Right-click `index.html` → **Open with Live Server**.

### Option 4: Open directly

You can also just double-click `index.html` - it works under `file://` because all resources are relative paths and there are no `fetch()` calls.

> **Tip**: If you open the file directly via `file://`, browsers vary on how much `localStorage` they allow per `file://` origin. Using a local HTTP server is the most reliable.

---

## GitHub Pages Deployment Tutorial

GitHub Pages is **free** static-site hosting and is the recommended deployment target for this project. Here is the full step-by-step tutorial.

### Step 1 - Create a new GitHub repository

1. Sign in to https://github.com.
2. Click the **+** icon in the top-right → **New repository**.
3. Repository name: `halalina-voting-system` (or any name you like).
4. Set visibility: **Public** (GitHub Pages on free accounts requires public repos) or **Private** (if you have GitHub Pro).
5. **Do NOT** initialize with a README, .gitignore, or license - we will upload our own files.
6. Click **Create repository**.

### Step 2 - Upload the project files

You have two options - use the GitHub web UI or `git` on the command line.

#### Option A - GitHub web UI (easiest)

1. On your new repository page, click **uploading an existing file**.
2. Drag the entire contents of the `halalina-voting-system/` folder (the `index.html`, the `css/` folder, the `js/` folder, and this `README.md`) into the uploader. Make sure the folder structure is preserved - the `css/` and `js/` sub-folders must be at the top level of the repo.
3. Add a commit message like `Initial commit: HALALina voting system`.
4. Click **Commit changes**.

#### Option B - Git command line

```bash
# Inside the halalina-voting-system folder
git init
git add .
git commit -m "Initial commit: HALALina voting system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/halalina-voting-system.git
git push -u origin main
```

### Step 3 - Enable GitHub Pages

1. Go to your repository on GitHub.
2. Click the **Settings** tab (top-right of the repo page).
3. In the left sidebar, click **Pages**.
4. Under **Source**, select **Deploy from a branch**.
5. Under **Branch**, select `main` and `/ (root)` then click **Save**.
6. Wait 1-2 minutes. Refresh the page; GitHub will show a banner like:
   > Your site is live at `https://YOUR_USERNAME.github.io/halalina-voting-system/`

### Step 4 - Open the deployed site

Visit the URL GitHub Pages gave you. You should see the HALALina login page.

### Step 5 - Test the live deployment

Use any of the **Test Accounts** below to log in, cast a vote, and verify your receipt.

> **Important**: The simulated blockchain uses **localStorage**, which is per-browser and per-origin. Each visitor's blockchain is independent - they will see their own vote but not other visitors' votes. For a real election, replace the simulated chain with a real shared ledger (see [Extending to a Real Blockchain](#extending-to-a-real-blockchain)).

### Troubleshooting GitHub Pages

- **"404 There isn't a GitHub Pages site here"** - Wait 1-2 minutes after enabling Pages. Check that your repo has `index.html` at the **root** (not inside a sub-folder).
- **CSS or JS doesn't load** - Make sure the `css/` and `js/` folders are uploaded with their files inside, at the top level of the repo.
- **Blank page** - Open your browser's DevTools (F12) → Console. The most common cause is a path typo or a missing file.

---

## Test Accounts

The Mock SIS database contains 220 students. Here are 10 sample `ELIGIBLE` accounts you can use to log in:

| Student ID   | PIN  | Name                          | Program    | Year/Section |
|--------------|------|-------------------------------|------------|--------------|
| `23005045`   | `3868` | Gabriel Tiangco               | ACT        | 2-B          |
| `23008484`   | `9591` | Jaspher Walangitan            | BSCS       | 1-A          |
| `23014363`   | `6419` | Karl Ortega                   | BSEMCP     | 3-D          |
| `23016400`   | `1158` | Andrei Yaptinchay             | BSDS       | 4-D          |
| `23025039`   | `7375` | Kim Rivera                    | BSIS       | 2-B          |
| `23027588`   | `2934` | Mika Yaptinchay               | BSIS       | 2-C          |
| `23030673`   | `6224` | Princess Mendoza              | BSEMCP     | 3-B          |
| `23031051`   | `4981` | Hannah Estrada                | BSEMCP     | 2-D          |
| `23044369`   | `3780` | Lorraine Bacani              | ACT        | 2-D          |
| `23055269`   | `2106` | Francisco Agustin            | ACT        | 1-A          |

And an **INELIGIBLE** sample (for testing the eligibility check):

| Student ID   | PIN  | Reason                          |
|--------------|------|---------------------------------|
| `23008427`   | `4020` | Marked INELIGIBLE - will be rejected at login |

And **ADMIN / COMELEC** accounts (for testing the role-based UI):

| Admin ID     | PIN  | Name                          | Role      | Sees                                            |
|--------------|------|-------------------------------|-----------|-------------------------------------------------|
| `99000001`   | `1234` | Dr. Maria Elena Santos         | ADMIN     | Full audit trail (login + vote casts + blockchain validation), Mock SIS panel, Validate Blockchain button. Vote tab hidden. |
| `99000002`   | `5678` | Prof. Ronaldo Reyes            | COMELEC   | Same as ADMIN.                                  |

> Admin accounts have IDs starting with `99`. They cannot vote, so the Vote tab is hidden for them and they default to the Audit Trail & Live Tally tab.

To find more student accounts, open `js/sis-data.js` and look at the `MOCK_SIS` array - every student record has its `pin` field. The two admin accounts are defined in `js/sis.js` (in the `ADMIN_USERS` constant).

> **PINs are intentionally shown here** because this is a demo. In a production deployment, PINs would never be exposed - they would be issued to students out-of-band (e.g. via a one-time email from the registrar).

---

## Project Structure

```
halalina-voting-system/
├── index.html              # Main HTML page (login + app shell)
├── README.md               # This file (tutorial + docs)
├── css/
│   └── style.css           # White & green LMS-style theme
├── js/
│   ├── crypto-utils.js     # SHA-256 + AES-GCM via Web Crypto API
│   ├── sis-data.js         # Mock SIS database (220 students, JS mirror of sql/seed.sql)
│   ├── sis.js              # SQL-style query layer + admin accounts (IDs starting with 99)
│   ├── candidates.js       # 12 candidate profiles + election metadata
│   ├── voter-log.js        # Off-chain voter metadata (one-vote-per-student)
│   ├── audit.js            # Audit trail logging (anonymous actors, role-based visibility)
│   ├── blockchain.js       # Simulated PoW blockchain + admin attack tests (custom pure-JS impl)
│   ├── auth.js             # Login / logout / session (auto-detects student vs admin)
│   ├── voting.js           # Ballot casting + receipt generation
│   └── app.js              # Main app router & UI wiring (role-based UI)
├── sql/
│   ├── schema.sql          # MySQL 8+ DDL: MOCK_STUDENT_SIS, VOTER_LOG,
│   │                       # CANDIDATE_PROFILE, ELECTION_SCHEDULE (mirrors capstone ERD)
│   └── seed.sql            # 220 INSERT statements (same data as js/sis-data.js)
└── scripts/
    └── generate_sis.py     # Python script to regenerate js/sis-data.js
```

---

## SQL Schema (alongside JavaScript)

The Mock SIS is intentionally backed by **both SQL and JavaScript running alongside each other**. The SQL files are the authoritative schema; the JavaScript mirror lets the system run entirely client-side on GitHub Pages.

### What's in the SQL files

**`sql/schema.sql`** (5 KB) - MySQL 8+ compatible DDL that mirrors the Entity Relationship Diagram (ERD) in the capstone document. It creates four tables:

| Table               | Purpose                                                          | Mirrors ERD entity    |
|---------------------|------------------------------------------------------------------|----------------------|
| `MOCK_STUDENT_SIS`  | 220 synthetic student records (PK: `student_id`)                | MOCK_STUDENT_SIS     |
| `VOTER_LOG`         | Off-chain voter metadata + tx hash (FK to MOCK_STUDENT_SIS)     | VOTER_LOG            |
| `CANDIDATE_PROFILE` | Election candidates with platform / credentials / credibility  | CANDIDATE_PROFILE    |
| `ELECTION_SCHEDULE` | Election windows + smart contract address                       | ELECTION_SCHEDULE    |

**`sql/seed.sql`** (44 KB) - 220 `INSERT` statements that populate `MOCK_STUDENT_SIS` with the same 220 students that ship in `js/sis-data.js`. Both files are generated by the same Python script (`scripts/generate_sis.py`) so they are guaranteed to contain identical data.

### How to load the SQL into a real MySQL server

```bash
# From the project root
mysql -u root -p < sql/schema.sql    # creates the halalina_sis database + tables
mysql -u root -p < sql/seed.sql      # inserts all 220 students
```

Then connect and run queries:

```sql
USE halalina_sis;

-- Find an eligible student by ID
SELECT * FROM MOCK_STUDENT_SIS
WHERE student_id = '23005045' AND eligibility_status = 'ELIGIBLE';

-- Verify credentials (in production, the PIN column would be a SHA-256 hash)
SELECT student_id, first_name, last_name, program, eligibility_status
FROM MOCK_STUDENT_SIS WHERE student_id = '23005045' AND pin = '3868';

-- Eligibility summary by program
SELECT program,
       SUM(eligibility_status = 'ELIGIBLE') AS eligible,
       SUM(eligibility_status = 'INELIGIBLE') AS ineligible
FROM MOCK_STUDENT_SIS GROUP BY program;
```

### How the JS query layer mirrors the SQL

The file `js/sis.js` exposes a small SQL-style API over the in-memory JS mirror:

```js
// SELECT * FROM MOCK_STUDENT_SIS WHERE student_id = '<sid>'
const student = SIS.selectByStudentId('23005045');

// SELECT * FROM MOCK_STUDENT_SIS
//   WHERE student_id = '<sid>' AND pin = '<pin>'
const verified = SIS.verifyCredentials('23005045', '3868');

// SELECT * FROM MOCK_STUDENT_SIS WHERE program = 'BSIT' AND year = 4
const seniors = SIS.selectWhere({ program: 'BSIT', year: 4 });

// Raw SQL string (simple SELECT ... FROM MOCK_STUDENT_SIS [WHERE ...] [LIMIT n])
const rows = SIS.rawSql(
  "SELECT student_id, first_name FROM MOCK_STUDENT_SIS WHERE program = 'BSIT' LIMIT 5"
);

// SELECT COUNT(*) FROM MOCK_STUDENT_SIS (and per-status)
const stats = SIS.stats();
//  -> { total_students: 220, eligible_students: 201, ineligible_students: 19, by_program: {...} }
```

The rest of the app (`auth.js`, `voting.js`, `app.js`) goes through `SIS.*` exclusively - it never touches `MOCK_SIS` directly. This means when you swap the JS shim for real `fetch('/api/sis/...')` calls to a Node + Express + MySQL backend, only `js/sis.js` needs to change.

### Where to see this in the UI

Open the **Audit Trail & Live Tally** tab and scroll down past the blockchain ledger. You'll find a "Mock Student Information System (SIS) — SQL Backend" card that shows:
- Stat blocks (Total Students, Eligible, Ineligible, Tables)
- A dark code block showing the equivalent SQL queries the app runs

---

## How the Simulated Blockchain Works

This project ships with a tiny JavaScript implementation of an Ethereum-style PoW blockchain. It is intentionally simple so you can read every line.

### What library is used?

**None.** The simulated blockchain in `js/blockchain.js` is a **custom pure-JavaScript implementation** written from scratch for this project. It does not use any external library (no Web3.js, no ethers.js, no Ethereum client).

The only APIs it relies on are:

- The browser's **native Web Crypto API** (`window.crypto.subtle.digest('SHA-256', ...)`) for SHA-256 hashing - this is built into every modern browser, no library needed.
- The browser's **native `localStorage`** API for persisting the chain across page refreshes.

The reason we don't use a real Web3 library or any testnet/mainnet is intentional: the user asked for the blockchain to be **simulated through JavaScript** instead of using a real testnet or mainnet (per the capstone document's note that production deployments would target Polygon Layer-2, but for the demo the system runs entirely client-side).

If you wanted to upgrade this to a real blockchain, you would replace `js/blockchain.js` with `ethers.js` or `web3.js` calls to a Polygon RPC endpoint and deploy a Solidity smart contract - see [Extending to a Real Blockchain](#extending-to-a-real-blockchain) below.

### Block Structure

```js
{
  index: 1,                       // block height (0 = genesis)
  timestamp: 1699955600000,        // ms since epoch
  transactions: [ { ... } ],       // vote records in this block
  previousHash: '000ff63a...',     // hash of the previous block
  nonce: 12345,                    // PoW nonce
  hash: '000a1b2c3d...'           // SHA-256 of this block (starts with '000')
}
```

### Mining (Proof-of-Work)

```js
// pseudo-code - see js/blockchain.js for the real implementation
do {
  block.nonce = randomNonce() + attempts;
  hash = await sha256(JSON.stringify({
    index, timestamp, transactions, previousHash, nonce
  }));
  attempts++;
} while (!hash.startsWith('000'));
block.hash = hash;
```

A difficulty of `3` means each block hash must start with `000`. On a modern laptop this takes only a few milliseconds, which is perfect for a demo (real Ethereum uses difficulty in the tens of trillions).

### One Vote = One Block

For clarity, each vote is mined into its own block. In a production system you would batch many votes per block to save gas; here we prioritize transparency so you can see exactly which block contains your vote.

### Chain Validation

The **Validate Blockchain** button (Audit tab) re-hashes every block and verifies:
1. The recomputed hash matches the stored hash.
2. The `previousHash` matches the previous block's hash.
3. Each hash satisfies the PoW difficulty (starts with `000`).

If anyone tampers with a single byte of a vote or block, the recomputed hash will differ and the validation will fail - the chain is **tamper-evident**.

---

## Anonymity & Cryptography

This is the part of the design that satisfies the *Data Privacy Act of 2012 (RA 10173)* requirements described in the capstone document.

### What is stored on the blockchain?

For each vote, the on-chain record contains:

| Field              | Value                                                            |
|--------------------|------------------------------------------------------------------|
| `transactionHash`  | A 64-char SHA-256 hex string (your receipt)                       |
| `hashedVoterId`    | `SHA-256(salt + ':' + student_id)` - **no plaintext student ID** |
| `encryptedBallot`  | AES-GCM ciphertext + IV + salt of your candidate selection       |
| `electionId`       | `ELEC-2026-SSC`                                                  |
| `timestamp`        | Vote time                                                        |
| `candidateIds`     | **null** (intentionally - the selections live only in ciphertext)|

### Why is this anonymous?

1. The student ID is **hashed with a salt** before being written to the chain. Even if an attacker gets the chain, they cannot reverse the hash to identify the voter without knowing the salt and brute-forcing every possible student ID.
2. The candidate selection is **encrypted with AES-GCM** using an election key. The encrypted blob is the only thing stored on-chain - not the plaintext ballot.
3. The receipt code you receive is derived from `SHA-256(transactionHash + hashedVoterId)`. It is **unlinkable** to your student ID unless you also have the salt (which is in the JavaScript source, but in a real deployment would be in a server-side KMS).

### How can the live tally show counts without revealing who voted for whom?

The `Live Tally` panel on the Audit tab decrypts each ballot using the election key (which is the only piece of information that can decrypt the AES-GCM ciphertext). It then counts votes per candidate.

**Crucially**, the tally shows only aggregate counts per candidate - it does not display which voter picked which candidate. This is the same property a real homomorphic tally would have: the **public can verify the totals, but no one can link a voter to their ballot**.

In a real production deployment:
- The election key would be split across multiple trustees using **Shamir's Secret Sharing**, so no single admin can decrypt individual ballots.
- Or, a **Zero-Knowledge Proof** scheme would let the system prove the tally is correct without ever decrypting ballots at all.
- Or, **Mix-nets** would shuffle ballots before tallying.

This demo uses a simpler approach (a single election key) to keep the code readable.

---

## Mock SIS Database

The file `js/sis-data.js` is generated by a Python script (`scripts/generate_sis.py` in the source repo). It contains 220 students with this schema:

```js
{
  student_id: "23005045",         // PK, format 23XXXXXX
  first_name: "Gabriel",
  middle_initial: "T",
  last_name: "Tiangco",
  gender: "M",
  program: "ACT",
  program_full: "Associate in Computer Technology",
  year: 2,
  section: "B",
  email: "gabriel.tiangco5045@plmun.edu.ph",
  pin: "3868",                    // 4-digit
  eligibility_status: "ELIGIBLE", // or "INELIGIBLE"
  has_voted: false,               // updated at runtime
  vote_hash: null,                // updated at runtime
  created_at: "2026-01-15T08:00:00Z"
}
```

To regenerate the database with different data, edit and run:

```bash
python3 scripts/generate_sis.py
```

> Note: the `scripts/` folder is part of the development setup and is **not** needed for the deployed site. You only need it if you want to regenerate the SIS data.

---

## Tab-by-Tab Walkthrough

### Login Page

- Enter your Student ID and 4-digit PIN. Student IDs start with `23`; admin/COMELEC IDs start with `99`.
- The login form shows 5 sample student credentials plus 2 admin/COMELEC credentials as a quick reference for testing.
- The system auto-detects whether you're a student or admin based on the ID prefix (`23` = student, `99` = admin).
- Errors are shown inline (red box) and as a toast.

### Vote Tab (homepage after login)

> This tab is hidden for admin accounts - admins do not vote.

- The election status banner shows the election name and voting window.
- The ballot is grouped by position (President, VP, Secretary, Treasurer, Auditor, PRO).
- Click one candidate per position. The selected card gets a green border and a "✓ Selected" badge.
- The **Cast My Vote** button is disabled until you have selected one candidate for every position.
- After clicking, the system:
  1. Validates your ballot (no double-selection per position).
  2. Encrypts the ballot with AES-GCM (E2EE).
  3. Hashes your student ID with SHA-256 + salt.
  4. Mines a new block onto the simulated blockchain.
  5. Marks you as having voted in the off-chain Voter Log.
  6. Generates your receipt code.
  7. Shows the receipt in a modal.
- **Export your receipt as a .txt file**: The receipt modal has an "Export as .txt" button (replacing the old "Copy Receipt" button) that downloads a formatted text file containing your receipt code, transaction hash, block hash, and instructions for how to verify your vote later. Keep this file private - anyone with the code can verify that a vote was cast, but cannot link it to you.
- **After voting**, if you come back to the Vote tab, you'll see a "You have already voted" message.

### Candidates Tab

- 12 candidate cards (2 per position × 6 positions) in a responsive 3-column grid.
- Each card shows: avatar, name, position, party affiliation, program/year, verified badge, **platform** (list of campaign promises), and **credentials** (leadership experience + achievements).
- Credibility scores, ratings, and GPA/GWA have been removed per the user's request - only the candidate's platform and credentials are shown.
- Cards are aligned at the top so the "Platform" and "Credentials" section headers line up across cards in the same row.

### Audit Trail & Live Tally Tab

This is a two-column layout (responsive: stacks vertically on smaller screens). What you see depends on your role:

**Left column - Live Tally** (visible to everyone):
- Three stat blocks: Total Votes Cast, Eligible Voters, Turnout %.
- For each position, a bar chart showing vote count and percentage per candidate.
- The tally updates live every 5 seconds, or you can click **Refresh Tally**.
- The tally is computed by decrypting every ballot on the chain with the election key (admin/audit view). The tally shows only **aggregate counts** - it never reveals which voter voted for whom.

**Right column - Audit Trail** (role-filtered):
- Chronological list of system events (newest first).
- Filters: action type, count. (For students, admin-only actions like "Login Success" are hidden from the filter dropdown.)
- Each entry shows: timestamp (UTC), action label, **anonymized actor** (either `anonymous`, `system`, or a `voter_<8-char-hash>` pseudonym), and structured details.
- **No student IDs are ever written to the audit trail.** For `VOTE_CAST` entries, the details field contains only `block_index` - never the transaction hash, receipt code, or any other PII. The voter keeps their receipt private; the audit trail records only that "a vote was cast by voter_<hash> in block #N".
- **What students see**: Only public audit entries - `VOTE_VERIFIED`, `VOTE_NOT_FOUND`, `SYSTEM_ACTION`. A blue info banner reminds them that login events, vote casts, and blockchain validations are visible only to admin accounts.
- **What admins see**: Every audit entry, including `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_REJECTED_ALREADY_VOTED`, `LOGOUT`, `VOTE_CAST`, `BLOCKCHAIN_VALID`, `BLOCKCHAIN_INVALID`. Admin-only entries are tagged with a `[system]` badge. The "Validate Blockchain" button is visible to admins only.

**Below the two columns - Simulated Blockchain Ledger** (visible to everyone):
- A scrolling list of every block in the chain (genesis + every vote).
- Each block shows: index, timestamp, hash, previous hash, nonce, transaction count.
- For blocks with transactions, the transaction hash, hashed voter ID (truncated SHA-256 pseudonym, not the raw student ID), and encrypted ballot metadata are shown.
- The badge in the top-right of the card (e.g. "2 blocks · 1 txs · difficulty 3") summarizes the chain state. Hover over the badge for a tooltip explaining what each number means: blocks = total mined (genesis + 1 per vote), transactions = total votes cast, difficulty = proof-of-work difficulty (each block hash must start with that many zeros).
- After clicking **Validate Blockchain** (admin only), a colored result box appears at the top of this card: green "Blockchain is VALID" with all-checks-passed message, or red "Blockchain is INVALID" with a list of which checks failed (hash-integrity, linkage, pow, signature) on which block.

**Below the blockchain ledger - Admin Testing Panel** (admin-only):
This is a panel that lets an admin simulate three classic blockchain attacks to verify that the validator detects them. Each test takes a snapshot of the chain first, performs the attack, and lets you click **Validate Blockchain** (above) to see the validator catch it. After testing, click **Restore Chain to Pre-Attack State** to roll back and run another test.

- **Test 1 - Block Tampering (Hash Integrity)**: Modifies the voter ID inside an existing block's transaction.
  - *Run (no re-mine)*: The block's stored hash no longer matches its (now-tampered) contents. The validator's `hash-integrity` check catches this.
  - *Run (with re-mine)*: The block is re-mined so its own hash is internally valid, but the next block's `previousHash` still points to the OLD hash. The validator's `linkage` check catches this.
- **Test 2 - Unauthorized Transaction (Signature Verification)**: Mines a new block containing a transaction whose declared `transactionHash` does NOT match the hash of the actual payload - simulating a forged vote under another student's identity. The validator's `signature` check catches this.
- **Test 3 - Direct Chain Injection (Consensus Bypass)**: Pushes a fake block directly onto the chain array without going through the mining process.
  - *Run (bad PoW)*: The fake block's hash does NOT start with "000". The validator's `pow` check catches this.
  - *Run (bad linkage)*: The fake block has a valid-looking PoW hash but its `previousHash` does NOT match the previous block's hash. The validator's `linkage` check catches this.

After clicking any test button:
1. The test result panel (green) appears below the test grid showing exactly what was changed (target block, original vs tampered hash, declared vs expected tx hash, etc.).
2. Click **Validate Blockchain** (above, in the audit filters row) to run the validator. The red "Blockchain is INVALID" panel appears with a detailed list of which checks failed and which block(s) are affected.
3. Click **Restore Chain to Pre-Attack State** (at the bottom of the testing panel) to roll back to the pre-attack state. The validator automatically re-runs and shows a green "Blockchain is VALID" panel.

This lets you demonstrate the security of the simulated blockchain in real time: try an attack, validate, see the failure, restore, repeat.

**Below the Admin Testing Panel - Mock SIS / SQL Backend** (admin-only):
- Stat blocks: Total Students, Eligible, Ineligible, Tables (4).
- A dark code block showing the equivalent SQL queries the app would run against the SQL database (`sql/schema.sql` + `sql/seed.sql`).
- This panel is tagged "Admin Only" and hidden from student accounts.

### Verify Vote Tab

- Paste a receipt code (e.g. `804E-37C0-36B2-745B-0439`) or a 64-char transaction hash.
- The system searches the entire chain for a matching transaction.
- If found: shows the transaction hash, block index, block hash, vote timestamp, and hashed voter ID.
- If not found: shows a red "Vote Not Found" message.
- Every verification is logged to the audit trail (as `VOTE_VERIFIED` or `VOTE_NOT_FOUND`) **without revealing the user's query** - the audit entry just records `actor: 'anonymous'` and empty details.

---

## Limitations

This is a **demonstration-grade** system. Important limitations to be aware of:

1. **localStorage is per-browser** - Each browser has its own copy of the blockchain. Two students voting on different computers will each see their own chain, not a shared one. For a real election you need a shared ledger (see below).
2. **The election key is in the source code** - Anyone who reads `voting.js` can decrypt ballots. In production this key would be split across multiple trustees (Shamir's Secret Sharing) or replaced with a homomorphic / ZK scheme.
3. **The SIS salt is in the source code** - Same caveat. In production it would be server-side.
4. **No rate limiting** - There's no protection against a malicious user trying to brute-force PINs. In production, the SIS would lock an account after N failed attempts.
5. **No device fingerprinting / IP velocity checks** - If a student shares their credentials, the system can't detect it. The capstone document explicitly notes this as a known limitation.
6. **PINs are 4 digits** - Only 10,000 possible values, suitable for a demo but trivially brute-forceable. Production should use 6+ digit PINs or password + 2FA.
7. **Mining difficulty is fixed at 3** - Fine for a demo. A real election would use a much higher difficulty and would not ask the voter's browser to mine (the network does that).

These limitations are all explicitly noted in the capstone document's **Scope and Limitation** section.

---

## Extending to a Real Blockchain

The architecture of this project is deliberately layered so you can swap the simulated blockchain for a real one with minimal changes. Here is the high-level migration path:

1. **Replace `js/blockchain.js`** with calls to a real Web3 provider (e.g. `ethers.js` or `web3.js`) targeting a Layer-2 network like Polygon Amoy testnet or Polygon mainnet.
2. **Deploy a Solidity smart contract** that exposes:
   - `castVote(bytes32 hashedVoterId, bytes encryptedBallot)` - records a vote.
   - `getVoteCount(bytes32 candidateId)` - returns the tally for a candidate.
   - `isElectionOpen()` - returns whether voting is currently allowed.
3. **Move the election key out of the source code** - use a multi-sig or threshold signature scheme so no single admin can decrypt ballots.
4. **Move the SIS salt out of the source code** - have the SIS API server hash the student ID before returning it to the frontend.
5. **Add a real backend** (Node.js + Express + MySQL as described in the capstone document) for:
   - Voter eligibility verification (instead of the static `sis-data.js`).
   - Rate limiting.
   - Issuing JWT session tokens.
   - Storing off-chain metadata (voter log, audit trail, election schedules).

The rest of the system - the UI, the crypto utilities, the audit trail format, the receipt format, the verify flow - stays the same.

---

## License

This capstone project is released for educational use under the **MIT License**. You are free to copy, modify, and deploy it for academic purposes. Attribution to the original capstone team (Malate, Maminta, Rubica - PLMun BSIT 2026) is appreciated.

---

## Credits

- **Capstone Team (Group 7)**: Josh Andreu A. Malate, Eumiko T. Maminta, Carl Andrie P. Rubica
- **Institution**: Pamantasan ng Lungsod ng Muntinlupa (PLMun) - College of Information Technology and Computer Studies (CITCS)
- **Degree Program**: Bachelor of Science in Information Technology
- **Year**: 2026

The system was built to satisfy the requirements described in the capstone document *"HALALina: The Design and Development of a Web-Based Blockchain Voting System for Enhanced Transparency, Security, and Participation in PLMun Student Elections"*, with the deliberate substitution of a JavaScript-simulated blockchain for the production Solidity / Polygon network so the project can be deployed entirely on GitHub Pages with zero server infrastructure.
