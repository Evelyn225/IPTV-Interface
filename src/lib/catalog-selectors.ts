import type { CatalogItem, LibrarySection, PlaybackHistoryEntry, Rail } from '../types'
import { groupGenres, sortByAddedDate } from './utils'

function topLevelItems(items: CatalogItem[]) {
  return items.filter((item) => item.type !== 'episode')
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
  return history
    .map((entry) => items.find((item) => item.id === entry.itemId))
    .filter((item): item is CatalogItem => Boolean(item))
    .filter((item) => item.type !== 'channel')
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
  section: LibrarySection,
): Rail[] {
  const rails: Rail[] = []

  if (section === 'home') {
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
