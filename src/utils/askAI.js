const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY

export async function askAI(prompt, context = '') {
  if (!API_KEY || API_KEY === 'your-key-here') {
    // Fallback: return mock response if no key configured
    return `**AI Suggestion:** Based on this requirement, consider breaking it into smaller tasks. Start with the data model, then build the UI, and finally wire up the API integration.`
  }

  const systemPrompt = `You are a helpful AI assistant embedded in a productivity app called Innernet. The user is working on feature documentation. Give concise, actionable suggestions. Use markdown formatting (bold, code, bullets). Keep responses under 100 words.`

  const messages = [
    { role: 'system', content: systemPrompt },
  ]

  if (context) {
    messages.push({ role: 'user', content: `Feature context:\n${context}` })
  }

  messages.push({ role: 'user', content: prompt })

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
        model: 'anthropic/claude-sonnet-4',
        messages,
        max_tokens: 300,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('OpenRouter error:', err)
      return `**AI Error:** Could not generate suggestion. Check your API key.`
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || '**AI:** No response generated.'
  } catch (err) {
    console.error('AI request failed:', err)
    return `**AI Error:** Network request failed.`
  }
}
