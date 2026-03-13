import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../lib/db'
import { DEMO_APP_CONFIG } from '../lib/demo'
import { useAppStore } from './app-store'

const EMPTY_CATALOG = { items: [], importedAt: '' }

describe('useAppStore', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    useAppStore.setState({
      status: 'booting',
      config: null,
      catalog: EMPTY_CATALOG,
      history: [],
      errorMessage: null,
    })
  })

  it('boots into setup with no saved config, then imports and reloads the demo library', async () => {
    await useAppStore.getState().bootstrap()
    expect(useAppStore.getState().status).toBe('needs-setup')

    await useAppStore.getState().saveSetup({
      providerType: DEMO_APP_CONFIG.providerType,
      playlistUrl: DEMO_APP_CONFIG.playlistUrl,
      epgUrl: DEMO_APP_CONFIG.epgUrl,
      portalUrl: DEMO_APP_CONFIG.portalUrl,
      macAddress: DEMO_APP_CONFIG.macAddress,
      tmdbApiKey: '',
      preferredProfile: 'cinema',
    })

    expect(useAppStore.getState().status).toBe('ready')
    expect(useAppStore.getState().catalog.items.length).toBeGreaterThan(0)

    useAppStore.setState({
      status: 'booting',
      config: null,
      catalog: EMPTY_CATALOG,
      history: [],
      errorMessage: null,
    })

    await useAppStore.getState().bootstrap()
    expect(useAppStore.getState().status).toBe('ready')
    expect(useAppStore.getState().catalog.items.length).toBeGreaterThan(0)

    await useAppStore.getState().refreshLibrary()
    expect(useAppStore.getState().status).toBe('ready')
  })
})
