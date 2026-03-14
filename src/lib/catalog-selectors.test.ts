import { describe, expect, it } from 'vitest'
import { getRecommendedItems, getResumeEntry, getResumeTarget } from './catalog-selectors'
import type { CatalogEpisode, CatalogMovie, CatalogSeries, PlaybackHistoryEntry } from '../types'

const movieA: CatalogMovie = {
  id: 'movie-a',
  type: 'movie',
  title: 'Night Current',
  synopsis: 'A sci-fi thriller.',
  genres: ['Sci-Fi', 'Thriller'],
  artwork: {},
  source: { url: 'https://example.com/movie-a.mp4', isLive: false },
  addedAt: '2026-03-13T12:00:00.000Z',
}

const movieB: CatalogMovie = {
  id: 'movie-b',
  type: 'movie',
  title: 'Solar Drift',
  synopsis: 'A space odyssey.',
  genres: ['Sci-Fi', 'Adventure'],
  artwork: {},
  source: { url: 'https://example.com/movie-b.mp4', isLive: false },
  addedAt: '2026-03-14T12:00:00.000Z',
}

const series: CatalogSeries = {
  id: 'series-a',
  type: 'series',
  title: 'Glass Harbor',
  synopsis: 'Mystery by the coast.',
  genres: ['Mystery', 'Thriller'],
  artwork: {},
  source: { url: 'https://example.com/series-a.m3u8', isLive: false },
  addedAt: '2026-03-12T12:00:00.000Z',
  seasons: [{ seasonNumber: 1, episodeIds: ['ep-1', 'ep-2'] }],
  totalEpisodes: 2,
}

const episodeOne: CatalogEpisode = {
  id: 'ep-1',
  type: 'episode',
  title: 'The Arrival',
  synopsis: 'Episode one.',
  genres: ['Mystery', 'Thriller'],
  artwork: {},
  source: { url: 'https://example.com/ep-1.m3u8', isLive: false },
  addedAt: '2026-03-12T12:00:00.000Z',
  seriesId: 'series-a',
  seasonNumber: 1,
  episodeNumber: 1,
}

const episodeTwo: CatalogEpisode = {
  id: 'ep-2',
  type: 'episode',
  title: 'Low Tide',
  synopsis: 'Episode two.',
  genres: ['Mystery', 'Thriller'],
  artwork: {},
  source: { url: 'https://example.com/ep-2.m3u8', isLive: false },
  addedAt: '2026-03-12T13:00:00.000Z',
  seriesId: 'series-a',
  seasonNumber: 1,
  episodeNumber: 2,
}

describe('catalog selectors', () => {
  it('recommends unwatched titles that match watched genres', () => {
    const history: PlaybackHistoryEntry[] = [
      {
        id: 'movie-a',
        itemId: 'movie-a',
        positionSeconds: 1800,
        durationSeconds: 5400,
        updatedAt: '2026-03-14T10:00:00.000Z',
      },
    ]

    const recommendations = getRecommendedItems([movieA, movieB, series, episodeOne, episodeTwo], history)
    expect(recommendations[0]?.id).toBe('movie-b')
    expect(recommendations.some((item) => item.id === 'movie-a')).toBe(false)
  })

  it('resumes a series from the next episode when the previous one was completed', () => {
    const history: PlaybackHistoryEntry[] = [
      {
        id: 'ep-1',
        itemId: 'ep-1',
        positionSeconds: 1790,
        durationSeconds: 1800,
        updatedAt: '2026-03-14T09:00:00.000Z',
      },
    ]

    const items = [series, episodeOne, episodeTwo]
    expect(getResumeTarget(series, items, history)?.id).toBe('ep-2')
    expect(getResumeEntry(series, items, history)?.itemId).toBe('ep-1')
  })
})
