import { loadTextResource } from '../lib/resource-loader'
import { enrichCatalogItems } from './metadata-enricher'
import { normalizeCatalog } from './normalize-catalog'
import { parseXmltv } from './epg-provider'
import { parseM3u } from './playlist-provider'
import type { AppConfig, CatalogSnapshot } from '../types'

export async function importLibrary(config: AppConfig): Promise<CatalogSnapshot> {
  const [playlistContent, epgContent] = await Promise.all([
    loadTextResource(config.playlistUrl),
    loadTextResource(config.epgUrl),
  ])

  const parsedPlaylist = parseM3u(playlistContent)
  const parsedPrograms = parseXmltv(epgContent)
  const normalized = normalizeCatalog(parsedPlaylist, parsedPrograms)
  const items = await enrichCatalogItems(normalized, config.tmdbApiKey)

  return {
    items,
    importedAt: new Date().toISOString(),
  }
}
