import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * POST /api/notifications/email
 *
 * Sends email alerts for Concern and Action Required findings.
 * Called after agents write findings during upload completion.
 *
 * Body: { schoolId: string }
 *
 * Requires RESEND_API_KEY environment variable.
 * Get a free API key at https://resend.com/signup
 * Add to .env.local: RESEND_API_KEY=re_xxxxxxxxxxxxx
 *
 * Gracefully degrades if RESEND_API_KEY is not set (logs warning, doesn't crash).
 */

interface Finding {
  id: string
  title: string
  summary: string
  severity: string
  agent_name: string
  email_sent: boolean
  created_at: string
}

interface NotificationPrefs {
  action_alerts_enabled: boolean
  daily_digest_enabled: boolean
  email_address: string
}

const DEFAULT_PREFS: NotificationPrefs = {
  action_alerts_enabled: true,
  daily_digest_enabled: true,
  email_address: '',
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.schoolcfo.com'

// ── Email HTML templates ──────────────────────────────────────────────────────

function actionRequiredEmail(
  schoolName: string,
  findings: Finding[]
): { subject: string; html: string } {
  const primaryTitle = findings[0]?.title ?? 'Financial Alert'
  const subject = findings.length === 1
    ? `Action Required: ${primaryTitle} — ${schoolName}`
    : `Action Required: ${findings.length} alerts — ${schoolName}`

  const findingRows = findings.map((f) => `
    <tr>
      <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="background: #fef2f2; color: #dc2626; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase;">Action Required</span>
          <span style="font-size: 11px; color: #6b7280;">${f.agent_name.replace('_', ' ')}</span>
        </div>
        <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #1f2937;">${f.title}</p>
        <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.5;">${f.summary}</p>
      </td>
    </tr>
  `).join('')

  const html = emailWrapper(schoolName, `
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #1e3a5f;">Action Required</h2>
    <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">
      The following ${findings.length === 1 ? 'issue requires' : 'issues require'} your immediate attention at ${schoolName}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      ${findingRows}
    </table>
    <div style="text-align: center; margin-top: 24px;">
      <a href="${APP_URL}/dashboard" style="display: inline-block; background: #1e3a5f; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none;">
        View in SchoolCFO
      </a>
    </div>
  `)

  return { subject, html }
}

function dailyDigestEmail(
  schoolName: string,
  date: string,
  findings: Finding[]
): { subject: string; html: string } {
  const subject = `SchoolCFO Daily Briefing — ${schoolName} — ${date}`

  const findingRows = findings.map((f) => {
    const sevColor = f.severity === 'action' ? '#dc2626' : '#ea580c'
    const sevLabel = f.severity === 'action' ? 'Action Required' : 'Concern'
    const sevBg = f.severity === 'action' ? '#fef2f2' : '#fff7ed'
    return `
    <tr>
      <td style="padding: 12px 20px; border-bottom: 1px solid #e5e7eb;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="background: ${sevBg}; color: ${sevColor}; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase;">${sevLabel}</span>
          <span style="font-size: 11px; color: #6b7280;">${f.agent_name.replace('_', ' ')}</span>
        </div>
        <p style="margin: 0 0 2px; font-size: 14px; font-weight: 600; color: #1f2937;">${f.title}</p>
        <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.4;">${f.summary}</p>
      </td>
    </tr>
  `
  }).join('')

  const html = emailWrapper(schoolName, `
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #1e3a5f;">Daily Briefing</h2>
    <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">
      Here's a summary of ${findings.length} active ${findings.length === 1 ? 'finding' : 'findings'} for ${schoolName} as of ${date}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      ${findingRows}
    </table>
    <div style="text-align: center; margin-top: 24px;">
      <a href="${APP_URL}/dashboard" style="display: inline-block; background: #1e3a5f; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none;">
        View in SchoolCFO
      </a>
    </div>
  `)

  return { subject, html }
}

function emailWrapper(schoolName: string, bodyContent: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background: #1e3a5f; padding: 20px 28px;">
            <span style="color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">SchoolCFO</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 28px;">
            ${bodyContent}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding: 16px 28px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
              You're receiving this because you're the CEO of ${schoolName} on SchoolCFO.
              <a href="${APP_URL}/settings" style="color: #1e3a5f;">Manage notification settings</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Send via Resend ──────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send. Get a key at https://resend.com/signup')
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SchoolCFO <alerts@schoolcfo.com>',
        to: [to],
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[email] Resend API error:', res.status, err)
      return false
    }

    return true
  } catch (err) {
    console.error('[email] Failed to send:', err)
    return false
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await req.json()
    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch school info
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, user_id, last_digest_sent')
      .eq('id', schoolId)
      .single()

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    // Get notification preferences from school_context
    const { data: prefRow } = await supabase
      .from('school_context')
      .select('value')
      .eq('school_id', schoolId)
      .eq('context_type', 'notification_prefs')
      .single()

    const prefs: NotificationPrefs = prefRow?.value
      ? { ...DEFAULT_PREFS, ...(prefRow.value as Partial<NotificationPrefs>) }
      : DEFAULT_PREFS

    // Get the user's email from auth
    const { data: { user } } = await supabase.auth.getUser()
    const emailAddress = prefs.email_address || user?.email
    if (!emailAddress) {
      return NextResponse.json({ sent: 0, reason: 'No email address configured' })
    }

    let totalSent = 0

    // ── 1. Action Required alerts (send immediately) ──────────────────────

    if (prefs.action_alerts_enabled) {
      const { data: actionFindings } = await supabase
        .from('agent_findings')
        .select('id, title, summary, severity, agent_name, email_sent, created_at')
        .eq('school_id', schoolId)
        .eq('severity', 'action')
        .eq('email_sent', false)
        .order('created_at', { ascending: false })

      if (actionFindings && actionFindings.length > 0) {
        const { subject, html } = actionRequiredEmail(school.name, actionFindings)
        const sent = await sendEmail(emailAddress, subject, html)

        if (sent) {
          // Mark findings as email_sent
          const ids = actionFindings.map((f) => f.id)
          await supabase
            .from('agent_findings')
            .update({ email_sent: true })
            .in('id', ids)
          totalSent++
        }
      }
    }

    // ── 2. Concern digest (at most once per day) ──────────────────────────

    if (prefs.daily_digest_enabled) {
      const lastDigest = school.last_digest_sent ? new Date(school.last_digest_sent) : null
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      if (!lastDigest || lastDigest < oneDayAgo) {
        const { data: concernFindings } = await supabase
          .from('agent_findings')
          .select('id, title, summary, severity, agent_name, email_sent, created_at')
          .eq('school_id', schoolId)
          .in('severity', ['concern', 'action'])
          .order('created_at', { ascending: false })

        if (concernFindings && concernFindings.length > 0) {
          const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          const { subject, html } = dailyDigestEmail(school.name, dateStr, concernFindings)
          const sent = await sendEmail(emailAddress, subject, html)

          if (sent) {
            await supabase
              .from('schools')
              .update({ last_digest_sent: now.toISOString() })
              .eq('id', schoolId)

            // Mark concern findings as emailed
            const unsent = concernFindings.filter((f) => !f.email_sent).map((f) => f.id)
            if (unsent.length > 0) {
              await supabase
                .from('agent_findings')
                .update({ email_sent: true })
                .in('id', unsent)
            }
            totalSent++
          }
        }
      }
    }

    return NextResponse.json({ sent: totalSent })
  } catch (err) {
    console.error('[email-notifications]', err)
    return NextResponse.json({ error: 'Email notification failed' }, { status: 500 })
  }
}
