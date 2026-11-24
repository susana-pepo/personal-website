import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { usePrefersReducedMotion } from './useMediaQuery'

type NetworkInformationLike = { saveData?: boolean; effectiveType?: string }

function prefersDataSaving(): boolean {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  return Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType ?? '')
}

export interface ScenePlayback {
  /** The video should be attached (its source requested). */
  shouldLoad: boolean
  /** The video is actually playing frames. */
  isPlaying: boolean
  /** The first frame has been shown; until then the poster image is visible. */
  hasFrame: boolean
  /** The video failed to load; the poster stays in place permanently. */
  unavailable: boolean
  /** True when the visitor (or their settings) chose a still room. */
  isPausedByChoice: boolean
  /**
   * Motion is welcome right now: not paused by choice or settings, the tab is
   * visible and the room is on screen. Other moving parts (the cat) follow this.
   */
  motionAllowed: boolean
  toggle: () => void
}

/**
 * Decides when the looping room animation plays.
 *
 * - Respects prefers-reduced-motion and Save-Data: starts on the still poster,
 *   and the video file is not requested until the visitor presses play.
 * - Pauses when the tab is hidden or the room scrolls out of view.
 * - Falls back to the poster if autoplay is blocked or the video fails.
 */
export function useScenePlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  stageRef: RefObject<HTMLElement | null>,
): ScenePlayback {
  const reducedMotion = usePrefersReducedMotion()
  const [pausedByChoice, setPausedByChoice] = useState(() => reducedMotion || prefersDataSaving())
  const [shouldLoad, setShouldLoad] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasFrame, setHasFrame] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  )
  const [inView, setInView] = useState(true)
  const userToggled = useRef(false)

  // Follow the reduced-motion preference until the visitor makes their own choice.
  useEffect(() => {
    if (!userToggled.current) setPausedByChoice(reducedMotion || prefersDataSaving())
  }, [reducedMotion])

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry ? entry.isIntersecting : true),
      { threshold: 0.05 },
    )
    observer.observe(stage)
    return () => observer.disconnect()
  }, [stageRef])

  const motionAllowed = !pausedByChoice && pageVisible && inView
  const wantsToPlay = motionAllowed && !unavailable

  useEffect(() => {
    if (wantsToPlay) setShouldLoad(true)
  }, [wantsToPlay])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !shouldLoad) return
    video.muted = true
    if (wantsToPlay) {
      const attempt = video.play()
      attempt?.catch((error: unknown) => {
        // Autoplay was refused (e.g. power saving). Show the still room and
        // let the visitor start it themselves.
        if (error instanceof DOMException && error.name === 'NotAllowedError') setPausedByChoice(true)
      })
    } else if (!video.paused) {
      video.pause()
    }
  }, [videoRef, shouldLoad, wantsToPlay])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPlaying = () => {
      setIsPlaying(true)
      setHasFrame(true)
    }
    const onPause = () => setIsPlaying(false)
    const onLoaded = () => setHasFrame(true)
    const onError = () => {
      setUnavailable(true)
      setIsPlaying(false)
    }
    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('loadeddata', onLoaded)
    video.addEventListener('error', onError)
    return () => {
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('loadeddata', onLoaded)
      video.removeEventListener('error', onError)
    }
  }, [videoRef])

  const toggle = useCallback(() => {
    userToggled.current = true
    setPausedByChoice((paused) => !paused)
  }, [])

  return { shouldLoad, isPlaying, hasFrame, unavailable, isPausedByChoice: pausedByChoice, motionAllowed, toggle }
}
