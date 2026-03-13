export type LibrarySection = 'home' | 'movies' | 'series' | 'live'

export type MediaType = 'movie' | 'series' | 'episode' | 'channel'

export type PreferredProfile = 'cinema' | 'balanced'
export type ProviderType = 'm3u' | 'portal'
export type PortalStreamType = 'itv' | 'vod'

export interface AppConfig {
  id: 'default'
  providerType: ProviderType
  playlistUrl: string
  epgUrl: string
  portalUrl: string
  macAddress: string
  tmdbApiKey: string
  lastRefreshAt?: string
  preferredProfile: PreferredProfile
}

export interface MediaArtwork {
  poster?: string
  backdrop?: string
  logo?: string
  accent?: string
}

export interface PlaybackSource {
  url?: string
  mimeType?: string
  isLive: boolean
  resumePosition?: number
  providerType?: 'direct' | 'portal'
  portalType?: PortalStreamType
  portalCommand?: string
  portalEpisode?: number
}

export interface PlaylistEntry {
  id: string
  title: string
  url: string
  groupTitle?: string
  tvgId?: string
  tvgName?: string
  tvgLogo?: string
  attrs: Record<string, string>
}

export interface EpgProgram {
  id: string
  channelId: string
  title: string
  description?: string
  start: string
  stop: string
}

export interface BaseCatalogItem {
  id: string
  type: MediaType
  title: string
  synopsis: string
  genres: string[]
  artwork: MediaArtwork
  source: PlaybackSource
  addedAt: string
  year?: number
  rawGroup?: string
  tmdbId?: number
}

export interface CatalogEpisode extends BaseCatalogItem {
  type: 'episode'
  seriesId: string
  seasonNumber: number
  episodeNumber: number
}

export interface SeasonSummary {
  seasonNumber: number
  episodeIds: string[]
}

export interface CatalogSeries extends BaseCatalogItem {
  type: 'series'
  seasons: SeasonSummary[]
  totalEpisodes: number
}

export interface CatalogMovie extends BaseCatalogItem {
  type: 'movie'
  durationMinutes?: number
}

export interface CatalogChannel extends BaseCatalogItem {
  type: 'channel'
  channelNumber?: string
  channelId?: string
  currentProgram?: EpgProgram
  nextProgram?: EpgProgram
}

export type CatalogItem =
  | CatalogMovie
  | CatalogSeries
  | CatalogEpisode
  | CatalogChannel

export interface PlaybackHistoryEntry {
  id: string
  itemId: string
  positionSeconds: number
  durationSeconds?: number
  updatedAt: string
}

export interface TmdbCacheRecord {
  key: string
  title: string
  type: 'movie' | 'series'
  result: Partial<CatalogMovie | CatalogSeries>
  updatedAt: string
}

export interface Rail {
  id: string
  title: string
  itemType: MediaType | 'mixed'
  sortRule: string
  items: CatalogItem[]
}

export interface CatalogSnapshot {
  items: CatalogItem[]
  importedAt: string
}
