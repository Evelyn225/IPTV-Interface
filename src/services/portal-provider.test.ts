import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolvePortalStreamUrl, testPortalConnection } from './portal-provider'
import type { AppConfig, PlaybackSource } from '../types'

const portalConfig: AppConfig = {
  id: 'default',
  providerType: 'portal',
  playlistUrl: '',
  epgUrl: '',
  portalUrl: 'example.com',
  macAddress: '00:1A:79:00:00:00',
  tmdbApiKey: '',
  preferredProfile: 'cinema',
}

describe('portal-provider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function unwrapTarget(input: RequestInfo | URL) {
    const value = String(input)
    if (!value.startsWith('/__portal_proxy__')) {
      return value
    }

    const url = new URL(value, 'http://localhost')
    return decodeURIComponent(url.searchParams.get('target') ?? '')
  }

  it('verifies a portal handshake using a MAC-address provider', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = unwrapTarget(input)
      if (url.includes('action=handshake')) {
        return new Response(JSON.stringify({ js: { token: 'token-123' } }))
      }

      if (url.includes('action=get_profile')) {
        return new Response(JSON.stringify({ js: {} }))
      }

      return new Response(JSON.stringify({ js: {} }))
    })

    await expect(
      testPortalConnection({
        portalUrl: portalConfig.portalUrl,
        macAddress: portalConfig.macAddress,
      }),
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalled()
  })

  it('resolves a create_link portal command into a playable URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = unwrapTarget(input)
      if (url.includes('action=handshake')) {
        return new Response(JSON.stringify({ js: { token: 'token-123' } }))
      }

      if (url.includes('action=get_profile')) {
        return new Response(JSON.stringify({ js: {} }))
      }

      if (url.includes('action=create_link')) {
        return new Response(JSON.stringify({ js: { cmd: 'ffmpeg http://stream.example/live.m3u8' } }))
      }

      return new Response(JSON.stringify({ js: {} }))
    })

    const source: PlaybackSource = {
      isLive: true,
      providerType: 'portal',
      portalType: 'itv',
      portalCommand: 'ffrt http:///ch/1',
    }

    await expect(resolvePortalStreamUrl(portalConfig, source)).resolves.toBe('http://stream.example/live.m3u8')
  })
})
