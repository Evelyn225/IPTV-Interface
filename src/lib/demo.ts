import type { AppConfig } from '../types'

export const DEMO_PLAYLIST_URL = 'demo://playlist'
export const DEMO_EPG_URL = 'demo://epg'

export const DEMO_APP_CONFIG: AppConfig = {
  id: 'default',
  playlistUrl: DEMO_PLAYLIST_URL,
  epgUrl: DEMO_EPG_URL,
  tmdbApiKey: '',
  preferredProfile: 'cinema',
}

export const DEMO_PLAYLIST = `#EXTM3U
#EXTINF:-1 tvg-id="aether-cinema" tvg-logo="https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80" group-title="Movies",Aether Run (2024)
https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
#EXTINF:-1 tvg-id="midnight-atlas" tvg-logo="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80" group-title="Movies",Midnight Atlas (2023)
https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4
#EXTINF:-1 tvg-id="glass-harbor-s01e01" tvg-logo="https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=800&q=80" group-title="Series",Glass Harbor S01E01 - The Arrival
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="glass-harbor-s01e02" tvg-logo="https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=800&q=80" group-title="Series",Glass Harbor S01E02 - Low Tide
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="glass-harbor-s01e03" tvg-logo="https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=800&q=80" group-title="Series",Glass Harbor S01E03 - The Signal Room
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="ember-park-s01e01" tvg-logo="https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80" group-title="Series",Ember Park S01E01 - Floodlights
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="ember-park-s01e02" tvg-logo="https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80" group-title="Series",Ember Park S01E02 - Closing Drive
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="pulse-news" tvg-logo="https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=800&q=80" group-title="Live News",Pulse News
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="stadium-1" tvg-logo="https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80" group-title="Live Sports",Arena One
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
`

export const DEMO_EPG = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="pulse-news"><display-name>Pulse News</display-name></channel>
  <channel id="stadium-1"><display-name>Arena One</display-name></channel>
  <programme start="20260313160000 +0000" stop="20260313170000 +0000" channel="pulse-news">
    <title>Global Pulse</title>
    <desc>Continuous headlines and international reports.</desc>
  </programme>
  <programme start="20260313170000 +0000" stop="20260313180000 +0000" channel="pulse-news">
    <title>Market Horizon</title>
    <desc>Evening business coverage and analysis.</desc>
  </programme>
  <programme start="20260313160000 +0000" stop="20260313174500 +0000" channel="stadium-1">
    <title>Championship Replay</title>
    <desc>Classic finals and pitch-side commentary.</desc>
  </programme>
  <programme start="20260313174500 +0000" stop="20260313190000 +0000" channel="stadium-1">
    <title>Night Match Live</title>
    <desc>Prime-time live football from the weekend slate.</desc>
  </programme>
</tv>
`
