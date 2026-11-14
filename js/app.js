// =============================================================
// HALALina - Main Application
// Ties together auth, voting, audit trail, and live tally.
// Initializes on DOMContentLoaded, handles routing between tabs,
// renders the ballot / candidates / audit / verify screens, and
// wires up all the buttons.
// =============================================================

(function () {
  'use strict';

  // ---------- DOM helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const el = (id) => document.getElementById(id);

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(message, type = 'info', duration = 3000) {
    const t = el('toast');
    t.textContent = message;
    t.className = 'toast ' + type;
    t.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), duration);
  }

  // ---------- Sample credentials for the login page ----------
  function renderSampleCredentials() {
    const ul = el('sample-credentials');
    if (!ul) return;
    // Pick a few representative sample credentials from the Mock SIS
    const samples = MOCK_SIS
      .filter(s => s.eligibility_status === 'ELIGIBLE')
      .slice(0, 5);
    ul.innerHTML = samples.map(s =>
      `<li><strong>${s.student_id}</strong> &mdash; PIN <strong>${s.pin}</strong> (${s.program}-${s.year}${s.section})</li>`
    ).join('');
  }

  // ---------- Tab routing ----------
  function switchTab(name) {
    $$('.tab-content').forEach(tc => tc.classList.remove('active'));
    $$('.nav-link').forEach(l => l.classList.remove('active'));
    el('tab-' + name)?.classList.add('active');
    document.querySelector(`.nav-link[data-tab="${name}"]`)?.classList.add('active');
    // Re-render dynamic content for this tab
    if (name === 'audit') renderAuditTab();
    if (name === 'verify') {} // form-only
    if (name === 'vote') {
      const session = Auth.getSession();
      if (VoterLog.hasVoted(session.student_id)) {
        showAlreadyVoted();
      } else {
        renderBallot(session);
      }
    }
    if (name === 'candidates') renderCandidates();
  }

  // ---------- Render the election status banner ----------
  function renderElectionStatus() {
    const start = new Date(ELECTION_INFO.start_time).toLocaleString();
    const end = new Date(ELECTION_INFO.end_time).toLocaleString();
    el('election-status').innerHTML =
      `Election: <strong>${ELECTION_INFO.election_name}</strong> &mdash; Voting is OPEN &mdash; ` +
      `Window: ${start} to ${end}`;
  }

  // ---------- Render the ballot ----------
  function renderBallot(session) {
    const container = el('ballot-container');
    const actions = el('vote-actions');
    const alreadyCast = el('vote-already-cast');

    if (VoterLog.hasVoted(session.student_id)) {
      showAlreadyVoted();
      return;
    }

    alreadyCast.classList.add('hidden');
    actions.classList.remove('hidden');

    // Group candidates by position
    const positions = ELECTION_INFO.positions;
    let html = '';
    for (const position of positions) {
      const cands = CANDIDATES.filter(c => c.running_position === position);
      if (cands.length === 0) continue;
      html += `
        <div class="position-group" data-position="${position}">
          <div class="position-group-header">
            <span>${position}</span>
            <span class="position-info">Select one (1)</span>
          </div>
          <div class="candidate-list">
            ${cands.map(c => candidateCardHTML(c, false)).join('')}
          </div>
        </div>
      `;
    }
    container.innerHTML = html;

    // Wire up candidate selection (one per position)
    const selection = {};
    $$('.candidate-card').forEach(card => {
      card.addEventListener('click', () => {
        const position = card.closest('.position-group').dataset.position;
        const candId = card.dataset.candidateId;
        // Deselect siblings in same group
        card.parentElement.querySelectorAll('.candidate-card').forEach(s => s.classList.remove('selected'));
        card.classList.add('selected');
        selection[position] = candId;
        // Enable submit only if all positions selected
        const positionsCount = ELECTION_INFO.positions.filter(p =>
          CANDIDATES.some(c => c.running_position === p)
        ).length;
        const selectedCount = Object.keys(selection).length;
        el('cast-vote-btn').disabled = selectedCount < positionsCount;
      });
    });

    // Wire up cast vote button
    el('cast-vote-btn').onclick = async () => {
      const selectedIds = Object.values(selection);
      try {
        el('cast-vote-btn').disabled = true;
        el('cast-vote-btn').textContent = 'Mining vote onto blockchain...';
        const result = await Voting.castVote(selectedIds, session);
        showReceiptModal(result, session);
        toast('Vote successfully cast! Mining complete.', 'success');
      } catch (err) {
        toast('Failed to cast vote: ' + err.message, 'error', 5000);
      } finally {
        el('cast-vote-btn').disabled = false;
        el('cast-vote-btn').textContent = 'Cast My Vote';
      }
    };
  }

  function showAlreadyVoted() {
    el('ballot-container').innerHTML = '';
    el('vote-actions').classList.add('hidden');
    el('vote-already-cast').classList.remove('hidden');
  }

  function candidateCardHTML(c, _full) {
    return `
      <div class="candidate-card" data-candidate-id="${c.candidate_id}" style="--avatar-color:${c.photo_color}">
        <div class="candidate-row">
          <div class="candidate-avatar" style="background:${c.photo_color}">${c.photo_initials}</div>
          <div class="candidate-info">
            <div class="candidate-name">${c.full_name}</div>
            <div class="candidate-party">${c.party_affiliation}</div>
            <p class="candidate-program">${c.program} &middot; Year ${c.year_section}</p>
          </div>
        </div>
        <div class="candidate-platform">
          <ul>
            ${c.platform.map(p => `<li>${p}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  // ---------- Receipt modal ----------
  function showReceiptModal(result, session) {
    const body = el('receipt-body');
    body.innerHTML = `
      <div class="receipt-box">
        <div class="receipt-label">Your Receipt Code</div>
        <div class="receipt-code">${result.receiptCode}</div>
        <div class="receipt-label">Keep this code private. You can use it to verify your vote.</div>
      </div>
      <div class="receipt-rows">
        <div>
          <strong>Transaction Hash</strong>
          <span class="mono">${result.transactionHash}</span>
        </div>
        <div>
          <strong>Block Index</strong>
          <span class="mono">#${result.blockIndex}</span>
        </div>
        <div>
          <strong>Block Hash</strong>
          <span class="mono">${result.blockHash}</span>
        </div>
        <div>
          <strong>Vote Time (UTC)</strong>
          <span class="mono">${new Date(result.voteTimestamp).toISOString().replace('T', ' ').slice(0, 19)}</span>
        </div>
      </div>
      <div class="receipt-warning">
        <strong>Important:</strong> Save this receipt. Your candidate selections are
        end-to-end encrypted (AES-GCM) and cannot be read off the public ledger.
        Only the SHA-256 hash of your student ID and the encrypted ballot are recorded
        on the simulated blockchain, preserving your anonymity.
      </div>
    `;
    el('receipt-modal').classList.remove('hidden');
    el('receipt-modal').setAttribute('aria-hidden', 'false');

    // Copy button
    el('receipt-copy-btn').onclick = () => {
      const text = `HALALina Receipt\nCode: ${result.receiptCode}\nTx Hash: ${result.transactionHash}\nBlock #: ${result.blockIndex}\nBlock Hash: ${result.blockHash}`;
      navigator.clipboard?.writeText(text).then(() => toast('Receipt copied to clipboard!', 'success'));
    };
    el('receipt-verify-btn').onclick = () => {
      closeReceiptModal();
      el('verify-input').value = result.receiptCode;
      switchTab('verify');
      el('verify-form').dispatchEvent(new Event('submit'));
    };
  }
  function closeReceiptModal() {
    el('receipt-modal').classList.add('hidden');
    el('receipt-modal').setAttribute('aria-hidden', 'true');
  }

  // ---------- Candidates tab ----------
  function renderCandidates() {
    const container = el('candidates-container');
    container.innerHTML = CANDIDATES.map(c => `
      <div class="candidate-full-card">
        <div class="candidate-full-header">
          <div class="candidate-avatar" style="background:${c.photo_color}; width:60px; height:60px; font-size:22px;">${c.photo_initials}</div>
          <div style="flex:1">
            <h3 class="candidate-full-title">${c.full_name}</h3>
            <p class="candidate-full-sub">${c.running_position} &middot; ${c.party_affiliation}</p>
            <p class="candidate-program">${c.program} &middot; Year ${c.year_section}</p>
            <span class="verified-badge">&#10003; Verified by ${c.credibility.verified_by}</span>
          </div>
        </div>

        <div class="section-title">Platform</div>
        <ul class="platform-list">
          ${c.platform.map(p => `<li>${p}</li>`).join('')}
        </ul>

        <div class="section-title">Credentials</div>
        <p style="margin:0 0 6px; font-size:13px;"><strong>Education:</strong> ${c.credentials.education}</p>
        <p style="margin:0 0 6px; font-size:13px;"><strong>GPA:</strong> ${c.credentials.gpa}</p>
        <ul class="credentials-list">
          ${c.credentials.leadership_experience.map(x => `<li>${x}</li>`).join('')}
          ${c.credentials.achievements.map(x => `<li>${x}</li>`).join('')}
        </ul>

        <div class="section-title">Credibility Score</div>
        <div class="credibility-score">
          <div class="credibility-score-big">${c.credibility.overall.toFixed(1)}</div>
          <div class="credibility-score-label">out of 100 &mdash; Verified by ${c.credibility.verified_by}</div>
        </div>
        ${credibilityBar('Academic', c.credibility.academic_score)}
        ${credibilityBar('Leadership', c.credibility.leadership_score)}
        ${credibilityBar('Integrity', c.credibility.integrity_score)}
        ${credibilityBar('Community', c.credibility.community_score)}
      </div>
    `).join('');
  }
  function credibilityBar(label, value) {
    return `
      <div class="credibility-bar">
        <span class="credibility-bar-label">${label}</span>
        <div class="credibility-bar-track">
          <div class="credibility-bar-fill" style="width:${value}%"></div>
        </div>
        <span class="credibility-bar-value">${value}</span>
      </div>
    `;
  }

  // ---------- Audit tab (live tally + audit trail + blockchain) ----------
  async function renderAuditTab() {
    // 1. Stats
    const totalVotes = Blockchain.getAllTransactions().length;
    const eligibleVoters = SIS_STATS.eligible_students;
    const turnout = eligibleVoters > 0 ? ((totalVotes / eligibleVoters) * 100).toFixed(1) : '0.0';
    el('stat-total-votes').textContent = totalVotes;
    el('stat-eligible-voters').textContent = eligibleVoters;
    el('stat-turnout').textContent = turnout + '%';
    el('tally-update-time').textContent = 'Updated: ' + new Date().toLocaleTimeString();

    // 2. Live tally (decrypt all ballots - admin/audit-only view)
    const tallies = await Voting.computeLiveTally();
    const tallyContainer = el('tally-by-position');
    let html = '';
    for (const position of ELECTION_INFO.positions) {
      const cands = CANDIDATES.filter(c => c.running_position === position);
      if (cands.length === 0) continue;
      // Compute total votes for this position
      const positionTotal = cands.reduce((sum, c) => sum + (tallies[c.candidate_id] || 0), 0);
      html += `
        <div class="tally-position">
          <div class="tally-position-title">${position}</div>
          ${cands.map(c => {
            const count = tallies[c.candidate_id] || 0;
            const pct = positionTotal > 0 ? ((count / positionTotal) * 100).toFixed(1) : '0.0';
            const barWidth = positionTotal > 0 ? (count / positionTotal) * 100 : 0;
            return `
              <div class="tally-row">
                <span class="tally-row-name">${c.full_name.split(' ').slice(0, 2).join(' ')} <span style="color:var(--text-muted); font-size:11px;">(${c.party_affiliation.replace(' Party', '')})</span></span>
                <div class="tally-row-bar">
                  <div class="tally-row-fill" style="width:${barWidth}%"></div>
                  <span class="tally-row-count">${count}</span>
                </div>
                <span class="tally-row-pct">${pct}%</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
    tallyContainer.innerHTML = html || '<p style="color:var(--text-muted); font-size:13px;">No votes cast yet.</p>';

    // 3. Audit log
    const actionFilter = el('audit-filter-action').value;
    const countFilter = el('audit-filter-count').value;
    const logs = AuditTrail.getAll(actionFilter ? { action: actionFilter } : null);
    const limit = countFilter === 'all' ? logs.length : parseInt(countFilter, 10);
    const visible = logs.slice(0, limit);
    el('audit-log-list').innerHTML = visible.length === 0
      ? '<p style="padding:14px; color:var(--text-muted); font-size:13px; text-align:center;">No audit log entries yet.</p>'
      : visible.map(l => `
        <div class="audit-log-entry">
          <div class="audit-log-time">${AuditTrail.formatTimestamp(l.timestamp)}</div>
          <div>
            <div class="audit-log-action action-${l.action}">${AuditTrail.label(l.action)}</div>
            <div class="audit-log-actor">${l.actor === 'anonymous' ? 'anonymous' : 'Student ' + l.actor}</div>
          </div>
          <div class="audit-log-details">${formatDetails(l.details)}</div>
        </div>
      `).join('');

    // 4. Blockchain list
    const chain = Blockchain.getChain();
    const stats = Blockchain.getStats();
    el('blockchain-stats').textContent = `${chain.length} blocks · ${stats.transactionCount} txs · difficulty ${stats.difficulty}`;
    el('blockchain-list').innerHTML = chain.map(b => `
      <div class="blockchain-block ${b.index === 0 ? 'genesis' : ''}">
        <div class="block-row"><span class="block-label">Block #</span><span class="block-value"><strong>${b.index}</strong>${b.index === 0 ? ' (GENESIS)' : ''}</span></div>
        <div class="block-row"><span class="block-label">Timestamp</span><span class="block-value">${new Date(b.timestamp).toISOString()}</span></div>
        <div class="block-row"><span class="block-label">Hash</span><span class="block-value block-hash">${b.hash}</span></div>
        <div class="block-row"><span class="block-label">Previous Hash</span><span class="block-value">${b.previousHash}</span></div>
        <div class="block-row"><span class="block-label">Nonce</span><span class="block-value">${b.nonce}</span></div>
        <div class="block-row"><span class="block-label">Transactions</span><span class="block-value">${b.transactions.length}</span></div>
        ${b.transactions.length > 0 ? b.transactions.map(tx => `
          <div class="block-row" style="padding-left:20px; margin-top:6px; border-left:2px solid var(--primary-light);">
            <span class="block-label">Tx Hash</span><span class="block-value">${tx.transactionHash.slice(0, 32)}...</span>
          </div>
          <div class="block-row" style="padding-left:20px; border-left:2px solid var(--primary-light);">
            <span class="block-label">Hashed Voter ID</span><span class="block-value">${tx.hashedVoterId.slice(0, 32)}...</span>
          </div>
          <div class="block-row" style="padding-left:20px; border-left:2px solid var(--primary-light);">
            <span class="block-label">Encrypted Ballot</span><span class="block-value">AES-GCM ciphertext (${Math.floor((tx.encryptedBallot.ciphertextHex.length / 2))} bytes)</span>
          </div>
        `).join('') : ''}
      </div>
    `).join('');
  }

  function formatDetails(details) {
    if (!details || Object.keys(details).length === 0) return '';
    return Object.entries(details).map(([k, v]) => {
      let val = String(v);
      if (val.length > 80) val = val.slice(0, 77) + '...';
      return `<div><strong>${k}:</strong> ${val}</div>`;
    }).join('');
  }

  // ---------- Verify tab ----------
  async function handleVerify(e) {
    e?.preventDefault();
    const query = el('verify-input').value.trim();
    const successBox = el('verify-success');
    const failureBox = el('verify-failure');
    successBox.classList.add('hidden');
    failureBox.classList.add('hidden');

    if (!query) {
      failureBox.classList.remove('hidden');
      failureBox.innerHTML = '<h3>No input</h3><p>Please paste your receipt code or transaction hash.</p>';
      return;
    }
    el('verify-result').textContent = 'Searching the blockchain...';
    const result = await Voting.verifyVote(query);
    el('verify-result').textContent = '';
    if (result.ok) {
      successBox.classList.remove('hidden');
      successBox.innerHTML = `
        <h3>&#10003; Vote Verified</h3>
        <p>Your vote was found on the simulated blockchain. The block has been
           permanently recorded and cannot be altered.</p>
        <div class="verify-success-row">
          <div>
            <strong>Transaction Hash</strong>
            <span class="mono">${result.transactionHash}</span>
          </div>
          <div>
            <strong>Block Index</strong>
            <span class="mono">#${result.blockIndex}</span>
          </div>
          <div>
            <strong>Block Hash</strong>
            <span class="mono">${result.blockHash}</span>
          </div>
          <div>
            <strong>Vote Time (UTC)</strong>
            <span class="mono">${new Date(result.timestamp).toISOString().replace('T', ' ').slice(0, 19)}</span>
          </div>
          <div>
            <strong>Hashed Voter ID</strong>
            <span class="mono">${result.hashedVoterId}</span>
          </div>
        </div>
      `;
    } else {
      failureBox.classList.remove('hidden');
      failureBox.innerHTML = `<h3>&#10007; Vote Not Found</h3><p>${result.reason}</p>`;
    }
  }

  // ---------- Wire up events ----------
  function wireEvents() {
    // Login form
    el('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const sid = el('student-id').value.trim();
      const pin = el('student-pin').value.trim();
      const errBox = el('login-error');
      errBox.hidden = true;

      const result = await Auth.login(sid, pin);
      if (!result.ok) {
        errBox.textContent = result.reason;
        errBox.hidden = false;
        toast(result.reason, 'error');
        return;
      }
      toast(`Welcome, ${result.student.first_name}!`, 'success');
      showApp();
    });

    // Logout
    el('logout-btn').addEventListener('click', () => {
      Auth.logout();
      el('app').classList.add('hidden');
      el('login-page').classList.remove('hidden');
      el('login-form').reset();
      toast('Logged out.', 'info');
    });

    // Nav links
    $$('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.dataset.tab;
        switchTab(tab);
      });
    });
    // Inline tab links (e.g. inside callouts)
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab-link]');
      if (t) {
        e.preventDefault();
        switchTab(t.dataset.tabLink);
      }
    });

    // Modal close
    document.querySelector('.modal-close')?.addEventListener('click', closeReceiptModal);
    document.querySelector('.modal-backdrop')?.addEventListener('click', closeReceiptModal);

    // Audit filters
    el('audit-filter-action').addEventListener('change', renderAuditTab);
    el('audit-filter-count').addEventListener('change', renderAuditTab);
    el('refresh-tally').addEventListener('click', async () => {
      await renderAuditTab();
      toast('Tally refreshed.', 'info');
    });

    // Validate chain
    el('audit-validate-chain').addEventListener('click', async () => {
      const valid = await Blockchain.isChainValid();
      if (valid) {
        AuditTrail.log({ action: 'BLOCKCHAIN_VALID', actor: 'system', timestamp: Date.now() });
        toast('Blockchain validation passed - chain is intact.', 'success');
      } else {
        AuditTrail.log({ action: 'BLOCKCHAIN_INVALID', actor: 'system', timestamp: Date.now() });
        toast('Blockchain validation FAILED - chain integrity compromised!', 'error');
      }
      renderAuditTab();
    });

    el('audit-clear-filters').addEventListener('click', () => {
      el('audit-filter-action').value = '';
      el('audit-filter-count').value = '50';
      renderAuditTab();
    });

    // Verify
    el('verify-form').addEventListener('submit', handleVerify);

    // ESC closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeReceiptModal();
    });
  }

  // ---------- Show main app ----------
  function showApp() {
    el('login-page').classList.add('hidden');
    el('app').classList.remove('hidden');

    const session = Auth.getSession();
    el('user-name').textContent = session.full_name;
    el('user-meta').textContent = `${session.program} - ${session.year_section}`;

    renderElectionStatus();
    switchTab('vote');
  }

  // ---------- Initialization ----------
  async function init() {
    // Initialize blockchain (loads from localStorage or creates genesis)
    await Blockchain.init();

    renderSampleCredentials();
    wireEvents();

    // Auto-login if session exists
    if (Auth.isLoggedIn()) {
      showApp();
    } else {
      el('login-page').classList.remove('hidden');
    }

    // Periodic refresh of audit tab if visible (simulates live updates)
    setInterval(() => {
      if (el('tab-audit')?.classList.contains('active')) {
        renderAuditTab();
      }
    }, 5000);

    console.log('%c HALALina ', 'background:#16a34a; color:white; padding:2px 6px; border-radius:4px;',
      'Simulated Blockchain Voting System initialized. Block count:', Blockchain.getStats().blockCount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
