import { Capacitor } from '@capacitor/core'
import { getPortalBackendUrl } from '../lib/backend'
import { PortalBridge } from '../plugins/portal-bridge'
import type { AppConfig, PlaybackSource, PlaylistEntry } from '../types'

interface BackendErrorPayload {
  error?: string
}

interface BackendPortalEntriesPayload {
  entries: PlaylistEntry[]
}

interface BackendPortalResolvePayload {
  url: string
}

export async function fetchPortalPlaylist(config: AppConfig): Promise<PlaylistEntry[]> {
  if (usesNativePortalBridge()) {
    const payload = await PortalBridge.importPlaylist({
      portalUrl: config.portalUrl,
      macAddress: config.macAddress,
    })

    return payload.entries
  }

  const payload = await backendRequest<BackendPortalEntriesPayload>(
    '/api/portal/import',
    {
      portalUrl: config.portalUrl,
      macAddress: config.macAddress,
    },
    config.portalBackendUrl,
  )

  return payload.entries
}

export async function testPortalConnection(
  config: Pick<AppConfig, 'portalUrl' | 'portalBackendUrl' | 'macAddress'>,
): Promise<void> {
  if (usesNativePortalBridge()) {
    await PortalBridge.testConnection({
      portalUrl: config.portalUrl,
      macAddress: config.macAddress,
    })
    return
  }

  await backendRequest('/api/portal/test', config, config.portalBackendUrl)
}

export async function resolvePortalStreamUrl(config: AppConfig, source: PlaybackSource): Promise<string> {
  if (source.providerType !== 'portal' || !source.portalType || !source.portalCommand) {
    throw new Error('This item does not use a portal playback source.')
  }

  if (usesNativePortalBridge()) {
    const payload = await PortalBridge.resolveStreamUrl({
      portalUrl: config.portalUrl,
      macAddress: config.macAddress,
      source,
    })

    return payload.url
  }

  const payload = await backendRequest<BackendPortalResolvePayload>(
    '/api/portal/resolve',
    {
      portalUrl: config.portalUrl,
      macAddress: config.macAddress,
      source,
    },
    config.portalBackendUrl,
  )

  return payload.url
}

async function backendRequest<T = void>(
  path: string,
  body: object,
  configuredBackendUrl?: string,
): Promise<T> {
  const baseUrl = getPortalBackendUrl(configuredBackendUrl)
  if (!baseUrl) {
    throw new Error('Portal backend is not configured. Run `npm run proxy`, set `VITE_PORTAL_BACKEND_URL`, or add a backend URL in settings.')
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as BackendErrorPayload
      throw new Error(payload.error ?? `Portal backend request failed with status ${response.status}.`)
    }

    const text = await response.text()
    throw new Error(text || `Portal backend request failed with status ${response.status}.`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function usesNativePortalBridge() {
  return Capacitor.getPlatform() === 'android'
}
