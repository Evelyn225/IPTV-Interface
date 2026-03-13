import { describe, expect, it } from 'vitest'
import { normalizeCatalog } from './normalize-catalog'
import type { PlaylistEntry } from '../types'

describe('normalizeCatalog', () => {
  it('groups episodes into a series and attaches live EPG state', () => {
    const entries: PlaylistEntry[] = [
      {
        id: 'movie-1',
        title: 'Night Current (2024)',
        url: 'https://example.com/movie.m3u8',
        groupTitle: 'Movies',
        attrs: {},
      },
      {
        id: 'series-1',
        title: 'Glass Harbor S01E01 - The Arrival',
        url: 'https://example.com/episode-1.m3u8',
        groupTitle: 'Series',
        attrs: {},
      },
      {
        id: 'channel-1',
        title: 'Pulse News',
        url: 'https://example.com/live.m3u8',
        groupTitle: 'Live News',
        tvgId: 'pulse-news',
        attrs: {},
      },
    ]

    const items = normalizeCatalog(
      entries,
      [
        {
          id: 'program-1',
          channelId: 'pulse-news',
          title: 'Global Pulse',
          start: '2026-03-13T16:00:00.000Z',
          stop: '2026-03-13T17:00:00.000Z',
        },
      ],
      '2026-03-13T16:30:00.000Z',
    )

    const movie = items.find((item) => item.type === 'movie')
    const series = items.find((item) => item.type === 'series')
    const episode = items.find((item) => item.type === 'episode')
    const channel = items.find((item) => item.type === 'channel')

    expect(movie?.title).toBe('Night Current')
    expect(series).toMatchObject({ title: 'Glass Harbor', totalEpisodes: 1 })
    expect(episode).toMatchObject({ title: 'The Arrival', seasonNumber: 1, episodeNumber: 1 })
    expect(channel).toMatchObject({ title: 'Pulse News' })
    expect(channel?.type === 'channel' ? channel.currentProgram?.title : '').toBe('Global Pulse')
  })
})
