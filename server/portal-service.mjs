const MAG_USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250'
const CONTEXT_PATHS = ['', 'stalker_portal', 'c']
const ENDPOINT_FILES = ['server/load.php', 'portal.php']
const SESSION_TTL_MS = 4 * 60 * 1000
const DEFAULT_PORTAL_VERSION = '5.6.0'
const DEFAULT_API_SIGNATURE = '262'
const DEVICE_PROFILE_PRESETS = [
  { stbType: 'MAG250', imageVersion: '218', hwVersion: '1.7-BD-00', modelCode: '250' },
  { stbType: 'MAG254', imageVersion: '218', hwVersion: '1.7-BD-00', modelCode: '254' },
  { stbType: 'MAG322', imageVersion: '218', hwVersion: '1.7-BD-00', modelCode: '322' },
]

const portalSessionCache = new Map()

export async function fetchPortalPlaylist({ portalUrl, macAddress }) {
  const session = await createPortalSession({ portalUrl, macAddress })
  const [channels, movies, episodes] = await Promise.all([
    fetchLiveEntries(session),
    fetchMovieEntries(session),
    fetchSeriesEpisodeEntries(session),
  ])

  return [...movies, ...episodes, ...channels]
}

export async function testPortalConnection({ portalUrl, macAddress }) {
  await createPortalSession({ portalUrl, macAddress })
}

export async function resolvePortalStreamUrl({ portalUrl, macAddress, source }) {
  if (source?.providerType !== 'portal' || !source.portalType || !source.portalCommand) {
    throw new Error('This item does not use a portal playback source.')
  }

  const session = await createPortalSession({ portalUrl, macAddress })
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

  const payload = await fetchPortalJson(session, `?${params.toString()}`)
  const command = payload?.js?.cmd
  if (!command) {
    throw new Error('The portal did not return a playable stream URL.')
  }

  const normalized = command.match(/(https?:\/\/.+)$/)?.[1] ?? command.replace(/^ffmpeg\s+/i, '').trim()
  if (!normalized) {
    throw new Error('The portal returned an invalid playback command.')
  }

  return decodeURI(normalized)
}

async function fetchLiveEntries(session) {
  const [genresPayload, channelsPayload] = await Promise.all([
    fetchPortalJson(session, '?type=itv&action=get_genres&JsHttpRequest=1-xml'),
    fetchPortalJson(session, '?type=itv&action=get_all_channels&JsHttpRequest=1-xml'),
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

async function fetchMovieEntries(session) {
  const categories = (await fetchPortalJson(session, '?type=vod&action=get_categories&JsHttpRequest=1-xml')).js ?? []

  const entries = await mapWithConcurrency(categories, 4, async (category) => {
    const videos = await fetchPagedPrograms(session, 'vod', {
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

async function fetchSeriesEpisodeEntries(session) {
  const categories = (await fetchPortalJson(session, '?type=series&action=get_categories&JsHttpRequest=1-xml')).js ?? []

  const perCategory = await mapWithConcurrency(categories, 3, async (category) => {
    const seriesList = await fetchPagedPrograms(session, 'series', {
      category: String(category.id),
      sortby: 'added',
    })

    const episodes = await mapWithConcurrency(seriesList, 2, async (series) => {
      const seasons = await fetchPagedPrograms(session, 'series', {
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

async function fetchPagedPrograms(session, type, extraParams) {
  const results = []
  let page = 1

  while (true) {
    const params = new URLSearchParams({
      type,
      action: 'get_ordered_list',
      p: String(page),
      JsHttpRequest: '1-xml',
      ...extraParams,
    })

    const payload = await fetchPortalJson(session, `?${params.toString()}`, true)
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

async function createPortalSession({ portalUrl, macAddress }) {
  const cacheKey = `${portalUrl}|${macAddress}`.toLowerCase()
  const cached = portalSessionCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached
  }

  const endpoint = await resolvePortalEndpoint(portalUrl, macAddress)
  const errors = []

  for (const preset of DEVICE_PROFILE_PRESETS) {
    try {
      const session = await authorizePortalSession(endpoint, macAddress, preset)
      portalSessionCache.set(cacheKey, {
        ...session,
        expiresAt: Date.now() + SESSION_TTL_MS,
      })
      return session
    } catch (error) {
      if (error instanceof Error && error.message.includes('429')) {
        throw error
      }

      errors.push(`${preset.stbType}: ${error instanceof Error ? error.message : 'Unknown authorization failure.'}`)
    }
  }

  throw new Error(
    `Portal authorization failed for profiles ${DEVICE_PROFILE_PRESETS.map((preset) => preset.stbType).join(', ')}. ${errors[0] ?? 'The registered MAC may be enabled for a different STB preset or a stricter device lock.'}`,
  )
}

async function authorizePortalSession(endpoint, macAddress, preset) {
  const profile = buildPortalDeviceProfile(macAddress, preset)
  const headers = {
    Accept: 'application/json',
    'User-Agent': MAG_USER_AGENT,
    'X-User-Agent': MAG_USER_AGENT,
    Cookie: profile.cookies,
    SN: profile.serialNumber,
    Referer: endpoint,
  }

  const handshakeParams = new URLSearchParams({
    type: 'stb',
    action: 'handshake',
    token: '',
    prehash: profile.prehash,
    JsHttpRequest: '1-xml',
  })
  const handshakeUrl = `${endpoint}?${handshakeParams.toString()}`
  const handshake = await fetch(handshakeUrl, { headers })
  if (handshake.status === 429) {
    throw new Error('Portal handshake was rate-limited (429). Wait a few minutes, then retry once.')
  }
  if (!handshake.ok) {
    throw new Error(`Portal handshake failed with status ${handshake.status}.`)
  }

  const handshakePayload = await parsePortalResponse(handshake)
  const token = handshakePayload.js?.token
  if (!token) {
    throw new Error('Portal handshake succeeded but no token was returned.')
  }

  const authorizedHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
  }

  const profileParams = new URLSearchParams({
    type: 'stb',
    action: 'get_profile',
    hd: profile.hd,
    ver: profile.version,
    num_banks: profile.numBanks,
    sn: profile.serialNumber,
    stb_type: profile.stbType,
    client_type: profile.clientType,
    image_version: profile.imageVersion,
    video_out: profile.videoOut,
    device_id: profile.deviceId,
    device_id2: profile.deviceId2,
    signature: profile.signature,
    auth_second_step: '0',
    hw_version: profile.hwVersion,
    not_valid_token: handshakePayload.js?.not_valid ? '1' : '0',
    metrics: profile.metrics,
    hw_version_2: profile.hwVersion2,
    timestamp: profile.timestamp,
    api_signature: profile.apiSignature,
    prehash: profile.prehash,
    JsHttpRequest: '1-xml',
  })

  const session = {
    baseUrl: endpoint,
    token,
    headers: authorizedHeaders,
  }

  await fetchPortalJson(session, `?${profileParams.toString()}`, false)
  await fetchPortalJson(session, '?type=itv&action=get_genres&JsHttpRequest=1-xml', false)

  return session
}

async function resolvePortalEndpoint(portalUrl, macAddress) {
  const normalizedBase = normalizePortalBaseUrl(portalUrl)
  const candidates = buildPortalCandidates(normalizedBase)
  const mac = normalizeMacAddress(macAddress)

  for (const candidate of candidates) {
    const probeProfile = buildPortalDeviceProfile(mac, DEVICE_PROFILE_PRESETS[0])
    try {
      const params = new URLSearchParams({
        type: 'stb',
        action: 'handshake',
        token: '',
        prehash: probeProfile.prehash,
        JsHttpRequest: '1-xml',
      })
      const response = await fetch(`${candidate}?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': MAG_USER_AGENT,
          'X-User-Agent': MAG_USER_AGENT,
          Cookie: probeProfile.cookies,
          SN: probeProfile.serialNumber,
          Referer: candidate,
        },
      })

      if (response.status === 429) {
        throw new Error('Portal handshake was rate-limited (429). Wait a few minutes, then retry once.')
      }
      if (!response.ok) {
        continue
      }

      const payload = await parsePortalResponse(response)
      if (payload.js?.token) {
        return candidate
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('429')) {
        throw error
      }
      continue
    }
  }

  throw new Error('Could not find a working portal endpoint for that server and MAC address.')
}

async function fetchPortalJson(session, query, ignoreErrors = false) {
  const response = await fetch(`${session.baseUrl}${query}`, {
    headers: session.headers,
  })

  if (response.status === 429) {
    throw new Error('Portal requests are being rate-limited (429). Wait a few minutes before trying again.')
  }
  if (!response.ok) {
    if (ignoreErrors) {
      return {}
    }
    throw new Error(`Portal request failed with status ${response.status}.`)
  }

  return parsePortalResponse(response, ignoreErrors)
}

async function parsePortalResponse(response, ignoreErrors = false) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    if (ignoreErrors) {
      return {}
    }
    if (/Unauthorized request\./i.test(text)) {
      throw new Error('Portal rejected the catalog request as unauthorized. The registered MAC may not match, or the provider expects stricter MAG device headers.')
    }
    if (/Authorization failed\./i.test(text)) {
      throw new Error('Portal authorization failed after handshake. This usually means the MAC is not accepted for this device profile.')
    }

    const snippet = text.replace(/\s+/g, ' ').slice(0, 160)
    throw new Error(`Portal returned non-JSON content. Response preview: ${snippet || '[empty response]'}`)
  }
}

function buildPortalEntry({
  id,
  title,
  groupTitle,
  image,
  portalType,
  portalCommand,
  contentType,
  portalEpisode,
  tvgId,
}) {
  return {
    id: slugify(id),
    title: title.trim(),
    url: '',
    groupTitle,
    tvgId,
    tvgLogo: image,
    attrs: {
      'source-provider': 'portal',
      'portal-type': portalType,
      'portal-command': portalCommand,
      'content-type': contentType,
      ...(portalEpisode ? { 'portal-episode': String(portalEpisode) } : {}),
    },
  }
}

function normalizePortalBaseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) {
    throw new Error('Portal URL is required for MAC/portal providers.')
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
}

function buildPortalCandidates(normalizedBase) {
  if (normalizedBase.endsWith('/server/load.php') || normalizedBase.endsWith('/portal.php')) {
    return [normalizedBase]
  }

  if (normalizedBase.includes('/stalker_portal') || normalizedBase.includes('/c')) {
    return ENDPOINT_FILES.map((endpoint) =>
      `${normalizedBase}/${endpoint}`.replace(/(?<!:)\/{2,}/g, '/').replace(':/', '://'),
    )
  }

  return CONTEXT_PATHS.flatMap((contextPath) =>
    ENDPOINT_FILES.map((endpoint) =>
      `${normalizedBase}${contextPath ? `/${contextPath}` : ''}/${endpoint}`.replace(/(?<!:)\/{2,}/g, '/').replace(':/', '://'),
    ),
  )
}

function normalizeMacAddress(value) {
  const normalized = value.trim().toUpperCase()
  if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(normalized)) {
    throw new Error('MAC address must use the format 00:1A:79:00:00:00.')
  }
  return normalized
}

function buildSerialNumber(seed) {
  const source = seed.replace(/[^0-9A-F]/gi, '').toUpperCase() || 'ABCDEF1234567'
  return (source + '0000000000000').slice(0, 13)
}

function parseSeasonNumber(value, fallback) {
  const match = value.match(/(\d{1,2})/)
  return match ? Number(match[1]) : fallback
}

function buildPortalDeviceProfile(macAddress, preset = DEVICE_PROFILE_PRESETS[0]) {
  const normalizedMac = normalizeMacAddress(macAddress)
  const compactMac = normalizedMac.replace(/:/g, '')
  const serialNumber = buildSerialNumber(normalizedMac)
  const version = [
    `ImageDescription: 0.2.18-r23-${preset.modelCode};`,
    'ImageDate: Wed Oct 31 15:22:54 EEST 2018;',
    `PORTAL version: ${DEFAULT_PORTAL_VERSION};`,
    'API Version: JS API version: 343;',
  ].join(' ')

  const prehash = stableHash(`${preset.stbType}|${version.slice(0, 56)}`)
  const deviceId = stableHash(`device_id:${compactMac}`)
  const deviceId2 = stableHash(`device_id2:${compactMac}`)
  const randomSeed = stableHash(`random:${compactMac}`)
  const signature = stableHash(`signature:${randomSeed}:${compactMac}`)
  const metricsPayload = JSON.stringify({
    mac: normalizedMac,
    sn: serialNumber,
    model: preset.stbType,
    type: 'STB',
    uid: deviceId2,
    random: randomSeed,
  })
  const timestamp = String(Math.floor(Date.now() / 1000))

  return {
    hd: '1',
    numBanks: '2',
    stbType: preset.stbType,
    clientType: 'STB',
    imageVersion: preset.imageVersion,
    version,
    hwVersion: preset.hwVersion,
    videoOut: 'hdmi',
    serialNumber,
    deviceId,
    deviceId2,
    signature,
    metrics: metricsPayload,
    hwVersion2: stableHash(`${metricsPayload}|${randomSeed}`),
    timestamp,
    apiSignature: DEFAULT_API_SIGNATURE,
    prehash,
    cookies: [
      `mac=${normalizedMac}`,
      'stb_lang=en',
      'timezone=UTC',
      `adid=${stableHash(`adid:${compactMac}:${timestamp}`).slice(0, 32)}`,
      `sn=${serialNumber}`,
      `stb_type=${preset.stbType}`,
    ].join('; '),
  }
}

function stableHash(value) {
  let hashA = 0x811c9dc5
  let hashB = 0x01000193
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    hashA ^= code
    hashA = Math.imul(hashA, 0x01000193) >>> 0
    hashB ^= code
    hashB = Math.imul(hashB, 0x85ebca6b) >>> 0
  }

  const combined = `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`
  return (combined + combined + combined + combined).slice(0, 64).toUpperCase()
}

async function mapWithConcurrency(items, limit, mapper) {
  const queue = [...items]
  return Promise.all(
    Array.from({ length: Math.min(limit, queue.length || 1) }, async () => {
      const bucket = []
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
