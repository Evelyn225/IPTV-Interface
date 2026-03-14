import Dexie, { type Table } from 'dexie'
import type {
  AppConfig,
  CatalogItem,
  CatalogSnapshot,
  PlaybackHistoryEntry,
  TmdbCacheRecord,
  WatchlistEntry,
} from '../types'

interface AppMetaRecord {
  key: string
  value: string
}

class FirestickDb extends Dexie {
  config!: Table<AppConfig, string>
  catalog!: Table<CatalogItem, string>
  history!: Table<PlaybackHistoryEntry, string>
  watchlist!: Table<WatchlistEntry, string>
  meta!: Table<AppMetaRecord, string>
  tmdbCache!: Table<TmdbCacheRecord, string>

  constructor() {
    super('firestick-iptv-db')
    this.version(1).stores({
      config: 'id',
      catalog: 'id, type, title, addedAt',
      history: 'id, itemId, updatedAt',
      meta: 'key',
      tmdbCache: 'key, updatedAt',
    })
    this.version(2).stores({
      config: 'id',
      catalog: 'id, type, title, addedAt',
      history: 'id, itemId, updatedAt',
      watchlist: 'id, itemId, addedAt',
      meta: 'key',
      tmdbCache: 'key, updatedAt',
    })
  }
}

export const db = new FirestickDb()

export async function loadConfig() {
  return db.config.get('default')
}

export async function saveConfig(config: AppConfig) {
  await db.config.put(config)
}

export async function saveCatalogSnapshot(snapshot: CatalogSnapshot) {
  await db.transaction('rw', db.catalog, db.meta, async () => {
    await db.catalog.clear()
    await db.catalog.bulkPut(snapshot.items)
    await db.meta.put({ key: 'importedAt', value: snapshot.importedAt })
  })
}

export async function loadCatalogSnapshot(): Promise<CatalogSnapshot> {
  const [items, importedAt] = await Promise.all([
    db.catalog.toArray(),
    db.meta.get('importedAt'),
  ])

  return {
    items,
    importedAt: importedAt?.value ?? '',
  }
}

export async function savePlaybackHistory(entry: PlaybackHistoryEntry) {
  await db.history.put(entry)
}

export async function loadPlaybackHistory() {
  return db.history.orderBy('updatedAt').reverse().toArray()
}

export async function saveWatchlistEntry(entry: WatchlistEntry) {
  await db.watchlist.put(entry)
}

export async function deleteWatchlistEntry(itemId: string) {
  await db.watchlist.delete(itemId)
}

export async function loadWatchlist() {
  return db.watchlist.orderBy('addedAt').reverse().toArray()
}

export async function clearLibrary() {
  await db.transaction('rw', db.catalog, db.history, db.meta, async () => {
    await db.catalog.clear()
    await db.history.clear()
    await db.meta.clear()
  })
}

export async function clearAllData() {
  await db.delete()
}
