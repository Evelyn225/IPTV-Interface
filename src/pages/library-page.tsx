import { startTransition, useState } from 'react'
import { HeroSpotlight } from '../components/hero-spotlight'
import { MediaCard } from '../components/media-card'
import { MediaRail } from '../components/media-rail'
import {
  getFeaturedItem,
  getGenreOptions,
  getGridItems,
  getRailsForSection,
  getRecommendedItems,
  getResumeEntry,
  isInWatchlist,
} from '../lib/catalog-selectors'
import { useAppStore } from '../store/app-store'
import type { LibrarySection } from '../types'

interface LibraryPageProps {
  section: LibrarySection
}

export function LibraryPage({ section }: LibraryPageProps) {
  const { items } = useAppStore((state) => state.catalog)
  const history = useAppStore((state) => state.history)
  const watchlist = useAppStore((state) => state.watchlist)
  const toggleWatchlist = useAppStore((state) => state.toggleWatchlist)
  const [activeGenre, setActiveGenre] = useState('All')

  const featured = getFeaturedItem(items, history, section)
  const rails = getRailsForSection(items, history, watchlist, section)
  const recommended = section === 'home' ? getRecommendedItems(items, history).slice(0, 6) : []
  const genres = ['All', ...getGenreOptions(items, section)]
  const gridItems = getGridItems(items, section, activeGenre).slice(0, 18)

  return (
    <main className="page-shell">
      <HeroSpotlight
        eyebrow={section === 'home' ? 'Tonight on your shelf' : `${section} showcase`}
        history={history}
        item={featured}
        items={items}
        isWatchlisted={featured ? isInWatchlist(featured.id, watchlist) : false}
        onToggleWatchlist={featured && (featured.type === 'movie' || featured.type === 'series') ? () => void toggleWatchlist(featured.id) : undefined}
      />

      {section === 'home' && recommended.length > 0 ? (
        <section className="filter-panel">
          <div className="section-heading">
            <p>Watch affinity</p>
            <h2>Recommended for you</h2>
          </div>
          <div className="feature-grid">
            {recommended.map((item) => (
              <MediaCard key={item.id} historyEntry={getResumeEntry(item, items, history) ?? undefined} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {(section === 'movies' || section === 'series' || section === 'live') && (
        <section className="filter-panel">
          <div className="section-heading">
            <p>Filter lane</p>
            <h2>Jump by genre</h2>
          </div>
          <div className="chip-row">
            {genres.map((genre) => (
              <button
                key={genre}
                className={`chip${genre === activeGenre ? ' is-active' : ''}`}
                data-focusable="true"
                type="button"
                onClick={() => startTransition(() => setActiveGenre(genre))}
              >
                {genre}
              </button>
            ))}
          </div>
          <div className="feature-grid">
            {gridItems.map((item) => (
              <MediaCard key={item.id} historyEntry={getResumeEntry(item, items, history) ?? undefined} item={item} />
            ))}
          </div>
        </section>
      )}

      {rails.map((rail) => (
        <MediaRail key={rail.id} history={history} items={items} rail={rail} />
      ))}
    </main>
  )
}
