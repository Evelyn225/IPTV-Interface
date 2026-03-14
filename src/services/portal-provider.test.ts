import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPortalPlaylist, resolvePortalStreamUrl, testPortalConnection } from './portal-provider'
import type { AppConfig, PlaybackSource } from '../types'

const portalConfig: AppConfig = {
  id: 'default',
  providerType: 'portal',
  playlistUrl: '',
  epgUrl: '',
  portalUrl: 'example.com',
  portalBackendUrl: '',
  macAddress: '00:1A:79:00:00:00',
  tmdbApiKey: '',
  preferredProfile: 'cinema',
}

describe('portal-provider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('verifies a portal handshake through the local backend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await expect(
      testPortalConnection({
        portalUrl: portalConfig.portalUrl,
        portalBackendUrl: portalConfig.portalBackendUrl,
        macAddress: portalConfig.macAddress,
      }),
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8787/api/portal/test',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('loads normalized playlist entries from the backend', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          entries: [
            {
              id: 'movie-1',
              title: 'Night Current',
              url: '',
              groupTitle: 'Movies',
              attrs: {
                'source-provider': 'portal',
                'portal-type': 'vod',
                'portal-command': 'ffmpeg http:///movie/1',
                'content-type': 'movie',
              },
            },
          ],
        }),
      ),
    )

    await expect(fetchPortalPlaylist(portalConfig)).resolves.toHaveLength(1)
  })

  it('resolves a create_link portal command into a playable URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'http://stream.example/live.m3u8' })),
    )

    const source: PlaybackSource = {
      isLive: true,
      providerType: 'portal',
      portalType: 'itv',
      portalCommand: 'ffrt http:///ch/1',
    }

    await expect(resolvePortalStreamUrl(portalConfig, source)).resolves.toBe('http://stream.example/live.m3u8')
  })
})
