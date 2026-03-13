import { useEffect, useEffectEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const BACK_CODES = new Set(['Escape', 'Backspace', 'BrowserBack', 'GoBack'])
const BACK_KEYCODES = new Set([8, 27, 461, 10009])

export function useBackNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }

    const keyCode = 'which' in event ? Number(event.which) : 0
    if (!BACK_CODES.has(event.key) && !BACK_KEYCODES.has(keyCode)) {
      return
    }

    if (location.pathname === '/' || location.pathname === '/setup') {
      return
    }

    event.preventDefault()
    navigate(-1)
  })

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
