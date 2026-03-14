import { Link, useParams } from 'react-router-dom'
import { MediaRail } from '../components/media-rail'
import { getItemById, getResumeEntry, getResumeTarget, isInWatchlist } from '../lib/catalog-selectors'
import { minutesFromSeconds, resolveSeriesEpisodes } from '../lib/utils'
import { useAppStore } from '../store/app-store'

export function DetailsPage() {
  const { itemId } = useParams()
  const { items } = useAppStore((state) => state.catalog)
  const history = useAppStore((state) => state.history)
  const watchlist = useAppStore((state) => state.watchlist)
  const toggleWatchlist = useAppStore((state) => state.toggleWatchlist)
  const item = getItemById(items, itemId)

  if (!item) {
    return (
      <main className="page-shell">
        <section className="hero-card hero-card--empty">
          <p className="eyebrow">Missing title</p>
          <h1>We could not find that item.</h1>
          <Link className="action-link" data-focusable="true" to="/">
            Return Home
          </Link>
        </section>
      </main>
    )
  }

  const playable = getResumeTarget(item, items, history)
  const resumeEntry = getResumeEntry(item, items, history)
  const canWatchlist = item.type === 'movie' || item.type === 'series'
  const watchlisted = canWatchlist ? isInWatchlist(item.id, watchlist) : false
  const related = items
    .filter((candidate) => candidate.id !== item.id && candidate.type !== 'episode' && candidate.genres.some((genre) => item.genres.includes(genre)))
    .slice(0, 10)

  return (
    <main className="page-shell">
      <section
        className="detail-stage"
        style={{
          ['--hero-image' as string]: item.artwork.backdrop ? `url(${item.artwork.backdrop})` : 'none',
          ['--hero-accent' as string]: item.artwork.accent ?? '#f97316',
        }}
      >
        <div className="detail-copy">
          <p className="eyebrow">{item.type.toUpperCase()}</p>
          <h1>{item.title}</h1>
          <p className="hero-meta">
            {item.year ? <span>{item.year}</span> : null}
            {item.genres.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </p>
          <p className="hero-summary">{item.synopsis}</p>
          {resumeEntry && item.type !== 'channel' ? (
            <p className="detail-resume-copy">Resume from {minutesFromSeconds(resumeEntry.positionSeconds)}.</p>
          ) : null}
          <div className="hero-actions">
            {playable ? (
              <Link className="action-link action-link--primary" data-focusable="true" to={`/player/${playable.id}`}>
                {resumeEntry ? 'Resume' : 'Play'}
              </Link>
            ) : null}
            {canWatchlist ? (
              <button className="action-link" data-focusable="true" type="button" onClick={() => void toggleWatchlist(item.id)}>
                {watchlisted ? 'Remove Watchlist' : 'Add To Watchlist'}
              </button>
            ) : null}
            <Link className="action-link" data-focusable="true" to="/">
              Back Home
            </Link>
          </div>
        </div>
      </section>

      {item.type === 'series' ? (
        <section className="filter-panel">
          <div className="section-heading">
            <p>{item.totalEpisodes} episodes</p>
            <h2>Season run</h2>
          </div>
          <div className="episode-list">
            {resolveSeriesEpisodes(item, items).map((episode) => (
              <Link key={episode.id} className="episode-card" data-focusable="true" to={`/player/${episode.id}`}>
                <strong>
                  S{String(episode.seasonNumber).padStart(2, '0')}E{String(episode.episodeNumber).padStart(2, '0')}
                </strong>
                <span>{episode.title}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {item.type === 'channel' ? (
        <section className="filter-panel">
          <div className="section-heading">
            <p>Now playing</p>
            <h2>Program flow</h2>
          </div>
          <div className="settings-grid">
            <article className="settings-card">
              <strong>{item.currentProgram?.title ?? 'Live signal ready'}</strong>
              <p>{item.currentProgram?.description ?? 'EPG data will appear here when the channel has matching XMLTV metadata.'}</p>
            </article>
            <article className="settings-card">
              <strong>Up next</strong>
              <p>{item.nextProgram?.title ?? 'No next program scheduled yet.'}</p>
            </article>
          </div>
        </section>
      ) : null}

      {related.length ? (
        <MediaRail
          history={history}
          items={items}
          rail={{
            id: 'related',
            title: 'Related Picks',
            itemType: 'mixed',
            sortRule: 'genre',
            items: related,
          }}
        />
      ) : null}
    </main>
  )
}
