import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import type { IncomingHttpHeaders } from 'node:http'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

function pickForwardHeaders(headers: IncomingHttpHeaders) {
  const allowed = ['accept', 'authorization', 'cookie', 'user-agent', 'x-user-agent']
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([key, value]) => allowed.includes(key.toLowerCase()) && typeof value === 'string',
    ),
  )
}

function portalProxyPlugin() {
  const attachProxy = (middlewares: {
    use: (path: string, handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) => void
  }) => {
    middlewares.use('/__portal_proxy__', (req, res) => {
      const requestUrl = new URL(req.url ?? '', 'http://localhost')
      const target = requestUrl.searchParams.get('target')
      if (!target) {
        res.statusCode = 400
        res.end('Missing target query parameter')
        return
      }

      const targetUrl = new URL(target)
      const client = targetUrl.protocol === 'https:' ? https : http

      const proxyRequest = client.request(
        targetUrl,
        {
          method: req.method,
          headers: pickForwardHeaders(req.headers),
        },
        (proxyResponse) => {
          res.statusCode = proxyResponse.statusCode ?? 502
          Object.entries(proxyResponse.headers).forEach(([key, value]) => {
            if (value !== undefined) {
              res.setHeader(key, value)
            }
          })
          proxyResponse.pipe(res)
        },
      )

      proxyRequest.on('error', (error) => {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: error.message }))
      })

      req.pipe(proxyRequest)
    })
  }

  return {
    name: 'portal-proxy',
    configureServer(server: { middlewares: { use: (path: string, handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) => void } }) {
      attachProxy(server.middlewares)
    },
    configurePreviewServer(server: { middlewares: { use: (path: string, handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) => void } }) {
      attachProxy(server.middlewares)
    },
  }
}

export default defineConfig({
  plugins: [react(), portalProxyPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
