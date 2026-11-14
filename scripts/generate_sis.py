"""
Generates a Mock Student Information System (SIS) database for HALALina
- 220 students with student IDs in the format 23XXXXXX (8 digits, start with 23)
- Realistic Filipino names (PLMun context)
- Programs: BSIT, BSCS, BSIS, ACT, BSEMCP, BSDS
- PIN: 4-digit codes
- Eligibility: enrolled students only
Output: /home/z/my-project/download/halalina-voting-system/js/sis-data.js
"""
import random
import json
from pathlib import Path

random.seed(42)  # reproducibility

first_names_m = [
    "Josh", "Carl", "Eumiko", "Mark", "John", "Paul", "Ramon", "Luis", "Andrei", "Gabriel",
    "Miguel", "Carlos", "Antonio", "Ricardo", "Fernando", "Diego", "Jose", "Manuel", "Vincent", "Christian",
    "Rafael", "Nathaniel", "Jericho", "Francis", "Adrian", "James", "Patrick", "Daniel", "Andrew", "Sebastian",
    "Romeo", "Julius", "Hans", "Lorenzo", "Francisco", "Eduard", "Renz", "Karl", "Allen", "Jomari",
    "Jayson", "Rey", "Bryan", "Alvin", "Jaspher", "Kim", "Joven", "Hendrix", "Arvin", "Emmanuel"
]

first_names_f = [
    "Maria", "Andrea", "Sofia", "Isabella", "Althea", "Patricia", "Mikaela", "Jasmine", "Alyssa", "Frances",
    "Angela", "Beatrice", "Camille", "Danielle", "Erika", "Felicity", "Giselle", "Hannah", "Iris", "Kathleen",
    "Lorraine", "Marites", "Nadine", "Olivia", "Pia", "Quinn", "Rina", "Samira", "Trisha", "Ursula",
    "Vanessa", "Wendy", "Xenia", "Yvette", "Zara", "Maureen", "Charmaine", "Diana", "Ella", "Faye",
    "Gemma", "Heaven", "Iya", "Jannah", "Keziah", "Lia", "Mika", "Nica", "Princess", "Rebecca"
]

last_names = [
    "Malate", "Maminta", "Rubica", "Dela Cruz", "Santos", "Reyes", "Garcia", "Mendoza", "Bautista", "Fernandez",
    "Cruz", "Aquino", "Villanueva", "Pascual", "Tan", "Lim", "Ong", "Sy", "Ramos", "Castro",
    "Gonzales", "Hernandez", "Agustin", "De Guzman", "Lopez", "Perez", "Tiongson", "Marquez", "Navarro", "Pascua",
    "Salvador", "Tiangco", "Umali", "Yaptinchay", "Zabala", "Borja", "Cardenas", "Domingo", "Escueta", "Fajardo",
    "Gatchalian", "Imperial", "Jacinto", "Kintanar", "Lazaro", "Madrigal", "Nuqui", "Ortega", "Pacheco", "Quesada",
    "Rivera", "Sandoval", "Torres", "Uy", "Valdez", "Walangitan", "Yba\u00f1ez", "Zaragoza", "Abad", "Bacani",
    "Cabrera", "Dominguez", "Estrada", "Feria", "Galang", "Henson", "Ignacio", "Javellana", "Kalaw", "Magsaysay"
]

programs = [
    ("BSIT", "Bachelor of Science in Information Technology"),
    ("BSCS", "Bachelor of Science in Computer Science"),
    ("BSIS", "Bachelor of Science in Information Systems"),
    ("ACT", "Associate in Computer Technology"),
    ("BSEMCP", "Bachelor of Science in Entertainment and Multimedia Computing"),
    ("BSDS", "Bachelor of Science in Data Science"),
]

years = [1, 2, 3, 4]
sections = ["A", "B", "C", "D"]

students = []
used_ids = set()

# Generate 220 students
for i in range(220):
    # Unique student ID starting with 23
    while True:
        sid = "23" + "".join([str(random.randint(0, 9)) for _ in range(6)])
        if sid not in used_ids:
            used_ids.add(sid)
            break

    # Random gender selection
    if random.random() < 0.5:
        first = random.choice(first_names_m)
        gender = "M"
    else:
        first = random.choice(first_names_f)
        gender = "F"

    last = random.choice(last_names)
    middle_initial = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

    prog_code, prog_full = random.choice(programs)
    year = random.choice(years)
    section = random.choice(sections)

    # PIN: 4-digit
    pin = f"{random.randint(1000, 9999)}"

    # 92% are eligible (enrolled), 8% ineligible (for testing eligibility verification)
    eligibility = "ELIGIBLE" if random.random() < 0.92 else "INELIGIBLE"

    # Email pattern
    email = f"{first.lower()}.{last.lower().replace(' ', '').replace('\u00f1', 'n')}{sid[-4:]}@plmun.edu.ph"

    students.append({
        "student_id": sid,
        "first_name": first,
        "middle_initial": middle_initial,
        "last_name": last,
        "gender": gender,
        "program": prog_code,
        "program_full": prog_full,
        "year": year,
        "section": section,
        "email": email,
        "pin": pin,
        "eligibility_status": eligibility,
        "has_voted": False,
        "vote_hash": None,
        "created_at": "2026-01-15T08:00:00Z"
    })

# Sort by student_id for cleaner output
students.sort(key=lambda s: s["student_id"])

# Build JS file
js_content = "// =============================================================\n"
js_content += "// HALALina - Mock Student Information System (SIS) Database\n"
js_content += "// Generated synthetic data: 220 students with 23XXXXXX format IDs\n"
js_content += "// Compliant with Data Privacy Act of 2012 (RA 10173) - synthetic\n"
js_content += "// anonymized records replicating PLMun SIS structure.\n"
js_content += "// =============================================================\n\n"
js_content += "const MOCK_SIS = Object.freeze(" + json.dumps(students, indent=2) + ");\n\n"
js_content += "// Eligible students count (for stats display)\n"
js_content += "const SIS_STATS = Object.freeze({\n"
js_content += f"  total_students: {len(students)},\n"
js_content += f"  eligible_students: {len([s for s in students if s['eligibility_status'] == 'ELIGIBLE'])},\n"
js_content += f"  ineligible_students: {len([s for s in students if s['eligibility_status'] == 'INELIGIBLE'])},\n"
js_content += "  generated_at: '2026-01-15T08:00:00Z'\n"
js_content += "});\n\n"
js_content += "// Expose to window for browser usage\n"
js_content += "if (typeof window !== 'undefined') {\n"
js_content += "  window.MOCK_SIS = MOCK_SIS;\n"
js_content += "  window.SIS_STATS = SIS_STATS;\n"
js_content += "}\n\n"
js_content += "// CommonJS export for Node testing\n"
js_content += "if (typeof module !== 'undefined' && module.exports) {\n"
js_content += "  module.exports = { MOCK_SIS, SIS_STATS };\n"
js_content += "}\n"

out_path = Path("/home/z/my-project/download/halalina-voting-system/js/sis-data.js")
out_path.write_text(js_content, encoding="utf-8")
print(f"Generated {len(students)} students -> {out_path}")
print(f"File size: {out_path.stat().st_size:,} bytes")

# Print a few sample student IDs + PINs for the README/tutorial
print("\n=== Sample credentials (for testing/tutorial) ===")
samples = [s for s in students if s["eligibility_status"] == "ELIGIBLE"][:10]
for s in samples:
    print(f"  {s['student_id']}  PIN: {s['pin']}  ({s['first_name']} {s['last_name']}, {s['program']}-{s['year']}{s['section']})")

ineligible_sample = next(s for s in students if s["eligibility_status"] == "INELIGIBLE")
print(f"\n  Ineligible sample: {ineligible_sample['student_id']}  PIN: {ineligible_sample['pin']}")

# Save sample credentials for the README
with open("/home/z/my-project/scripts/sample_credentials.json", "w") as f:
    json.dump({
        "eligible_samples": [{"student_id": s["student_id"], "pin": s["pin"], "name": f"{s['first_name']} {s['last_name']}", "program": s["program"]} for s in samples],
        "ineligible_sample": {"student_id": ineligible_sample["student_id"], "pin": ineligible_sample["pin"]}
    }, f, indent=2)
print("\nSample credentials saved to /home/z/my-project/scripts/sample_credentials.json")
