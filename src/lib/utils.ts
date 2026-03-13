import type { CatalogEpisode, CatalogItem, CatalogSeries, EpgProgram, MediaType } from '../types'

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function parseYear(value: string): number | undefined {
  const match = value.match(/\b(19|20)\d{2}\b/)
  return match ? Number(match[0]) : undefined
}

export function stripYear(value: string): string {
  return value.replace(/\s*\((19|20)\d{2}\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

export function getSeriesMatch(value: string): { showTitle: string; seasonNumber: number; episodeNumber: number } | null {
  const match = value.match(/(.+?)\s*S(\d{1,2})E(\d{1,2})(?:\s*[-:]\s*(.+))?/i)
  if (!match) {
    return null
  }

  return {
    showTitle: match[1].trim(),
    seasonNumber: Number(match[2]),
    episodeNumber: Number(match[3]),
  }
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

export function minutesFromSeconds(value?: number): string {
  if (!value || Number.isNaN(value)) {
    return 'Fresh start'
  }

  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function sortByAddedDate(items: CatalogItem[]): CatalogItem[] {
  return [...items].toSorted((left, right) => right.addedAt.localeCompare(left.addedAt))
}

export function sortPrograms(programs: EpgProgram[]): EpgProgram[] {
  return [...programs].toSorted((left, right) => left.start.localeCompare(right.start))
}

export function getNowProgram(programs: EpgProgram[], nowIso = new Date().toISOString()) {
  const now = new Date(nowIso)
  const sorted = sortPrograms(programs)
  const current = sorted.find((program) => new Date(program.start) <= now && new Date(program.stop) >= now)
  const next = sorted.find((program) => new Date(program.start) > now)
  return { current, next }
}

export function groupGenres(items: CatalogItem[], type?: MediaType): string[] {
  return unique(
    items
      .filter((item) => !type || item.type === type)
      .flatMap((item) => item.genres)
      .filter(Boolean),
  ).toSorted()
}

export function createAccentFromTitle(title: string): string {
  let hash = 0
  for (let index = 0; index < title.length; index += 1) {
    hash = title.charCodeAt(index) + ((hash << 5) - hash)
  }

  const hue = Math.abs(hash % 360)
  return `hsl(${hue} 70% 55%)`
}

export function resolveSeriesEpisodes(series: CatalogSeries, items: CatalogItem[]) {
  return items
    .filter((item): item is CatalogEpisode => item.type === 'episode' && item.seriesId === series.id)
    .toSorted((left, right) => {
      if (left.seasonNumber === right.seasonNumber) {
        return left.episodeNumber - right.episodeNumber
      }

      return left.seasonNumber - right.seasonNumber
    })
}
