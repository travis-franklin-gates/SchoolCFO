import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getFiscalMonths, fiscalIndexFromKey } from '@/lib/fiscalYear'

// Pure data analysis — no Claude API call needed.
// Reads school data from Supabase and determines checklist item status.

export type ItemStatus = 'verified' | 'warning' | 'action' | 'manual'

export interface ComplianceItem {
  item: string
  category: string
  status: ItemStatus
  reason: string
}

export interface ComplianceResult {
  items: ComplianceItem[]
  summary: {
    verified: number
    warning: number
    action: number
    manual: number
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, activeMonth } = (await req.json()) as {
      schoolId: string
      activeMonth: string
    }

    if (!schoolId) {
      return NextResponse.json({ error: 'Missing schoolId' }, { status: 400 })
    }

    const supabase = await createClient()
    const items: ComplianceItem[] = []

    // ── Fetch school data ──────────────────────────────────────────────────

    // Board packets — check warrant approval coverage
    const { data: packets } = await supabase
      .from('board_packets')
      .select('month_key, status')
      .eq('school_id', schoolId)

    const packetMonths = new Set((packets ?? []).map((p) => p.month_key as string))
    const finalizedMonths = new Set(
      (packets ?? []).filter((p) => p.status === 'finalized').map((p) => p.month_key as string)
    )

    // Monthly snapshots — check upload frequency
    const { data: snapshots } = await supabase
      .from('monthly_snapshots')
      .select('month_key, created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })

    const uploadedMonths = new Set((snapshots ?? []).map((s) => s.month_key as string))
    const latestUpload = snapshots?.[0]?.created_at ?? null

    // Grants — check categorical fund status
    const { data: grants } = await supabase
      .from('grants')
      .select('*')
      .eq('school_id', schoolId)

    const categoricalGrants = (grants ?? []).filter((g) => g.grant_type === 'categorical')

    // Alerts
    const { data: alerts } = await supabase
      .from('monthly_snapshots')
      .select('financial_summary')
      .eq('school_id', schoolId)
      .eq('month_key', activeMonth)
      .single()

    const financialSummary = alerts?.financial_summary as Record<string, unknown> | null
    const storedAlerts = (financialSummary?.alerts as Array<{ severity: string; message: string }>) ?? []

    // ── 1. STAFF CERTIFICATION ──────────────────────────────────────────────
    // No staff_members table exists yet — all items are manual review

    items.push(
      { item: 'All instructional staff hold current WA teaching certificates or OSPI-issued permits', category: 'staff_certification', status: 'manual', reason: 'Staff certification records not yet tracked in SchoolCFO. Verify via OSPI E-Certification.' },
      { item: 'S-275 personnel report accurately reflects staff certification status', category: 'staff_certification', status: 'manual', reason: 'S-275 data not imported. Cross-reference OSPI submission with your payroll register.' },
      { item: 'Special education staff hold valid SpEd endorsements or pre-endorsement authorization', category: 'staff_certification', status: 'manual', reason: 'SpEd endorsement tracking requires staff records. Check OSPI E-Certification for each SpEd staff member.' },
      { item: 'All instructional staff contracts have been approved by the Board', category: 'staff_certification', status: 'manual', reason: 'Contract approval tracking requires board minutes review. Check each meeting for consent agenda items.' },
      { item: 'Paraeducator certificates are current per HB 1115 requirements', category: 'staff_certification', status: 'manual', reason: 'Paraeducator records not tracked. Verify via OSPI E-Certification for all classified instructional staff.' },
    )

    // ── 2. ENROLLMENT REPORTING ─────────────────────────────────────────────

    const fiscalMonths = getFiscalMonths()
    const currentIdx = fiscalIndexFromKey(activeMonth)
    const expectedMonths = fiscalMonths.filter((fm) => fm.fiscalIndex <= currentIdx)
    const missingUploadMonths = expectedMonths.filter((fm) => !uploadedMonths.has(fm.key))

    if (missingUploadMonths.length === 0) {
      items.push({ item: 'Student enrollment count date documentation is complete for each month', category: 'enrollment_reporting', status: 'verified', reason: `Financial data uploaded for all ${currentIdx} months of the fiscal year to date.` })
    } else if (missingUploadMonths.length <= 2) {
      items.push({ item: 'Student enrollment count date documentation is complete for each month', category: 'enrollment_reporting', status: 'warning', reason: `Missing data for ${missingUploadMonths.map((m) => m.label).join(', ')}. Upload these months to ensure enrollment documentation is complete.` })
    } else {
      items.push({ item: 'Student enrollment count date documentation is complete for each month', category: 'enrollment_reporting', status: 'action', reason: `Missing data for ${missingUploadMonths.length} of ${currentIdx} months: ${missingUploadMonths.map((m) => m.shortLabel).join(', ')}. Significant enrollment documentation gaps.` })
    }

    items.push(
      { item: 'Special education students have current IEPs and evaluations on file', category: 'enrollment_reporting', status: 'manual', reason: 'IEP tracking not available in SchoolCFO. Review your SpEd compliance tracker for current IEP and evaluation dates.' },
      { item: 'Special ed students received services on or before each monthly count date', category: 'enrollment_reporting', status: 'manual', reason: 'Service log tracking not available. Review SpEd provider service logs against count dates.' },
    )

    // CEDARS check — based on upload regularity
    if (missingUploadMonths.length === 0) {
      items.push({ item: 'CEDARS enrollment data matches actual student roster', category: 'enrollment_reporting', status: 'verified', reason: 'Monthly data is current and complete — verify CEDARS submissions match these records.' })
    } else {
      items.push({ item: 'CEDARS enrollment data matches actual student roster', category: 'enrollment_reporting', status: 'warning', reason: 'Data gaps make CEDARS reconciliation difficult. Ensure CEDARS submissions cover all months.' })
    }

    // S-275 staff report
    items.push({ item: 'S-275 staff report matches actual employed staff', category: 'enrollment_reporting', status: 'manual', reason: 'S-275 reconciliation requires payroll register comparison. Not available in SchoolCFO.' })

    // ── 3. ACCOUNTS PAYABLE CONTROLS ────────────────────────────────────────
    // These require transaction-level data we don't have

    items.push(
      { item: 'All disbursements have documentation showing goods/services received before payment', category: 'accounts_payable', status: 'manual', reason: 'Disbursement documentation requires invoice-level review. Not tracked in SchoolCFO.' },
      { item: 'Credit card purchases have receipts and business purpose documentation', category: 'accounts_payable', status: 'manual', reason: 'Credit card receipt tracking not available. Review monthly statements and attached documentation.' },
      { item: 'Electronic funds transfers have dual authorization', category: 'accounts_payable', status: 'manual', reason: 'EFT authorization configuration is managed at the bank level. Verify with your bank.' },
      { item: 'No duplicate payments to vendors in current fiscal year', category: 'accounts_payable', status: 'manual', reason: 'Duplicate payment detection requires transaction-level data. Run a duplicate check from your accounting system.' },
      { item: 'Vendor payments are timely (no late fees or finance charges)', category: 'accounts_payable', status: 'manual', reason: 'Late fee detection requires transaction-level data. Review check register for finance charge entries.' },
    )

    // ── 4. WARRANT APPROVAL ─────────────────────────────────────────────────

    const missingPacketMonths = expectedMonths.filter((fm) => !packetMonths.has(fm.key))

    if (missingPacketMonths.length === 0) {
      items.push({ item: 'AP warrants approved by board monthly per RCW 42.24.080', category: 'warrant_approval', status: 'verified', reason: `Board packets exist for all ${currentIdx} fiscal months to date. Verify each contains AP warrant approval in minutes.` })
      items.push({ item: 'Payroll warrants approved by board monthly per RCW 42.24.090', category: 'warrant_approval', status: 'verified', reason: `Board packets exist for all ${currentIdx} fiscal months to date. Verify each contains payroll warrant approval.` })
    } else if (missingPacketMonths.length <= 2) {
      items.push({ item: 'AP warrants approved by board monthly per RCW 42.24.080', category: 'warrant_approval', status: 'warning', reason: `Missing board packets for ${missingPacketMonths.map((m) => m.label).join(', ')}. Generate these to document warrant approval.` })
      items.push({ item: 'Payroll warrants approved by board monthly per RCW 42.24.090', category: 'warrant_approval', status: 'warning', reason: `Missing board packets for ${missingPacketMonths.map((m) => m.label).join(', ')}.` })
    } else {
      items.push({ item: 'AP warrants approved by board monthly per RCW 42.24.080', category: 'warrant_approval', status: 'action', reason: `Missing board packets for ${missingPacketMonths.length} of ${currentIdx} months. SAO will flag each missing month as a finding.` })
      items.push({ item: 'Payroll warrants approved by board monthly per RCW 42.24.090', category: 'warrant_approval', status: 'action', reason: `Missing board packets for ${missingPacketMonths.length} months. Each gap is a separate audit finding.` })
    }

    items.push(
      { item: 'Warrant documentation includes voucher numbers and vendor names', category: 'warrant_approval', status: 'manual', reason: 'Warrant register detail level requires document review. Check that registers include voucher numbers.' },
      { item: 'Warrant register is maintained with sequential numbering', category: 'warrant_approval', status: 'manual', reason: 'Sequential numbering verification requires check register review.' },
      { item: 'Void warrants are documented with reason and board notification', category: 'warrant_approval', status: 'manual', reason: 'Void warrant documentation requires accounting system review.' },
    )

    // ── 5. CATEGORICAL FUND COMPLIANCE ──────────────────────────────────────

    const hasCategoricalGrants = categoricalGrants.length > 0
    const categoricalAlerts = storedAlerts.filter((a) =>
      /title|idea|sped|lap|tbip|categorical|grant/i.test(a.message)
    )

    if (hasCategoricalGrants && categoricalAlerts.length === 0) {
      items.push({ item: 'Categorical funds tracked in separate accounts per OSPI fund accounting', category: 'categorical_fund', status: 'verified', reason: `${categoricalGrants.length} categorical grants tracked with no active alerts.` })
    } else if (categoricalAlerts.length > 0) {
      items.push({ item: 'Categorical funds tracked in separate accounts per OSPI fund accounting', category: 'categorical_fund', status: 'warning', reason: `${categoricalAlerts.length} alert(s) related to categorical funds detected. Review grant spending patterns.` })
    } else {
      items.push({ item: 'Categorical funds tracked in separate accounts per OSPI fund accounting', category: 'categorical_fund', status: 'manual', reason: 'No categorical grant data found. Upload grant information in Settings.' })
    }

    items.push(
      { item: 'Expenditures match approved fund purposes and grant agreements', category: 'categorical_fund', status: 'manual', reason: 'Expenditure-to-purpose matching requires transaction review against grant agreements.' },
      { item: 'No commingling of categorical and general funds', category: 'categorical_fund', status: 'manual', reason: 'Commingling detection requires bank account and fund-level accounting review.' },
      { item: 'Quarterly spending reports filed on time with OSPI', category: 'categorical_fund', status: 'manual', reason: 'OSPI reporting schedule tracking not available. Check iGrants submission history.' },
      { item: 'Carryover amounts documented and approved by grantor', category: 'categorical_fund', status: 'manual', reason: 'Carryover documentation requires grant agreement and OSPI approval review.' },
    )

    // ── 6. OPEN PUBLIC MEETINGS ─────────────────────────────────────────────

    // Can partially verify from board packet data
    const allFinalizedPackets = expectedMonths.every((fm) => finalizedMonths.has(fm.key))

    items.push({
      item: 'Board meeting minutes are complete and approved for all meetings this fiscal year',
      category: 'open_meetings',
      status: allFinalizedPackets ? 'verified' : finalizedMonths.size > 0 ? 'warning' : 'action',
      reason: allFinalizedPackets
        ? `Board packets finalized for all ${currentIdx} months — minutes should be documented in each.`
        : `Only ${finalizedMonths.size} of ${currentIdx} months have finalized board packets. Complete and finalize missing months.`,
    })

    items.push(
      { item: 'Meeting agendas were posted at least 24 hours in advance per RCW 42.30.077', category: 'open_meetings', status: 'manual', reason: 'Agenda posting verification requires website posting log or screenshots with timestamps.' },
      { item: 'Executive sessions were properly noticed with specific statutory authority cited', category: 'open_meetings', status: 'manual', reason: 'Executive session compliance requires board minutes review for proper RCW 42.30.110 citations.' },
      { item: 'Conflict of interest disclosures are current for all board members', category: 'open_meetings', status: 'manual', reason: 'COI disclosure tracking not available. Collect annual disclosure forms from all board members.' },
      { item: 'Board has approved all employment contracts for instructional staff', category: 'open_meetings', status: 'manual', reason: 'Contract approval requires board minutes review. Check consent agenda items.' },
    )

    // ── 7. SEPARATION OF PUBLIC & PRIVATE ───────────────────────────────────

    items.push(
      { item: 'School bank accounts are separate from any private or organizational accounts', category: 'separation_public_private', status: 'manual', reason: 'Bank account separation requires signature card and account ownership review.' },
      { item: 'Fundraising revenue is properly tracked and deposited to school accounts', category: 'separation_public_private', status: 'manual', reason: 'Fundraising tracking requires deposit record review.' },
      { item: 'School assets are not commingled with private assets', category: 'separation_public_private', status: 'manual', reason: 'Asset separation requires inventory comparison with any private or CMO-owned items.' },
      { item: 'Public records requests have been properly responded to within statutory timeframes', category: 'separation_public_private', status: 'manual', reason: 'PRR compliance requires request log review. Maintain a log of all requests and response dates.' },
      { item: 'Management company or CMO transactions are at arms-length with board approval', category: 'separation_public_private', status: 'manual', reason: 'CMO transaction review requires contract and payment documentation.' },
    )

    // ── 8. ASSET TRACKING ───────────────────────────────────────────────────

    items.push(
      { item: 'Inventory of computers, tablets, and electronic equipment is current', category: 'asset_tracking', status: 'manual', reason: 'Asset inventory not tracked in SchoolCFO. Maintain a spreadsheet or asset management system.' },
      { item: 'All assets over $500 are tagged and tracked in an asset management system', category: 'asset_tracking', status: 'manual', reason: 'Asset tagging verification requires physical inspection of equipment.' },
      { item: 'Annual physical inventory has been completed and reconciled', category: 'asset_tracking', status: 'manual', reason: 'Physical inventory completion requires count documentation. Schedule before fiscal year-end.' },
      { item: 'Surplus or disposed assets are documented with board approval', category: 'asset_tracking', status: 'manual', reason: 'Surplus disposal requires board minutes and disposal records.' },
      { item: 'Staff-assigned devices have signed checkout agreements on file', category: 'asset_tracking', status: 'manual', reason: 'Device checkout agreements require HR file review.' },
    )

    // ── Write findings to agent_findings ─────────────────────────────────────

    await supabase
      .from('agent_findings')
      .delete()
      .eq('school_id', schoolId)
      .eq('agent_name', 'audit_compliance')

    const findingRows = items
      .filter((i) => i.status !== 'manual') // Only write verified/warning/action to findings
      .map((i) => ({
        school_id: schoolId,
        agent_name: 'audit_compliance',
        finding_type: i.status === 'verified' ? 'audit_verified' : 'audit_gap',
        severity: i.status === 'verified' ? 'info' : i.status === 'warning' ? 'watch' : 'action',
        title: i.item,
        summary: i.reason,
        detail: { category: i.category, status: i.status },
        expires_at: null,
      }))

    if (findingRows.length > 0) {
      const { error } = await supabase.from('agent_findings').insert(findingRows)
      if (error) console.error('[audit-compliance] Insert error:', error)
    }

    const summary = {
      verified: items.filter((i) => i.status === 'verified').length,
      warning: items.filter((i) => i.status === 'warning').length,
      action: items.filter((i) => i.status === 'action').length,
      manual: items.filter((i) => i.status === 'manual').length,
    }

    return NextResponse.json({ items, summary } satisfies ComplianceResult)
  } catch (error) {
    console.error('[audit-compliance]', error)
    return NextResponse.json({ error: 'Audit compliance check failed' }, { status: 500 })
  }
}
