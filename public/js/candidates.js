// =============================================================
// HALALina - Client-side Candidates (Cloudflare Pages edition)
// -------------------------------------------------------------
// The original 12 candidates are still defined here for offline
// fallback, but in production they're loaded from /api/candidates
// (which queries the CANDIDATE_PROFILE table in D1). The
// CandidatesManager wraps /api/candidates, /api/added-candidates
// for admin management.
// =============================================================

// Static fallback - the original 12 candidates. The client loads
// these if /api/candidates fails (e.g. offline).
const CANDIDATES = Object.freeze([
  // ============= PRESIDENT =============
  { candidate_id: "C001", full_name: "Josh Andreu A. Malate", running_position: "President", party_affiliation: "HALALIN Party", program: "BSIT", year_section: "4-A", photo_initials: "JM", photo_color: "#16a34a", platform: ["Push for transparent student fund utilization with monthly public reports.", "Establish a 24/7 digital student grievance portal integrated with SIS.", "Modernize the university election system with blockchain-based voting."], credentials: { leadership_experience: ["Supreme Student Government President, Senior High (2022)", "BSIT Representative, College of IT and Computer Studies (2024-2025)", "Lead Organizer, PLMun IT Week 2025"], achievements: ["Champion, PLMun Capstone Hackathon 2025", "Dean's Lister, 4 consecutive semesters", "Community Service Awardee (75+ hours)"] } },
  { candidate_id: "C002", full_name: "Eumiko T. Maminta", running_position: "President", party_affiliation: "Buklod PLMun Party", program: "BSIT", year_section: "4-B", photo_initials: "EM", photo_color: "#0ea5e9", platform: ["Advocate for accessible mental health resources for all students.", "Modernize campus Wi-Fi infrastructure across all buildings.", "Strengthen student-athlete scholarship programs."], credentials: { leadership_experience: ["Vice President, BSIT Society (2024-2025)", "Head, PLMun Sports Committee (2024)", "Volunteer Coordinator, Brigada Eskwela 2024"], achievements: ["Regional Silver Medalist, SUC III Sports (Basketball)", "President's Lister, 2 semesters", "Best IT Project, 2024"] } },
  // ============= VICE PRESIDENT =============
  { candidate_id: "C003", full_name: "Carl Andrie P. Rubica", running_position: "Vice President", party_affiliation: "HALALIN Party", program: "BSCS", year_section: "4-A", photo_initials: "CR", photo_color: "#16a34a", platform: ["Implement academic tutoring network across all colleges.", "Strengthen research collaborations between IT and Engineering.", "Advocate for open-access learning materials."], credentials: { leadership_experience: ["President, PLMun CS Society (2024-2025)", "Lead Developer, PLMun Mobile App (2024)", "Treasurer, PLMun student council (2023-2024)"], achievements: ["1st Place, National Collegiate Programming Contest (2024)", "Published research at PSITE National Conference 2025", "Full Academic Scholar since 1st year"] } },
  { candidate_id: "C004", full_name: "Andrea Sofia B. Reyes", running_position: "Vice President", party_affiliation: "Buklod PLMun Party", program: "BSIS", year_section: "3-A", photo_initials: "AR", photo_color: "#0ea5e9", platform: ["Bridge the gap between student organizations and administration.", "Create inclusive leadership workshops for first-year students.", "Push for sustainable campus practices."], credentials: { leadership_experience: ["Vice President, BSIS Society (2024-2025)", "Senator, College of IT and Computer Studies (2023-2024)", "Founder, PLMun Eco-Warriors (2023)"], achievements: ["Outstanding Student Leader, 2024", "Best IS Capstone Proposal, 2025", "Environmental Champion Award (City of Muntinlupa)"] } },
  // ============= SECRETARY =============
  { candidate_id: "C005", full_name: "Maria Camille D. Santos", running_position: "Secretary", party_affiliation: "HALALIN Party", program: "BSIT", year_section: "3-B", photo_initials: "MS", photo_color: "#16a34a", platform: ["Digitize all student council records with public access portal.", "Implement real-time attendance tracking for council sessions.", "Maintain transparent documentation of all resolutions."], credentials: { leadership_experience: ["Secretary, BSIT Society (2023-2024)", "Documentations Head, PLMun IT Week 2024", "Assistant Secretary, College Student Council (2022-2023)"], achievements: ["Best Documentation Award, PLMun IT Week 2024", "Dean's Lister, 3 consecutive semesters", "Volunteer, National Book Week 2024"] } },
  { candidate_id: "C006", full_name: "Patrick James C. Lim", running_position: "Secretary", party_affiliation: "Buklod PLMun Party", program: "BSCS", year_section: "2-A", photo_initials: "PL", photo_color: "#0ea5e9", platform: ["Establish digital archives for all student council activities.", "Push for paperless documentation across student organizations.", "Implement weekly council newsletter."], credentials: { leadership_experience: ["Assistant Secretary, BSCS Society (2024-2025)", "Co-founder, PLMun Developers Guild (2024)", "Event Coordinator, Hackathon PLMun 2024"], achievements: ["Best Coder, Internal Programming Competition (2024)", "Dean's Lister, 2 consecutive semesters"] } },
  // ============= TREASURER =============
  { candidate_id: "C007", full_name: "Beatrice Anne G. Fernando", running_position: "Treasurer", party_affiliation: "HALALIN Party", program: "BSDS", year_section: "3-A", photo_initials: "BF", photo_color: "#16a34a", platform: ["Publish monthly financial reports accessible to all students.", "Implement blockchain-based expense tracking system.", "Establish audit committee for student council funds."], credentials: { leadership_experience: ["Treasurer, BSDS Society (2024-2025)", "Finance Committee Member, PLMun IT Week (2024)", "Audit Assistant, College Student Council (2023-2024)"], achievements: ["Champion, PLMun Data Analytics Challenge (2025)", "1.40 GPA - Highest in BSDS cohort", "Certified Bookkeeping Specialist (TESDA NC III)"] } },
  { candidate_id: "C008", full_name: "Mark Vincent S. Cruz", running_position: "Treasurer", party_affiliation: "Buklod PLMun Party", program: "BSIS", year_section: "4-A", photo_initials: "MC", photo_color: "#0ea5e9", platform: ["Create digital wallet system for student organization budgets.", "Push for open bidding for student council procurement.", "Implement real-time fund monitoring dashboard."], credentials: { leadership_experience: ["Auditor, BSIS Society (2024-2025)", "Finance Head, PLMun Acquaintance Party (2024)", "Co-Treasurer, College Student Council (2022-2023)"], achievements: ["Outstanding IS Project Award (2024)", "Dean's Lister, 3 consecutive semesters", "ICPAS Student Member"] } },
  // ============= AUDITOR =============
  { candidate_id: "C009", full_name: "Rebecca Faye L. Aguilar", running_position: "Auditor", party_affiliation: "HALALIN Party", program: "BSCS", year_section: "3-A", photo_initials: "RA", photo_color: "#16a34a", platform: ["Conduct quarterly audits of all student council transactions.", "Push for transparent procurement processes.", "Establish anonymous fraud reporting channel."], credentials: { leadership_experience: ["Assistant Auditor, BSCS Society (2024-2025)", "Audit Team Member, PLMun COMELEC (2024)", "Volunteer Auditor, Local Church Organization (2022-2024)"], achievements: ["Best Research Paper, PLMun CS Conference (2025)", "ICAS Student Member", "Academic Excellence Awardee (3 semesters)"] } },
  { candidate_id: "C010", full_name: "Hans Gabriel D. Lim", running_position: "Auditor", party_affiliation: "Buklod PLMun Party", program: "BSIT", year_section: "2-B", photo_initials: "HL", photo_color: "#0ea5e9", platform: ["Implement real-time expense monitoring for student organizations.", "Push for digital receipts for all council transactions.", "Conduct pre-event budget reviews."], credentials: { leadership_experience: ["Assistant Auditor, BSIT Society (2024-2025)", "Member, PLMun IT Week Finance Committee (2024)"], achievements: ["Best in Mathematics, PLMun Freshman Quiz (2024)", "Dean's Lister, 2 consecutive semesters"] } },
  // ============= PRO =============
  { candidate_id: "C011", full_name: "Sophia Mae T. Villanueva", running_position: "Public Relations Officer (PRO)", party_affiliation: "HALALIN Party", program: "BSEMCP", year_section: "3-A", photo_initials: "SV", photo_color: "#16a34a", platform: ["Modernize official student council social media presence.", "Implement weekly student council updates across all platforms.", "Establish student-influencer partnerships for campus awareness."], credentials: { leadership_experience: ["PRO, BSEMCP Society (2024-2025)", "Social Media Manager, PLMun IT Week (2024)", "Event Host, PLMun Acquaintance Party (2024)"], achievements: ["Best Multimedia Project, PLMun (2024)", "10K+ followers across student-led platforms", "Best Event Host, PLMun (2024)"] } },
  { candidate_id: "C012", full_name: "Rafael Nathaniel C. Pascual", running_position: "Public Relations Officer (PRO)", party_affiliation: "Buklod PLMun Party", program: "BSIS", year_section: "2-A", photo_initials: "RP", photo_color: "#0ea5e9", platform: ["Establish campus-wide student newsletter.", "Push for student spotlights and feature stories.", "Implement digital bulletin boards across campus."], credentials: { leadership_experience: ["Assistant PRO, BSIS Society (2024-2025)", "Writer, PLMun Student Publication (2024)", "Photographer, PLMun Events Team (2024)"], achievements: ["Best Feature Article, PLMun Student Publication (2024)", "Dean's Lister, 2 consecutive semesters"] } }
]);

const ELECTION_INFO = Object.freeze({
  election_id: "ELEC-2026-SSC",
  election_name: "PLMun University Student Council Election AY 2026-2027",
  start_time: "2026-11-14T08:00:00+08:00",
  end_time: "2026-11-21T20:00:00+08:00",
  is_active: true,
  cluster_department: "All Colleges",
  positions: ["President", "Vice President", "Secretary", "Treasurer", "Auditor", "Public Relations Officer (PRO)"]
});

// =============================================================
// CandidatesManager - loads candidates from /api/candidates (D1)
// and supports admin add/remove via /api/candidates (POST/DELETE)
// =============================================================

const CandidatesManager = (function () {
  let cached = null;

  // ---- Load candidates from the server (with fallback to the static list) ----
  async function loadFromServer() {
    try {
      const res = await fetch('/api/candidates', { credentials: 'same-origin' });
      if (!res.ok) return CANDIDATES;
      const data = await res.json();
      if (data.ok && Array.isArray(data.candidates) && data.candidates.length > 0) {
        return data.candidates;
      }
      return CANDIDATES;
    } catch {
      return CANDIDATES;
    }
  }

  // ---- Get all candidates (async - loads from server) ----
  async function getAllAsync() {
    if (!cached) {
      cached = await loadFromServer();
    }
    return cached;
  }

  // ---- Sync version: returns the cached candidates (or static fallback) ----
  function getAll() {
    return cached || CANDIDATES;
  }

  // ---- Get by position ----
  function getByPosition(position) {
    return getAll().filter(c => c.running_position === position);
  }

  // ---- Add a new candidate (admin only) - POST /api/candidates ----
  async function addCandidate(input) {
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (data.ok) {
        // Refresh cache
        cached = null;
      }
      return data;
    } catch (e) {
      return { ok: false, reason: 'Network error: ' + e.message };
    }
  }

  // ---- Remove an admin-added candidate - DELETE /api/candidates?id=X ----
  async function removeCandidate(candidateId) {
    try {
      const res = await fetch('/api/candidates?id=' + encodeURIComponent(candidateId), {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (data.ok) {
        cached = null;  // refresh cache
      }
      return data;
    } catch (e) {
      return { ok: false, reason: 'Network error: ' + e.message };
    }
  }

  // ---- Get just the admin-added candidates - GET /api/added-candidates ----
  async function getAdded() {
    try {
      const res = await fetch('/api/added-candidates', { credentials: 'same-origin' });
      if (!res.ok) return [];
      const data = await res.json();
      return data.added || [];
    } catch {
      return [];
    }
  }

  // ---- Force a refresh of the cache ----
  async function refresh() {
    cached = await loadFromServer();
    return cached;
  }

  return {
    getAll, getAllAsync, getByPosition,
    addCandidate, removeCandidate, getAdded, refresh,
    ELECTION_INFO
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.CANDIDATES = CANDIDATES;
  globalThis.ELECTION_INFO = ELECTION_INFO;
  globalThis.CandidatesManager = CandidatesManager;
}
