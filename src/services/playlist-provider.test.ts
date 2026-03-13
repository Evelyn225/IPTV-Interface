import { describe, expect, it } from 'vitest'
import { parseM3u } from './playlist-provider'

describe('parseM3u', () => {
  it('extracts playlist entries and IPTV metadata attributes', () => {
    const content = `#EXTM3U
#EXTINF:-1 tvg-id="movie-1" tvg-logo="poster.jpg" group-title="Movies",Night Current (2024)
https://example.com/movie.m3u8
`

    const entries = parseM3u(content)

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      title: 'Night Current (2024)',
      tvgId: 'movie-1',
      tvgLogo: 'poster.jpg',
      groupTitle: 'Movies',
      url: 'https://example.com/movie.m3u8',
    })
  })
})
