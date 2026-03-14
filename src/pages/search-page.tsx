import { useDeferredValue, useState } from 'react'
import { MediaCard } from '../components/media-card'
import { getResumeEntry, searchLibrary } from '../lib/catalog-selectors'
import { useAppStore } from '../store/app-store'

export function SearchPage() {
  const { items } = useAppStore((state) => state.catalog)
  const history = useAppStore((state) => state.history)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const results = searchLibrary(items, deferredQuery)

  return (
    <main className="page-shell">
      <section className="search-hero">
        <p className="eyebrow">Search the lounge</p>
        <h1>Find a title, genre, or channel in a few clicks.</h1>
        <input
          aria-label="Search library"
          className="search-input"
          data-focusable="true"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search movies, series, and live channels"
          value={query}
        />
      </section>

      <section className="filter-panel">
        <div className="section-heading">
          <p>{results.length} matches</p>
          <h2>Results</h2>
        </div>
        <div className="feature-grid">
          {results.map((item) => (
            <MediaCard key={item.id} historyEntry={getResumeEntry(item, items, history) ?? undefined} item={item} />
          ))}
        </div>
      </section>
    </main>
  )
}
