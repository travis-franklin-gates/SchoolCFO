// Commission-aligned position taxonomy with WA market benchmark salaries.
// 27 position types across 3 categories. Reference data for AI context
// and groundwork for multi-year forecasting / SchoolLaunch import pipeline.
//
// Schools do NOT map staff to these types yet — this is reference data only.

export type PositionCategory = 'Administrative' | 'Certificated' | 'Classified'
export type DriverType = 'fixed' | 'per_pupil'

export interface PositionBenchmark {
  id: string                    // stable key for reference
  title: string
  category: PositionCategory
  benchmarkSalary: number       // WA market estimate (base, no benefits)
  typicalFteMin: number         // typical FTE range lower
  typicalFteMax: number         // typical FTE range upper
  driverType: DriverType        // fixed = admin/support; per_pupil = scales with enrollment
  notes: string                 // context for the AI
}

export const POSITION_BENCHMARKS: PositionBenchmark[] = [
  // ── Administrative (9) ──
  {
    id: 'exec_director',
    title: 'Executive Director / CEO',
    category: 'Administrative',
    benchmarkSalary: 125000,
    typicalFteMin: 1.0,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Single-site charter typically 1.0 FTE. Salary varies by school size and metro area.',
  },
  {
    id: 'asst_director',
    title: 'Assistant Director / Principal',
    category: 'Administrative',
    benchmarkSalary: 105000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Smaller schools may combine with ED role. Needed at ~200+ students.',
  },
  {
    id: 'dean_students',
    title: 'Dean of Students',
    category: 'Administrative',
    benchmarkSalary: 90000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Culture and discipline lead. Often added at 300+ students or middle school expansion.',
  },
  {
    id: 'business_manager',
    title: 'Business Manager / Operations Director',
    category: 'Administrative',
    benchmarkSalary: 95000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Critical for financial management. Some schools outsource to a service provider.',
  },
  {
    id: 'office_manager',
    title: 'Office Manager / Administrative Assistant',
    category: 'Administrative',
    benchmarkSalary: 52000,
    typicalFteMin: 1.0,
    typicalFteMax: 2.0,
    driverType: 'fixed',
    notes: 'Front office. Most schools need at least 1.0 FTE from day one.',
  },
  {
    id: 'registrar',
    title: 'Registrar / Data Manager',
    category: 'Administrative',
    benchmarkSalary: 55000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Manages enrollment, CEDARS, student records. Often combined with office manager at smaller schools.',
  },
  {
    id: 'development_director',
    title: 'Development / Fundraising Director',
    category: 'Administrative',
    benchmarkSalary: 85000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Grant writing and donor relations. ROI-positive if school relies on philanthropic funding.',
  },
  {
    id: 'communications_coord',
    title: 'Communications / Marketing Coordinator',
    category: 'Administrative',
    benchmarkSalary: 58000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Enrollment marketing, community outreach. Often part-time or combined with another role.',
  },
  {
    id: 'hr_coordinator',
    title: 'HR Coordinator',
    category: 'Administrative',
    benchmarkSalary: 62000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Benefits administration, compliance, hiring. Often outsourced or combined with business manager.',
  },

  // ── Certificated (10) ──
  {
    id: 'teacher_k5',
    title: 'Classroom Teacher K-5',
    category: 'Certificated',
    benchmarkSalary: 62000,
    typicalFteMin: 1.0,
    typicalFteMax: 1.0,
    driverType: 'per_pupil',
    notes: 'Core instructional staff. WA average ~$62K base. Ratio typically 1 per 22-25 students.',
  },
  {
    id: 'teacher_68',
    title: 'Classroom Teacher 6-8',
    category: 'Certificated',
    benchmarkSalary: 64000,
    typicalFteMin: 1.0,
    typicalFteMax: 1.0,
    driverType: 'per_pupil',
    notes: 'Subject-specific. May need more sections than K-5. Ratio typically 1 per 25-28 students.',
  },
  {
    id: 'teacher_912',
    title: 'Classroom Teacher 9-12',
    category: 'Certificated',
    benchmarkSalary: 65000,
    typicalFteMin: 1.0,
    typicalFteMax: 1.0,
    driverType: 'per_pupil',
    notes: 'Subject-specific with endorsement requirements. Ratio typically 1 per 25-30 students.',
  },
  {
    id: 'sped_teacher',
    title: 'Special Education Teacher',
    category: 'Certificated',
    benchmarkSalary: 66000,
    typicalFteMin: 0.5,
    typicalFteMax: 2.0,
    driverType: 'per_pupil',
    notes: 'Required by IDEA. FTE driven by IEP caseload. Typically 1.0 per 12-15 IEP students.',
  },
  {
    id: 'ell_teacher',
    title: 'ELL / Bilingual Teacher',
    category: 'Certificated',
    benchmarkSalary: 64000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'per_pupil',
    notes: 'Funded by TBIP. FTE driven by ELL student count. Required if school serves ELL students.',
  },
  {
    id: 'instructional_coach',
    title: 'Instructional Coach / Curriculum Coordinator',
    category: 'Certificated',
    benchmarkSalary: 75000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Teacher development and curriculum alignment. Typically added at 300+ students.',
  },
  {
    id: 'counselor',
    title: 'School Counselor',
    category: 'Certificated',
    benchmarkSalary: 70000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'per_pupil',
    notes: 'ASCA recommends 1:250 ratio. Many charters start with 0.5 FTE and scale.',
  },
  {
    id: 'psychologist',
    title: 'School Psychologist',
    category: 'Certificated',
    benchmarkSalary: 82000,
    typicalFteMin: 0.2,
    typicalFteMax: 1.0,
    driverType: 'per_pupil',
    notes: 'IEP evaluations and 504 plans. Often contracted. FTE driven by SPED caseload.',
  },
  {
    id: 'slp',
    title: 'Speech Language Pathologist',
    category: 'Certificated',
    benchmarkSalary: 80000,
    typicalFteMin: 0.2,
    typicalFteMax: 1.0,
    driverType: 'per_pupil',
    notes: 'Related service for IEPs. Typically contracted. High demand, competitive salary.',
  },
  {
    id: 'librarian',
    title: 'Librarian / Media Specialist',
    category: 'Certificated',
    benchmarkSalary: 62000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Not required but valuable. Some charters combine with tech coordinator role.',
  },

  // ── Classified (8) ──
  {
    id: 'para_instructional',
    title: 'Paraeducator / Instructional Aide',
    category: 'Classified',
    benchmarkSalary: 38000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'per_pupil',
    notes: 'Classroom support. HB 1115 certification required. Ratio varies by model (1 per 1-2 classrooms).',
  },
  {
    id: 'para_sped',
    title: 'Special Education Paraeducator',
    category: 'Classified',
    benchmarkSalary: 40000,
    typicalFteMin: 0.5,
    typicalFteMax: 2.0,
    driverType: 'per_pupil',
    notes: 'IEP-driven 1:1 or small group support. FTE determined by student needs. IDEA fundable.',
  },
  {
    id: 'office_clerical',
    title: 'Office / Clerical Staff',
    category: 'Classified',
    benchmarkSalary: 42000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Reception, filing, phones. Supports front office operations.',
  },
  {
    id: 'custodian',
    title: 'Custodian / Facilities',
    category: 'Classified',
    benchmarkSalary: 44000,
    typicalFteMin: 0.5,
    typicalFteMax: 2.0,
    driverType: 'fixed',
    notes: 'Building maintenance and cleaning. FTE depends on building size, not enrollment.',
  },
  {
    id: 'food_service',
    title: 'Food Service Worker',
    category: 'Classified',
    benchmarkSalary: 35000,
    typicalFteMin: 0.5,
    typicalFteMax: 2.0,
    driverType: 'per_pupil',
    notes: 'NSLP program staff. Some schools contract food service instead of hiring.',
  },
  {
    id: 'nurse',
    title: 'Health Room / School Nurse (Non-Cert)',
    category: 'Classified',
    benchmarkSalary: 48000,
    typicalFteMin: 0.25,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Medication management, health screening. Some schools share with other schools.',
  },
  {
    id: 'it_support',
    title: 'IT Support / Technology Coordinator',
    category: 'Classified',
    benchmarkSalary: 58000,
    typicalFteMin: 0.5,
    typicalFteMax: 1.0,
    driverType: 'fixed',
    notes: 'Device management, network, EdTech support. Critical for 1:1 programs.',
  },
  {
    id: 'afterschool',
    title: 'Before/After School Program Staff',
    category: 'Classified',
    benchmarkSalary: 32000,
    typicalFteMin: 0.5,
    typicalFteMax: 2.0,
    driverType: 'per_pupil',
    notes: 'Extended day programs. Often partially self-funded through fees.',
  },
]

/**
 * Format the position benchmarks as a reference block for AI system prompt injection.
 * Compact format to minimize token usage while preserving actionable detail.
 */
export function formatBenchmarksForPrompt(): string {
  const categories: PositionCategory[] = ['Administrative', 'Certificated', 'Classified']
  const sections = categories.map((cat) => {
    const positions = POSITION_BENCHMARKS.filter((p) => p.category === cat)
    const lines = positions.map((p) => {
      const fteRange = p.typicalFteMin === p.typicalFteMax
        ? `${p.typicalFteMin} FTE`
        : `${p.typicalFteMin}–${p.typicalFteMax} FTE`
      return `  - ${p.title}: $${p.benchmarkSalary.toLocaleString()} base | ${fteRange} | ${p.driverType === 'per_pupil' ? 'scales with enrollment' : 'fixed'} | ${p.notes}`
    })
    return `${cat.toUpperCase()} (${positions.length}):\n${lines.join('\n')}`
  })

  return `WA CHARTER SCHOOL POSITION BENCHMARKS (Commission-aligned taxonomy, ${POSITION_BENCHMARKS.length} types):
Use these as reference when evaluating personnel costs, staffing proposals, or salary competitiveness.
All salaries are base pay before benefits. Add benefits_load_pct (SEBB) + fica_rate_pct for total cost.

${sections.join('\n\n')}`
}
