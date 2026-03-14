import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getItemById } from '../lib/catalog-selectors'
import { detectPlaybackMode } from '../lib/playback'
import { minutesFromSeconds } from '../lib/utils'
import { resolvePortalStreamUrl } from '../services/portal-provider'
import { useAppStore } from '../store/app-store'

export function PlayerPage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const { items } = useAppStore((state) => state.catalog)
  const history = useAppStore((state) => state.history)
  const recordPlayback = useAppStore((state) => state.recordPlayback)
  const config = useAppStore((state) => state.config)
  const item = getItemById(items, itemId)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<{ destroy: () => void } | null>(null)
  const lastSavedRef = useRef(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const persistProgress = useEffectEvent((options?: { force?: boolean; completed?: boolean }) => {
    const video = videoRef.current
    if (!video || !item || item.type === 'channel') {
      return
    }

    if (!options?.force && Math.abs(video.currentTime - lastSavedRef.current) < 5) {
      return
    }

    lastSavedRef.current = video.currentTime
    const resolvedDuration = Number.isFinite(video.duration) ? video.duration : undefined
    void recordPlayback({
      itemId: item.id,
      positionSeconds: options?.completed && resolvedDuration ? resolvedDuration : video.currentTime,
      durationSeconds: resolvedDuration,
    })
  })

  const onTimeUpdate = useEffectEvent(() => {
    const video = videoRef.current
    if (!video || !item || item.type === 'channel') {
      return
    }

    setCurrentTime(video.currentTime)
    setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    persistProgress()
  })

  const onPlaybackStateChange = useEffectEvent(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    setIsPlaying(!video.paused)
    setIsMuted(video.muted)
    setCurrentTime(video.currentTime)
    setDuration(Number.isFinite(video.duration) ? video.duration : 0)
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video || !item) {
      return
    }

    if (!config) {
      setErrorMessage('Playback configuration is missing.')
      return
    }

    const currentItem = item
    const currentVideo = video
    const currentConfig = config
    let cancelled = false
    setErrorMessage('')
    const resumePosition = history.find((entry) => entry.itemId === currentItem.id)?.positionSeconds ?? 0
    const applyResume = () => {
      if (resumePosition > 0 && !currentItem.source.isLive) {
        currentVideo.currentTime = resumePosition
      }
      onPlaybackStateChange()
    }

    async function startPlayback() {
      const playbackUrl =
        currentItem.source.providerType === 'portal'
          ? await resolvePortalStreamUrl(currentConfig, currentItem.source)
          : currentItem.source.url

      if (!playbackUrl) {
        throw new Error('No playback URL was available for this item.')
      }

      const playbackMode = detectPlaybackMode(playbackUrl, currentItem.source.mimeType)

      if (playbackMode === 'hls') {
        const { default: Hls } = await import('hls.js')
        if (!cancelled && Hls.isSupported()) {
          const hls = new Hls()
          hlsRef.current = hls
          hls.loadSource(playbackUrl)
          hls.attachMedia(currentVideo)
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            applyResume()
            void currentVideo.play().catch(() => undefined)
          })
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              setErrorMessage('The HLS stream could not be played on this device.')
            }
          })
          return
        }
      }

      currentVideo.src = playbackUrl
      currentVideo.addEventListener('loadedmetadata', applyResume, { once: true })
      void currentVideo.play().catch(() => undefined)
    }

    void startPlayback().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Playback could not start.')
    })

    const persistOnPause = () => persistProgress({ force: true })
    const persistOnEnded = () => persistProgress({ force: true, completed: true })
    currentVideo.addEventListener('timeupdate', onTimeUpdate)
    currentVideo.addEventListener('play', onPlaybackStateChange)
    currentVideo.addEventListener('pause', onPlaybackStateChange)
    currentVideo.addEventListener('volumechange', onPlaybackStateChange)
    currentVideo.addEventListener('loadedmetadata', onPlaybackStateChange)
    currentVideo.addEventListener('pause', persistOnPause)
    currentVideo.addEventListener('ended', persistOnEnded)
    return () => {
      persistProgress({ force: true })
      cancelled = true
      currentVideo.removeEventListener('timeupdate', onTimeUpdate)
      currentVideo.removeEventListener('play', onPlaybackStateChange)
      currentVideo.removeEventListener('pause', onPlaybackStateChange)
      currentVideo.removeEventListener('volumechange', onPlaybackStateChange)
      currentVideo.removeEventListener('loadedmetadata', onPlaybackStateChange)
      currentVideo.removeEventListener('pause', persistOnPause)
      currentVideo.removeEventListener('ended', persistOnEnded)
      hlsRef.current?.destroy()
      hlsRef.current = null
      currentVideo.pause()
      currentVideo.removeAttribute('src')
      currentVideo.load()
    }
  }, [config, history, item, recordPlayback])

  function togglePlayPause() {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (video.paused) {
      void video.play().catch(() => setErrorMessage('Playback could not start.'))
    } else {
      video.pause()
    }
  }

  function playVideo() {
    const video = videoRef.current
    if (!video) {
      return
    }

    void video.play().catch(() => setErrorMessage('Playback could not start.'))
  }

  function pauseVideo() {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.pause()
  }

  function toggleMute() {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  function seekBy(seconds: number) {
    const video = videoRef.current
    if (!video || item?.source.isLive) {
      return
    }

    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds))
    setCurrentTime(video.currentTime)
  }

  function handleScrub(nextValue: number) {
    const video = videoRef.current
    if (!video || item?.source.isLive) {
      return
    }

    video.currentTime = nextValue
    setCurrentTime(nextValue)
  }

  async function enterFullscreen() {
    const video = videoRef.current
    if (!video) {
      return
    }

    try {
      if (video.requestFullscreen) {
        await video.requestFullscreen()
      }
    } catch {
      setErrorMessage('Fullscreen is not available in this browser.')
    }
  }

  const onRemoteKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!item) {
      return
    }

    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }

    switch (event.key) {
      case ' ':
      case 'Enter':
      case 'NumpadEnter':
      case 'MediaPlayPause':
        event.preventDefault()
        togglePlayPause()
        break
      case 'MediaPlay':
        event.preventDefault()
        playVideo()
        break
      case 'MediaPause':
        event.preventDefault()
        pauseVideo()
        break
      case 'ArrowLeft':
      case 'MediaRewind':
      case 'j':
      case 'J':
        if (!item.source.isLive) {
          event.preventDefault()
          seekBy(-10)
        }
        break
      case 'ArrowRight':
      case 'MediaFastForward':
      case 'l':
      case 'L':
        if (!item.source.isLive) {
          event.preventDefault()
          seekBy(10)
        }
        break
      case 'm':
      case 'M':
      case 'AudioVolumeMute':
        event.preventDefault()
        toggleMute()
        break
      case 'f':
      case 'F':
        event.preventDefault()
        void enterFullscreen()
        break
      case 'Escape':
      case 'Backspace':
      case 'BrowserBack':
      case 'GoBack':
        event.preventDefault()
        if (document.fullscreenElement && document.exitFullscreen) {
          void document.exitFullscreen().catch(() => undefined)
          return
        }

        navigate(`/details/${item.id}`)
        break
      default:
        break
    }
  })

  useEffect(() => {
    if (!item) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => onRemoteKeyDown(event)
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [item, navigate])

  if (!item) {
    return (
      <main className="player-stage">
        <div className="player-overlay">
          <h1>Missing item</h1>
          <Link className="action-link" data-focusable="true" to="/">
            Return Home
          </Link>
        </div>
      </main>
    )
  }

  const isLive = item.source.isLive
  const progressMax = duration > 0 ? duration : 0

  return (
    <main className="player-stage">
      <video className="player-video" playsInline ref={videoRef} />
      <div className="player-overlay player-overlay--top">
        <div className="player-summary">
          <p className="eyebrow">{item.type.toUpperCase()}</p>
          <h1>{item.title}</h1>
          <p>{item.type === 'channel' ? item.currentProgram?.title ?? 'Live signal' : item.synopsis}</p>
        </div>
        <div className="hero-actions">
          <Link className="action-link" data-focusable="true" to={`/details/${item.id}`}>
            Back To Details
          </Link>
          <Link className="action-link" data-focusable="true" to="/">
            Home
          </Link>
        </div>
      </div>
      <div className="player-overlay player-overlay--bottom">
        <div className="player-controls">
          <button
            aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
            className="player-control-button player-control-button--primary"
            data-focusable="true"
            type="button"
            onClick={togglePlayPause}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          {!isLive ? (
            <>
              <button className="player-control-button" data-focusable="true" type="button" onClick={() => seekBy(-10)}>
                -10s
              </button>
              <button className="player-control-button" data-focusable="true" type="button" onClick={() => seekBy(10)}>
                +10s
              </button>
            </>
          ) : (
            <span className="player-live-pill">Live</span>
          )}
          <button className="player-control-button" data-focusable="true" type="button" onClick={toggleMute}>
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button className="player-control-button" data-focusable="true" type="button" onClick={() => void enterFullscreen()}>
            Fullscreen
          </button>
        </div>
        <div className="player-timeline">
          <div className="player-time-row">
            <strong>{isLive ? 'Live Stream' : `${minutesFromSeconds(currentTime)} / ${minutesFromSeconds(duration)}`}</strong>
            {!isLive ? <span>Use left/right buttons or the seek bar to scrub.</span> : <span>Live channels update automatically.</span>}
          </div>
          {!isLive ? (
            <input
              aria-label="Seek playback position"
              className="player-range"
              data-focusable="true"
              max={progressMax}
              min={0}
              step={1}
              type="range"
              value={Math.min(currentTime, progressMax)}
              onChange={(event) => handleScrub(Number(event.target.value))}
            />
          ) : (
            <div className="player-live-track">
              <span className="player-live-dot" />
              <span>Now Playing</span>
            </div>
          )}
        </div>
        <div className="player-shortcuts" aria-label="Remote shortcuts">
          <span className="player-shortcut-chip">Select: {isPlaying ? 'Pause' : 'Play'}</span>
          {!isLive ? <span className="player-shortcut-chip">Left/Right: Seek 10s</span> : <span className="player-shortcut-chip">Left/Right: Stay tuned</span>}
          <span className="player-shortcut-chip">M: {isMuted ? 'Unmute' : 'Mute'}</span>
          <span className="player-shortcut-chip">F: Fullscreen</span>
          <span className="player-shortcut-chip">Back: Details</span>
        </div>
        {errorMessage ? <div className="status-banner status-banner--error">{errorMessage}</div> : null}
      </div>
    </main>
  )
}
