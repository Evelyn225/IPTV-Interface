import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../lib/db'
import { enrichCatalogItems } from './metadata-enricher'
import type { CatalogMovie } from '../types'

describe('enrichCatalogItems', () => {
  beforeEach(async () => {
    await db.tmdbCache.clear()
  })

  it('keeps provider metadata when TMDb has no match', async () => {
    const item: CatalogMovie = {
      id: 'movie-1',
      type: 'movie',
      title: 'Unknown Signal',
      synopsis: 'Provider synopsis',
      genres: ['Movies'],
      artwork: {},
      source: { url: 'https://example.com/movie.m3u8', isLive: false },
      addedAt: '2026-03-13T16:00:00.000Z',
    }

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/genre/')) {
        return new Response(JSON.stringify({ genres: [] }))
      }

      return new Response(JSON.stringify({ results: [] }))
    }) as unknown as typeof fetch

    const result = await enrichCatalogItems([item], 'demo-key', fetchImpl)

    expect(result[0]).toMatchObject({
      title: 'Unknown Signal',
      synopsis: 'Provider synopsis',
    })
  })
})
