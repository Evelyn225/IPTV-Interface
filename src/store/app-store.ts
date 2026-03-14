import { create } from 'zustand'
import {
  clearLibrary,
  deleteWatchlistEntry,
  loadCatalogSnapshot,
  loadConfig,
  loadPlaybackHistory,
  loadWatchlist,
  saveCatalogSnapshot,
  saveConfig,
  savePlaybackHistory,
  saveWatchlistEntry,
} from '../lib/db'
import type { AppConfig, CatalogSnapshot, PlaybackHistoryEntry, PreferredProfile, ProviderType, WatchlistEntry } from '../types'
import { importLibrary } from '../services/import-library'

type AppStatus = 'booting' | 'needs-setup' | 'loading' | 'ready' | 'error'

interface SaveSetupInput {
  providerType: ProviderType
  playlistUrl: string
  epgUrl: string
  portalUrl: string
  portalBackendUrl: string
  macAddress: string
  tmdbApiKey: string
  preferredProfile: PreferredProfile
}

interface AppState {
  status: AppStatus
  config: AppConfig | null
  catalog: CatalogSnapshot
  history: PlaybackHistoryEntry[]
  watchlist: WatchlistEntry[]
  errorMessage: string | null
  bootstrap: () => Promise<void>
  saveSetup: (input: SaveSetupInput) => Promise<void>
  refreshLibrary: () => Promise<void>
  recordPlayback: (payload: {
    itemId: string
    positionSeconds: number
    durationSeconds?: number
  }) => Promise<void>
  toggleWatchlist: (itemId: string) => Promise<void>
  clearCachedLibrary: () => Promise<void>
}

const emptyCatalog: CatalogSnapshot = {
  items: [],
  importedAt: '',
}

let bootstrapPromise: Promise<void> | null = null

export const useAppStore = create<AppState>((set, get) => ({
  status: 'booting',
  config: null,
  catalog: emptyCatalog,
  history: [],
  watchlist: [],
  errorMessage: null,

  async bootstrap() {
    if (bootstrapPromise) {
      await bootstrapPromise
      return
    }

    bootstrapPromise = (async () => {
      try {
        const config = await loadConfig()
        if (!config) {
          set({ status: 'needs-setup', config: null, catalog: emptyCatalog, history: [], watchlist: [], errorMessage: null })
          return
        }

        const [catalog, history, watchlist] = await Promise.all([loadCatalogSnapshot(), loadPlaybackHistory(), loadWatchlist()])
        if (!catalog.items.length) {
          set({ config, history, watchlist, status: 'loading', errorMessage: null })
          const snapshot = await importLibrary(config)
          const nextConfig = { ...config, lastRefreshAt: snapshot.importedAt }
          await Promise.all([saveCatalogSnapshot(snapshot), saveConfig(nextConfig)])
          set({ config: nextConfig, catalog: snapshot, history, watchlist, status: 'ready', errorMessage: null })
          return
        }

        set({ config, catalog, history, watchlist, status: 'ready', errorMessage: null })
      } catch (error) {
      set({
        status: 'error',
        watchlist: [],
        errorMessage: error instanceof Error ? error.message : 'Unable to load the library.',
      })
      } finally {
        bootstrapPromise = null
      }
    })()

    await bootstrapPromise
  },

  async saveSetup(input) {
    const nextConfig: AppConfig = {
      id: 'default',
      ...input,
      lastRefreshAt: new Date().toISOString(),
    }

    set({ config: nextConfig, status: 'loading', errorMessage: null })
    await saveConfig(nextConfig)

    try {
      const snapshot = await importLibrary(nextConfig)
      const hydratedConfig = { ...nextConfig, lastRefreshAt: snapshot.importedAt }
      await Promise.all([saveCatalogSnapshot(snapshot), saveConfig(hydratedConfig)])
      const [history, watchlist] = await Promise.all([loadPlaybackHistory(), loadWatchlist()])
      set({ config: hydratedConfig, catalog: snapshot, history, watchlist, status: 'ready', errorMessage: null })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unable to import the IPTV library.',
      })
    }
  },

  async refreshLibrary() {
    const config = get().config
    if (!config) {
      set({ status: 'needs-setup' })
      return
    }

    set({ status: 'loading', errorMessage: null })
    try {
      const snapshot = await importLibrary(config)
      const nextConfig = { ...config, lastRefreshAt: snapshot.importedAt }
      await Promise.all([saveCatalogSnapshot(snapshot), saveConfig(nextConfig)])
      set({ config: nextConfig, catalog: snapshot, status: 'ready', errorMessage: null })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Refresh failed.',
      })
    }
  },

  async recordPlayback({ itemId, positionSeconds, durationSeconds }) {
    const entry: PlaybackHistoryEntry = {
      id: itemId,
      itemId,
      positionSeconds,
      durationSeconds,
      updatedAt: new Date().toISOString(),
    }

    await savePlaybackHistory(entry)
    const history = await loadPlaybackHistory()
    set({ history })
  },

  async toggleWatchlist(itemId) {
    const item = get().catalog.items.find((candidate) => candidate.id === itemId)
    if (!item || (item.type !== 'movie' && item.type !== 'series')) {
      return
    }

    const existing = get().watchlist.find((entry) => entry.itemId === itemId)
    if (existing) {
      await deleteWatchlistEntry(itemId)
    } else {
      await saveWatchlistEntry({
        id: itemId,
        itemId,
        addedAt: new Date().toISOString(),
      })
    }

    const watchlist = await loadWatchlist()
    set({ watchlist })
  },

  async clearCachedLibrary() {
    await clearLibrary()
    set({ catalog: emptyCatalog, history: [], status: get().config ? 'loading' : 'needs-setup' })
    if (get().config) {
      await get().refreshLibrary()
    }
  },
}))
