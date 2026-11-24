import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { content } from '../../content/content'
import type { SpotifyPick } from '../../content/types'
import { fetchSpotifyMeta, kindLabel, parseSpotifyUrl, type SpotifyMeta, type SpotifyRef } from '../../lib/spotify'
import { RecordCrate } from './music/RecordCrate'
import type { CrateRecord } from './music/types'
import './music/music.css'

/** Sample records for development only; never bundled into the live site. */
const CratePreview = import.meta.env.DEV ? lazy(() => import('./music/samples')) : null

interface CollectionItem {
  ref: SpotifyRef
  pick: SpotifyPick
}

/** Title and cover for every pick that doesn't set its own, from Spotify's public lookup. */
function useSpotifyMeta(items: CollectionItem[]): Record<string, SpotifyMeta> {
  const [meta, setMeta] = useState<Record<string, SpotifyMeta>>({})
  const needed = items.filter((item) => !item.pick.title || !item.pick.cover)
  const key = needed.map((item) => item.ref.url).join(' ')
  useEffect(() => {
    let alive = true
    for (const item of needed) {
      void fetchSpotifyMeta(item.ref).then((m) => {
        if (alive && m) setMeta((prev) => ({ ...prev, [item.ref.url]: m }))
      })
    }
    return () => {
      alive = false
    }
    // Keyed on the URL list so re-created ref objects don't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return meta
}

/**
 * "On my shelf of records": the albums and playlists in content.ts, as a crate
 * of sleeves. Spotify's player (and its cookies) loads only when asked for.
 */
export function SpotifyCollection() {
  const { collection } = content.music
  const items = useMemo<CollectionItem[]>(
    () =>
      collection.items.flatMap((pick) => {
        const ref = parseSpotifyUrl(pick.url)
        return ref ? [{ ref, pick }] : []
      }),
    [collection.items],
  )
  const meta = useSpotifyMeta(items)

  const records = useMemo<CrateRecord[]>(
    () =>
      items.map(({ ref, pick }) => ({
        key: ref.url,
        title: pick.title ?? meta[ref.url]?.title ?? '',
        cover: pick.cover ?? meta[ref.url]?.cover,
        artist: pick.subtitle,
        kind: kindLabel(ref.kind),
        year: pick.year,
        note: pick.note,
        startWith: pick.startWith,
        length: pick.length,
        spotify: ref,
      })),
    [items, meta],
  )

  if (records.length === 0) {
    return CratePreview ? (
      <Suspense fallback={null}>
        <CratePreview />
      </Suspense>
    ) : null
  }
  return <RecordCrate records={records} heading={collection.heading} description={collection.description} />
}
