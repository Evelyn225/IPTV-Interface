import { Link } from 'react-router-dom'
import type { CatalogItem, PlaybackHistoryEntry } from '../types'
import { resolvePlayableItem } from '../lib/playback'
import { minutesFromSeconds } from '../lib/utils'

interface HeroSpotlightProps {
  item: CatalogItem | null
  items: CatalogItem[]
  history: PlaybackHistoryEntry[]
  eyebrow: string
}

export function HeroSpotlight({ item, items, history, eyebrow }: HeroSpotlightProps) {
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

  const playable = resolvePlayableItem(item, items)
  const historyEntry = history.find((entry) => entry.itemId === playable?.id)

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
          <Link className="action-link" data-focusable="true" to={`/details/${item.id}`}>
            View Details
          </Link>
        </div>
      </div>
    </section>
  )
}
