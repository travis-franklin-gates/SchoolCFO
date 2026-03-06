// Detailed guidance for each SAO audit checklist item.
// Sourced from WA State Auditor's Office published charter school
// accountability audit reports and applicable RCWs/WACs.

export interface ChecklistItemDetail {
  whyItMatters: string
  howToComply: string[]
  whatToHaveReady: string[]
  resources: { label: string; url: string }[]
}

// Keyed by the exact checklist item text string.
const CHECKLIST_DETAILS: Record<string, ChecklistItemDetail> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. STAFF CERTIFICATION COMPLIANCE
  // ═══════════════════════════════════════════════════════════════════════════

  'All instructional staff hold current WA teaching certificates or OSPI-issued permits': {
    whyItMatters:
      'This is the single most common finding in WA charter school audits. The SAO checks every teacher against the OSPI E-Certification database. If even one teacher is found working with an expired or missing certificate, it becomes a formal audit finding — and repeated findings can trigger authorizer intervention. The school can also lose state funding for uncertified instructional time.',
    howToComply: [
      'Run a full certification check against OSPI E-Certification for every instructional staff member at the start of each school year and again in January.',
      'Set calendar reminders 90 days before each teacher\'s certificate expiration date.',
      'For new hires, verify certification status before the first day of instruction — not after.',
      'If a teacher\'s certificate lapses, immediately file for an emergency substitute certificate or remove them from instructional duties until resolved.',
      'Maintain a tracking spreadsheet with certificate type, number, issue date, and expiration date for all instructional staff.',
    ],
    whatToHaveReady: [
      'Printout or screenshot from OSPI E-Certification for each instructional staff member showing current status',
      'Staff roster with certificate numbers, types, endorsements, and expiration dates',
      'Documentation of any emergency permits or conditional certificates with OSPI approval letters',
      'Board minutes showing approval of any conditional or emergency staffing arrangements',
      'HR file for each teacher with copy of certificate on file',
    ],
    resources: [
      { label: 'OSPI E-Certification Lookup', url: 'https://eds.ospi.k12.wa.us/' },
      { label: 'RCW 28A.405 — Teacher Certification', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.405' },
      { label: 'WAC 181-79A — Certification Requirements', url: 'https://app.leg.wa.gov/wac/default.aspx?cite=181-79A' },
      { label: 'SAO Audit Report Search', url: 'https://portal.sao.wa.gov/ReportSearch' },
    ],
  },

  'S-275 personnel report accurately reflects staff certification status': {
    whyItMatters:
      'The S-275 is the annual personnel report that every school submits to OSPI. The SAO cross-references S-275 data against actual payroll records and E-Certification. If the S-275 shows a teacher as certified but they aren\'t, or if staff are missing from the report, it creates a discrepancy that auditors flag. S-275 errors can also affect your school\'s state funding allocation.',
    howToComply: [
      'Reconcile S-275 data against your actual payroll register and OSPI E-Certification before submitting.',
      'Verify that every paid instructional staff member appears on the S-275 with correct FTE, certificate number, and duty codes.',
      'Cross-check that staff who left mid-year are reported with correct start/end dates.',
      'Have the business manager and principal both review the final S-275 before submission.',
    ],
    whatToHaveReady: [
      'Completed S-275 report as submitted to OSPI',
      'Payroll register for the reporting period showing all instructional staff',
      'Reconciliation worksheet showing S-275 entries matched to payroll and certification records',
      'Correction documentation if any amendments were filed after initial submission',
    ],
    resources: [
      { label: 'OSPI S-275 Staff Reporting (SAFS)', url: 'https://www.k12.wa.us/safs/' },
      { label: 'OSPI E-Certification Lookup', url: 'https://eds.ospi.k12.wa.us/' },
    ],
  },

  'Special education staff hold valid SpEd endorsements or pre-endorsement authorization': {
    whyItMatters:
      'Special education is a federally mandated service, and the SAO pays close attention to whether SpEd teachers have the proper endorsements. A teacher providing SpEd services without a valid endorsement means the school is providing services with unqualified personnel, which can result in audit findings and jeopardize IDEA funding. Pre-endorsement authorization from OSPI is acceptable but must be documented.',
    howToComply: [
      'Verify that every staff member providing direct SpEd instruction holds a Special Education endorsement on their WA teaching certificate.',
      'If a teacher is working toward their SpEd endorsement, obtain and file OSPI pre-endorsement authorization before they begin serving students.',
      'Check that related service providers (SLPs, OTs, PTs) hold current WA state licenses in their discipline.',
      'Review SpEd staff assignments annually to ensure endorsements match the disability categories they serve.',
    ],
    whatToHaveReady: [
      'E-Certification printouts for all SpEd instructional staff showing endorsement status',
      'OSPI pre-endorsement authorization letters for any staff working toward SpEd endorsement',
      'Current state licenses for related service providers (speech, OT, PT)',
      'SpEd staffing assignment sheet showing which staff serve which students/programs',
    ],
    resources: [
      { label: 'OSPI E-Certification Lookup', url: 'https://eds.ospi.k12.wa.us/' },
      { label: 'OSPI Special Education', url: 'https://ospi.k12.wa.us/student-success/special-education' },
      { label: 'RCW 28A.405 — Teacher Certification', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.405' },
    ],
  },

  'All instructional staff contracts have been approved by the Board': {
    whyItMatters:
      'WA charter school boards must approve all employment contracts for instructional staff. The SAO reviews board minutes to confirm this. If contracts were executed without board approval, it indicates a governance gap — the board isn\'t exercising its oversight role over personnel decisions. This finding often appears alongside certification findings.',
    howToComply: [
      'Present all new hire contracts and renewals to the board for approval before the employee\'s start date.',
      'Include a consent agenda item for staff contracts at each board meeting during hiring season.',
      'Maintain a log of all contracts approved by the board with the corresponding meeting date and resolution number.',
      'For mid-year hires, get board approval at the next regularly scheduled meeting and document the interim hiring authority used.',
    ],
    whatToHaveReady: [
      'Board meeting minutes showing approval of each instructional staff contract',
      'Signed employment contracts for all instructional staff',
      'Board resolution or consent agenda items authorizing contracts',
      'Log or tracker showing contract approval dates matched to board meeting dates',
    ],
    resources: [
      { label: 'RCW 28A.405 — Teacher Certification', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.405' },
      { label: 'WA Charter School Commission — Oversight', url: 'https://charterschool.wa.gov/oversight-accountability/' },
    ],
  },

  'Paraeducator certificates are current per HB 1115 requirements': {
    whyItMatters:
      'Since 2017, WA paraeducators must hold certificates issued by the Paraeducator Board. The SAO verifies that classified instructional staff (teacher aides, paraprofessionals) meet these requirements. Schools sometimes overlook paraeducator certification because it\'s newer than teacher certification, but auditors check it. Non-compliance means the school has unqualified staff working directly with students.',
    howToComply: [
      'Identify all staff whose job duties include direct student instruction in a support role — these are paraeducators regardless of job title.',
      'Verify each paraeducator holds a current certificate from the WA Paraeducator Board via OSPI E-Certification.',
      'For new paraeducator hires, verify certificate status before they begin working with students.',
      'Track certificate expiration dates and ensure renewal applications are submitted on time.',
    ],
    whatToHaveReady: [
      'List of all paraeducator staff with certificate numbers and expiration dates',
      'E-Certification printouts showing current paraeducator certificate status',
      'Job descriptions for classified instructional staff showing how they meet paraeducator definitions',
      'Documentation of any staff completing the paraeducator certification process',
    ],
    resources: [
      { label: 'OSPI E-Certification Lookup', url: 'https://eds.ospi.k12.wa.us/' },
      { label: 'OSPI Paraeducator Program', url: 'https://ospi.k12.wa.us/certification/paraeducator-certificate' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ENROLLMENT REPORTING ACCURACY
  // ═══════════════════════════════════════════════════════════════════════════

  'Student enrollment count date documentation is complete for each month': {
    whyItMatters:
      'Charter school funding is based on enrolled student counts reported on specific count dates each month. The SAO audits whether your reported enrollment numbers match actual students who were physically enrolled and attending. If you reported 150 students but can only document 142, you received funding for 8 students you shouldn\'t have. This is one of the most common financial findings in charter school audits.',
    howToComply: [
      'Maintain a clear enrollment register showing every student\'s enrollment date, withdrawal date (if applicable), and attendance status on each count date.',
      'On each monthly count date, generate and preserve a snapshot of your student information system showing exactly who was enrolled.',
      'Cross-reference your count date roster against CEDARS submission to ensure they match.',
      'Document any students who were enrolled but absent on count dates — you need evidence they were still actively enrolled.',
      'Keep withdrawal documentation (parent notification, records transfer) for any student who left during the year.',
    ],
    whatToHaveReady: [
      'Monthly enrollment count date rosters with student names and enrollment status',
      'Student information system reports showing enrollment as of each count date',
      'Enrollment and withdrawal forms for all student movement during the year',
      'Attendance records for count date periods',
      'CEDARS submission confirmations showing reported enrollment numbers',
    ],
    resources: [
      { label: 'WAC 392-121 — Enrollment Counting', url: 'https://app.leg.wa.gov/wac/default.aspx?cite=392-121' },
      { label: 'OSPI CEDARS Reporting', url: 'https://ospi.k12.wa.us/data-reporting/reporting/cedars' },
    ],
  },

  'Special education students have current IEPs and evaluations on file': {
    whyItMatters:
      'The SAO checks that every student reported as receiving special education services has a current Individualized Education Program (IEP) and a current evaluation (re-evaluation every 3 years). If a student is counted for SpEd funding but their IEP is expired or they don\'t have a current evaluation, the school received funding it wasn\'t entitled to. This also exposes the school to IDEA compliance complaints.',
    howToComply: [
      'Maintain a SpEd compliance tracker showing every SpEd student\'s IEP dates (annual review due, next re-evaluation due).',
      'Set calendar reminders at least 60 days before each IEP annual review and each triennial re-evaluation.',
      'If an IEP lapses, hold the meeting immediately — don\'t let it go more than 30 days past due.',
      'Ensure evaluations are completed within the 35-school-day timeline required by WAC.',
      'When a SpEd student enrolls from another district, obtain their IEP records within 5 business days and either adopt or develop a new IEP within 30 days.',
    ],
    whatToHaveReady: [
      'Current signed IEP for each SpEd student',
      'Current evaluation report for each SpEd student (within 3 years)',
      'SpEd compliance tracker showing IEP review dates and re-evaluation dates',
      'Prior Written Notice documents for all IEP meetings held this year',
      'Transfer IEP documentation for students who enrolled from another district',
    ],
    resources: [
      { label: 'OSPI Special Education', url: 'https://ospi.k12.wa.us/student-success/special-education' },
      { label: 'WAC 392-172A — Special Education', url: 'https://app.leg.wa.gov/wac/default.aspx?cite=392-172A' },
    ],
  },

  'Special ed students received services on or before each monthly count date': {
    whyItMatters:
      'It\'s not enough to have an IEP on file — the SAO verifies that SpEd students actually received services. They cross-reference service logs against count dates. If a student is reported as receiving SpEd services for funding purposes but the service logs show no services were provided before the count date, it\'s a finding. The school essentially claimed funding for services it didn\'t deliver.',
    howToComply: [
      'Require SpEd service providers to maintain daily or weekly service logs showing date, time, student, and service type.',
      'Before each count date, verify that all SpEd students have received at least some services in the current service period.',
      'If a service provider is absent, document how services were covered (substitute provider, make-up sessions).',
      'For students with related services (speech, OT), ensure those providers are logging sessions with dates and minutes.',
    ],
    whatToHaveReady: [
      'SpEd service logs for each provider showing dates, students served, and minutes of service',
      'Documentation that services were delivered before each monthly count date',
      'Make-up session documentation for any missed services',
      'Related service provider session logs (speech, OT, PT)',
    ],
    resources: [
      { label: 'OSPI Special Education', url: 'https://ospi.k12.wa.us/student-success/special-education' },
      { label: 'WAC 392-121 — Enrollment Counting', url: 'https://app.leg.wa.gov/wac/default.aspx?cite=392-121' },
    ],
  },

  'CEDARS enrollment data matches actual student roster': {
    whyItMatters:
      'CEDARS is the state\'s enrollment reporting system, and it\'s what OSPI uses to calculate your funding. The SAO compares your CEDARS submissions against your actual student records. Mismatches — students in CEDARS who aren\'t actually enrolled, or enrolled students missing from CEDARS — indicate reporting errors. Even unintentional mismatches get flagged as findings because they affect funding accuracy.',
    howToComply: [
      'After each CEDARS submission, pull a report and compare it line-by-line against your student information system.',
      'Resolve all CEDARS error reports before each submission window closes.',
      'When a student withdraws, update your SIS and CEDARS within 5 business days.',
      'Assign one staff member as the CEDARS data steward responsible for accuracy.',
    ],
    whatToHaveReady: [
      'CEDARS submission confirmations for each reporting window',
      'CEDARS error reports showing issues were identified and resolved',
      'Reconciliation showing CEDARS student count matches SIS student count by reporting period',
      'Documentation of CEDARS corrections made during the year',
    ],
    resources: [
      { label: 'OSPI CEDARS Reporting', url: 'https://ospi.k12.wa.us/data-reporting/reporting/cedars' },
      { label: 'WA Charter School Commission — Oversight', url: 'https://charterschool.wa.gov/oversight-accountability/' },
    ],
  },

  'S-275 staff report matches actual employed staff': {
    whyItMatters:
      'The SAO compares your S-275 personnel report against your actual payroll records. If you reported staff on the S-275 who weren\'t actually employed, or if employed staff are missing from the report, it raises questions about data integrity and can affect how state funding is calculated. This check is often done simultaneously with the certification review, so errors in one area compound findings in the other.',
    howToComply: [
      'Before submitting the S-275, reconcile it against your payroll register — every person receiving a paycheck for instructional or support duties should appear.',
      'Verify FTE allocations on the S-275 match actual contracted hours.',
      'Check that staff who were terminated or resigned mid-year have correct service dates.',
      'Confirm duty codes and assignment codes match actual job responsibilities.',
    ],
    whatToHaveReady: [
      'S-275 report as submitted to OSPI',
      'Payroll register for the S-275 reporting period',
      'Reconciliation worksheet showing S-275 entries matched to payroll records',
      'Documentation of any mid-year staffing changes with effective dates',
    ],
    resources: [
      { label: 'OSPI S-275 Staff Reporting (SAFS)', url: 'https://www.k12.wa.us/safs/' },
      { label: 'OSPI E-Certification Lookup', url: 'https://eds.ospi.k12.wa.us/' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ACCOUNTS PAYABLE CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  'All disbursements have documentation showing goods/services received before payment': {
    whyItMatters:
      'The SAO samples disbursements and checks that each one has supporting documentation — an invoice, a receiving record, and evidence that someone verified the goods or services were actually delivered before the check was cut. Paying vendors without confirming delivery is how fraud and waste occur. A finding here means the school\'s internal controls aren\'t strong enough to prevent improper payments.',
    howToComply: [
      'Implement a three-way match process: purchase order, vendor invoice, and receiving confirmation must all agree before payment is approved.',
      'Require a staff member other than the person who placed the order to confirm receipt of goods or services.',
      'Stamp or initial each invoice with the date received, account code, and approver signature before processing payment.',
      'Never process payment based solely on a vendor statement — always require the original invoice.',
      'File supporting documentation (PO, invoice, receiving record) together in a way that allows easy auditor retrieval.',
    ],
    whatToHaveReady: [
      'Vendor invoices with receiving confirmation signatures or initials',
      'Purchase orders matched to invoices (where applicable)',
      'Check register or payment ledger showing all disbursements with dates and amounts',
      'Account coding documentation for each payment',
      'Approval signatures showing who authorized each payment',
    ],
    resources: [
      { label: 'SAO Best Practices — Internal Controls', url: 'https://portal.sao.wa.gov/ReportSearch' },
      { label: 'RCW 42.24 — Warrant Requirements', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.24' },
    ],
  },

  'Credit card purchases have receipts and business purpose documentation': {
    whyItMatters:
      'Credit card purchases are the most scrutinized transactions in a school audit because they bypass normal purchasing controls. The SAO reviews every credit card statement and expects to see an original receipt and a written business purpose for each charge. Missing receipts or vague business purposes (like "supplies") are automatic findings. Personal charges on a school credit card — even if reimbursed — are reported as misuse of public funds.',
    howToComply: [
      'Require cardholders to submit original receipts within 5 business days of each purchase.',
      'Use a credit card log or expense report form that requires the cardholder to write a specific business purpose for each transaction.',
      'Reconcile each credit card statement against submitted receipts before paying the bill.',
      'Prohibit personal use of school credit cards under any circumstances — document this in your fiscal policy.',
      'Review statements monthly with a supervisor other than the cardholder reviewing and approving.',
    ],
    whatToHaveReady: [
      'Monthly credit card statements with receipts attached for every transaction',
      'Credit card expense report forms with business purpose documented for each charge',
      'Board-approved credit card use policy',
      'Documentation of monthly statement review and supervisor approval',
      'Cardholder agreements signed by each person with a school credit card',
    ],
    resources: [
      { label: 'SAO Audit Report Search', url: 'https://portal.sao.wa.gov/ReportSearch' },
      { label: 'RCW 42.24 — Warrant Requirements', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.24' },
    ],
  },

  'Electronic funds transfers have dual authorization': {
    whyItMatters:
      'EFTs move money instantly with no paper trail unless you create one. The SAO expects that no single person can initiate and approve an electronic payment. Without dual authorization, one staff member could transfer school funds to a personal account or to a fictitious vendor. Several WA school districts have had embezzlement findings tied to single-person control over electronic payments.',
    howToComply: [
      'Configure your bank to require two authorized signers for all EFTs above a board-approved threshold.',
      'Maintain a written EFT authorization policy approved by the board that specifies who can initiate and who can approve.',
      'Require the person who initiates an EFT to be different from the person who approves it.',
      'Review bank activity daily or at minimum weekly for any unauthorized electronic transfers.',
    ],
    whatToHaveReady: [
      'Board-approved policy requiring dual authorization for electronic fund transfers',
      'Bank authorization documents showing which staff have EFT access',
      'Transaction logs showing initiator and approver for each EFT',
      'Bank statements with EFTs identified and reconciled',
    ],
    resources: [
      { label: 'SAO Best Practices — Internal Controls', url: 'https://portal.sao.wa.gov/ReportSearch' },
    ],
  },

  'No duplicate payments to vendors in current fiscal year': {
    whyItMatters:
      'Duplicate payments are a common finding in audits of all sizes. They happen when the same invoice is processed twice — often because it arrives by email and mail, or because a vendor resubmits. The SAO runs data analytics on your check register to identify potential duplicates. Even if the vendor refunds the overpayment, the fact that your controls didn\'t catch it before payment is the finding.',
    howToComply: [
      'Before processing any payment, check the vendor\'s payment history for invoices with the same amount, date, or invoice number.',
      'Stamp invoices "PAID" with the check number and date immediately after payment is processed.',
      'Run a duplicate payment report from your accounting system at least quarterly.',
      'If a duplicate is discovered, contact the vendor for a refund and document the resolution.',
    ],
    whatToHaveReady: [
      'Vendor payment history reports showing no duplicate invoice numbers',
      'Invoices stamped as paid with check numbers',
      'Quarterly duplicate payment analysis reports (if produced)',
      'Documentation of any duplicate payments discovered and resolved',
    ],
    resources: [
      { label: 'SAO Audit Report Search', url: 'https://portal.sao.wa.gov/ReportSearch' },
    ],
  },

  'Vendor payments are timely (no late fees or finance charges)': {
    whyItMatters:
      'Late fees and finance charges are a waste of public funds. When the SAO finds late fees in your check register, it indicates poor cash management or processing delays. While occasional late fees may not become a formal finding, a pattern of them signals that your accounts payable process needs improvement. It also affects vendor relationships and can result in service disruptions.',
    howToComply: [
      'Process vendor invoices within 5 business days of receipt.',
      'Track invoice due dates and prioritize payments approaching deadlines.',
      'If cash flow is tight (especially during low OSPI payment months), communicate with vendors proactively about payment timing.',
      'Review the check register monthly for any late fee or finance charge line items and investigate the cause.',
    ],
    whatToHaveReady: [
      'Accounts payable aging report showing no past-due invoices',
      'Check register with no late fee or finance charge payments (or documented explanations for any that exist)',
      'Evidence of invoice processing timelines',
    ],
    resources: [
      { label: 'SAO Audit Report Search', url: 'https://portal.sao.wa.gov/ReportSearch' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. WARRANT APPROVAL COMPLIANCE
  // ═══════════════════════════════════════════════════════════════════════════

  'AP warrants approved by board monthly per RCW 42.24.080': {
    whyItMatters:
      'RCW 42.24.080 requires that all claims against the school (accounts payable) be audited and approved by the board before payment, or ratified at the next board meeting if paid under an advance approval process. The SAO checks board minutes for every month to confirm this happened. Missing a single month of warrant approval is a compliance finding. It\'s one of the most straightforward requirements but one of the most frequently missed.',
    howToComply: [
      'Include an AP warrant approval item on every regular board meeting agenda.',
      'Prepare a warrant register listing all AP payments with vendor names, amounts, and voucher numbers for board review.',
      'Have the board formally vote to approve the warrant register and record the vote in the minutes.',
      'If the board uses an advance approval process (paying before the meeting), the warrants must be ratified at the next meeting.',
      'Never skip warrant approval even if the board meeting is short — it\'s a legal requirement.',
    ],
    whatToHaveReady: [
      'Board meeting minutes showing AP warrant approval for each month of the fiscal year',
      'AP warrant registers as presented to the board (with voucher numbers and vendor names)',
      'Board resolution or policy establishing the warrant approval process',
      'Documentation of any months where warrants were paid in advance and ratified later',
    ],
    resources: [
      { label: 'RCW 42.24.080 — AP Warrant Approval', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.24.080' },
      { label: 'RCW 42.24 — Full Chapter', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.24' },
      { label: 'SAO Audit Report Search', url: 'https://portal.sao.wa.gov/ReportSearch' },
    ],
  },

  'Payroll warrants approved by board monthly per RCW 42.24.090': {
    whyItMatters:
      'RCW 42.24.090 has the same requirement for payroll that 42.24.080 has for AP — the board must approve payroll warrants. The SAO checks that payroll was formally approved by the board each month. Since payroll is typically the largest expenditure (60-80% of a charter school\'s budget), this approval is critical oversight. It\'s often missed because boards assume payroll is "automatic" and doesn\'t need explicit approval.',
    howToComply: [
      'Include a payroll warrant approval item on every board meeting agenda — separate from AP warrants.',
      'Prepare a payroll summary showing total gross payroll, benefits, and net disbursements for board review.',
      'Have the board formally vote to approve payroll warrants and record the vote in minutes.',
      'If payroll is processed before the board meeting (as it usually is), the board must ratify at the next meeting.',
    ],
    whatToHaveReady: [
      'Board meeting minutes showing payroll warrant approval for each month',
      'Payroll warrant summaries as presented to the board',
      'Board resolution or policy establishing the payroll approval process',
    ],
    resources: [
      { label: 'RCW 42.24.090 — Payroll Warrant Approval', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.24.090' },
      { label: 'RCW 42.24 — Full Chapter', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.24' },
    ],
  },

  'Warrant documentation includes voucher numbers and vendor names': {
    whyItMatters:
      'The SAO expects warrant documentation to be specific enough that any board member could identify what was paid and to whom. Warrant registers that show only total amounts without vendor names or voucher numbers don\'t give the board meaningful oversight. Auditors check that the documentation presented to the board had sufficient detail for informed approval.',
    howToComply: [
      'Format your warrant register to include: voucher/check number, vendor name, description or account code, and amount for each payment.',
      'For large warrant runs, organize by category (utilities, curriculum, contracted services) to make it easier for board members to review.',
      'Ensure the total on the warrant register matches the total approved in the board motion.',
    ],
    whatToHaveReady: [
      'Warrant registers with full detail: voucher numbers, vendor names, descriptions, and amounts',
      'Board meeting minutes referencing the specific warrant register approved',
      'Sample warrant register showing the format used for board presentation',
    ],
    resources: [
      { label: 'RCW 42.24 — Warrant Requirements', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.24' },
    ],
  },

  'Warrant register is maintained with sequential numbering': {
    whyItMatters:
      'Sequential numbering ensures that no warrants can be inserted or removed without detection. The SAO checks for gaps in the sequence — a missing number could indicate an unauthorized payment or a destroyed check. The warrant register is the school\'s official record of every payment made, and sequential integrity is a basic internal control.',
    howToComply: [
      'Use pre-numbered checks or configure your accounting system to assign sequential warrant numbers automatically.',
      'Account for every warrant number in the register — including voided warrants.',
      'If a check is voided, mark it VOID in the register and retain the physical check (or document the void in the system).',
      'Never manually override or skip warrant numbers.',
    ],
    whatToHaveReady: [
      'Complete warrant register showing sequential numbering with no unexplained gaps',
      'Voided warrant documentation for any gaps in the sequence',
      'Bank reconciliation showing all warrant numbers matched to cleared checks',
    ],
    resources: [
      { label: 'SAO Best Practices — Internal Controls', url: 'https://portal.sao.wa.gov/ReportSearch' },
    ],
  },

  'Void warrants are documented with reason and board notification': {
    whyItMatters:
      'When a check is voided after being issued, the SAO wants to see documentation of why it was voided and evidence that the board was informed. Voided warrants without documentation are a red flag for auditors because they could indicate that a payment was made, the check was intercepted, and then the void was used to hide the transaction. Proper documentation removes suspicion.',
    howToComply: [
      'Document the reason for every void in your accounting system and on the physical check stub.',
      'Report voided warrants to the board as part of the monthly warrant approval process.',
      'Retain voided checks with "VOID" written across the face, or document electronic voids with screenshots.',
      'Ensure voided amounts are reversed in your accounting system and the bank reconciliation reflects the void.',
    ],
    whatToHaveReady: [
      'List of all voided warrants with reasons documented',
      'Physical voided checks or electronic void documentation',
      'Board meeting minutes showing void warrants were reported',
      'Bank reconciliation showing voided warrants properly accounted for',
    ],
    resources: [
      { label: 'RCW 42.24 — Warrant Requirements', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.24' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CATEGORICAL FUND COMPLIANCE
  // ═══════════════════════════════════════════════════════════════════════════

  'Categorical funds tracked in separate accounts per OSPI fund accounting': {
    whyItMatters:
      'WA state law requires that categorical funds (Title I, LAP, SpEd, etc.) be tracked separately from general funds. The SAO checks your chart of accounts to verify that restricted funds have their own fund codes and that transactions are properly coded. If categorical funds are mixed into the general fund, auditors can\'t verify that restricted dollars were spent on allowable purposes — which becomes a compliance finding.',
    howToComply: [
      'Set up separate fund codes in your accounting system for each categorical program (Title I, Title II, LAP, SpEd, etc.).',
      'Code every transaction to the correct fund at the time of entry — not in a batch at year-end.',
      'Run monthly fund balance reports to verify that each categorical fund has a positive balance (you can\'t spend categorical funds before receiving them without a cash flow arrangement).',
      'Ensure your chart of accounts follows OSPI\'s Accounting Manual for Public School Districts.',
    ],
    whatToHaveReady: [
      'Chart of accounts showing separate fund codes for each categorical program',
      'Fund balance reports for each categorical fund by month',
      'Trial balance showing categorical fund activity segregated from general fund',
      'OSPI grant award letters matched to fund codes in your system',
    ],
    resources: [
      { label: 'OSPI S-275 / SAFS Resources', url: 'https://www.k12.wa.us/safs/' },
      { label: 'OSPI Accounting Manual', url: 'https://ospi.k12.wa.us/policy-funding/school-apportionment/school-apportionment-and-financial-services' },
    ],
  },

  'Expenditures match approved fund purposes and grant agreements': {
    whyItMatters:
      'Every dollar of categorical funding comes with strings attached — specific allowable uses defined in the grant agreement and federal/state law. The SAO samples transactions from each categorical fund and checks whether the expenditure is allowable under the grant purpose. Buying general classroom supplies with Title I funds, for example, when they aren\'t serving eligible students, is a questioned cost that may need to be returned.',
    howToComply: [
      'Before making any purchase from a categorical fund, verify the expense is allowable under the grant agreement and the applicable federal/state cost principles.',
      'Maintain a summary of allowable and unallowable expenses for each grant, accessible to anyone who makes purchases.',
      'Have the program director approve expenditures from their categorical fund before processing.',
      'If in doubt about whether an expense is allowable, contact your OSPI program officer before spending.',
    ],
    whatToHaveReady: [
      'Grant agreements for each categorical fund showing allowable purposes',
      'Transaction detail for each categorical fund with expenditure descriptions',
      'Documentation showing program director approval for categorical expenditures',
      'Any guidance or approval from OSPI on expenditures that were borderline allowable',
    ],
    resources: [
      { label: 'OSPI Grant Management', url: 'https://ospi.k12.wa.us/policy-funding/grants-grant-management' },
      { label: 'WA Charter School Commission — Oversight', url: 'https://charterschool.wa.gov/oversight-accountability/' },
    ],
  },

  'No commingling of categorical and general funds': {
    whyItMatters:
      'Commingling occurs when categorical (restricted) funds are deposited into or spent from the general fund bank account without proper accounting separation. Even if your accounting system tracks funds separately, if the actual bank accounts mix restricted and unrestricted money without clear tracking, auditors consider it commingling. This is a serious finding because it makes it impossible to verify that restricted funds were used properly.',
    howToComply: [
      'Either maintain separate bank accounts for categorical funds or ensure your accounting system provides clear fund-level tracking within a pooled account.',
      'If using pooled banking, maintain a cash reconciliation by fund showing that each fund\'s calculated cash balance can be supported by the pooled bank balance.',
      'Never transfer categorical funds to cover general fund shortfalls.',
      'Ensure bank deposits are coded to the correct fund at the time of deposit.',
    ],
    whatToHaveReady: [
      'Bank reconciliations showing fund-level cash balances',
      'If using separate bank accounts: statements for each categorical fund account',
      'If using pooled banking: cash reconciliation by fund showing the pool supports all fund balances',
      'Evidence that no interfund transfers occurred without proper authorization and repayment',
    ],
    resources: [
      { label: 'OSPI Accounting Manual', url: 'https://ospi.k12.wa.us/policy-funding/school-apportionment/school-apportionment-and-financial-services' },
    ],
  },

  'Quarterly spending reports filed on time with OSPI': {
    whyItMatters:
      'Most categorical grants require quarterly or periodic spending reports to OSPI. The SAO checks whether these reports were filed on time and whether the amounts match your accounting records. Late or inaccurate reports indicate poor grant management and can result in delayed reimbursements or loss of future funding. It\'s also a compliance requirement of the grant itself.',
    howToComply: [
      'Maintain a calendar of all grant reporting deadlines for the fiscal year.',
      'Prepare reports at least one week before the deadline to allow time for review.',
      'Reconcile reported amounts against your accounting system before submitting.',
      'Keep copies of submitted reports with confirmation of on-time submission.',
    ],
    whatToHaveReady: [
      'Copies of all quarterly spending reports submitted to OSPI',
      'Submission confirmations (email receipts, iGrants confirmation pages)',
      'Calendar showing all grant reporting deadlines and dates reports were submitted',
      'Reconciliation between reported amounts and accounting system totals',
    ],
    resources: [
      { label: 'OSPI iGrants', url: 'https://eds.ospi.k12.wa.us/iGrants/' },
      { label: 'OSPI Grant Management', url: 'https://ospi.k12.wa.us/policy-funding/grants-grant-management' },
    ],
  },

  'Carryover amounts documented and approved by grantor': {
    whyItMatters:
      'When categorical funds aren\'t fully spent by year-end, the remaining balance doesn\'t automatically carry over. Most grants require specific approval to carry over unspent funds, and there are often limits on how much can be carried forward. The SAO checks whether carryover amounts were properly approved and documented. Unauthorized carryover can result in the school being required to return the funds.',
    howToComply: [
      'Before year-end, identify any categorical funds that will have remaining balances.',
      'Submit carryover requests to the grantor (usually OSPI) before the applicable deadline.',
      'Document the approved carryover amount and the conditions for spending it in the new year.',
      'Track carryover funds separately in the new fiscal year to ensure they\'re spent within the approved timeframe.',
    ],
    whatToHaveReady: [
      'Carryover request documentation submitted to OSPI or other grantors',
      'Grantor approval of carryover amounts',
      'Accounting records showing carryover amounts tracked separately in the new fiscal year',
      'Documentation of how carryover funds were spent in the subsequent year',
    ],
    resources: [
      { label: 'OSPI Grant Management', url: 'https://ospi.k12.wa.us/policy-funding/grants-grant-management' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. OPEN PUBLIC MEETINGS ACT & BOARD GOVERNANCE
  // ═══════════════════════════════════════════════════════════════════════════

  'Board meeting minutes are complete and approved for all meetings this fiscal year': {
    whyItMatters:
      'The Open Public Meetings Act (RCW 42.30) requires that minutes be taken at all board meetings. The SAO checks that minutes exist for every meeting, that they document all actions taken, and that they were formally approved by the board. Missing or incomplete minutes mean there\'s no official record of what the board decided. For financial audits specifically, auditors look for budget approvals, warrant approvals, and contract authorizations in the minutes.',
    howToComply: [
      'Take minutes at every board meeting (regular, special, and committee meetings where action is taken).',
      'Minutes should document: attendance, motions made, who moved and seconded, vote results, and a summary of key discussion points.',
      'Present draft minutes for approval at the next regular board meeting.',
      'Maintain a complete chronological file of all approved minutes.',
    ],
    whatToHaveReady: [
      'Approved minutes for every board meeting this fiscal year (regular and special)',
      'Board meeting schedule showing dates of all meetings held',
      'Draft minutes pending approval (for the most recent meeting)',
      'Evidence of minutes being posted publicly (website or other location)',
    ],
    resources: [
      { label: 'RCW 42.30 — Open Public Meetings Act', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.30' },
      { label: 'WA Attorney General OPMA Guide', url: 'https://www.atg.wa.gov/open-government' },
    ],
  },

  'Meeting agendas were posted at least 24 hours in advance per RCW 42.30.077': {
    whyItMatters:
      'RCW 42.30.077 requires that meeting agendas be posted online at least 24 hours before the meeting. The SAO checks for compliance with this posting requirement. If agendas weren\'t posted on time, any actions taken at that meeting could be challenged as invalid. This is especially important for charter schools because public transparency is a condition of the charter.',
    howToComply: [
      'Post meeting agendas on your school website at least 24 hours before each meeting.',
      'Keep a log showing the date and time each agenda was posted.',
      'Include the meeting date, time, location, and a list of all agenda items in the posting.',
      'For special meetings, ensure the 24-hour notice requirement is met from the time of posting to the meeting start.',
    ],
    whatToHaveReady: [
      'Meeting agendas for every board meeting this fiscal year',
      'Evidence of posting (website screenshots with timestamps, or posting log)',
      'Documentation showing agendas were posted at least 24 hours before each meeting',
      'Special meeting notices with posting timestamps',
    ],
    resources: [
      { label: 'RCW 42.30.077 — Agenda Posting', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.30.077' },
      { label: 'RCW 42.30 — Open Public Meetings Act', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.30' },
    ],
  },

  'Executive sessions were properly noticed with specific statutory authority cited': {
    whyItMatters:
      'Executive sessions (closed meetings) are only allowed for specific purposes listed in RCW 42.30.110, such as discussing personnel matters or pending litigation. The SAO checks that every executive session was properly announced with the specific statutory authority cited (not just "personnel matters" but the actual RCW subsection). Improperly noticed executive sessions violate OPMA and can expose the school to legal liability.',
    howToComply: [
      'Before entering executive session, publicly announce the specific RCW 42.30.110 subsection authorizing the session.',
      'State the estimated duration of the executive session.',
      'Do not take any final action during executive session — all votes must occur in open session.',
      'Record in the open session minutes: the time executive session began, the statutory authority cited, the estimated duration, and the time open session resumed.',
    ],
    whatToHaveReady: [
      'Board minutes showing proper executive session notices with RCW citations',
      'Documentation that no action was taken during executive sessions',
      'Records of executive session duration (start and end times)',
    ],
    resources: [
      { label: 'RCW 42.30.110 — Executive Sessions', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.30.110' },
      { label: 'RCW 42.30 — Open Public Meetings Act', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.30' },
      { label: 'WA Attorney General OPMA Guide', url: 'https://www.atg.wa.gov/open-government' },
    ],
  },

  'Conflict of interest disclosures are current for all board members': {
    whyItMatters:
      'The SAO checks that board members have disclosed any potential conflicts of interest, especially financial interests that could affect their votes on school business. If a board member votes on a contract with a company they have a financial interest in, and they didn\'t disclose the conflict, it\'s a finding. For charter schools, this is especially scrutinized because of the potential for self-dealing between the school and its management organization.',
    howToComply: [
      'Require all board members to complete an annual conflict of interest disclosure form.',
      'Review disclosures at the beginning of each fiscal year and update as circumstances change.',
      'When a conflict exists, the board member must recuse themselves from discussion and vote — and the recusal must be documented in minutes.',
      'Maintain a conflict of interest policy approved by the board.',
    ],
    whatToHaveReady: [
      'Signed conflict of interest disclosure forms for each current board member',
      'Board-approved conflict of interest policy',
      'Board minutes showing recusals where conflicts were identified',
      'Annual review documentation showing disclosures were collected and reviewed',
    ],
    resources: [
      { label: 'RCW 42.23 — Code of Ethics for Municipal Officers', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.23' },
      { label: 'WA Charter School Commission — Oversight', url: 'https://charterschool.wa.gov/oversight-accountability/' },
    ],
  },

  'Board has approved all employment contracts for instructional staff': {
    whyItMatters:
      'This overlaps with staff certification compliance but is checked independently as a governance item. The SAO verifies that the board exercised its authority to approve all instructional staff contracts. If the school leader hired teachers without board approval, it indicates weak governance. The finding is about board oversight, not about whether the teachers were qualified.',
    howToComply: [
      'Present all new instructional staff contracts to the board for approval — either individually or on a consent agenda.',
      'For mid-year hires, use interim hiring authority if the board has delegated it, and ratify at the next meeting.',
      'Keep a master list of all board-approved contracts with the date of approval.',
      'Ensure contract renewals are also formally approved by the board each year.',
    ],
    whatToHaveReady: [
      'Board minutes showing approval of each instructional staff contract or renewal',
      'Master list of instructional staff with contract approval dates',
      'Board policy on hiring authority delegation (if interim hires are made between meetings)',
      'Signed employment contracts matching board approvals',
    ],
    resources: [
      { label: 'RCW 28A.405 — Teacher Certification', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.405' },
      { label: 'WA Charter School Commission — Oversight', url: 'https://charterschool.wa.gov/oversight-accountability/' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SEPARATION OF PUBLIC & PRIVATE ACTIVITIES
  // ═══════════════════════════════════════════════════════════════════════════

  'School bank accounts are separate from any private or organizational accounts': {
    whyItMatters:
      'Charter schools that share a management company or CMO sometimes have bank accounts that aren\'t clearly separated from the private organization\'s accounts. The SAO checks that the school\'s public funds are held in accounts owned by the school entity — not by a parent organization, CMO, or related party. If public funds flow through a private entity\'s accounts, it\'s a serious finding because it undermines public accountability for those funds.',
    howToComply: [
      'Ensure all school bank accounts are in the name of the charter school entity — not the CMO, board chair, or any other party.',
      'Verify that only authorized school employees or board-approved signers have access to school accounts.',
      'If the school shares back-office services with a CMO, maintain a clear service agreement that specifies the school retains control of its funds.',
      'Conduct an annual review of all bank accounts to confirm ownership and authorized signers are current.',
    ],
    whatToHaveReady: [
      'Bank signature cards showing accounts are in the school\'s name',
      'List of all bank accounts with authorized signers',
      'Board resolution designating authorized bank signers',
      'Service agreement with CMO/management company (if applicable) showing separation of funds',
    ],
    resources: [
      { label: 'WA Charter School Commission — Oversight', url: 'https://charterschool.wa.gov/oversight-accountability/' },
      { label: 'RCW 28A.710 — Charter Schools', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.710' },
    ],
  },

  'Fundraising revenue is properly tracked and deposited to school accounts': {
    whyItMatters:
      'The SAO checks that all fundraising revenue — from events, donations, and parent organizations — is properly deposited into the school\'s official bank account and tracked in the school\'s accounting system. Money raised in the school\'s name is public money. If fundraising proceeds go into a parent organization\'s account or aren\'t properly receipted, there\'s no public accountability for those funds. Several charter schools have had findings related to unclear handling of fundraised money.',
    howToComply: [
      'Deposit all fundraising revenue into the school\'s bank account within 24 hours of receipt.',
      'Issue receipts for all cash and check donations.',
      'If a parent organization (PTO/PTA) raises funds for the school, require them to transfer funds to the school\'s account with documentation of the purpose.',
      'Track all fundraising revenue and expenses in the school\'s accounting system with a separate activity or fund code.',
    ],
    whatToHaveReady: [
      'Deposit records for all fundraising revenue',
      'Donation receipts issued to donors',
      'Accounting records showing fundraising revenue coded to appropriate accounts',
      'Agreements with parent organizations regarding fundraised money handling',
    ],
    resources: [
      { label: 'SAO Audit Report Search', url: 'https://portal.sao.wa.gov/ReportSearch' },
      { label: 'RCW 28A.710 — Charter Schools', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.710' },
    ],
  },

  'School assets are not commingled with private assets': {
    whyItMatters:
      'If the school shares space with or is managed by a private organization, the SAO checks that school-purchased assets (furniture, equipment, technology) are clearly identified as school property. If the school closes or changes management, there needs to be a clear record of what belongs to the public entity. Asset commingling makes it impossible to determine what the public paid for.',
    howToComply: [
      'Tag all school-purchased assets with identification labels showing they are school property.',
      'Maintain a separate asset inventory for the school that doesn\'t include privately owned items.',
      'If sharing space with a private entity, create a clear written agreement about asset ownership.',
      'When disposing of assets, follow public surplus property procedures.',
    ],
    whatToHaveReady: [
      'Asset inventory listing all school-owned property with purchase dates and costs',
      'Asset tags or labels on physical equipment',
      'Facility use agreement showing asset ownership terms (if sharing space)',
      'Surplus property disposal records',
    ],
    resources: [
      { label: 'WA Charter School Commission — Oversight', url: 'https://charterschool.wa.gov/oversight-accountability/' },
    ],
  },

  'Public records requests have been properly responded to within statutory timeframes': {
    whyItMatters:
      'Charter schools are public agencies subject to the Public Records Act (RCW 42.56). The SAO notes whether the school has responded to public records requests within 5 business days as required. Failure to respond or excessive delays can result in legal penalties and indicates poor administrative practices. Some charter school authorizers also review records request compliance as part of their oversight.',
    howToComply: [
      'Designate a public records officer for the school.',
      'Respond to all records requests within 5 business days — even if the response is that you need additional time.',
      'Maintain a log of all records requests received, including the date received, date responded, and outcome.',
      'Train staff on what constitutes a public records request (they don\'t have to use those exact words).',
    ],
    whatToHaveReady: [
      'Public records request log showing all requests and response dates',
      'Copies of response letters for all requests',
      'Board-approved public records policy',
      'Designation of public records officer',
    ],
    resources: [
      { label: 'RCW 42.56 — Public Records Act', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.56' },
      { label: 'WA Attorney General Public Records Guide', url: 'https://www.atg.wa.gov/open-government' },
    ],
  },

  'Management company or CMO transactions are at arms-length with board approval': {
    whyItMatters:
      'If your school contracts with a Charter Management Organization or management company, the SAO examines those transactions closely. The concern is self-dealing — the management company charging excessive fees or receiving preferential treatment. All transactions between the school and its management company must be at arms-length (fair market value), approved by the board, and documented. This is one of the most scrutinized areas for charter schools with management agreements.',
    howToComply: [
      'Ensure the management agreement was competitively procured or that the board documented why sole-source was appropriate.',
      'Have the board formally approve the management agreement and any amendments.',
      'Review management fees annually to ensure they\'re at fair market value.',
      'Board members with connections to the management company must recuse themselves from votes on the agreement.',
      'Maintain clear documentation of all payments to the management company with service descriptions.',
    ],
    whatToHaveReady: [
      'Management company agreement with board approval documentation',
      'Evidence of competitive procurement or sole-source justification',
      'Payment records to management company with service descriptions',
      'Board minutes showing approval of management agreement and any amendments',
      'Conflict of interest recusals for board members connected to the management company',
    ],
    resources: [
      { label: 'WA Charter School Commission — Oversight', url: 'https://charterschool.wa.gov/oversight-accountability/' },
      { label: 'RCW 28A.710 — Charter Schools', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.710' },
      { label: 'RCW 42.23 — Code of Ethics', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=42.23' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. THEFT-SENSITIVE ASSET TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  'Inventory of computers, tablets, and electronic equipment is current': {
    whyItMatters:
      'The SAO classifies computers, tablets, and electronic equipment as "theft-sensitive assets" that require tracking regardless of cost. Schools that can\'t account for their technology inventory demonstrate weak safeguarding of public assets. With charter schools receiving significant technology funding, auditors expect a current inventory showing what was purchased, where it is, and who has it.',
    howToComply: [
      'Maintain an inventory spreadsheet or asset management system listing every computer, tablet, Chromebook, and electronic device.',
      'Include: asset tag number, description, serial number, purchase date, cost, location, and assigned user.',
      'Update the inventory when new equipment is purchased, transferred, or disposed of.',
      'Conduct a physical count at least annually to verify the inventory is accurate.',
    ],
    whatToHaveReady: [
      'Current technology inventory listing all devices with serial numbers, locations, and assigned users',
      'Purchase records for technology acquired this fiscal year',
      'Most recent physical inventory count results with reconciliation to the master list',
      'Documentation of any lost, stolen, or damaged equipment',
    ],
    resources: [
      { label: 'SAO Best Practices — Asset Management', url: 'https://portal.sao.wa.gov/ReportSearch' },
    ],
  },

  'All assets over $500 are tagged and tracked in an asset management system': {
    whyItMatters:
      'WA public entities are expected to track all assets above a reasonable capitalization threshold (typically $500 for theft-sensitive items, $5,000 for general capital assets). The SAO checks that these assets are tagged with an identifying number and tracked in a system. Without tagging, there\'s no way to verify during a physical inventory that an item is the same one that was purchased. Untagged assets are easily lost, stolen, or misappropriated.',
    howToComply: [
      'Establish a capitalization/tracking threshold in your fiscal policies (recommended: $500 for electronics, $5,000 for other assets).',
      'Assign a unique asset tag number to each tracked item and physically affix a label to the asset.',
      'Record tagged assets in your asset management system with the tag number, description, cost, and location.',
      'Tag items immediately upon receipt — before deploying them to classrooms or offices.',
    ],
    whatToHaveReady: [
      'Board-approved capitalization policy specifying tracking thresholds',
      'Asset management system or spreadsheet with all tagged assets',
      'Evidence of physical asset tags on equipment',
      'Purchase records matched to asset inventory entries',
    ],
    resources: [
      { label: 'SAO Best Practices — Asset Management', url: 'https://portal.sao.wa.gov/ReportSearch' },
      { label: 'GASB 34 Capital Asset Reporting', url: 'https://gasb.org/page/PageContent?pageId=/standards-guidance/pronouncements/summary--statement-no-34.html' },
    ],
  },

  'Annual physical inventory has been completed and reconciled': {
    whyItMatters:
      'A physical inventory verifies that the assets on your books actually exist and are in the locations your records show. The SAO expects an annual physical count, especially for theft-sensitive items like technology. If your inventory records say you have 200 Chromebooks but a physical count only finds 185, you have 15 missing devices and a finding for inadequate asset safeguarding.',
    howToComply: [
      'Schedule an annual physical inventory (ideally at year-end or during summer when devices are returned).',
      'Have someone other than the person responsible for the assets conduct or assist with the count.',
      'Compare the physical count to your asset inventory records and investigate any discrepancies.',
      'Update the inventory records after the count to reflect actual status (found, missing, damaged, surplus).',
      'Report results to the board, including any missing or unaccounted-for items.',
    ],
    whatToHaveReady: [
      'Physical inventory count sheets or scan records with date of count',
      'Reconciliation report comparing physical count to asset records',
      'Documentation of how discrepancies were investigated and resolved',
      'Board report on inventory results (especially any missing items)',
    ],
    resources: [
      { label: 'SAO Best Practices — Asset Management', url: 'https://portal.sao.wa.gov/ReportSearch' },
    ],
  },

  'Surplus or disposed assets are documented with board approval': {
    whyItMatters:
      'When a school disposes of public assets — sells old equipment, donates broken computers, or sends items to recycling — the SAO checks that the disposal was properly authorized and documented. Disposing of public assets without board approval and documentation creates an accountability gap. The concern is that items could be diverted for personal use under the guise of disposal.',
    howToComply: [
      'Present a list of surplus assets to the board for approval before disposal.',
      'Document how each item was disposed of (sold, donated, recycled, destroyed) and to whom.',
      'For items with resale value, follow public surplus procedures (advertising, competitive bids, or use of surplus property services).',
      'Remove disposed assets from your asset inventory and note the disposal date and method.',
    ],
    whatToHaveReady: [
      'Board minutes showing approval of surplus asset disposals',
      'Disposal records for each item: method, date, recipient (if sold/donated), and proceeds (if sold)',
      'Asset inventory showing removed items with disposal documentation',
      'Revenue records for any proceeds from surplus sales',
    ],
    resources: [
      { label: 'RCW 28A.335.180 — Surplus School Property', url: 'https://app.leg.wa.gov/rcw/default.aspx?cite=28A.335.180' },
      { label: 'SAO Audit Report Search', url: 'https://portal.sao.wa.gov/ReportSearch' },
    ],
  },

  'Staff-assigned devices have signed checkout agreements on file': {
    whyItMatters:
      'When staff take school devices home or use them outside the building, the school needs documentation showing who has what. The SAO checks for checkout agreements because they establish accountability — if a device goes missing, the school knows who had it last. Without checkout agreements, the school has no way to recover lost assets or hold anyone responsible.',
    howToComply: [
      'Create a device checkout agreement form that includes: device description, serial number, asset tag, condition at checkout, and the staff member\'s acknowledgment of responsibility.',
      'Require staff to sign a checkout agreement before taking any school device off-premises.',
      'Maintain signed agreements in a central file accessible to the business manager.',
      'When staff return devices (at year-end or upon departure), document the return and condition.',
    ],
    whatToHaveReady: [
      'Signed device checkout agreements for each staff-assigned device',
      'Log of devices checked out with staff names, dates, and device identifiers',
      'Device return documentation for staff who returned or left the school',
      'Template checkout agreement form',
    ],
    resources: [
      { label: 'SAO Best Practices — Asset Management', url: 'https://portal.sao.wa.gov/ReportSearch' },
    ],
  },
}

export function getChecklistItemDetail(itemText: string): ChecklistItemDetail | undefined {
  return CHECKLIST_DETAILS[itemText]
}
