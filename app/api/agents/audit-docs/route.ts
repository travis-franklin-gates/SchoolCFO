import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface GapItem {
  item: string
  category: string
  status: string
  reason: string
}

export interface DocGap {
  item: string
  category: string
  documentName: string
  mustContain: string
  prepTimeEstimate: string
  templateAvailable: boolean
  templateNote: string
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { gaps } = (await req.json()) as { gaps: GapItem[] }

    if (!gaps || gaps.length === 0) {
      return NextResponse.json({ docGaps: [] })
    }

    const gapLines = gaps.map((g) =>
      `- [${g.status.toUpperCase()}] ${g.category}: "${g.item}" — ${g.reason}`
    ).join('\n')

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: `You are an experienced Washington State charter school audit preparation specialist. You have guided multiple WA charter schools through SAO accountability audits and know exactly what fieldwork teams request. When given a list of compliance gaps identified from school data, provide specific, actionable documentation gap analysis. For each gap: name the exact document the SAO would request, describe what it must contain, estimate preparation time, and note whether a template exists. Be specific to WA charter school requirements — not generic audit advice.`,
      messages: [{
        role: 'user',
        content: `Analyze these compliance gaps and provide documentation gap analysis for each. Return a JSON array where each item has:
- item: the checklist item text (exact match from input)
- category: the category key
- documentName: exact name of the document SAO would request
- mustContain: what the document must include to satisfy the requirement
- prepTimeEstimate: realistic time estimate (e.g., "2-3 hours", "1 day", "ongoing")
- templateAvailable: boolean — is there a standard template?
- templateNote: brief note about where to find the template or how to create it

GAPS TO ANALYZE:
${gapLines}

Return ONLY the JSON array, no markdown fences.`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    let docGaps: DocGap[]

    try {
      docGaps = JSON.parse(text)
      if (!Array.isArray(docGaps)) docGaps = []
    } catch {
      console.error('[audit-docs] Failed to parse response:', text)
      docGaps = []
    }

    return NextResponse.json({ docGaps })
  } catch (error) {
    console.error('[audit-docs]', error)
    return NextResponse.json({ error: 'Documentation gap analysis failed' }, { status: 500 })
  }
}
