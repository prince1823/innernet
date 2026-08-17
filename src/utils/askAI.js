import { getApiSecret } from '../services/api'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export async function askAI(prompt, context = '') {
  const secret = getApiSecret()
  if (!secret) {
    return `**AI unavailable:** Unlock sync (bottom-right corner) to enable AI features — the API key now lives server-side only, so it needs the sync secret to authorize requests.`
  }

  const systemPrompt = `You are a helpful AI assistant embedded in a productivity app called Innernet. The user is working on feature documentation. Give concise, actionable suggestions. Use markdown formatting (bold, code, bullets). Keep responses under 100 words.`

  const messages = [
    { role: 'system', content: systemPrompt },
  ]

  if (context) {
    messages.push({ role: 'user', content: `Feature context:\n${context}` })
  }

  messages.push({ role: 'user', content: prompt })

  console.group('%c🤖 Ask AI Request', 'color: #8b5cf6; font-weight: bold')
  console.log('%cSystem Prompt:', 'color: #666; font-weight: bold', systemPrompt)
  if (context) console.log('%cContext:', 'color: #666; font-weight: bold', context)
  console.log('%cUser Prompt:', 'color: #22c55e; font-weight: bold', prompt)
  console.log('%cFull Messages Array:', 'color: #3b82f6; font-weight: bold', JSON.parse(JSON.stringify(messages)))
  console.log('%cModel:', 'color: #f59e0b; font-weight: bold', 'openai/gpt-4o-mini')
  console.groupEnd()

  try {
    const res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Secret': secret,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages,
        max_tokens: 300,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('OpenRouter error:', res.status, err)
      return `**AI Error:** ${res.status} — Could not generate suggestion.`
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content || '**AI:** No response generated.'
    console.group('%c🤖 Ask AI Response', 'color: #22c55e; font-weight: bold')
    console.log('%cResponse:', 'color: #666; font-weight: bold', reply)
    console.log('%cTokens:', 'color: #f59e0b; font-weight: bold', `prompt: ${data.usage?.prompt_tokens}, completion: ${data.usage?.completion_tokens}, total: ${data.usage?.total_tokens}`)
    console.log('%cCost:', 'color: #ef4444; font-weight: bold', `$${data.usage?.cost?.toFixed(6) || '?'}`)
    console.groupEnd()
    return reply
  } catch (err) {
    console.error('AI request failed:', err)
    return `**AI Error:** Network request failed.`
  }
}
