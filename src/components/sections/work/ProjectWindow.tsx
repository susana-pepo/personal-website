import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { WorkProject } from '../../../content/types'
import { Topics } from '../Topics'
import { FADE_KEYFRAMES, genieKeyframes, type Box } from './desktop'
import { WorkThumb } from './thumbs/WorkThumb'

/** Full open and full close, in ms. A change of mind mid-way reverses from where it is. */
const OPEN_MS = 450
const CLOSE_MS = 300
const FADE_MS = 150
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}

interface ProjectWindowProps {
  project: WorkProject
  id: string
  /** The file it pours out of and returns to. */
  from: HTMLElement | null
  /** True while it is being put back; the motion reverses from wherever it is. */
  closing: boolean
  reducedMotion: boolean
  onPutBack: () => void
  /** Called once it is fully back in its file. */
  onClosed: () => void
}

/**
 * An open project: a raised dark window on the tablet's screen, poured out of its
 * file in a short, transform-only genie and put back the same way. Focus moves
 * into it on open; the desktop returns focus to the file on close.
 */
export function ProjectWindow({ project, id, from, closing, reducedMotion, onPutBack, onClosed }: ProjectWindowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const anim = useRef<Animation | null>(null)
  const closingRef = useRef(closing)
  const onClosedRef = useRef(onClosed)
  const [landing, setLanding] = useState(true)
  closingRef.current = closing
  onClosedRef.current = onClosed

  // Pour out of the file once, as soon as the window has its final size.
  useLayoutEffect(() => {
    const win = ref.current
    if (!win) return
    win.focus({ preventScroll: true })
    if (typeof win.animate !== 'function') return
    const frames = reducedMotion || !from ? FADE_KEYFRAMES : genieKeyframes(boxOf(from), boxOf(win))
    const a = win.animate(frames, {
      duration: reducedMotion ? FADE_MS : OPEN_MS,
      easing: reducedMotion ? 'ease' : EASE,
      fill: 'both',
    })
    a.onfinish = () => {
      if (closingRef.current) onClosedRef.current()
      else setLanding(false)
    }
    anim.current = a
    return () => {
      a.onfinish = null
      a.cancel()
      anim.current = null
    }
    // The path is fixed when the window opens; later changes don't re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Put back (or change of mind): play the same path the other way from where it is.
  useEffect(() => {
    const a = anim.current
    if (!a) {
      if (closing) onClosedRef.current()
      return
    }
    // Put back before it has even started: stay at the start (invisible) and close.
    // (Reversing from time 0 would make the browser seek to the end first.)
    if (closing && Number(a.currentTime ?? 0) <= 0) {
      a.pause()
      onClosedRef.current()
      return
    }
    const back = reducedMotion ? 1 : OPEN_MS / CLOSE_MS
    a.updatePlaybackRate(closing ? -back : 1)
    a.play()
  }, [closing, reducedMotion])

  const titleId = `${id}-title`

  return (
    <div
      ref={ref}
      id={id}
      className="wwin"
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-landing={landing ? '' : undefined}
    >
      <div className="wwin__bar">
        <span className="wwin__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="wwin__name" aria-hidden="true">
          {project.title}
        </span>
        <button type="button" className="wwin__back" onClick={onPutBack}>
          Put it back
        </button>
      </div>
      <div className="wwin__body">
        <WorkThumb kind={project.thumb} />
        <div className="wwin__text">
          <h4 id={titleId} className="wwin__title">
            {project.title}
          </h4>
          <p className="wwin__summary">{project.summary}</p>
          {project.topics && <Topics label={`Topics in ${project.title}`} items={project.topics} />}
          {project.href && (
            <p className="wwin__link">
              <a className="text-link" href={project.href} target="_blank" rel="noopener noreferrer">
                {project.linkLabel ?? project.title}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
