import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CLAUDE_MODEL } from '@/lib/constants'
import { createClient } from '@/lib/supabase-server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface RequestBody {
  schoolId: string
  nextBoardMeeting: string
  schoolName: string
}

export async function GET(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const schoolId = req.nextUrl.searchParams.get('schoolId')
    const nextBoardMeeting = req.nextUrl.searchParams.get('nextBoardMeeting')
    const schoolName = req.nextUrl.searchParams.get('schoolName') || 'the school'

    if (!schoolId || !nextBoardMeeting) {
      return NextResponse.json({ error: 'Missing schoolId or nextBoardMeeting' }, { status: 400 })
    }

    const supabase = await createClient()

    // Read all active findings from other agents
    const { data: findings } = await supabase
      .from('agent_findings')
      .select('*')
      .eq('school_id', schoolId)
      .neq('agent_name', 'board_prep')
      .order('created_at', { ascending: false })

    if (!findings || findings.length === 0) {
      // No findings from other agents — clear old board_prep findings
      await supabase
        .from('agent_findings')
        .delete()
        .eq('school_id', schoolId)
        .eq('agent_name', 'board_prep')
      return NextResponse.json({ findings: 0, agent: 'board_prep' })
    }

    const findingsByAgent: Record<string, typeof findings> = {}
    for (const f of findings) {
      const agent = f.agent_name as string
      if (!findingsByAgent[agent]) findingsByAgent[agent] = []
      findingsByAgent[agent].push(f)
    }

    const findingsBlock = Object.entries(findingsByAgent).map(([agent, items]) => {
      const label = agent.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      const lines = items.map((f) =>
        `  - [${(f.severity as string).toUpperCase()}] ${f.title}: ${f.summary}`
      ).join('\n')
      return `${label}:\n${lines}`
    }).join('\n\n')

    const prompt = `You are preparing a board meeting briefing for ${schoolName}. The board meeting is on ${nextBoardMeeting}.

ACTIVE FINDINGS FROM SPECIALIST AGENTS:
${findingsBlock}

Synthesize these findings into board-ready items. Return a JSON array of findings. Each finding must have:
- findingType: "board_action_required"
- severity: "watch" | "concern" | "action"
- title: board-appropriate title (plain English, no jargon)
- summary: 2-3 sentences synthesizing the issue for board members who are not financial experts. Include specific dollar amounts and what action the board should consider.
- detail: { sourceAgents: string[], relatedFindings: string[] }

Group related findings (e.g., a budget variance + cash impact = one board item). Prioritize by severity. Include 3-5 items max. Return ONLY the JSON array, no markdown fences.`

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1200,
      system: 'You are a board preparation specialist for charter schools. You translate financial analysis into clear, actionable board agenda items. Respond only with valid JSON arrays.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    let boardFindings: Array<{
      findingType: string
      severity: string
      title: string
      summary: string
      detail: Record<string, unknown>
    }>

    try {
      boardFindings = JSON.parse(text)
      if (!Array.isArray(boardFindings)) boardFindings = []
    } catch {
      console.error('[board-prep] Failed to parse response:', text)
      boardFindings = []
    }

    // Write findings to Supabase
    await supabase
      .from('agent_findings')
      .delete()
      .eq('school_id', schoolId)
      .eq('agent_name', 'board_prep')

    if (boardFindings.length > 0) {
      const rows = boardFindings.map((f) => ({
        school_id: schoolId,
        agent_name: 'board_prep',
        finding_type: f.findingType || 'board_action_required',
        severity: f.severity,
        title: f.title,
        summary: f.summary,
        detail: f.detail || {},
        expires_at: nextBoardMeeting,
      }))

      const { error } = await supabase.from('agent_findings').insert(rows)
      if (error) console.error('[board-prep] Insert error:', error)
    }

    return NextResponse.json({ findings: boardFindings.length, agent: 'board_prep' })
  } catch (error) {
    console.error('[board-prep]', error)
    return NextResponse.json({ error: 'Board prep failed' }, { status: 500 })
  }
}
