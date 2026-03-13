import type { PlaybackHistoryEntry, Rail } from '../types'
import { MediaCard } from './media-card'

interface MediaRailProps {
  rail: Rail
  history: PlaybackHistoryEntry[]
}

export function MediaRail({ rail, history }: MediaRailProps) {
  return (
    <section className="media-rail-section">
      <div className="section-heading">
        <p>{rail.sortRule}</p>
        <h2>{rail.title}</h2>
      </div>
      <div className="media-rail-row">
        {rail.items.map((item) => (
          <MediaCard key={item.id} historyEntry={history.find((entry) => entry.itemId === item.id)} item={item} />
        ))}
      </div>
    </section>
  )
}
