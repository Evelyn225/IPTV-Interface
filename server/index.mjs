import express from 'express'
import {
  fetchPortalPlaylist,
  resolvePortalStreamUrl,
  testPortalConnection,
} from './portal-service.mjs'

const app = express()
const port = Number(process.env.PORTAL_PROXY_PORT || 8787)

app.use(express.json({ limit: '1mb' }))
app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (_.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/portal/test', async (req, res) => {
  try {
    assertPortalPayload(req.body)
    await testPortalConnection(req.body)
    res.status(204).end()
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/api/portal/import', async (req, res) => {
  try {
    assertPortalPayload(req.body)
    const entries = await fetchPortalPlaylist(req.body)
    res.json({ entries })
  } catch (error) {
    sendError(res, error)
  }
})

app.post('/api/portal/resolve', async (req, res) => {
  try {
    assertPortalPayload(req.body)
    const url = await resolvePortalStreamUrl(req.body)
    res.json({ url })
  } catch (error) {
    sendError(res, error)
  }
})

app.listen(port, () => {
  console.log(`Portal backend listening on http://localhost:${port}`)
})

function assertPortalPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body is required.')
  }
  if (typeof body.portalUrl !== 'string' || !body.portalUrl.trim()) {
    throw new Error('Portal URL is required.')
  }
  if (typeof body.macAddress !== 'string' || !body.macAddress.trim()) {
    throw new Error('MAC address is required.')
  }
}

function sendError(res, error) {
  const message = error instanceof Error ? error.message : 'Unexpected proxy error.'
  const status =
    /required|format/i.test(message) ? 400 :
    /Unauthorized|authorization failed/i.test(message) ? 403 :
    /429|rate-limit/i.test(message) ? 429 :
    502
  res.status(status).json({ error: message })
}
