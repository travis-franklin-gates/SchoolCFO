-- Commission-aligned position taxonomy with WA market benchmark salaries.
-- Reference data for AI context and SchoolLaunch import pipeline alignment.
-- Schools do NOT map staff to these types yet — that is a future feature.

create table if not exists position_benchmarks (
  id text primary key,                       -- stable key e.g. 'teacher_k5'
  title text not null,
  category text not null check (category in ('Administrative', 'Certificated', 'Classified')),
  benchmark_salary integer not null,         -- WA market estimate, base pay
  typical_fte_min numeric(3,2) not null,
  typical_fte_max numeric(3,2) not null,
  driver_type text not null check (driver_type in ('fixed', 'per_pupil')),
  notes text not null default ''
);

-- No RLS needed — this is global reference data, not school-specific.
-- All authenticated users can read.
alter table position_benchmarks enable row level security;
create policy "position_benchmarks_read" on position_benchmarks
  for select using (true);

-- Seed the 27 position types
insert into position_benchmarks (id, title, category, benchmark_salary, typical_fte_min, typical_fte_max, driver_type, notes) values
  -- Administrative (9)
  ('exec_director',       'Executive Director / CEO',                   'Administrative', 125000, 1.0, 1.0, 'fixed',     'Single-site charter typically 1.0 FTE.'),
  ('asst_director',       'Assistant Director / Principal',             'Administrative', 105000, 0.5, 1.0, 'fixed',     'Smaller schools may combine with ED role.'),
  ('dean_students',       'Dean of Students',                          'Administrative',  90000, 0.5, 1.0, 'fixed',     'Culture and discipline lead.'),
  ('business_manager',    'Business Manager / Operations Director',    'Administrative',  95000, 0.5, 1.0, 'fixed',     'Critical for financial management.'),
  ('office_manager',      'Office Manager / Administrative Assistant', 'Administrative',  52000, 1.0, 2.0, 'fixed',     'Front office support.'),
  ('registrar',           'Registrar / Data Manager',                  'Administrative',  55000, 0.5, 1.0, 'fixed',     'Manages enrollment and CEDARS.'),
  ('development_director','Development / Fundraising Director',        'Administrative',  85000, 0.5, 1.0, 'fixed',     'Grant writing and donor relations.'),
  ('communications_coord','Communications / Marketing Coordinator',    'Administrative',  58000, 0.5, 1.0, 'fixed',     'Enrollment marketing and outreach.'),
  ('hr_coordinator',      'HR Coordinator',                            'Administrative',  62000, 0.5, 1.0, 'fixed',     'Benefits administration and compliance.'),
  -- Certificated (10)
  ('teacher_k5',          'Classroom Teacher K-5',                     'Certificated',    62000, 1.0, 1.0, 'per_pupil', '1 per 22-25 students.'),
  ('teacher_68',          'Classroom Teacher 6-8',                     'Certificated',    64000, 1.0, 1.0, 'per_pupil', '1 per 25-28 students.'),
  ('teacher_912',         'Classroom Teacher 9-12',                    'Certificated',    65000, 1.0, 1.0, 'per_pupil', '1 per 25-30 students.'),
  ('sped_teacher',        'Special Education Teacher',                 'Certificated',    66000, 0.5, 2.0, 'per_pupil', '1.0 per 12-15 IEP students.'),
  ('ell_teacher',         'ELL / Bilingual Teacher',                   'Certificated',    64000, 0.5, 1.0, 'per_pupil', 'Funded by TBIP.'),
  ('instructional_coach', 'Instructional Coach / Curriculum Coordinator','Certificated',  75000, 0.5, 1.0, 'fixed',     'Typically added at 300+ students.'),
  ('counselor',           'School Counselor',                          'Certificated',    70000, 0.5, 1.0, 'per_pupil', 'ASCA recommends 1:250 ratio.'),
  ('psychologist',        'School Psychologist',                       'Certificated',    82000, 0.2, 1.0, 'per_pupil', 'IEP evaluations. Often contracted.'),
  ('slp',                 'Speech Language Pathologist',               'Certificated',    80000, 0.2, 1.0, 'per_pupil', 'Related service for IEPs.'),
  ('librarian',           'Librarian / Media Specialist',              'Certificated',    62000, 0.5, 1.0, 'fixed',     'Not required but valuable.'),
  -- Classified (8)
  ('para_instructional',  'Paraeducator / Instructional Aide',         'Classified',      38000, 0.5, 1.0, 'per_pupil', 'HB 1115 certification required.'),
  ('para_sped',           'Special Education Paraeducator',            'Classified',      40000, 0.5, 2.0, 'per_pupil', 'IEP-driven support. IDEA fundable.'),
  ('office_clerical',     'Office / Clerical Staff',                   'Classified',      42000, 0.5, 1.0, 'fixed',     'Reception and admin support.'),
  ('custodian',           'Custodian / Facilities',                    'Classified',      44000, 0.5, 2.0, 'fixed',     'FTE depends on building size.'),
  ('food_service',        'Food Service Worker',                       'Classified',      35000, 0.5, 2.0, 'per_pupil', 'NSLP program staff.'),
  ('nurse',               'Health Room / School Nurse (Non-Cert)',     'Classified',      48000, 0.25,1.0, 'fixed',     'Medication management and health screening.'),
  ('it_support',          'IT Support / Technology Coordinator',       'Classified',      58000, 0.5, 1.0, 'fixed',     'Critical for 1:1 programs.'),
  ('afterschool',         'Before/After School Program Staff',         'Classified',      32000, 0.5, 2.0, 'per_pupil', 'Extended day programs.')
on conflict (id) do nothing;
