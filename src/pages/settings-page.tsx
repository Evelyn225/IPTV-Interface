import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBanner } from '../components/status-banner'
import { DEMO_APP_CONFIG } from '../lib/demo'
import { loadTextResource } from '../lib/resource-loader'
import { testPortalConnection } from '../services/portal-provider'
import { useAppStore } from '../store/app-store'

export function SettingsPage() {
  const usesOnDevicePortalBridge = Capacitor.getPlatform() === 'android'
  const config = useAppStore((state) => state.config)
  const refreshLibrary = useAppStore((state) => state.refreshLibrary)
  const clearCachedLibrary = useAppStore((state) => state.clearCachedLibrary)
  const saveSetup = useAppStore((state) => state.saveSetup)
  const [status, setStatus] = useState('')
  const [testing, setTesting] = useState(false)
  const [form, setForm] = useState({
    providerType: config?.providerType ?? 'm3u',
    playlistUrl: config?.playlistUrl ?? '',
    epgUrl: config?.epgUrl ?? '',
    portalUrl: config?.portalUrl ?? '',
    portalBackendUrl: config?.portalBackendUrl ?? '',
    macAddress: config?.macAddress ?? '',
    tmdbApiKey: config?.tmdbApiKey ?? '',
    preferredProfile: config?.preferredProfile ?? 'cinema',
  })

  async function handleTest() {
    setTesting(true)
    setStatus('')
    try {
      if (form.providerType === 'portal') {
        await testPortalConnection({
          portalUrl: form.portalUrl,
          portalBackendUrl: form.portalBackendUrl,
          macAddress: form.macAddress,
        })
        setStatus('Portal handshake succeeded.')
      } else {
        await Promise.all([loadTextResource(form.playlistUrl), loadTextResource(form.epgUrl)])
        setStatus('Both sources responded successfully.')
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to reach the configured sources.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <main className="page-shell">
      <section className="settings-grid">
        <article className="settings-card">
          <p className="eyebrow">Library control</p>
          <h1>Refresh, test, and re-shape your IPTV source.</h1>
          <p className="settings-copy">
            Browser-based IPTV setups often depend on CORS-friendly playlist hosts. If a source fails here, it may still need a proxy or wrapper later.
          </p>

          {status ? (
            <StatusBanner
              message={status}
              status={status.includes('successfully') || status.includes('succeeded') ? 'loading' : 'error'}
            />
          ) : null}

          <div className="chip-row">
            {[
              { value: 'm3u', label: 'M3U / XMLTV' },
              { value: 'portal', label: 'Portal / MAC' },
            ].map((provider) => (
              <button
                key={provider.value}
                className={`chip${provider.value === form.providerType ? ' is-active' : ''}`}
                data-focusable="true"
                type="button"
                onClick={() => setForm((current) => ({ ...current, providerType: provider.value as 'm3u' | 'portal' }))}
              >
                {provider.label}
              </button>
            ))}
          </div>

          {form.providerType === 'm3u' ? (
            <>
              <label className="field">
                <span>Playlist URL</span>
                <input
                  className="text-field"
                  data-focusable="true"
                  onChange={(event) => setForm((current) => ({ ...current, playlistUrl: event.target.value }))}
                  value={form.playlistUrl}
                />
              </label>

              <label className="field">
                <span>XMLTV URL</span>
                <input
                  className="text-field"
                  data-focusable="true"
                  onChange={(event) => setForm((current) => ({ ...current, epgUrl: event.target.value }))}
                  value={form.epgUrl}
                />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span>Portal URL</span>
                <input
                  className="text-field"
                  data-focusable="true"
                  onChange={(event) => setForm((current) => ({ ...current, portalUrl: event.target.value }))}
                  value={form.portalUrl}
                />
              </label>

              <label className="field">
                <span>MAC address</span>
                <input
                  className="text-field"
                  data-focusable="true"
                  onChange={(event) => setForm((current) => ({ ...current, macAddress: event.target.value.toUpperCase() }))}
                  value={form.macAddress}
                />
              </label>

              {!usesOnDevicePortalBridge ? (
                <label className="field">
                  <span>Portal backend URL</span>
                  <input
                    className="text-field"
                    data-focusable="true"
                    onChange={(event) => setForm((current) => ({ ...current, portalBackendUrl: event.target.value }))}
                    placeholder="http://192.168.x.x:8787"
                    value={form.portalBackendUrl}
                  />
                </label>
              ) : null}
            </>
          )}

          <label className="field">
            <span>TMDb API Key</span>
            <input
              className="text-field"
              data-focusable="true"
              onChange={(event) => setForm((current) => ({ ...current, tmdbApiKey: event.target.value }))}
              value={form.tmdbApiKey}
            />
          </label>

          <div className="chip-row">
            {['cinema', 'balanced'].map((profile) => (
              <button
                key={profile}
                className={`chip${profile === form.preferredProfile ? ' is-active' : ''}`}
                data-focusable="true"
                type="button"
                onClick={() => setForm((current) => ({ ...current, preferredProfile: profile as 'cinema' | 'balanced' }))}
              >
                {profile}
              </button>
            ))}
          </div>

          <div className="hero-actions">
            <button
              className="action-link action-link--primary"
              data-focusable="true"
              type="button"
              onClick={() => void saveSetup(form)}
            >
              Save And Import
            </button>
            <button className="action-link" data-focusable="true" type="button" onClick={() => void refreshLibrary()}>
              Refresh Now
            </button>
            <button className="action-link" data-focusable="true" disabled={testing} type="button" onClick={() => void handleTest()}>
              {testing ? 'Testing...' : 'Test Sources'}
            </button>
            <button className="action-link" data-focusable="true" type="button" onClick={() => void clearCachedLibrary()}>
              Clear Cache
            </button>
            <button
              className="action-link"
              data-focusable="true"
              type="button"
              onClick={() =>
                setForm({
                  providerType: DEMO_APP_CONFIG.providerType,
                  playlistUrl: DEMO_APP_CONFIG.playlistUrl,
                  epgUrl: DEMO_APP_CONFIG.epgUrl,
                  portalUrl: DEMO_APP_CONFIG.portalUrl,
                  portalBackendUrl: DEMO_APP_CONFIG.portalBackendUrl,
                  macAddress: DEMO_APP_CONFIG.macAddress,
                  tmdbApiKey: '',
                  preferredProfile: 'cinema',
                })
              }
            >
              Load Demo Settings
            </button>
          </div>
        </article>
      </section>
    </main>
  )
}
