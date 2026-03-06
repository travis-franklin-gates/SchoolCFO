import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ComplianceItem {
  item: string
  category: string
  status: string
  reason: string
}

interface DocGap {
  item: string
  category: string
  documentName: string
  mustContain: string
  prepTimeEstimate: string
  templateAvailable: boolean
  templateNote: string
}

interface FederalFinding {
  severity: string
  title: string
  summary: string
}

export interface ReadinessAssessment {
  score: number
  grade: string
  priorityActions: { action: string; timeEstimate: string; category: string }[]
  executiveSummary: string
  categoryStatus: { category: string; label: string; status: string; itemCount: number; verifiedCount: number; gapCount: number }[]
  estimatedTimeToReady: string
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { schoolName, complianceItems, docGaps, federalFindings } = (await req.json()) as {
      schoolName: string
      complianceItems: ComplianceItem[]
      docGaps: DocGap[]
      federalFindings: FederalFinding[]
    }

    // Build category summary
    const categories = new Map<string, { total: number; verified: number; warning: number; action: number; manual: number }>()
    for (const item of complianceItems) {
      if (!categories.has(item.category)) {
        categories.set(item.category, { total: 0, verified: 0, warning: 0, action: 0, manual: 0 })
      }
      const cat = categories.get(item.category)!
      cat.total++
      if (item.status === 'verified') cat.verified++
      else if (item.status === 'warning') cat.warning++
      else if (item.status === 'action') cat.action++
      else cat.manual++
    }

    const categoryLines = [...categories.entries()].map(([key, counts]) => {
      return `- ${key}: ${counts.verified} verified, ${counts.warning} warnings, ${counts.action} action required, ${counts.manual} manual review needed (${counts.total} total)`
    }).join('\n')

    const gapLines = docGaps.length > 0
      ? docGaps.map((g) => `- ${g.category}: "${g.documentName}" — ${g.mustContain} (est. ${g.prepTimeEstimate})`).join('\n')
      : 'No specific documentation gaps identified from data analysis.'

    const federalLines = federalFindings.length > 0
      ? federalFindings.map((f) => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.summary}`).join('\n')
      : 'No federal programs findings.'

    const totalItems = complianceItems.length
    const verifiedCount = complianceItems.filter((i) => i.status === 'verified').length
    const actionCount = complianceItems.filter((i) => i.status === 'action').length
    const warningCount = complianceItems.filter((i) => i.status === 'warning').length

    const prompt = `Synthesize the following audit readiness data for ${schoolName} into an executive assessment.

COMPLIANCE VERIFICATION RESULTS (${totalItems} items total):
- Verified green: ${verifiedCount}
- Warnings: ${warningCount}
- Action required: ${actionCount}
- Manual review needed: ${totalItems - verifiedCount - warningCount - actionCount}

BY CATEGORY:
${categoryLines}

DOCUMENTATION GAPS:
${gapLines}

FEDERAL PROGRAMS FINDINGS:
${federalLines}

Return a JSON object with:
- score: 0-100 readiness score
- grade: letter grade (A/B/C/D/F)
- priorityActions: array of top 3 objects with { action, timeEstimate, category }
- executiveSummary: 2-3 paragraph summary suitable for board/authorizer (plain English, specific numbers)
- categoryStatus: array of { category, label (human-readable), status ("ready"|"needs-attention"|"at-risk"|"not-reviewed"), itemCount, verifiedCount, gapCount }
- estimatedTimeToReady: overall time estimate to achieve full readiness

Scoring guide: Each verified item adds points proportionally. Action items reduce score heavily. Warnings reduce moderately. Manual items score neutral (neither help nor hurt). Federal findings reduce score based on severity.

Return ONLY the JSON object, no markdown fences.`

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: `You are a senior Washington State charter school audit preparation advisor who has guided schools through SAO accountability audits. You synthesize findings from compliance verification and federal programs analysis into an executive-level readiness assessment. Be direct and specific — a CEO reading your summary should know exactly what to do and in what order. Provide a 0-100 readiness score with letter grade, top 3 priority actions with time estimates, and a 2-3 paragraph executive summary suitable for sharing with the board or authorizer. Never give generic audit advice — every finding should reference this school's specific situation.`,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
    let assessment: ReadinessAssessment

    try {
      assessment = JSON.parse(text)
    } catch {
      console.error('[audit-coordinator] Failed to parse response:', text)
      assessment = {
        score: 0,
        grade: 'F',
        priorityActions: [],
        executiveSummary: 'Assessment generation failed. Please try again.',
        categoryStatus: [],
        estimatedTimeToReady: 'Unknown',
      }
    }

    return NextResponse.json(assessment)
  } catch (error) {
    console.error('[audit-coordinator]', error)
    return NextResponse.json({ error: 'Audit coordinator failed' }, { status: 500 })
  }
}
