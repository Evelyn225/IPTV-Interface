import type { CatalogItem } from '../types'
import { resolveSeriesEpisodes } from './utils'

export function detectPlaybackMode(url?: string, mimeType?: string) {
  if (mimeType?.includes('mpegURL') || url?.endsWith('.m3u8')) {
    return 'hls'
  }

  return 'native'
}

export function resolvePlayableItem(item: CatalogItem, items: CatalogItem[]) {
  if (item.type !== 'series') {
    return item
  }

  return resolveSeriesEpisodes(item, items)[0] ?? null
}
