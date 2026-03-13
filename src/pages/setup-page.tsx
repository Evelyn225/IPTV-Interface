import { useState } from 'react'
import { DEMO_APP_CONFIG } from '../lib/demo'
import { useAppStore } from '../store/app-store'

export function SetupPage() {
  const saveSetup = useAppStore((state) => state.saveSetup)
  const status = useAppStore((state) => state.status)
  const errorMessage = useAppStore((state) => state.errorMessage)
  const [form, setForm] = useState<{
    playlistUrl: string
    epgUrl: string
    tmdbApiKey: string
    preferredProfile: 'cinema' | 'balanced'
  }>({
    playlistUrl: '',
    epgUrl: '',
    tmdbApiKey: '',
    preferredProfile: 'cinema',
  })

  return (
    <main className="setup-page">
      <section className="setup-stage">
        <div className="setup-copy">
          <p className="eyebrow">Firestick IPTV setup</p>
          <h1>Turn raw IPTV feeds into a cinematic streaming lounge.</h1>
          <p>
            Paste your M3U playlist and XMLTV guide, add an optional TMDb key for richer posters, then import the catalog into a remote-friendly browsing shell.
          </p>
          <div className="setup-notes">
            <span>Remote-safe focus states</span>
            <span>Movies, series, and live rails</span>
            <span>Local cache with resume history</span>
          </div>
        </div>

        <form
          className="setup-form"
          onSubmit={(event) => {
            event.preventDefault()
            void saveSetup(form)
          }}
        >
          <label className="field">
            <span>M3U playlist URL</span>
            <input
              className="text-field"
              data-focusable="true"
              onChange={(event) => setForm((current) => ({ ...current, playlistUrl: event.target.value }))}
              placeholder="https://provider.example/playlist.m3u"
              value={form.playlistUrl}
            />
          </label>

          <label className="field">
            <span>XMLTV guide URL</span>
            <input
              className="text-field"
              data-focusable="true"
              onChange={(event) => setForm((current) => ({ ...current, epgUrl: event.target.value }))}
              placeholder="https://provider.example/guide.xml"
              value={form.epgUrl}
            />
          </label>

          <label className="field">
            <span>TMDb API key</span>
            <input
              className="text-field"
              data-focusable="true"
              onChange={(event) => setForm((current) => ({ ...current, tmdbApiKey: event.target.value }))}
              placeholder="Optional for richer artwork"
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

          {errorMessage ? <p className="setup-error">{errorMessage}</p> : null}

          <div className="hero-actions">
            <button className="action-link action-link--primary" data-focusable="true" disabled={status === 'loading'} type="submit">
              {status === 'loading' ? 'Importing library...' : 'Start Import'}
            </button>
            <button
              className="action-link"
              data-focusable="true"
              type="button"
              onClick={() =>
                setForm({
                  playlistUrl: DEMO_APP_CONFIG.playlistUrl,
                  epgUrl: DEMO_APP_CONFIG.epgUrl,
                  tmdbApiKey: '',
                  preferredProfile: 'cinema',
                })
              }
            >
              Try Demo Catalog
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
