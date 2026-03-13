import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/app-shell'
import { useArrowNavigation } from './hooks/use-arrow-navigation'
import { useBackNavigation } from './hooks/use-back-navigation'
import { useBootstrap } from './hooks/use-bootstrap'
import { LibraryPage } from './pages/library-page'
import { SetupPage } from './pages/setup-page'
import { useAppStore } from './store/app-store'

const DetailsPage = lazy(async () => import('./pages/details-page').then((module) => ({ default: module.DetailsPage })))
const PlayerPage = lazy(async () => import('./pages/player-page').then((module) => ({ default: module.PlayerPage })))
const SearchPage = lazy(async () => import('./pages/search-page').then((module) => ({ default: module.SearchPage })))
const SettingsPage = lazy(async () => import('./pages/settings-page').then((module) => ({ default: module.SettingsPage })))

function RouteLoadingFallback() {
  return (
    <main className="page-shell">
      <section className="filter-panel">
        <p className="eyebrow">Loading panel</p>
        <h2>Bringing that screen into focus.</h2>
      </section>
    </main>
  )
}

function AppRuntime() {
  useBootstrap()
  useArrowNavigation()
  useBackNavigation()

  const status = useAppStore((state) => state.status)
  const config = useAppStore((state) => state.config)
  const errorMessage = useAppStore((state) => state.errorMessage)

  if (status === 'booting' || status === 'loading') {
    return (
      <main className="loading-stage">
        <div className="loading-card">
          <p className="eyebrow">Spooling your library</p>
          <h1>Building the wall of posters.</h1>
          <p>Parsing playlists, syncing guide data, and shaping the lounge for remote-first browsing.</p>
        </div>
      </main>
    )
  }

  if (status === 'error' && !config) {
    return <SetupPage />
  }

  return (
    <>
      {status === 'error' && errorMessage ? <div className="global-toast">{errorMessage}</div> : null}
      <Routes>
        <Route element={config ? <Navigate replace to="/" /> : <SetupPage />} path="/setup" />
        <Route element={config ? <AppShell /> : <Navigate replace to="/setup" />} path="/">
          <Route index element={<LibraryPage section="home" />} />
          <Route element={<LibraryPage section="movies" />} path="movies" />
          <Route element={<LibraryPage section="series" />} path="series" />
          <Route element={<LibraryPage section="live" />} path="live" />
          <Route
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <SearchPage />
              </Suspense>
            }
            path="search"
          />
          <Route
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <SettingsPage />
              </Suspense>
            }
            path="settings"
          />
          <Route
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <DetailsPage />
              </Suspense>
            }
            path="details/:itemId"
          />
        </Route>
        <Route
          element={
            config ? (
              <Suspense fallback={<RouteLoadingFallback />}>
                <PlayerPage />
              </Suspense>
            ) : (
              <Navigate replace to="/setup" />
            )
          }
          path="/player/:itemId"
        />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRuntime />
    </BrowserRouter>
  )
}
