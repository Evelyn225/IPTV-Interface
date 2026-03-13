import { describe, expect, it } from 'vitest'
import { parseXmltv } from './epg-provider'

describe('parseXmltv', () => {
  it('parses programme metadata into ISO timestamps', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <tv>
        <programme start="20260313160000 +0000" stop="20260313170000 +0000" channel="pulse-news">
          <title>Global Pulse</title>
          <desc>Continuous headlines.</desc>
        </programme>
      </tv>`

    const programs = parseXmltv(xml)

    expect(programs).toHaveLength(1)
    expect(programs[0].channelId).toBe('pulse-news')
    expect(programs[0].title).toBe('Global Pulse')
    expect(programs[0].start).toBe('2026-03-13T16:00:00.000Z')
  })
})
