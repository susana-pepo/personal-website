import type { ReactNode } from 'react'
import type { SpotifyRef } from '../../../lib/spotify'

/** One record in the crate, ready to draw: real (from content.ts) or a dev-only sample. */
export interface CrateRecord {
  key: string
  /** Empty while Spotify's lookup is still on its way. */
  title: string
  artist?: string
  /** "Album", "Playlist"… */
  kind: string
  year?: string | number
  note?: string
  startWith?: { number: string; title: string }
  length?: string
  /** Cover image URL (real records). */
  cover?: string
  /** Drawn cover art (development samples). */
  art?: ReactNode
  /** A colour to tint the stand-in player with (development samples). */
  tint?: string
  /** The Spotify item behind it. Samples have none, so nothing is ever loaded for them. */
  spotify?: SpotifyRef
  sample?: boolean
}
