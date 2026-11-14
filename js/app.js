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

    // Also list the admin / COMELEC sample credentials (separate section in the login page)
    const adminUl = el('admin-credentials');
    if (adminUl) {
      adminUl.innerHTML = SIS.ADMIN_USERS.map(a =>
        `<li><strong>${a.admin_id}</strong> &mdash; PIN <strong>${a.pin}</strong> (${a.role} &mdash; ${a.full_name})</li>`
      ).join('');
    }
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

    // Export receipt as .txt file (replaces the old "Copy Receipt" button)
    el('receipt-copy-btn').onclick = () => {
      const receiptText = buildReceiptText(result);
      downloadTextFile(`halalina-receipt-${result.receiptCode.split('-')[0]}.txt`, receiptText);
      toast('Receipt exported as .txt file.', 'success');
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

  // ---------- Build the .txt receipt content ----------
  function buildReceiptText(result) {
    const voteTime = new Date(result.voteTimestamp).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    return [
      '==============================================================',
      '  HALALina - PLMun Transparent Voting System',
      '  OFFICIAL VOTE RECEIPT',
      '==============================================================',
      '',
      `Receipt Code    : ${result.receiptCode}`,
      `Transaction Hash: ${result.transactionHash}`,
      `Block Index     : #${result.blockIndex}`,
      `Block Hash      : ${result.blockHash}`,
      `Vote Time       : ${voteTime}`,
      '',
      '--------------------------------------------------------------',
      '  HOW TO VERIFY YOUR VOTE',
      '--------------------------------------------------------------',
      '1. Go to the "Verify Vote" tab in the HALALina web app.',
      '2. Paste the Receipt Code above into the input field.',
      '3. Click "Verify" - the system will search the simulated',
      '   blockchain and confirm that your vote was recorded.',
      '',
      'Your candidate selections were end-to-end encrypted (AES-GCM)',
      'before being written to the blockchain, so this receipt cannot',
      'reveal who you voted for. Only the SHA-256 hash of your student',
      'ID and the encrypted ballot payload were recorded on-chain,',
      'preserving your anonymity.',
      '',
      'Keep this receipt private. Anyone with this code can verify',
      'that a vote was cast, but cannot link it to you.',
      '',
      '==============================================================',
      `Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
      '=============================================================='
    ].join('\n');
  }

  // ---------- Trigger a .txt file download ----------
  function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke the object URL after a short delay so the download has time to start
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- Candidates tab ----------
  // Per the user's request, this tab now shows only the candidate's
  // platform and credentials (leadership experience + achievements).
  // Credibility scores, ratings, and GPA/GWA have been removed.
  // The card layout is fixed: each card has the same set of sections
  // in the same order so the alignment is consistent across cards.
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
            <span class="verified-badge">&#10003; Verified by PLMun COMELEC + Faculty Verification Committee</span>
          </div>
        </div>

        <div class="section-title section-title-platform">Platform</div>
        <ul class="platform-list">
          ${c.platform.map(p => `<li>${p}</li>`).join('')}
        </ul>

        <div class="section-title section-title-credentials">Credentials</div>
        <ul class="credentials-list">
          ${c.credentials.leadership_experience.map(x => `<li>${x}</li>`).join('')}
          ${c.credentials.achievements.map(x => `<li>${x}</li>`).join('')}
        </ul>
      </div>
    `).join('');
  }

  // ---------- Audit tab (live tally + audit trail + blockchain) ----------
  async function renderAuditTab() {
    // 1. Stats
    const totalVotes = Blockchain.getAllTransactions().length;
    // Use the SIS query layer to compute eligible voters (SQL-style)
    const sisStats = SIS.stats();
    const eligibleVoters = sisStats.eligible_students;
    const turnout = eligibleVoters > 0 ? ((totalVotes / eligibleVoters) * 100).toFixed(1) : '0.0';
    el('stat-total-votes').textContent = totalVotes;
    el('stat-eligible-voters').textContent = eligibleVoters;
    el('stat-turnout').textContent = turnout + '%';
    el('tally-update-time').textContent = 'Updated: ' + new Date().toLocaleTimeString();

    // Populate the SIS / SQL info panel
    if (el('sis-total')) {
      el('sis-total').textContent = sisStats.total_students;
      el('sis-eligible').textContent = sisStats.eligible_students;
      el('sis-ineligible').textContent = sisStats.ineligible_students;
      el('sis-tables').textContent = Object.keys(SIS.SCHEMA.tables).length;
    }

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

    // 3. Audit log - filter by role
    // Students only see "public" entries (VOTE_VERIFIED, VOTE_NOT_FOUND, SYSTEM_ACTION).
    // Admins see everything (including LOGIN_SUCCESS, LOGIN_FAILED, VOTE_CAST,
    // BLOCKCHAIN_VALID, etc.) - the "System audit trail".
    const actionFilter = el('audit-filter-action').value;
    const countFilter = el('audit-filter-count').value;
    const session = Auth.getSession();
    const role = (session && session.role) || 'student';
    const filter = {};
    if (actionFilter) filter.action = actionFilter;
    if (role === 'student') filter.role = 'student';
    const logs = AuditTrail.getAll(filter);
    const limit = countFilter === 'all' ? logs.length : parseInt(countFilter, 10);
    const visible = logs.slice(0, limit);
    const isAdmin = role === 'admin';
    el('audit-log-list').innerHTML = visible.length === 0
      ? `<p style="padding:14px; color:var(--text-muted); font-size:13px; text-align:center;">
         ${isAdmin ? 'No audit log entries yet.' : 'No public audit log entries yet. Login events, votes, and blockchain validations are visible only to admin accounts.'}
       </p>`
      : visible.map(l => {
        const isSystemEntry = (l.visibility || AuditTrail.visibilityOf(l.action)) === 'system';
        return `
        <div class="audit-log-entry">
          <div class="audit-log-time">${AuditTrail.formatTimestamp(l.timestamp)}</div>
          <div>
            <div class="audit-log-action action-${l.action}">
              ${AuditTrail.label(l.action)}
              ${isAdmin && isSystemEntry ? '<span class="audit-log-sys-tag" title="System audit trail - admin only">[system]</span>' : ''}
            </div>
            <div class="audit-log-actor">${formatActor(l.actor)}</div>
          </div>
          <div class="audit-log-details">${formatDetails(l.details)}</div>
        </div>
      `;
      }).join('');

    // 4. Blockchain list
    const chain = Blockchain.getChain();
    const stats = Blockchain.getStats();
    // Badge with tooltip explaining the stats:
    //   "2 blocks"  = total blocks mined (genesis + 1 vote = 2)
    //   "1 txs"     = total transactions recorded (1 vote cast)
    //   "difficulty 3" = proof-of-work difficulty (hash must start with '000')
    const statsBadge = el('blockchain-stats');
    statsBadge.textContent = `${chain.length} blocks · ${stats.transactionCount} txs · difficulty ${stats.difficulty}`;
    statsBadge.title =
      'Simulated blockchain stats:\n' +
      `  - Blocks: ${chain.length}  (genesis block + one block per vote)\n` +
      `  - Transactions: ${stats.transactionCount}  (one transaction per vote cast)\n` +
      `  - Difficulty: ${stats.difficulty}  (proof-of-work: each block hash must start with "${'0'.repeat(stats.difficulty)}")\n` +
      '  - Algorithm: SHA-256 (browser Web Crypto API)\n' +
      '  - Library: NONE - this is a custom pure-JavaScript blockchain\n' +
      '    built specifically for this project (see js/blockchain.js).';

    // Show the Mock SIS panel + Validate Blockchain button only to admins
    // (re-use the role variable already computed above; don't redeclare)
    const sisPanel = document.getElementById('sis-info-panel');
    if (sisPanel) sisPanel.classList.toggle('hidden', !isAdmin);
    const validateBtn = document.getElementById('audit-validate-chain');
    if (validateBtn) validateBtn.classList.toggle('hidden', !isAdmin);
    const adminTestPanel = document.getElementById('admin-test-panel');
    if (adminTestPanel) adminTestPanel.classList.toggle('hidden', !isAdmin);
    const adminOnlyFilters = document.getElementById('audit-filters-admin-note');
    if (adminOnlyFilters) adminOnlyFilters.classList.toggle('hidden', isAdmin);

    // For students: also hide the action-filter dropdown options that
    // correspond to admin-only actions (LOGIN_SUCCESS, VOTE_CAST, etc.)
    if (!isAdmin) {
      Array.from(el('audit-filter-action').options).forEach(opt => {
        const v = opt.value;
        if (v && AuditTrail.visibilityOf(v) === 'system') {
          opt.style.display = 'none';
        } else {
          opt.style.display = '';
        }
      });
    } else {
      Array.from(el('audit-filter-action').options).forEach(opt => {
        opt.style.display = '';
      });
    }

    // Update the "Restore Chain" button enabled state
    const restoreBtn = document.getElementById('test-restore');
    if (restoreBtn) {
      restoreBtn.disabled = !Blockchain.hasTestSnapshot();
    }

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

  function formatActor(actor) {
    if (!actor || actor === 'anonymous' || actor === 'system') {
      return actor || 'anonymous';
    }
    // Actor is a SHA-256 hashed voter ID (a 64-char hex string).
    // Show it as an abbreviated pseudonym so it cannot be mistaken for a
    // student ID, and so different pseudonyms are visually distinguishable.
    if (/^[a-f0-9]{64}$/i.test(actor)) {
      return 'voter_' + actor.slice(0, 8);
    }
    return actor;
  }

  function formatDetails(details) {
    if (!details || Object.keys(details).length === 0) return '';
    return Object.entries(details).map(([k, v]) => {
      let val = String(v);
      if (val.length > 80) val = val.slice(0, 77) + '...';
      return `<div><strong>${k}:</strong> ${val}</div>`;
    }).join('');
  }

  // ---------- Admin Testing Panel: result display ----------
  function showTestResult(buttonId, result) {
    const panel = el('admin-test-result');
    if (!panel) return;
    if (!result.ok) {
      panel.className = 'admin-test-result test-fail';
      panel.innerHTML = `
        <div class="admin-test-result-title">&#10007; Test Failed to Run</div>
        <div class="admin-test-result-desc">${result.reason || 'Unknown error.'}</div>
      `;
      panel.classList.remove('hidden');
      toast('Test failed: ' + (result.reason || 'unknown'), 'error');
      return;
    }
    panel.className = 'admin-test-result test-success';
    const rows = [];
    if (result.attackType) rows.push(['Attack Type', result.attackType]);
    if (result.blockIndex !== undefined) rows.push(['Target Block', '#' + result.blockIndex]);
    if (result.originalHash) rows.push(['Original Hash', result.originalHash.slice(0, 32) + '...']);
    if (result.newHash) rows.push(['New Hash', result.newHash.slice(0, 32) + '...']);
    if (result.originalVoterId) rows.push(['Original Voter ID', result.originalVoterId.slice(0, 32) + '...']);
    if (result.tamperedVoterId) rows.push(['Tampered Voter ID', result.tamperedVoterId.slice(0, 32) + '...']);
    if (result.declaredTxHash) rows.push(['Declared Tx Hash', result.declaredTxHash.slice(0, 32) + '...']);
    if (result.expectedTxHash) rows.push(['Expected Tx Hash (actual signature)', result.expectedTxHash.slice(0, 32) + '...']);
    if (result.previousHash) rows.push(['Previous Hash', result.previousHash.slice(0, 32) + '...']);
    if (result.expectedPreviousHash) rows.push(['Expected Previous Hash', result.expectedPreviousHash.slice(0, 32) + '...']);
    if (result.blockHash) rows.push(['Block Hash', result.blockHash.slice(0, 32) + '...']);
    if (result.reMined !== undefined) rows.push(['Re-Mined', result.reMined ? 'yes (block hash is internally valid, linkage breaks)' : 'no (block hash itself is now invalid)']);
    if (result.variant) rows.push(['Variant', result.variant]);

    panel.innerHTML = `
      <div class="admin-test-result-title">&#9888; Attack Executed</div>
      <div class="admin-test-result-desc">${result.description || ''}</div>
      ${rows.length > 0 ? `
        <div class="admin-test-result-rows">
          ${rows.map(([k, v]) => `
            <div>
              <strong>${k}</strong>
              <span class="mono">${v}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border); font-size: 12.5px; color: var(--text-muted);">
        <strong>Next step:</strong> Click the <em>Validate Blockchain</em> button above to run the
        validator. It should now detect this attack and report which check failed.
      </div>
    `;
    panel.classList.remove('hidden');
    toast('Attack executed: ' + (result.attackType || 'Test') + '. Click Validate Blockchain to verify detection.', 'info', 5000);
  }

  // ---------- Validation result display ----------
  function showValidationResult(valid, details) {
    // Show the result inline above the blockchain list
    let resultBox = document.getElementById('validation-result-box');
    if (!resultBox) {
      // Create it
      const blockchainCard = el('blockchain-list')?.closest('.card');
      if (blockchainCard) {
        resultBox = document.createElement('div');
        resultBox.id = 'validation-result-box';
        blockchainCard.querySelector('.card-body').insertBefore(resultBox, el('blockchain-list'));
      }
    }
    if (!resultBox) return;

    if (valid) {
      resultBox.className = 'validation-result valid';
      resultBox.innerHTML = `
        <div class="validation-result-title">&#10003; Blockchain is VALID</div>
        <div>All checks passed: hash integrity, chain linkage, PoW difficulty, and transaction signatures are all intact.</div>
      `;
    } else {
      const failures = (details && details.failures) || [];
      resultBox.className = 'validation-result invalid';
      resultBox.innerHTML = `
        <div class="validation-result-title">&#10007; Blockchain is INVALID</div>
        <div>${failures.length} check(s) failed. The attack was detected.</div>
        ${failures.length > 0 ? `
          <div class="validation-result-failures">
            ${failures.map(f => `
              <div class="validation-failure">
                <span class="validation-failure-tag">${f.check}</span>
                ${f.blockIndex !== undefined ? `[Block #${f.blockIndex}] ` : ''}
                ${f.message || ''}
                ${f.storedHash ? `<br>&nbsp;&nbsp;&nbsp;&nbsp;<em>stored:</em> ${f.storedHash.slice(0, 40)}...` : ''}
                ${f.recomputedHash ? `<br>&nbsp;&nbsp;&nbsp;&nbsp;<em>recomputed:</em> ${f.recomputedHash.slice(0, 40)}...` : ''}
                ${f.expectedPreviousHash ? `<br>&nbsp;&nbsp;&nbsp;&nbsp;<em>expected previous:</em> ${f.expectedPreviousHash.slice(0, 40)}...` : ''}
                ${f.actualPreviousHash ? `<br>&nbsp;&nbsp;&nbsp;&nbsp;<em>actual previous:</em> ${f.actualPreviousHash.slice(0, 40)}...` : ''}
                ${f.hash ? `<br>&nbsp;&nbsp;&nbsp;&nbsp;<em>block hash:</em> ${f.hash.slice(0, 40)}...` : ''}
                ${f.declaredHash ? `<br>&nbsp;&nbsp;&nbsp;&nbsp;<em>declared tx hash:</em> ${f.declaredHash.slice(0, 40)}...` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div style="margin-top: 10px; font-size: 12.5px; color: var(--text-muted);">
          <strong>Recovery:</strong> Use the <em>Restore Chain</em> button in the Admin Testing Panel below
          to roll back to the pre-attack state.
        </div>
      `;
    }
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
      // Welcome message differs for admin vs student
      if (result.role === 'admin') {
        toast(`Welcome, ${result.admin.full_name} (Admin)!`, 'success');
      } else {
        toast(`Welcome, ${result.student.first_name}!`, 'success');
      }
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
      const btn = el('audit-validate-chain');
      btn.disabled = true;
      btn.textContent = 'Validating...';
      const valid = await Blockchain.isChainValid();
      const details = Blockchain.getValidationDetails();
      btn.disabled = false;
      btn.textContent = 'Validate Blockchain';
      if (valid) {
        AuditTrail.log({ action: 'BLOCKCHAIN_VALID', actor: 'system', timestamp: Date.now() });
        toast('Blockchain validation passed - chain is intact.', 'success');
      } else {
        AuditTrail.log({ action: 'BLOCKCHAIN_INVALID', actor: 'system', timestamp: Date.now() });
        const failCount = details ? details.failures.length : 0;
        toast(`Blockchain validation FAILED - ${failCount} issue(s) detected!`, 'error', 5000);
      }
      // Show the validation result panel
      showValidationResult(valid, details);
      renderAuditTab();
    });

    // ---------- Admin Testing Panel ----------
    // Test 1: Block Tampering (no re-mine)
    el('test-tamper-noremine')?.addEventListener('click', async () => {
      const result = await Blockchain.testTamperBlock(false);
      showTestResult('test-tamper-noremine', result);
      renderAuditTab();
    });

    // Test 1: Block Tampering (with re-mine)
    el('test-tamper-remine')?.addEventListener('click', async () => {
      const result = await Blockchain.testTamperBlock(true);
      showTestResult('test-tamper-remine', result);
      renderAuditTab();
    });

    // Test 2: Unauthorized Transaction
    el('test-unauth-tx')?.addEventListener('click', async () => {
      const result = await Blockchain.testUnauthorizedTransaction();
      showTestResult('test-unauth-tx', result);
      renderAuditTab();
    });

    // Test 3: Direct Chain Injection (bad PoW)
    el('test-inject-bad-pow')?.addEventListener('click', () => {
      const result = Blockchain.testInjectBlock('bad-pow');
      showTestResult('test-inject-bad-pow', result);
      renderAuditTab();
    });

    // Test 3: Direct Chain Injection (bad linkage)
    el('test-inject-bad-link')?.addEventListener('click', () => {
      const result = Blockchain.testInjectBlock('bad-linkage');
      showTestResult('test-inject-bad-link', result);
      renderAuditTab();
    });

    // Restore chain to pre-attack state
    el('test-restore')?.addEventListener('click', () => {
      const restored = Blockchain.restoreChain();
      const statusEl = el('test-restore-status');
      if (restored) {
        statusEl.textContent = 'Chain restored successfully.';
        toast('Chain restored to pre-attack state.', 'success');
        // Hide the test result panel since the chain is now clean
        el('admin-test-result')?.classList.add('hidden');
      } else {
        statusEl.textContent = 'No snapshot to restore from.';
        toast('No snapshot to restore from.', 'info');
      }
      // Re-validate after restore
      setTimeout(async () => {
        const valid = await Blockchain.isChainValid();
        showValidationResult(valid, Blockchain.getValidationDetails());
        renderAuditTab();
      }, 100);
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

    // Show role badge in topbar (Student / Admin)
    const roleBadge = el('user-role-badge');
    if (roleBadge) {
      if (session.role === 'admin') {
        roleBadge.textContent = 'ADMIN';
        roleBadge.className = 'role-badge role-admin';
        roleBadge.title = 'Administrator account - can see system audit trails, Mock SIS, and blockchain validation';
      } else {
        roleBadge.textContent = 'STUDENT';
        roleBadge.className = 'role-badge role-student';
        roleBadge.title = 'Student voter account - can vote, view live tally, and verify own vote';
      }
    }

    // Hide the "Vote" tab for admins (they don't vote)
    const voteTabLink = document.querySelector('.nav-link[data-tab="vote"]');
    if (voteTabLink) {
      voteTabLink.style.display = session.role === 'admin' ? 'none' : '';
    }

    // For admin users, default to the audit tab (where they do most of their work)
    renderElectionStatus();
    if (session.role === 'admin') {
      switchTab('audit');
    } else {
      switchTab('vote');
    }
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
