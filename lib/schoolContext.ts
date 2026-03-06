// Builds a structured "School Context" block from active context entries
// for injection into AI system prompts.

export interface ContextEntry {
  contextType: string
  key: string
  value: Record<string, unknown>
  expiresAt: string | null
}

/**
 * Returns active (non-expired) context entries formatted as a prompt block.
 * Intended for injection into system prompts across chat, briefing, and board-packet APIs.
 */
export function buildSchoolContextBlock(entries: ContextEntry[]): string {
  if (!entries || entries.length === 0) return ''

  const today = new Date().toISOString().slice(0, 10)
  const active = entries.filter((e) => !e.expiresAt || e.expiresAt >= today)
  if (active.length === 0) return ''

  const sections: string[] = []

  // Guided prompts
  const guided = active.filter((e) => e.contextType === 'guided')
  if (guided.length > 0) {
    const lines = guided.map((e) => {
      const v = e.value
      switch (e.key) {
        case 'staffing_ratio': {
          const explanation = String(v.explanation ?? '')
          const threshold = Number(v.threshold ?? 80)
          return `- Staffing: School intentionally staffs above typical para-to-teacher ratio. ${explanation ? `Reason: ${explanation}. ` : ''}Personnel cost threshold set to ${threshold}% (custom override — do not flag personnel under this level).`
        }
        case 'capital_outlays': {
          const outlays = Array.isArray(v.outlays) ? v.outlays : []
          const list = outlays.map((o: Record<string, unknown>) =>
            `  * ${o.description}: $${Number(o.amount).toLocaleString()} expected ${o.month}`
          ).join('\n')
          return `- Planned Capital Outlays:\n${list}`
        }
        case 'variance_events': {
          const events = Array.isArray(v.events) ? v.events : []
          const list = events.map((ev: Record<string, unknown>) =>
            `  * ${ev.category}: "${ev.description}" (expires ${ev.expirationMonth}) — this variance is a known one-time event, suppress or downgrade alert severity`
          ).join('\n')
          return `- Known One-Time Events Affecting Variances:\n${list}`
        }
        case 'additional_revenue':
          return `- Additional Revenue: ${String(v.explanation ?? '')}`
        case 'salary_braiding': {
          const positions = String(v.positions ?? '')
          return `- Salary Braiding: Staff salaries split across funding sources. Details: ${positions}`
        }
        default:
          return `- ${e.key}: ${JSON.stringify(v)}`
      }
    })
    sections.push('GUIDED CONTEXT:\n' + lines.join('\n'))
  }

  // Free-form notes
  const freeform = active.filter((e) => e.contextType === 'freeform')
  if (freeform.length > 0) {
    const lines = freeform.map((e) => {
      const title = String(e.value.title ?? e.key)
      const body = String(e.value.body ?? '')
      return `- ${title}: ${body}`
    })
    sections.push('ADDITIONAL CONTEXT NOTES:\n' + lines.join('\n'))
  }

  // Event flags
  const flags = active.filter((e) => e.contextType === 'event_flag')
  if (flags.length > 0) {
    const lines = flags.map((e) => {
      const v = e.value
      return `- [${v.category}] "${v.description}" (active ${v.startMonth ?? '?'} – ${e.expiresAt ?? 'ongoing'}) — suppress or downgrade variance alerts for this category`
    })
    sections.push('ACTIVE EVENT FLAGS (suppress/downgrade variance alerts for these):\n' + lines.join('\n'))
  }

  return '\n\nSCHOOL CONTEXT (provided by the school leader — treat as authoritative):\n' + sections.join('\n\n')
}
