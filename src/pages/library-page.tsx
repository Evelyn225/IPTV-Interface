import { startTransition, useState } from 'react'
import { HeroSpotlight } from '../components/hero-spotlight'
import { MediaCard } from '../components/media-card'
import { MediaRail } from '../components/media-rail'
import { getFeaturedItem, getGenreOptions, getGridItems, getRailsForSection } from '../lib/catalog-selectors'
import { useAppStore } from '../store/app-store'
import type { LibrarySection } from '../types'

interface LibraryPageProps {
  section: LibrarySection
}

export function LibraryPage({ section }: LibraryPageProps) {
  const { items } = useAppStore((state) => state.catalog)
  const history = useAppStore((state) => state.history)
  const [activeGenre, setActiveGenre] = useState('All')

  const featured = getFeaturedItem(items, history, section)
  const rails = getRailsForSection(items, history, section)
  const genres = ['All', ...getGenreOptions(items, section)]
  const gridItems = getGridItems(items, section, activeGenre).slice(0, 18)

  return (
    <main className="page-shell">
      <HeroSpotlight
        eyebrow={section === 'home' ? 'Tonight on your shelf' : `${section} showcase`}
        history={history}
        item={featured}
        items={items}
      />

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
              <MediaCard key={item.id} historyEntry={history.find((entry) => entry.itemId === item.id)} item={item} />
            ))}
          </div>
        </section>
      )}

      {rails.map((rail) => (
        <MediaRail key={rail.id} history={history} rail={rail} />
      ))}
    </main>
  )
}
