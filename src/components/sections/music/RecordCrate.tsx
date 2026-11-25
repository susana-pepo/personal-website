import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { transitionMs } from '../../../lib/motion'
import { nextSleeve, sleeveAt } from './crate'
import { Desk } from './Desk'
import { boxIn, flySleeve, wait, type Box } from './flight'
import { useCrateLayout } from './useCrateLayout'
import { CoverArt, Vinyl } from './Vinyl'
import type { CrateRecord } from './types'

/* Motion timings from the design study (docs/design-explorations/music/README.md). */
const TAKE_OUT_MS = 620
const PUT_BACK_MS = 520
const SWAP_BACK_MS = 420
/** The record slides back into its sleeve before the sleeve leaves the desk. */
const SLIDE_IN_MS = 380
const SETTLE_MS = 120
/** The desk's fold in music.css (--dur-panel), for when it can't be read. */
const DESK_FOLD_FALLBACK_MS = 460
/** A drag of more than this flips through the crate instead of tapping a sleeve. */
const DRAG_SLOP = 8

interface DeskState {
  index: number
  open: boolean
  settled: boolean
  out: boolean
  sleeveShown: boolean
}

export type CrateVariant = 'records' | 'podcasts'

interface RecordCrateProps {
  records: CrateRecord[]
  heading: string
  description: string
  /** Podcasts are covers only: no record slides out of them. */
  variant?: CrateVariant
}

const describe = (r: CrateRecord) =>
  [r.title || 'Untitled', r.artist, r.kind.toLowerCase()].filter(Boolean).join(', ') + (r.sample ? ' (sample)' : '')

/**
 * "On my shelf of records": sleeves standing on a walnut board, flipped
 * through with the pointer, a finger or the arrow keys. Choosing one takes it
 * out to the desk below, with its liner notes and an opt-in Spotify player.
 */
export function RecordCrate({ records, heading, description, variant = 'records' }: RecordCrateProps) {
  const disc = variant === 'records'
  const reduced = usePrefersReducedMotion()
  const baseId = useId()
  const deskId = `${baseId}-desk`
  const sectionRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const deskSleeveRef = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const [active, setActive] = useState<number | null>(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [slotOut, setSlotOut] = useState<number | null>(null)
  const [desk, setDesk] = useState<DeskState | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const outRef = useRef<number | null>(null)
  const busy = useRef(false)
  const drag = useRef<{ x: number; moved: boolean; index: number } | null>(null)
  const foldTimer = useRef<number | undefined>(undefined)

  const count = records.length
  const { offsets, instant } = useCrateLayout(listRef, count, active ?? slotOut)
  const shown = active ?? slotOut
  const captionRecord = shown != null ? records[shown] : undefined
  const deskRecord = desk ? records[desk.index] : undefined

  useEffect(() => () => window.clearTimeout(foldTimer.current), [])

  // A drag ends wherever the finger lifts. Cleared after the click that follows it.
  useEffect(() => {
    const end = () => window.setTimeout(() => (drag.current = null), 0)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [])

  const reveal = useCallback(
    (el: Element | null) =>
      el?.scrollIntoView({
        block: 'nearest',
        behavior: reduced ? 'auto' : 'smooth',
      }),
    [reduced],
  )

  const focusSleeve = (i: number) => {
    setFocusIndex(i)
    buttons.current[i]?.focus()
  }

  /** Where a sleeve's face stands in its slot, ignoring the dip of an empty slot. */
  const slotBox = (i: number): Box | null => {
    const section = sectionRef.current
    const li = listRef.current?.children[i]
    const face = li?.querySelector('.sleeve__face')
    if (!section || !li || !(face instanceof HTMLElement)) return null
    const slot = li.getBoundingClientRect()
    const size = face.offsetWidth
    return boxIn(section, new DOMRect(slot.left, slot.bottom - size, size, size))
  }

  /** Put the record on the desk back in its slot. With fold=false the desk stays open for a swap. */
  const stow = async (fold: boolean) => {
    const i = outRef.current
    const section = sectionRef.current
    if (i == null || !section) return
    flushSync(() => setDesk((d) => d && { ...d, out: false }))
    let foldFrom = 0 // when the desk started folding (it folds while the sleeve flies back)
    if (!reduced) {
      await wait(SLIDE_IN_MS)
      const sleeve = deskSleeveRef.current
      const to = slotBox(i)
      if (sleeve && to) {
        const from = boxIn(section, sleeve.getBoundingClientRect())
        flushSync(() =>
          setDesk(
            (d) =>
              d && {
                ...d,
                sleeveShown: false,
                ...(fold ? { open: false, settled: false } : {}),
              },
          ),
        )
        foldFrom = performance.now()
        await flySleeve(section, sleeve, from, to, fold ? PUT_BACK_MS : SWAP_BACK_MS)
      }
    } else if (fold) {
      flushSync(() => setDesk((d) => d && { ...d, open: false, settled: false }))
      foldFrom = performance.now()
    }
    flushSync(() => setSlotOut(null))
    outRef.current = null
    // The desk stays drawn while it folds away, with a frame to spare, counted from when the
    // fold began (during the flight back), so a player left open stops as the desk closes.
    if (fold) {
      const foldMs = reduced ? 0 : transitionMs(wrapRef.current, 'grid-template-rows', DESK_FOLD_FALLBACK_MS) + 20
      const left = Math.max(0, foldMs - (foldFrom ? performance.now() - foldFrom : 0))
      foldTimer.current = window.setTimeout(() => setDesk(null), left)
    }
  }

  const takeOut = async (i: number) => {
    const record = records[i]
    const section = sectionRef.current
    if (busy.current || !record || !section) return
    busy.current = true
    window.clearTimeout(foldTimer.current)
    if (outRef.current != null) await stow(false)

    const face = listRef.current?.children[i]?.querySelector('.sleeve__face')
    const from = face ? boxIn(section, face.getBoundingClientRect()) : null
    flushSync(() => {
      setDesk({
        index: i,
        open: true,
        settled: reduced,
        out: reduced,
        sleeveShown: reduced,
      })
      setSlotOut(i)
    })
    outRef.current = i
    setAnnouncement(`${record.title || (disc ? 'The record' : 'The podcast')} is out on the desk.`)

    const sleeve = deskSleeveRef.current
    if (!reduced && face && from && sleeve) {
      const to = boxIn(section, sleeve.getBoundingClientRect())
      requestAnimationFrame(() => reveal(wrapRef.current))
      await flySleeve(section, face, from, to, TAKE_OUT_MS)
      // The record slides (and rolls) out; the notes settle in.
      flushSync(() => setDesk((d) => d && { ...d, sleeveShown: true, settled: true, out: true }))
      await wait(SETTLE_MS)
    }
    reveal(wrapRef.current)
    busy.current = false
  }

  const putBack = async () => {
    const i = outRef.current
    if (busy.current || i == null) return
    busy.current = true
    await stow(true)
    setAnnouncement(`${records[i]?.title || (disc ? 'The record' : 'The podcast')} is back on the shelf.`)
    focusSleeve(i)
    busy.current = false
  }

  /* ── Pointer and touch: flip through by moving along the crate ── */
  const indexAtPointer = (clientX: number) => {
    const left = listRef.current?.getBoundingClientRect().left ?? 0
    return sleeveAt(offsets, clientX - left)
  }
  const onPointerMove = (event: PointerEvent<HTMLUListElement>) => {
    if (event.pointerType !== 'mouse' && !drag.current) return
    const i = indexAtPointer(event.clientX)
    setActive(i)
    if (!drag.current) return
    drag.current.index = i
    if (Math.abs(event.clientX - drag.current.x) > DRAG_SLOP) drag.current.moved = true
  }
  const onPointerDown = (event: PointerEvent<HTMLUListElement>) => {
    if (event.pointerType === 'mouse') return
    const i = indexAtPointer(event.clientX)
    drag.current = { x: event.clientX, moved: false, index: i }
    setActive(i)
  }
  const onPointerLeave = (event: PointerEvent<HTMLUListElement>) => {
    if (event.pointerType !== 'mouse') return
    setActive(listRef.current?.contains(document.activeElement) ? focusIndex : null)
  }
  const onSleeveClick = (i: number) => {
    if (drag.current?.moved) return // a swipe flips; a tap takes the record out
    const chosen = drag.current ? drag.current.index : i
    void (chosen === outRef.current ? putBack() : takeOut(chosen))
  }

  /* ── Keyboard: one tab stop, arrows and Home/End flip, Enter takes out ── */
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const next = nextSleeve(event.key, focusIndex, count)
    if (next == null) return
    event.preventDefault()
    focusSleeve(next)
  }
  // Escape puts the record back, and must not also close the panel's <dialog>.
  const onSectionKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || outRef.current == null) return
    event.preventDefault()
    event.stopPropagation()
    void putBack()
  }

  return (
    <section
      ref={sectionRef}
      className="crate-section"
      data-variant={variant}
      aria-labelledby={`${baseId}-heading`}
      onKeyDown={onSectionKeyDown}
    >
      <div className="music-head">
        <h3 id={`${baseId}-heading`} className="music-head__title">
          {heading}
        </h3>
        {description && <p className="music-head__description">{description}</p>}
      </div>

      <div className="crate-wrap">
        <p className="visually-hidden" id={`${baseId}-hint`}>
          Use the arrow keys to flip through, Enter to take {disc ? 'a record' : 'one'} out.
        </p>
        <ul
          ref={listRef}
          className="crate"
          role="list"
          data-instant={instant ? '' : undefined}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerLeave}
          onKeyDown={onListKeyDown}
          onFocus={(event) => {
            const target: EventTarget = event.target
            const i = buttons.current.findIndex((button) => button === target)
            if (i < 0) return
            setFocusIndex(i)
            setActive(i)
          }}
          onBlur={(event) => {
            if (!listRef.current?.contains(event.relatedTarget as Node | null)) setActive(null)
          }}
        >
          {records.map((record, i) => (
            <li
              key={record.key}
              style={
                {
                  zIndex: i + 1,
                  '--x': `${Math.round(offsets[i] ?? 0)}px`,
                } as CSSProperties
              }
              data-active={i === active && i !== slotOut ? '' : undefined}
              data-out={i === slotOut ? '' : undefined}
            >
              <button
                ref={(el) => {
                  buttons.current[i] = el
                }}
                type="button"
                className="sleeve"
                tabIndex={i === focusIndex ? 0 : -1}
                aria-label={describe(record)}
                // the keys hint is read with the record that has focus (a list can't be described)
                aria-describedby={`${baseId}-hint`}
                aria-expanded={i === slotOut}
                aria-controls={deskId}
                onClick={() => onSleeveClick(i)}
              >
                {disc && (
                  <span className="sleeve__disc">
                    <Vinyl cover={record.cover} art={record.art} />
                  </span>
                )}
                <span className="sleeve__face">
                  <CoverArt cover={record.cover} art={record.art} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="crate__caption" aria-hidden="true">
          {/* Only the sleeve you point at is named; on the podcast shelf every show is a podcast, so it isn't said. */}
          {captionRecord && (
            <>
              <b>{captionRecord.title || 'Loading…'}</b>
              <span>{[captionRecord.artist, disc ? captionRecord.kind : undefined].filter(Boolean).join(' · ')}</span>
            </>
          )}
        </p>
      </div>

      <div
        ref={wrapRef}
        className="desk-wrap"
        data-open={desk?.open ? '' : undefined}
        data-settled={desk?.settled ? '' : undefined}
        inert={!desk?.open}
      >
        <div
          id={deskId}
          className="desk"
          role="region"
          aria-label={disc ? 'Record on the desk' : 'Podcast on the desk'}
          data-out={desk?.out ? '' : undefined}
        >
          {desk && deskRecord && (
            <Desk
              key={deskRecord.key}
              record={deskRecord}
              out={desk.out}
              sleeveShown={desk.sleeveShown}
              sleeveRef={deskSleeveRef}
              disc={disc}
              onPutBack={() => void putBack()}
            />
          )}
        </div>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </section>
  )
}
