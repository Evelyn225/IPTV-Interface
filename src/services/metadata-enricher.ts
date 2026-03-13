import { db } from '../lib/db'
import { createAccentFromTitle } from '../lib/utils'
import type { CatalogItem, CatalogMovie, CatalogSeries, TmdbCacheRecord } from '../types'

interface TmdbSearchResult {
  id: number
  overview?: string
  poster_path?: string
  backdrop_path?: string
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
}

const IMAGE_BASE = 'https://image.tmdb.org/t/p'

async function loadGenreMap(apiKey: string, fetchImpl: typeof fetch) {
  const [movieGenres, tvGenres] = await Promise.all([
    fetchImpl(`https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`).then((response) => response.json()),
    fetchImpl(`https://api.themoviedb.org/3/genre/tv/list?api_key=${apiKey}`).then((response) => response.json()),
  ])

  return new Map<number, string>(
    [...(movieGenres.genres ?? []), ...(tvGenres.genres ?? [])].map((genre: { id: number; name: string }) => [genre.id, genre.name]),
  )
}

function buildCacheKey(item: CatalogMovie | CatalogSeries) {
  return `${item.type}:${item.title}:${item.year ?? ''}`.toLowerCase()
}

function imageUrl(path?: string, size = 'w780') {
  return path ? `${IMAGE_BASE}/${size}${path}` : undefined
}

export async function enrichCatalogItems(
  items: CatalogItem[],
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CatalogItem[]> {
  if (!apiKey.trim()) {
    return items
  }

  const targets = items.filter((item): item is CatalogMovie | CatalogSeries => item.type === 'movie' || item.type === 'series')
  const genreMap = await loadGenreMap(apiKey, fetchImpl)

  const replacements = new Map<string, CatalogMovie | CatalogSeries>()
  await runWithConcurrency(targets, 4, async (item) => {
    const cacheKey = buildCacheKey(item)
    const cached = await db.tmdbCache.get(cacheKey)
    if (cached) {
      replacements.set(item.id, applyEnrichment(item, cached.result))
      return
    }

    const endpoint = item.type === 'movie' ? 'movie' : 'tv'
    const response = await fetchImpl(
      `https://api.themoviedb.org/3/search/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(item.title)}`,
    )

    if (!response.ok) {
      return
    }

    const payload = (await response.json()) as { results?: TmdbSearchResult[] }
    const match = payload.results?.[0]
    if (!match) {
      return
    }

    const result = {
      synopsis: match.overview || item.synopsis,
      artwork: {
        ...item.artwork,
        poster: imageUrl(match.poster_path, 'w500') ?? item.artwork.poster,
        backdrop: imageUrl(match.backdrop_path, 'w1280') ?? imageUrl(match.poster_path, 'w780') ?? item.artwork.backdrop,
        accent: item.artwork.accent ?? createAccentFromTitle(item.title),
      },
      genres: match.genre_ids?.map((genreId) => genreMap.get(genreId)).filter(Boolean) as string[] | undefined,
      tmdbId: match.id,
      year:
        item.year ??
        (match.release_date ? Number(match.release_date.slice(0, 4)) : undefined) ??
        (match.first_air_date ? Number(match.first_air_date.slice(0, 4)) : undefined),
    } satisfies Partial<CatalogMovie | CatalogSeries>

    const record: TmdbCacheRecord = {
      key: cacheKey,
      title: item.title,
      type: item.type,
      result,
      updatedAt: new Date().toISOString(),
    }

    await db.tmdbCache.put(record)
    replacements.set(item.id, applyEnrichment(item, result))
  })

  return items.map((item) => replacements.get(item.id) ?? item)
}

function applyEnrichment<T extends CatalogMovie | CatalogSeries>(item: T, result: Partial<T>): T {
  return {
    ...item,
    ...result,
    artwork: {
      ...item.artwork,
      ...result.artwork,
    },
    genres: result.genres?.length ? result.genres : item.genres,
  }
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) {
        const next = queue.shift()
        if (!next) {
          return
        }

        await worker(next)
      }
    }),
  )
}
