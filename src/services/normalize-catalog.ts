import type {
  CatalogChannel,
  CatalogEpisode,
  CatalogItem,
  CatalogMovie,
  CatalogSeries,
  EpgProgram,
  PlaylistEntry,
} from '../types'
import {
  createAccentFromTitle,
  getNowProgram,
  getSeriesMatch,
  parseYear,
  slugify,
  stripYear,
  unique,
} from '../lib/utils'

function detectKind(entry: PlaylistEntry): 'movie' | 'series' | 'channel' {
  const title = entry.title.toLowerCase()
  const group = entry.groupTitle?.toLowerCase() ?? ''
  const combined = `${title} ${group}`

  if (getSeriesMatch(entry.title) || /series|shows|episodes|season/.test(combined)) {
    return 'series'
  }

  if (/movie|film|cinema|vod/.test(combined)) {
    return 'movie'
  }

  return 'channel'
}

function createBase(entry: PlaylistEntry, addedAt: string) {
  return {
    synopsis: `${entry.groupTitle ?? 'Imported media'} from your IPTV library.`,
    genres: entry.groupTitle
      ? entry.groupTitle
          .split(/[|/,-]/)
          .map((genre) => genre.trim())
          .filter(Boolean)
      : [],
    artwork: {
      poster: entry.tvgLogo,
      backdrop: entry.tvgLogo,
      accent: createAccentFromTitle(entry.title),
    },
    source: {
      url: entry.url,
      isLive: detectKind(entry) === 'channel',
      mimeType: entry.url.endsWith('.m3u8') ? 'application/x-mpegURL' : undefined,
    },
    addedAt,
    year: parseYear(entry.title),
    rawGroup: entry.groupTitle,
  }
}

export function normalizeCatalog(entries: PlaylistEntry[], programs: EpgProgram[], nowIso = new Date().toISOString()): CatalogItem[] {
  const addedAt = new Date().toISOString()
  const items: CatalogItem[] = []
  const seriesMap = new Map<string, CatalogSeries>()
  const programsByChannel = new Map<string, EpgProgram[]>()

  for (const program of programs) {
    const collection = programsByChannel.get(program.channelId) ?? []
    collection.push(program)
    programsByChannel.set(program.channelId, collection)
  }

  for (const entry of entries) {
    const kind = detectKind(entry)
    const base = createBase(entry, addedAt)

    if (kind === 'movie') {
      const movie: CatalogMovie = {
        id: entry.id,
        type: 'movie',
        title: stripYear(entry.title),
        ...base,
      }
      items.push(movie)
      continue
    }

    if (kind === 'series') {
      const match = getSeriesMatch(entry.title)
      if (!match) {
        const standaloneSeries: CatalogSeries = {
          id: entry.id,
          type: 'series',
          title: entry.title,
          ...base,
          seasons: [],
          totalEpisodes: 0,
        }
        items.push(standaloneSeries)
        continue
      }

      const seriesId = slugify(`series-${match.showTitle}`)
      const episode: CatalogEpisode = {
        id: entry.id,
        type: 'episode',
        title: entry.title.replace(/^.+?S\d{1,2}E\d{1,2}\s*[-:]?\s*/i, '').trim() || `Episode ${match.episodeNumber}`,
        synopsis: `Episode ${match.episodeNumber} from ${match.showTitle}.`,
        genres: base.genres.length ? base.genres : ['Series'],
        artwork: base.artwork,
        source: { ...base.source, isLive: false },
        addedAt,
        year: base.year,
        rawGroup: entry.groupTitle,
        seriesId,
        seasonNumber: match.seasonNumber,
        episodeNumber: match.episodeNumber,
      }

      const existingSeries = seriesMap.get(seriesId)
      if (existingSeries) {
        existingSeries.totalEpisodes += 1
        existingSeries.seasons = upsertSeason(existingSeries.seasons, episode)
      } else {
        seriesMap.set(seriesId, {
          id: seriesId,
          type: 'series',
          title: match.showTitle,
          synopsis: `${match.showTitle} in your IPTV library.`,
          genres: base.genres.length ? base.genres : ['Series'],
          artwork: base.artwork,
          source: { ...base.source, isLive: false },
          addedAt,
          year: base.year,
          rawGroup: entry.groupTitle,
          seasons: [{ seasonNumber: match.seasonNumber, episodeIds: [episode.id] }],
          totalEpisodes: 1,
        })
      }

      items.push(episode)
      continue
    }

    const channelPrograms = programsByChannel.get(entry.tvgId ?? entry.title) ?? []
    const { current, next } = getNowProgram(channelPrograms, nowIso)
    const channel: CatalogChannel = {
      id: entry.id,
      type: 'channel',
      title: entry.title,
      ...base,
      genres: unique(base.genres.length ? base.genres : ['Live']),
      channelId: entry.tvgId ?? entry.title,
      currentProgram: current,
      nextProgram: next,
    }
    items.push(channel)
  }

  return [...items, ...seriesMap.values()]
}

function upsertSeason(seasons: CatalogSeries['seasons'], episode: CatalogEpisode) {
  const next = seasons.map((season) =>
    season.seasonNumber === episode.seasonNumber
      ? { ...season, episodeIds: [...season.episodeIds, episode.id] }
      : season,
  )

  if (!next.some((season) => season.seasonNumber === episode.seasonNumber)) {
    next.push({ seasonNumber: episode.seasonNumber, episodeIds: [episode.id] })
  }

  return next.toSorted((left, right) => left.seasonNumber - right.seasonNumber)
}
