import { registerPlugin } from '@capacitor/core'
import type { PlaybackSource, PlaylistEntry } from '../types'

export interface PortalBridgePlugin {
  testConnection(options: {
    portalUrl: string
    macAddress: string
  }): Promise<void>
  importPlaylist(options: {
    portalUrl: string
    macAddress: string
  }): Promise<{
    entries: PlaylistEntry[]
  }>
  resolveStreamUrl(options: {
    portalUrl: string
    macAddress: string
    source: PlaybackSource
  }): Promise<{
    url: string
  }>
}

export const PortalBridge = registerPlugin<PortalBridgePlugin>('PortalBridge')
