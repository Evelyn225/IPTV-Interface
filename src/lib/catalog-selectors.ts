import type { CatalogItem, LibrarySection, PlaybackHistoryEntry, Rail, WatchlistEntry } from '../types'
import { groupGenres, sortByAddedDate } from './utils'

function topLevelItems(items: CatalogItem[]) {
  return items.filter((item) => item.type !== 'episode')
}

function getHistoryMap(history: PlaybackHistoryEntry[]) {
  return new Map(history.map((entry) => [entry.itemId, entry]))
}

function getWatchlistMap(watchlist: WatchlistEntry[]) {
  return new Map(watchlist.map((entry) => [entry.itemId, entry]))
}

function isCompleted(entry?: PlaybackHistoryEntry) {
  if (!entry?.durationSeconds || entry.durationSeconds <= 0) {
    return false
  }

  return entry.positionSeconds / entry.durationSeconds >= 0.92
}

function getSeriesProgress(items: CatalogItem[], historyMap: Map<string, PlaybackHistoryEntry>) {
  const progress = new Map<
    string,
    {
      latestEpisodeId: string
      latestUpdatedAt: string
      watchedGenres: string[]
      completed: boolean
    }
  >()

  for (const item of items) {
    if (item.type !== 'episode') {
      continue
    }

    const entry = historyMap.get(item.id)
    if (!entry) {
      continue
    }

    const existing = progress.get(item.seriesId)
    if (!existing || entry.updatedAt > existing.latestUpdatedAt) {
      progress.set(item.seriesId, {
        latestEpisodeId: item.id,
        latestUpdatedAt: entry.updatedAt,
        watchedGenres: item.genres,
        completed: isCompleted(entry),
      })
    }
  }

  return progress
}

export function getItemById(items: CatalogItem[], itemId?: string | null) {
  return items.find((item) => item.id === itemId) ?? null
}

export function getFeaturedItem(items: CatalogItem[], history: PlaybackHistoryEntry[], section: LibrarySection) {
  const continueWatching = getContinueWatchingItems(items, history)
  if (continueWatching.length) {
    return continueWatching[0]
  }

  const pool = topLevelItems(items).filter((item) => {
    if (section === 'home') {
      return item.type === 'movie' || item.type === 'series'
    }

    if (section === 'movies') {
      return item.type === 'movie'
    }

    if (section === 'series') {
      return item.type === 'series'
    }

    return item.type === 'channel'
  })

  return sortByAddedDate(pool)[0] ?? null
}

export function getContinueWatchingItems(items: CatalogItem[], history: PlaybackHistoryEntry[]) {
  const historyMap = getHistoryMap(history)
  const seriesProgress = getSeriesProgress(items, historyMap)

  const ordered: CatalogItem[] = []
  const seen = new Set<string>()

  for (const entry of [...history].toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))) {
    const item = items.find((candidate) => candidate.id === entry.itemId)
    if (!item || item.type === 'channel') {
      continue
    }

    if (item.type === 'episode') {
      const parentSeries = items.find(
        (candidate): candidate is Extract<CatalogItem, { type: 'series' }> =>
          candidate.type === 'series' && candidate.id === item.seriesId,
      )
      if (parentSeries && !seen.has(parentSeries.id)) {
        seen.add(parentSeries.id)
        ordered.push(parentSeries)
      }
      continue
    }

    if (item.type === 'movie' && !isCompleted(entry) && !seen.has(item.id)) {
      seen.add(item.id)
      ordered.push(item)
      continue
    }

    if (item.type === 'series' && seriesProgress.has(item.id) && !seen.has(item.id)) {
      seen.add(item.id)
      ordered.push(item)
    }
  }

  return ordered
}

export function getWatchlistItems(items: CatalogItem[], watchlist: WatchlistEntry[]) {
  const watchlistMap = getWatchlistMap(watchlist)

  return topLevelItems(items)
    .filter((item) => (item.type === 'movie' || item.type === 'series') && watchlistMap.has(item.id))
    .toSorted((left, right) => {
      const leftAddedAt = watchlistMap.get(left.id)?.addedAt ?? ''
      const rightAddedAt = watchlistMap.get(right.id)?.addedAt ?? ''
      return rightAddedAt.localeCompare(leftAddedAt)
    })
}

export function getGenreOptions(items: CatalogItem[], section: LibrarySection) {
  if (section === 'home') {
    return groupGenres(topLevelItems(items).filter((item) => item.type !== 'channel'))
  }

  if (section === 'live') {
    return groupGenres(items, 'channel')
  }

  return groupGenres(items, section === 'movies' ? 'movie' : 'series')
}

function filterSectionItems(items: CatalogItem[], section: LibrarySection) {
  if (section === 'home') {
    return topLevelItems(items).filter((item) => item.type !== 'channel')
  }

  if (section === 'movies') {
    return items.filter((item) => item.type === 'movie')
  }

  if (section === 'series') {
    return items.filter((item) => item.type === 'series')
  }

  return items.filter((item) => item.type === 'channel')
}

export function getGridItems(items: CatalogItem[], section: LibrarySection, activeGenre: string) {
  const filtered = filterSectionItems(items, section)
  if (activeGenre === 'All') {
    return filtered
  }

  return filtered.filter((item) => item.genres.includes(activeGenre))
}

export function getRailsForSection(
  items: CatalogItem[],
  history: PlaybackHistoryEntry[],
  watchlist: WatchlistEntry[],
  section: LibrarySection,
): Rail[] {
  const rails: Rail[] = []

  if (section === 'home') {
    const watchlistItems = getWatchlistItems(items, watchlist)
    if (watchlistItems.length) {
      rails.push({
        id: 'watchlist',
        title: 'My Watchlist',
        itemType: 'mixed',
        sortRule: 'watchlist',
        items: watchlistItems.slice(0, 12),
      })
    }

    const continueWatching = getContinueWatchingItems(items, history)
    if (continueWatching.length) {
      rails.push({
        id: 'continue',
        title: 'Continue Watching',
        itemType: 'mixed',
        sortRule: 'history',
        items: continueWatching,
      })
    }

    rails.push({
      id: 'recent',
      title: 'Recently Added',
      itemType: 'mixed',
      sortRule: 'addedAt',
      items: sortByAddedDate(topLevelItems(items).filter((item) => item.type !== 'channel')).slice(0, 12),
    })
  }

  const sectionItems = filterSectionItems(items, section)
  const genres = getGenreOptions(items, section).slice(0, 4)
  for (const genre of genres) {
    const genreItems = sectionItems.filter((item) => item.genres.includes(genre)).slice(0, 12)
    if (!genreItems.length) {
      continue
    }

    rails.push({
      id: `${section}-${genre}`,
      title: genre,
      itemType: section === 'home' ? 'mixed' : section === 'movies' ? 'movie' : section === 'series' ? 'series' : 'channel',
      sortRule: 'genre',
      items: genreItems,
    })
  }

  if (section === 'live') {
    rails.unshift({
      id: 'live-now',
      title: 'On Now',
      itemType: 'channel',
      sortRule: 'currentProgram',
      items: sectionItems.filter((item) => item.type === 'channel' && item.currentProgram).slice(0, 12),
    })
  }

  return rails.filter((rail) => rail.items.length > 0)
}

export function searchLibrary(items: CatalogItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  return topLevelItems(items)
    .filter(
      (item) =>
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.genres.some((genre) => genre.toLowerCase().includes(normalizedQuery)),
    )
    .slice(0, 36)
}

export function getResumeEntry(item: CatalogItem | null, items: CatalogItem[], history: PlaybackHistoryEntry[]) {
  if (!item) {
    return null
  }

  const historyMap = getHistoryMap(history)

  if (item.type === 'movie' || item.type === 'episode') {
    return historyMap.get(item.id) ?? null
  }

  if (item.type === 'series') {
    const episodes = items
      .filter((candidate): candidate is Extract<CatalogItem, { type: 'episode' }> => candidate.type === 'episode' && candidate.seriesId === item.id)
      .toSorted((left, right) => {
        if (left.seasonNumber === right.seasonNumber) {
          return left.episodeNumber - right.episodeNumber
        }

        return left.seasonNumber - right.seasonNumber
      })

    const watchedEpisodes = episodes
      .map((episode) => ({
        episode,
        entry: historyMap.get(episode.id),
      }))
      .filter((candidate): candidate is { episode: Extract<CatalogItem, { type: 'episode' }>; entry: PlaybackHistoryEntry } => Boolean(candidate.entry))
      .toSorted((left, right) => right.entry.updatedAt.localeCompare(left.entry.updatedAt))

    return watchedEpisodes[0]?.entry ?? null
  }

  return null
}

export function getResumeTarget(item: CatalogItem | null, items: CatalogItem[], history: PlaybackHistoryEntry[]) {
  if (!item) {
    return null
  }

  if (item.type !== 'series') {
    return item
  }

  const historyMap = getHistoryMap(history)
  const episodes = items
    .filter((candidate): candidate is Extract<CatalogItem, { type: 'episode' }> => candidate.type === 'episode' && candidate.seriesId === item.id)
    .toSorted((left, right) => {
      if (left.seasonNumber === right.seasonNumber) {
        return left.episodeNumber - right.episodeNumber
      }

      return left.seasonNumber - right.seasonNumber
    })

  if (!episodes.length) {
    return item
  }

  const watchedEpisodes = episodes
    .map((episode) => ({
      episode,
      entry: historyMap.get(episode.id),
    }))
    .filter((candidate): candidate is { episode: Extract<CatalogItem, { type: 'episode' }>; entry: PlaybackHistoryEntry } => Boolean(candidate.entry))
    .toSorted((left, right) => right.entry.updatedAt.localeCompare(left.entry.updatedAt))

  const latest = watchedEpisodes[0]
  if (!latest) {
    return episodes[0]
  }

  if (isCompleted(latest.entry)) {
    const nextEpisode = episodes.find((episode) => {
      if (episode.seasonNumber > latest.episode.seasonNumber) {
        return true
      }

      return episode.seasonNumber === latest.episode.seasonNumber && episode.episodeNumber > latest.episode.episodeNumber
    })

    return nextEpisode ?? latest.episode
  }

  return latest.episode
}

export function getRecommendedItems(items: CatalogItem[], history: PlaybackHistoryEntry[]) {
  const candidates = topLevelItems(items).filter((item) => item.type !== 'channel')
  if (!history.length) {
    return candidates.slice(0, 12)
  }

  const historyMap = getHistoryMap(history)
  const seriesProgress = getSeriesProgress(items, historyMap)
  const watchedGenreWeights = new Map<string, number>()
  const watchedTypeWeights = new Map<string, number>()
  const watchedIds = new Set<string>()

  for (const entry of [...history].toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 24)) {
    const item = items.find((candidate) => candidate.id === entry.itemId)
    if (!item || item.type === 'channel') {
      continue
    }

    const weight = Math.max(1, 24 - [...history].findIndex((candidate) => candidate.id === entry.id))
    const affinityItem =
      item.type === 'episode'
        ? items.find((candidate): candidate is Extract<CatalogItem, { type: 'series' }> => candidate.type === 'series' && candidate.id === item.seriesId) ?? item
        : item

    watchedIds.add(affinityItem.id)
    watchedTypeWeights.set(affinityItem.type, (watchedTypeWeights.get(affinityItem.type) ?? 0) + weight)
    for (const genre of affinityItem.genres) {
      watchedGenreWeights.set(genre, (watchedGenreWeights.get(genre) ?? 0) + weight)
    }
  }

  return candidates
    .filter((item) => !watchedIds.has(item.id))
    .map((item) => {
      const genreScore = item.genres.reduce((score, genre) => score + (watchedGenreWeights.get(genre) ?? 0), 0)
      const typeScore = watchedTypeWeights.get(item.type) ?? 0
      const freshnessScore = Math.max(0, 50 - Math.floor((Date.now() - Date.parse(item.addedAt)) / (1000 * 60 * 60 * 24)))
      const affinityBoost = item.type === 'series' && seriesProgress.has(item.id) ? 0 : 1
      return {
        item,
        score: genreScore * 3 + typeScore * 2 + freshnessScore + affinityBoost,
      }
    })
    .toSorted((left, right) => right.score - left.score || right.item.addedAt.localeCompare(left.item.addedAt))
    .map((candidate) => candidate.item)
    .slice(0, 12)
}

export function isInWatchlist(itemId: string, watchlist: WatchlistEntry[]) {
  return watchlist.some((entry) => entry.itemId === itemId)
}
