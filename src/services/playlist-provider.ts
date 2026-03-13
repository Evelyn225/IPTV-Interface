import type { PlaylistEntry } from '../types'
import { slugify } from '../lib/utils'

const ATTRIBUTE_PATTERN = /([\w-]+)="([^"]*)"/g

export function parseM3u(content: string): PlaylistEntry[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim())
  const entries: PlaylistEntry[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.startsWith('#EXTINF:')) {
      continue
    }

    const nextLine = lines[index + 1]
    if (!nextLine || nextLine.startsWith('#')) {
      continue
    }

    const detail = line.slice('#EXTINF:'.length)
    const commaIndex = detail.indexOf(',')
    const info = commaIndex >= 0 ? detail.slice(0, commaIndex) : detail
    const title = commaIndex >= 0 ? detail.slice(commaIndex + 1).trim() : 'Untitled stream'
    const attrs = Object.fromEntries(Array.from(info.matchAll(ATTRIBUTE_PATTERN), (match) => [match[1], match[2]]))

    entries.push({
      id: slugify(`${attrs['tvg-id'] ?? title}-${entries.length}`),
      title,
      url: nextLine,
      groupTitle: attrs['group-title'],
      tvgId: attrs['tvg-id'],
      tvgName: attrs['tvg-name'],
      tvgLogo: attrs['tvg-logo'],
      attrs,
    })
  }

  return entries
}
