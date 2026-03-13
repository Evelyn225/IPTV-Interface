import { DEMO_EPG, DEMO_EPG_URL, DEMO_PLAYLIST, DEMO_PLAYLIST_URL } from './demo'

export async function loadTextResource(url: string): Promise<string> {
  if (url === DEMO_PLAYLIST_URL) {
    return DEMO_PLAYLIST
  }

  if (url === DEMO_EPG_URL) {
    return DEMO_EPG
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain,application/xml,application/x-mpegURL,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}. The source responded with ${response.status}.`)
  }

  return response.text()
}
