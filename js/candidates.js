// =============================================================
// HALALina - Candidate Profiles
// PLMun University Student Council Election - AY 2026-2027
// Each candidate has credentials, platform, and credibility metrics
// =============================================================

const CANDIDATES = Object.freeze([
  // ============= PRESIDENT =============
  {
    candidate_id: "C001",
    full_name: "Josh Andreu A. Malate",
    running_position: "President",
    party_affiliation: "HALALIN Party",
    program: "BSIT",
    year_section: "4-A",
    photo_initials: "JM",
    photo_color: "#16a34a",
    platform: [
      "Push for transparent student fund utilization with monthly public reports.",
      "Establish a 24/7 digital student grievance portal integrated with SIS.",
      "Modernize the university election system with blockchain-based voting."
    ],
    credentials: {
      education: "BS Information Technology, 4th Year - PLMun",
      gpa: "1.45",
      leadership_experience: [
        "Supreme Student Government President, Senior High (2022)",
        "BSIT Representative, College of IT and Computer Studies (2024-2025)",
        "Lead Organizer, PLMun IT Week 2025"
      ],
      achievements: [
        "Champion, PLMun Capstone Hackathon 2025",
        "Dean's Lister, 4 consecutive semesters",
        "Community Service Awardee (75+ hours)"
      ]
    },
    credibility: {
      academic_score: 95,
      leadership_score: 92,
      integrity_score: 88,
      community_score: 90,
      overall: 91.3,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  },
  {
    candidate_id: "C002",
    full_name: "Eumiko T. Maminta",
    running_position: "President",
    party_affiliation: "Buklod PLMun Party",
    program: "BSIT",
    year_section: "4-B",
    photo_initials: "EM",
    photo_color: "#0ea5e9",
    platform: [
      "Advocate for accessible mental health resources for all students.",
      "Modernize campus Wi-Fi infrastructure across all buildings.",
      "Strengthen student-athlete scholarship programs."
    ],
    credentials: {
      education: "BS Information Technology, 4th Year - PLMun",
      gpa: "1.50",
      leadership_experience: [
        "Vice President, BSIT Society (2024-2025)",
        "Head, PLMun Sports Committee (2024)",
        "Volunteer Coordinator, Brigada Eskwela 2024"
      ],
      achievements: [
        "Regional Silver Medalist, SUC III Sports (Basketball)",
        "President's Lister, 2 semesters",
        "Best IT Project, 2024"
      ]
    },
    credibility: {
      academic_score: 90,
      leadership_score: 95,
      integrity_score: 85,
      community_score: 88,
      overall: 89.5,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  },
  // ============= VICE PRESIDENT =============
  {
    candidate_id: "C003",
    full_name: "Carl Andrie P. Rubica",
    running_position: "Vice President",
    party_affiliation: "HALALIN Party",
    program: "BSCS",
    year_section: "4-A",
    photo_initials: "CR",
    photo_color: "#16a34a",
    platform: [
      "Implement academic tutoring network across all colleges.",
      "Strengthen research collaborations between IT and Engineering.",
      "Advocate for open-access learning materials."
    ],
    credentials: {
      education: "BS Computer Science, 4th Year - PLMun",
      gpa: "1.42",
      leadership_experience: [
        "President, PLMun CS Society (2024-2025)",
        "Lead Developer, PLMun Mobile App (2024)",
        "Treasurer, PLMun student council (2023-2024)"
      ],
      achievements: [
        "1st Place, National Collegiate Programming Contest (2024)",
        "Published research at PSITE National Conference 2025",
        "Full Academic Scholar since 1st year"
      ]
    },
    credibility: {
      academic_score: 97,
      leadership_score: 90,
      integrity_score: 94,
      community_score: 89,
      overall: 92.5,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  },
  {
    candidate_id: "C004",
    full_name: "Andrea Sofia B. Reyes",
    running_position: "Vice President",
    party_affiliation: "Buklod PLMun Party",
    program: "BSIS",
    year_section: "3-A",
    photo_initials: "AR",
    photo_color: "#0ea5e9",
    platform: [
      "Bridge the gap between student organizations and administration.",
      "Create inclusive leadership workshops for first-year students.",
      "Push for sustainable campus practices."
    ],
    credentials: {
      education: "BS Information Systems, 3rd Year - PLMun",
      gpa: "1.55",
      leadership_experience: [
        "Vice President, BSIS Society (2024-2025)",
        "Senator, College of IT and Computer Studies (2023-2024)",
        "Founder, PLMun Eco-Warriors (2023)"
      ],
      achievements: [
        "Outstanding Student Leader, 2024",
        "Best IS Capstone Proposal, 2025",
        "Environmental Champion Award (City of Muntinlupa)"
      ]
    },
    credibility: {
      academic_score: 88,
      leadership_score: 92,
      integrity_score: 91,
      community_score: 95,
      overall: 91.5,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  },
  // ============= SECRETARY =============
  {
    candidate_id: "C005",
    full_name: "Maria Camille D. Santos",
    running_position: "Secretary",
    party_affiliation: "HALALIN Party",
    program: "BSIT",
    year_section: "3-B",
    photo_initials: "MS",
    photo_color: "#16a34a",
    platform: [
      "Digitize all student council records with public access portal.",
      "Implement real-time attendance tracking for council sessions.",
      "Maintain transparent documentation of all resolutions."
    ],
    credentials: {
      education: "BS Information Technology, 3rd Year - PLMun",
      gpa: "1.48",
      leadership_experience: [
        "Secretary, BSIT Society (2023-2024)",
        "Documentations Head, PLMun IT Week 2024",
        "Assistant Secretary, College Student Council (2022-2023)"
      ],
      achievements: [
        "Best Documentation Award, PLMun IT Week 2024",
        "Dean's Lister, 3 consecutive semesters",
        "Volunteer, National Book Week 2024"
      ]
    },
    credibility: {
      academic_score: 93,
      leadership_score: 85,
      integrity_score: 96,
      community_score: 87,
      overall: 90.3,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  },
  {
    candidate_id: "C006",
    full_name: "Patrick James C. Lim",
    running_position: "Secretary",
    party_affiliation: "Buklod PLMun Party",
    program: "BSCS",
    year_section: "2-A",
    photo_initials: "PL",
    photo_color: "#0ea5e9",
    platform: [
      "Establish digital archives for all student council activities.",
      "Push for paperless documentation across student organizations.",
      "Implement weekly council newsletter."
    ],
    credentials: {
      education: "BS Computer Science, 2nd Year - PLMun",
      gpa: "1.51",
      leadership_experience: [
        "Assistant Secretary, BSCS Society (2024-2025)",
        "Co-founder, PLMun Developers Guild (2024)",
        "Event Coordinator, Hackathon PLMun 2024"
      ],
      achievements: [
        "Best Coder, Internal Programming Competition (2024)",
        "Dean's Lister, 2 consecutive semesters"
      ]
    },
    credibility: {
      academic_score: 91,
      leadership_score: 84,
      integrity_score: 88,
      community_score: 82,
      overall: 86.3,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  },
  // ============= TREASURER =============
  {
    candidate_id: "C007",
    full_name: "Beatrice Anne G. Fernando",
    running_position: "Treasurer",
    party_affiliation: "HALALIN Party",
    program: "BSDS",
    year_section: "3-A",
    photo_initials: "BF",
    photo_color: "#16a34a",
    platform: [
      "Publish monthly financial reports accessible to all students.",
      "Implement blockchain-based expense tracking system.",
      "Establish audit committee for student council funds."
    ],
    credentials: {
      education: "BS Data Science, 3rd Year - PLMun",
      gpa: "1.40",
      leadership_experience: [
        "Treasurer, BSDS Society (2024-2025)",
        "Finance Committee Member, PLMun IT Week (2024)",
        "Audit Assistant, College Student Council (2023-2024)"
      ],
      achievements: [
        "Champion, PLMun Data Analytics Challenge (2025)",
        "1.40 GPA - Highest in BSDS cohort",
        "Certified Bookkeeping Specialist (TESDA NC III)"
      ]
    },
    credibility: {
      academic_score: 96,
      leadership_score: 88,
      integrity_score: 98,
      community_score: 85,
      overall: 91.8,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  },
  {
    candidate_id: "C008",
    full_name: "Mark Vincent S. Cruz",
    running_position: "Treasurer",
    party_affiliation: "Buklod PLMun Party",
    program: "BSIS",
    year_section: "4-A",
    photo_initials: "MC",
    photo_color: "#0ea5e9",
    platform: [
      "Create digital wallet system for student organization budgets.",
      "Push for open bidding for student council procurement.",
      "Implement real-time fund monitoring dashboard."
    ],
    credentials: {
      education: "BS Information Systems, 4th Year - PLMun",
      gpa: "1.58",
      leadership_experience: [
        "Auditor, BSIS Society (2024-2025)",
        "Finance Head, PLMun Acquaintance Party (2024)",
        "Co-Treasurer, College Student Council (2022-2023)"
      ],
      achievements: [
        "Outstanding IS Project Award (2024)",
        "Dean's Lister, 3 consecutive semesters",
        "ICPAS Student Member"
      ]
    },
    credibility: {
      academic_score: 89,
      leadership_score: 86,
      integrity_score: 93,
      community_score: 84,
      overall: 88.0,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  },
  // ============= AUDITOR =============
  {
    candidate_id: "C009",
    full_name: "Rebecca Faye L. Aguilar",
    running_position: "Auditor",
    party_affiliation: "HALALIN Party",
    program: "BSCS",
    year_section: "3-A",
    photo_initials: "RA",
    photo_color: "#16a34a",
    platform: [
      "Conduct quarterly audits of all student council transactions.",
      "Push for transparent procurement processes.",
      "Establish anonymous fraud reporting channel."
    ],
    credentials: {
      education: "BS Computer Science, 3rd Year - PLMun",
      gpa: "1.43",
      leadership_experience: [
        "Assistant Auditor, BSCS Society (2024-2025)",
        "Audit Team Member, PLMun COMELEC (2024)",
        "Volunteer Auditor, Local Church Organization (2022-2024)"
      ],
      achievements: [
        "Best Research Paper, PLMun CS Conference (2025)",
        "ICAS Student Member",
        "Academic Excellence Awardee (3 semesters)"
      ]
    },
    credibility: {
      academic_score: 94,
      leadership_score: 82,
      integrity_score: 99,
      community_score: 86,
      overall: 90.3,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  },
  {
    candidate_id: "C010",
    full_name: "Hans Gabriel D. Lim",
    running_position: "Auditor",
    party_affiliation: "Buklod PLMun Party",
    program: "BSIT",
    year_section: "2-B",
    photo_initials: "HL",
    photo_color: "#0ea5e9",
    platform: [
      "Implement real-time expense monitoring for student organizations.",
      "Push for digital receipts for all council transactions.",
      "Conduct pre-event budget reviews."
    ],
    credentials: {
      education: "BS Information Technology, 2nd Year - PLMun",
      gpa: "1.52",
      leadership_experience: [
        "Assistant Auditor, BSIT Society (2024-2025)",
        "Member, PLMun IT Week Finance Committee (2024)"
      ],
      achievements: [
        "Best in Mathematics, PLMun Freshman Quiz (2024)",
        "Dean's Lister, 2 consecutive semesters"
      ]
    },
    credibility: {
      academic_score: 90,
      leadership_score: 80,
      integrity_score: 92,
      community_score: 78,
      overall: 85.0,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  },
  // ============= PRO =============
  {
    candidate_id: "C011",
    full_name: "Sophia Mae T. Villanueva",
    running_position: "Public Relations Officer (PRO)",
    party_affiliation: "HALALIN Party",
    program: "BSEMCP",
    year_section: "3-A",
    photo_initials: "SV",
    photo_color: "#16a34a",
    platform: [
      "Modernize official student council social media presence.",
      "Implement weekly student council updates across all platforms.",
      "Establish student-influencer partnerships for campus awareness."
    ],
    credentials: {
      education: "BS Entertainment and Multimedia Computing, 3rd Year - PLMun",
      gpa: "1.55",
      leadership_experience: [
        "PRO, BSEMCP Society (2024-2025)",
        "Social Media Manager, PLMun IT Week (2024)",
        "Event Host, PLMun Acquaintance Party (2024)"
      ],
      achievements: [
        "Best Multimedia Project, PLMun (2024)",
        "10K+ followers across student-led platforms",
        "Best Event Host, PLMun (2024)"
      ]
    },
    credibility: {
      academic_score: 88,
      leadership_score: 93,
      integrity_score: 87,
      community_score: 92,
      overall: 90.0,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  },
  {
    candidate_id: "C012",
    full_name: "Rafael Nathaniel C. Pascual",
    running_position: "Public Relations Officer (PRO)",
    party_affiliation: "Buklod PLMun Party",
    program: "BSIS",
    year_section: "2-A",
    photo_initials: "RP",
    photo_color: "#0ea5e9",
    platform: [
      "Establish campus-wide student newsletter.",
      "Push for student spotlights and feature stories.",
      "Implement digital bulletin boards across campus."
    ],
    credentials: {
      education: "BS Information Systems, 2nd Year - PLMun",
      gpa: "1.57",
      leadership_experience: [
        "Assistant PRO, BSIS Society (2024-2025)",
        "Writer, PLMun Student Publication (2024)",
        "Photographer, PLMun Events Team (2024)"
      ],
      achievements: [
        "Best Feature Article, PLMun Student Publication (2024)",
        "Dean's Lister, 2 consecutive semesters"
      ]
    },
    credibility: {
      academic_score: 86,
      leadership_score: 84,
      integrity_score: 86,
      community_score: 88,
      overall: 86.0,
      verified_by: "PLMun COMELEC + Faculty Verification Committee"
    }
  }
]);

// Election metadata
const ELECTION_INFO = Object.freeze({
  election_id: "ELEC-2026-SSC",
  election_name: "PLMun University Student Council Election AY 2026-2027",
  start_time: "2026-11-14T08:00:00+08:00",
  end_time: "2026-11-21T20:00:00+08:00",
  is_active: true,
  cluster_department: "All Colleges",
  description: "Annual University Student Council Election for the Pamantasan ng Lungsod ng Muntinlupa (PLMun) - Academic Year 2026-2027. Voting is open to all eligible, enrolled students as verified by the Mock Student Information System (SIS).",
  positions: ["President", "Vice President", "Secretary", "Treasurer", "Auditor", "Public Relations Officer (PRO)"]
});

// =============================================================
// HALALina - Candidates Manager
// Allows admins to push new candidates at runtime. New candidates
// are stored in localStorage (key: halalina_added_candidates_v1)
// and merged with the original CANDIDATES list whenever the
// candidates grid or ballot is rendered.
// =============================================================

const CandidatesManager = (function () {
  const STORAGE_KEY = 'halalina_added_candidates_v1';

  // ---- Avatar color palette (cycles through) ----
  const AVATAR_COLORS = ['#16a34a', '#0ea5e9', '#9333ea', '#dc2626', '#d97706', '#0891b2', '#65a30d', '#c026d3'];

  // ---- Load added candidates from localStorage ----
  function loadAdded() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ---- Save added candidates to localStorage ----
  function saveAdded(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // ---- Get all candidates (original + added) ----
  function getAll() {
    return CANDIDATES.concat(loadAdded());
  }

  // ---- Get candidates filtered by position ----
  function getByPosition(position) {
    return getAll().filter(c => c.running_position === position);
  }

  // ---- Add a new candidate ----
  // Returns { ok, candidate, reason }
  function addCandidate(input) {
    // Validate required fields
    if (!input.full_name || !input.full_name.trim()) {
      return { ok: false, reason: 'Full name is required.' };
    }
    if (!input.running_position || !input.running_position.trim()) {
      return { ok: false, reason: 'Position is required.' };
    }
    if (!input.party_affiliation || !input.party_affiliation.trim()) {
      return { ok: false, reason: 'Party affiliation is required.' };
    }

    // Generate a unique candidate ID
    const all = getAll();
    let nextId = all.length + 1;
    let candidateId;
    do {
      candidateId = 'C' + String(nextId).padStart(3, '0');
      nextId++;
    } while (all.some(c => c.candidate_id === candidateId));

    // Parse platform and credentials from textarea input (one per line)
    const platform = (input.platform || '')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (platform.length === 0) {
      return { ok: false, reason: 'At least one platform item is required.' };
    }

    const credentials = (input.credentials || '')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (credentials.length === 0) {
      return { ok: false, reason: 'At least one credential is required.' };
    }

    // Generate initials from the full name
    const nameParts = input.full_name.trim().split(/\s+/);
    const initials = nameParts
      .slice(0, 2)
      .map(p => p.charAt(0).toUpperCase())
      .join('');

    // Pick a color from the palette based on candidate count
    const color = AVATAR_COLORS[all.length % AVATAR_COLORS.length];

    const candidate = {
      candidate_id: candidateId,
      full_name: input.full_name.trim(),
      running_position: input.running_position.trim(),
      party_affiliation: input.party_affiliation.trim(),
      program: input.program || 'N/A',
      year_section: input.year_section || 'N/A',
      photo_initials: initials,
      photo_color: color,
      platform: platform,
      credentials: {
        leadership_experience: credentials.slice(0, Math.ceil(credentials.length / 2)),
        achievements: credentials.slice(Math.ceil(credentials.length / 2))
      },
      credibility: {
        academic_score: 0,
        leadership_score: 0,
        integrity_score: 0,
        community_score: 0,
        overall: 0,
        verified_by: 'Admin-added (not yet verified by PLMun COMELEC)'
      },
      _admin_added: true,
      _added_at: Date.now()
    };

    const list = loadAdded();
    list.push(candidate);
    saveAdded(list);

    return { ok: true, candidate };
  }

  // ---- Remove an admin-added candidate by ID ----
  function removeCandidate(candidateId) {
    const list = loadAdded();
    const filtered = list.filter(c => c.candidate_id !== candidateId);
    if (filtered.length === list.length) {
      return { ok: false, reason: 'Candidate not found, or it is one of the original candidates (cannot be removed).' };
    }
    saveAdded(filtered);
    return { ok: true };
  }

  // ---- Get just the admin-added candidates (for the management UI) ----
  function getAdded() {
    return loadAdded();
  }

  return {
    getAll,
    getByPosition,
    addCandidate,
    removeCandidate,
    getAdded,
    ELECTION_INFO
  };
})();

// Expose globally (browser & Node)
if (typeof globalThis !== 'undefined') {
  globalThis.CANDIDATES = CANDIDATES;
  globalThis.ELECTION_INFO = ELECTION_INFO;
  globalThis.CandidatesManager = CandidatesManager;
}

// CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CANDIDATES, ELECTION_INFO, CandidatesManager };
}
