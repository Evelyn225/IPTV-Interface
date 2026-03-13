import { Link } from 'react-router-dom'
import type { CatalogItem, PlaybackHistoryEntry } from '../types'

interface MediaCardProps {
  item: CatalogItem
  historyEntry?: PlaybackHistoryEntry
}

export function MediaCard({ item, historyEntry }: MediaCardProps) {
  const caption =
    item.type === 'channel'
      ? item.currentProgram?.title ?? 'Live stream ready'
      : historyEntry
        ? `Resume at ${Math.floor(historyEntry.positionSeconds / 60)} min`
        : item.genres[0] ?? item.type

  return (
    <Link
      className="media-card"
      data-focusable="true"
      to={`/details/${item.id}`}
      onFocus={(event) =>
        event.currentTarget.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        })
      }
    >
      <div
        className="media-poster"
        style={{
          ['--poster-accent' as string]: item.artwork.accent ?? '#c2410c',
          ['--poster-image' as string]: item.artwork.poster ? `url(${item.artwork.poster})` : 'none',
        }}
      />
      <div className="media-copy">
        <strong>{item.title}</strong>
        <span>{caption}</span>
      </div>
    </Link>
  )
}
