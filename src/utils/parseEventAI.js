const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY

const SYSTEM_PROMPT = `You are a calendar scheduling assistant. Given a user message about creating/scheduling an event, extract structured event data and return ONLY valid JSON (no markdown, no explanation).

Return this exact shape:
{
  "title": "string or null",
  "eventType": "meeting|call|sync|standup|focus|lunch|coffee|event",
  "attendees": ["Name1", "Name2"],
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM (24h) or null",
  "duration": "integer minutes or null",
  "location": "string or null",
  "description": "string or null",
  "recurrence": { "type": "daily|weekly|monthly|weekdays", "interval": 1, "count": null } or null,
  "reminder": "integer minutes or null",
  "action": "create"
}

Rules:
- Today's date is {today}. Use it to resolve "today", "tomorrow", "next Monday", etc.
- If user says "for 2 hours", duration = 120. If "30 min", duration = 30. Default: 60.
- Capitalize attendee names properly.
- If the user doesn't specify a title, generate a concise one from the context (e.g., "Meeting with Tanuj" or "Sprint Planning").
- For recurrence: "every week" = weekly, "daily" = daily, "every Monday" = weekly, "weekdays" = weekdays.
- Only return JSON. No other text.`

const UPDATE_PROMPT = `You are a calendar scheduling assistant. The user wants to modify a pending event. The current event data is:
{eventData}

The user said: "{userMessage}"

Return ONLY valid JSON with the changed fields and "action": "update". For example, if they say "make it 2pm", return:
{ "time": "14:00", "action": "update" }

If they say "add Priya", return:
{ "attendees": ["ExistingPerson", "Priya"], "action": "update" }

Return the full updated value for array fields (not just the addition). Only return JSON, no other text.`

export async function parseEventWithAI(userMessage, todayStr, pendingEvent = null) {
  if (!API_KEY || API_KEY === 'your-key-here') {
    return { error: 'No API key configured. Set VITE_OPENROUTER_API_KEY in your .env file.' }
  }

  const systemContent = pendingEvent
    ? UPDATE_PROMPT
        .replace('{eventData}', JSON.stringify(pendingEvent, null, 2))
        .replace('{userMessage}', userMessage)
    : SYSTEM_PROMPT.replace('{today}', todayStr)

  const messages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: userMessage },
  ]

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Innernet',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages,
        max_tokens: 400,
        temperature: 0.1,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('AI schedule parse error:', res.status, err)
      return { error: `API error: ${res.status}` }
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    try {
      const parsed = JSON.parse(cleaned)
      return parsed
    } catch (parseErr) {
      console.error('Failed to parse AI JSON:', cleaned)
      return { error: 'AI returned invalid JSON. Try rephrasing.' }
    }
  } catch (err) {
    console.error('AI schedule request failed:', err)
    return { error: 'Network request failed.' }
  }
}

// Quick intent check — does this message look like a scheduling request?
// Used to decide whether to route through AI parser vs general chat.
export function hasSchedulingIntent(text) {
  const q = text.toLowerCase().trim()
  const EVENT_TYPES = /\b(meeting|call|sync|standup|catchup|catch[- ]up|chat|1:1|one[- ]on[- ]one|interview|review|lunch|coffee|event|block|focus)\b/
  const ACTION_VERBS = /^(schedule|add|create|book|set\s*up|new|block)\b/
  const SCHEDULING_VERBS = /(schedule|book|add|create|block)/

  return ACTION_VERBS.test(q) || (SCHEDULING_VERBS.test(q) && EVENT_TYPES.test(q))
}
