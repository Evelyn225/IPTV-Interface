import { slugify } from '../lib/utils'
import type { AppConfig, PlaybackSource, PlaylistEntry, PortalStreamType } from '../types'

interface PortalEnvelope<T> {
  js?: T
}

interface PortalGenre {
  id: string
  title: string
}

interface PortalChannel {
  id: string
  name: string
  cmd: string
  logo?: string
  tv_genre_id?: string
}

interface PortalVideo {
  id: string
  name: string
  cmd: string
  screenshot_uri?: string
  category_id?: string
}

interface PortalSeries {
  id: string
  name: string
  cmd: string
  screenshot_uri?: string
  category_id?: string
  series?: number[]
}

interface PortalPrograms<T> {
  total_items: number
  max_page_items: number
  data: T[]
}

interface PortalSession {
  baseUrl: string
  token: string
  headers: Record<string, string>
}

const MAG_USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250'
const CONTEXT_PATHS = ['', 'stalker_portal', 'c']
const ENDPOINT_FILES = ['server/load.php', 'portal.php']
const DEV_PROXY_PATH = '/__portal_proxy__'

export async function fetchPortalPlaylist(config: AppConfig): Promise<PlaylistEntry[]> {
  const session = await createPortalSession(config)
  const [channels, movies, episodes] = await Promise.all([
    fetchLiveEntries(session),
    fetchMovieEntries(session),
    fetchSeriesEpisodeEntries(session),
  ])

  return [...movies, ...episodes, ...channels]
}

export async function testPortalConnection(config: Pick<AppConfig, 'portalUrl' | 'macAddress'>): Promise<void> {
  await createPortalSession({
    id: 'default',
    providerType: 'portal',
    playlistUrl: '',
    epgUrl: '',
    portalUrl: config.portalUrl,
    macAddress: config.macAddress,
    tmdbApiKey: '',
    preferredProfile: 'cinema',
  })
}

export async function resolvePortalStreamUrl(config: AppConfig, source: PlaybackSource): Promise<string> {
  if (source.providerType !== 'portal' || !source.portalType || !source.portalCommand) {
    throw new Error('This item does not use a portal playback source.')
  }

  const session = await createPortalSession(config)
  const params = new URLSearchParams({
    type: source.portalType,
    action: 'create_link',
    cmd: source.portalCommand,
    series: source.portalEpisode ? String(source.portalEpisode) : '',
    forced_storage: 'undefined',
    disable_ad: '0',
    download: '0',
    JsHttpRequest: '1-xml',
  })

  const payload = await fetchPortalJson<PortalEnvelope<{ cmd?: string }>>(session, `?${params.toString()}`)
  const command = payload.js?.cmd
  if (!command) {
    throw new Error('The portal did not return a playable stream URL.')
  }

  const normalized = command.match(/(https?:\/\/.+)$/)?.[1] ?? command.replace(/^ffmpeg\s+/i, '').trim()
  if (!normalized) {
    throw new Error('The portal returned an invalid playback command.')
  }

  return decodeURI(normalized)
}

async function fetchLiveEntries(session: PortalSession) {
  const [genresPayload, channelsPayload] = await Promise.all([
    fetchPortalJson<PortalEnvelope<PortalGenre[]>>(session, '?type=itv&action=get_genres&JsHttpRequest=1-xml', true),
    fetchPortalJson<PortalEnvelope<PortalPrograms<PortalChannel>>>(session, '?type=itv&action=get_all_channels&JsHttpRequest=1-xml', true),
  ])

  const genres = new Map((genresPayload.js ?? []).map((genre) => [String(genre.id), genre.title]))
  const channels = channelsPayload.js?.data ?? []

  return channels.map((channel) =>
    buildPortalEntry({
      id: `live-${channel.id}`,
      title: channel.name,
      groupTitle: genres.get(String(channel.tv_genre_id ?? '')) ?? 'Live',
      image: channel.logo,
      portalType: 'itv',
      portalCommand: channel.cmd,
      contentType: 'channel',
      tvgId: String(channel.id),
    }),
  )
}

async function fetchMovieEntries(session: PortalSession) {
  const categories = (await fetchPortalJson<PortalEnvelope<PortalGenre[]>>(
    session,
    '?type=vod&action=get_categories&JsHttpRequest=1-xml',
    true,
  )).js ?? []

  const entries = await mapWithConcurrency(categories, 4, async (category) => {
    const videos = await fetchPagedPrograms<PortalVideo>(session, 'vod', {
      genre: String(category.id),
      sortby: 'added',
    })

    return videos.map((video) =>
      buildPortalEntry({
        id: `movie-${video.id}`,
        title: video.name,
        groupTitle: category.title || 'Movies',
        image: video.screenshot_uri,
        portalType: 'vod',
        portalCommand: video.cmd,
        contentType: 'movie',
      }),
    )
  })

  return entries.flat()
}

async function fetchSeriesEpisodeEntries(session: PortalSession) {
  const categories = (await fetchPortalJson<PortalEnvelope<PortalGenre[]>>(
    session,
    '?type=series&action=get_categories&JsHttpRequest=1-xml',
    true,
  )).js ?? []

  const perCategory = await mapWithConcurrency(categories, 3, async (category) => {
    const seriesList = await fetchPagedPrograms<PortalSeries>(session, 'series', {
      category: String(category.id),
      sortby: 'added',
    })

    const episodes = await mapWithConcurrency(seriesList, 2, async (series) => {
      const seasons = await fetchPagedPrograms<PortalSeries>(session, 'series', {
        movie_id: encodeURIComponent(series.id),
        sortby: 'added',
      })

      return seasons.flatMap((season, seasonIndex) => {
        const seasonNumber = parseSeasonNumber(season.name, seasonIndex + 1)
        const episodeNumbers = season.series ?? []
        return episodeNumbers.map((episodeNumber) =>
          buildPortalEntry({
            id: `series-${series.id}-${seasonNumber}-${episodeNumber}`,
            title: `${series.name} S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`,
            groupTitle: category.title || 'Series',
            image: season.screenshot_uri || series.screenshot_uri,
            portalType: 'vod',
            portalCommand: season.cmd,
            contentType: 'series',
            portalEpisode: episodeNumber,
          }),
        )
      })
    })

    return episodes.flat()
  })

  return perCategory.flat()
}

async function fetchPagedPrograms<T extends { id: string }>(
  session: PortalSession,
  type: PortalStreamType | 'series',
  extraParams: Record<string, string>,
) {
  const results: T[] = []
  let page = 1

  while (true) {
    const params = new URLSearchParams({
      type,
      action: 'get_ordered_list',
      p: String(page),
      JsHttpRequest: '1-xml',
      ...extraParams,
    })

    const payload = await fetchPortalJson<PortalEnvelope<PortalPrograms<T>>>(session, `?${params.toString()}`, true)
    const data = payload.js?.data ?? []
    if (!data.length) {
      break
    }

    results.push(...data)
    page += 1

    const total = payload.js?.total_items ?? 0
    const perPage = payload.js?.max_page_items ?? data.length
    if (total && perPage && results.length >= total) {
      break
    }

    if (page > 40) {
      break
    }
  }

  return results
}

async function createPortalSession(config: AppConfig): Promise<PortalSession> {
  const endpoint = await resolvePortalEndpoint(config.portalUrl, config.macAddress)
  const headers = {
    Accept: 'application/json',
    'User-Agent': MAG_USER_AGENT,
    'X-User-Agent': MAG_USER_AGENT,
    Cookie: `mac=${normalizeMacAddress(config.macAddress)}; stb_lang=en; timezone=UTC`,
  }

  const handshakeUrl = `${endpoint}?type=stb&action=handshake&JsHttpRequest=1-xml`
  const handshake = await fetch(createPortalRequestUrl(handshakeUrl), {
    headers,
  })

  if (!handshake.ok) {
    throw new Error(`Portal handshake failed with status ${handshake.status}.`)
  }

  const handshakePayload = await parsePortalResponse<PortalEnvelope<{ token?: string }>>(handshake)
  const token = handshakePayload.js?.token
  if (!token) {
    throw new Error('Portal handshake succeeded but no token was returned.')
  }

  const authorizedHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
  }

  await fetchPortalJson<PortalEnvelope<object>>(
    { baseUrl: endpoint, token, headers: authorizedHeaders },
    `?type=stb&action=get_profile&hd=1&auth_second_step=0&num_banks=1&stb_type=&image_version=&hw_version=&not_valid_token=0&device_id=${buildDeviceId(config.macAddress)}&device_id2=${buildDeviceId(
      `${config.macAddress}-secondary`,
    )}&signature=&sn=${buildSerialNumber(config.macAddress)}&ver=&JsHttpRequest=1-xml`,
    false,
  )

  return {
    baseUrl: endpoint,
    token,
    headers: authorizedHeaders,
  }
}

async function resolvePortalEndpoint(portalUrl: string, macAddress: string) {
  const normalizedBase = normalizePortalBaseUrl(portalUrl)
  const candidates = CONTEXT_PATHS.flatMap((contextPath) =>
    ENDPOINT_FILES.map((endpoint) =>
      `${normalizedBase}${contextPath ? `/${contextPath}` : ''}/${endpoint}`.replace(/(?<!:)\/{2,}/g, '/').replace(':/', '://'),
    ),
  )

  for (const candidate of candidates) {
    try {
      const handshakeUrl = `${candidate}?type=stb&action=handshake&JsHttpRequest=1-xml`
      const response = await fetch(createPortalRequestUrl(handshakeUrl), {
        headers: {
          Accept: 'application/json',
          'User-Agent': MAG_USER_AGENT,
          'X-User-Agent': MAG_USER_AGENT,
          Cookie: `mac=${normalizeMacAddress(macAddress)}; stb_lang=en; timezone=UTC`,
        },
      })

      if (!response.ok) {
        continue
      }

      const payload = await parsePortalResponse<PortalEnvelope<{ token?: string }>>(response)
      if (payload.js?.token) {
        return candidate
      }
    } catch {
      continue
    }
  }

  throw new Error('Could not find a working portal endpoint for that server and MAC address.')
}

async function fetchPortalJson<T>(session: PortalSession, query: string, ignoreErrors = false): Promise<T> {
  const requestUrl = `${session.baseUrl}${query}`
  const response = await fetch(createPortalRequestUrl(requestUrl), {
    headers: session.headers,
  })

  if (!response.ok) {
    if (ignoreErrors) {
      return {} as T
    }

    throw new Error(`Portal request failed with status ${response.status}.`)
  }

  return parsePortalResponse<T>(response, ignoreErrors)
}

function createPortalRequestUrl(targetUrl: string) {
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return `${DEV_PROXY_PATH}?target=${encodeURIComponent(targetUrl)}`
  }

  return targetUrl
}

async function parsePortalResponse<T>(response: Response, ignoreErrors = false): Promise<T> {
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    if (ignoreErrors) {
      return {} as T
    }

    const snippet = text.replace(/\s+/g, ' ').slice(0, 160)
    throw new Error(
      `Portal returned non-JSON content. This often means the request was blocked or redirected. Response preview: ${snippet || '[empty response]'}`,
    )
  }
}

function buildPortalEntry(input: {
  id: string
  title: string
  groupTitle: string
  image?: string
  portalType: PortalStreamType
  portalCommand: string
  contentType: 'movie' | 'series' | 'channel'
  portalEpisode?: number
  tvgId?: string
}): PlaylistEntry {
  return {
    id: slugify(input.id),
    title: input.title.trim(),
    url: '',
    groupTitle: input.groupTitle,
    tvgId: input.tvgId,
    tvgLogo: input.image,
    attrs: {
      'source-provider': 'portal',
      'portal-type': input.portalType,
      'portal-command': input.portalCommand,
      'content-type': input.contentType,
      ...(input.portalEpisode ? { 'portal-episode': String(input.portalEpisode) } : {}),
    },
  }
}

function normalizePortalBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) {
    throw new Error('Portal URL is required for MAC/portal providers.')
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
}

function normalizeMacAddress(value: string) {
  const normalized = value.trim().toUpperCase()
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(normalized)) {
    throw new Error('MAC address must use the format 00:1A:79:00:00:00.')
  }

  return normalized
}

function buildDeviceId(seed: string) {
  const source = seed.replace(/[^0-9A-F]/gi, '').toUpperCase() || 'A1B2C3D4'
  let output = ''
  while (output.length < 64) {
    output += source
  }
  return output.slice(0, 64)
}

function buildSerialNumber(seed: string) {
  const source = seed.replace(/[^0-9A-F]/gi, '').toUpperCase() || 'ABCDEF1234567'
  return (source + '0000000000000').slice(0, 13)
}

function parseSeasonNumber(value: string, fallback: number) {
  const match = value.match(/(\d{1,2})/)
  return match ? Number(match[1]) : fallback
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const queue = [...items]
  return Promise.all(
    Array.from({ length: Math.min(limit, queue.length || 1) }, async () => {
      const bucket: R[] = []
      while (queue.length) {
        const next = queue.shift()
        if (!next) {
          break
        }

        bucket.push(await mapper(next))
      }
      return bucket
    }),
  ).then((groups) => groups.flat())
}
