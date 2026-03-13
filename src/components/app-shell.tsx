import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/app-store'

const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Movies', href: '/movies' },
  { label: 'Series', href: '/series' },
  { label: 'Live', href: '/live' },
  { label: 'Search', href: '/search' },
  { label: 'Settings', href: '/settings' },
] as const

export function AppShell() {
  const location = useLocation()
  const config = useAppStore((state) => state.config)
  const importedAt = config?.lastRefreshAt
    ? new Date(config.lastRefreshAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : 'Waiting for first import'

  return (
    <div className="app-shell">
      <aside className="signal-rail">
        <div className="brand-block">
          <span className="brand-mark">Signal</span>
          <strong className="brand-title">Cinder</strong>
          <p className="brand-copy">A TV-first streaming shell for Firestick IPTV.</p>
        </div>

        <nav className="main-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.href
            return (
              <Link
                key={item.href}
                className={`nav-link${active ? ' is-active' : ''}`}
                data-focusable="true"
                to={item.href}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="rail-footer">
          <span className="footer-label">Last Sync</span>
          <strong>{importedAt}</strong>
          <span className="footer-label">Profile</span>
          <strong>{config?.preferredProfile ?? 'cinema'}</strong>
        </div>
      </aside>

      <div className="viewport">
        <div className="atmosphere" />
        <Outlet />
      </div>
    </div>
  )
}
