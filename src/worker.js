const ALLOWED_ORIGINS = new Set([
  'https://innernet.princesaxena.workers.dev',
  'http://localhost:5173',
  'http://localhost:5174',
])

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://innernet.princesaxena.workers.dev'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } })
}

function checkAuth(request, env) {
  const secret = request.headers.get('X-App-Secret')
  return !!secret && !!env.APP_SHARED_SECRET && secret === env.APP_SHARED_SECRET
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REFRESH_TOKEN_KEY = 'google:refresh_token'

async function exchangeOrRefresh(params, cors) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  const data = await res.json()
  if (!res.ok) return json({ error: data.error_description || data.error || 'token request failed' }, 400, cors)
  return data
}

async function handleApi(request, env, url, cors) {
  const path = url.pathname

  const stateMatch = path.match(/^\/api\/state\/([a-zA-Z0-9_-]+)$/)
  if (stateMatch) {
    const key = `state:${stateMatch[1]}`
    if (request.method === 'GET') {
      const val = await env.INNERNET_KV.get(key)
      return json(val ? JSON.parse(val) : null, 200, cors)
    }
    if (request.method === 'PUT') {
      const body = await request.text()
      await env.INNERNET_KV.put(key, body)
      return json({ ok: true }, 200, cors)
    }
  }

  if (path === '/api/google/exchange' && request.method === 'POST') {
    const { code, redirectUri } = await request.json()
    const params = new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    })
    const result = await exchangeOrRefresh(params, cors)
    if (result instanceof Response) return result
    if (result.refresh_token) await env.INNERNET_KV.put(REFRESH_TOKEN_KEY, result.refresh_token)
    if (!result.refresh_token) {
      const existing = await env.INNERNET_KV.get(REFRESH_TOKEN_KEY)
      if (!existing) return json({ error: 'no_refresh_token — revoke app access in your Google account and reconnect' }, 400, cors)
    }
    return json({ access_token: result.access_token, expires_in: result.expires_in }, 200, cors)
  }

  if (path === '/api/google/refresh' && request.method === 'POST') {
    const refreshToken = await env.INNERNET_KV.get(REFRESH_TOKEN_KEY)
    if (!refreshToken) return json({ error: 'not_connected' }, 404, cors)
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    })
    const result = await exchangeOrRefresh(params, cors)
    if (result instanceof Response) return result
    return json({ access_token: result.access_token, expires_in: result.expires_in }, 200, cors)
  }

  if (path === '/api/google/disconnect' && request.method === 'POST') {
    await env.INNERNET_KV.delete(REFRESH_TOKEN_KEY)
    return json({ ok: true }, 200, cors)
  }

  // Proxies OpenRouter chat completions so the API key never reaches the
  // client — the frontend sends the same body it used to send straight to
  // OpenRouter (model, messages, stream), we just attach the real key here
  // and pass the response straight through, streaming included.
  if (path === '/api/ai/chat' && request.method === 'POST') {
    const body = await request.text()
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://innernet.princesaxena.workers.dev',
        'X-Title': 'Innernet',
      },
      body,
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    })
  }

  return json({ error: 'not found' }, 404, cors)
}

const OAUTH_CALLBACK_HTML = `<!doctype html><html><body style="font-family:system-ui;padding:24px;color:#444">
<p>Finishing sign-in…</p>
<script>
  var params = new URLSearchParams(location.search);
  var code = params.get('code');
  var error = params.get('error');
  var state = params.get('state') || '*';
  if (window.opener) {
    window.opener.postMessage({ type: 'google-oauth-result', code: code, error: error }, state);
  }
  window.close();
</script>
</body></html>`

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/oauth/callback') {
      return new Response(OAUTH_CALLBACK_HTML, { headers: { 'Content-Type': 'text/html' } })
    }

    if (url.pathname.startsWith('/api/')) {
      const origin = request.headers.get('Origin') || ''
      const cors = corsHeaders(origin)
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
      if (!checkAuth(request, env)) return json({ error: 'unauthorized' }, 401, cors)
      return handleApi(request, env, url, cors)
    }

    const assetResponse = await env.ASSETS.fetch(request)

    if (assetResponse.status !== 404) {
      return assetResponse
    }

    // SPA fallback for client-side routes.
    if (!url.pathname.includes(".")) {
      const spaRequest = new Request(new URL("/index.html", url), request)
      return env.ASSETS.fetch(spaRequest)
    }

    return assetResponse
  },
}
