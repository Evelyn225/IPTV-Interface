import type { EpgProgram } from '../types'
import { slugify } from '../lib/utils'

function parseXmltvTimestamp(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/)
  if (!match) {
    return new Date(trimmed).toISOString()
  }

  const [, year, month, day, hour, minute, second, timezone] = match
  const offset = timezone ? `${timezone.slice(0, 3)}:${timezone.slice(3)}` : '+00:00'
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`).toISOString()
}

export function parseXmltv(content: string): EpgProgram[] {
  const parser = new DOMParser()
  const xml = parser.parseFromString(content, 'application/xml')
  const programmeNodes = Array.from(xml.querySelectorAll('programme'))

  return programmeNodes.map((programme) => {
    const channelId = programme.getAttribute('channel') ?? 'unknown-channel'
    const title = programme.querySelector('title')?.textContent?.trim() ?? 'Untitled program'
    return {
      id: slugify(`${channelId}-${title}-${programme.getAttribute('start') ?? ''}`),
      channelId,
      title,
      description: programme.querySelector('desc')?.textContent?.trim() ?? '',
      start: parseXmltvTimestamp(programme.getAttribute('start') ?? ''),
      stop: parseXmltvTimestamp(programme.getAttribute('stop') ?? ''),
    }
  })
}
