export function getPortalBackendUrl(configuredOverride?: string) {
  const configured =
    configuredOverride?.trim() ||
    import.meta.env.VITE_PORTAL_BACKEND_URL?.trim()

  if (configured) {
    return configured.replace(/\/+$/, '')
  }

  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://localhost:8787'
  }

  return ''
}
