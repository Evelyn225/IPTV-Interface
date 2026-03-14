import { Link } from 'react-router-dom'
import type { CatalogItem, PlaybackHistoryEntry } from '../types'
import { getResumeEntry, getResumeTarget } from '../lib/catalog-selectors'
import { minutesFromSeconds } from '../lib/utils'

interface HeroSpotlightProps {
  item: CatalogItem | null
  items: CatalogItem[]
  history: PlaybackHistoryEntry[]
  eyebrow: string
  isWatchlisted?: boolean
  onToggleWatchlist?: () => void
}

export function HeroSpotlight({ item, items, history, eyebrow, isWatchlisted = false, onToggleWatchlist }: HeroSpotlightProps) {
  if (!item) {
    return (
      <section className="hero-card hero-card--empty">
        <p className="eyebrow">Your lounge is waiting</p>
        <h1>Import your library to light up the poster wall.</h1>
        <p>The first sync turns raw IPTV feeds into a cinematic catalog with rails, details, and fullscreen playback.</p>
        <Link className="action-link" data-focusable="true" to="/settings">
          Open Settings
        </Link>
      </section>
    )
  }

  const playable = getResumeTarget(item, items, history)
  const historyEntry = getResumeEntry(item, items, history)

  return (
    <section
      className="hero-card"
      style={{
        ['--hero-accent' as string]: item.artwork.accent ?? '#ff5733',
        ['--hero-image' as string]: item.artwork.backdrop ? `url(${item.artwork.backdrop})` : 'none',
      }}
    >
      <div className="hero-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{item.title}</h1>
        <p className="hero-meta">
          <span>{item.type.toUpperCase()}</span>
          {item.year ? <span>{item.year}</span> : null}
          {item.genres.slice(0, 2).map((genre) => (
            <span key={genre}>{genre}</span>
          ))}
        </p>
        <p className="hero-summary">{item.synopsis}</p>
        <div className="hero-actions">
          {playable ? (
            <Link className="action-link action-link--primary" data-focusable="true" to={`/player/${playable.id}`}>
              {historyEntry ? `Resume ${minutesFromSeconds(historyEntry.positionSeconds)}` : 'Play Now'}
            </Link>
          ) : null}
          {onToggleWatchlist ? (
            <button className="action-link" data-focusable="true" type="button" onClick={onToggleWatchlist}>
              {isWatchlisted ? 'Remove Watchlist' : 'Add To Watchlist'}
            </button>
          ) : null}
          <Link className="action-link" data-focusable="true" to={`/details/${item.id}`}>
            View Details
          </Link>
        </div>
      </div>
    </section>
  )
}
