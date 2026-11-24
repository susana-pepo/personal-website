import { lazy, Suspense, useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { content } from '../../content/content'
import { useCoverFit } from '../../hooks/useCoverFit'
import { useRoomPan } from '../../hooks/useRoomPan'
import { useEntered } from '../../hooks/useEntered'
import { useCoarsePointer, usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import type { ScenePlayback } from '../../hooks/useScenePlayback'
import type { CatPhase, PetStyle } from '../../scene/catReaction'
import type { HotspotAction } from '../../scene/hotspots'
import { HOTSPOTS, boundsOf } from '../../scene/hotspots'
import { OVERLAYS, ROOM_FRAME, ROOM_PLAYBACK_RATE, ROOM_POSTER_SRC, ROOM_VIDEO_SRC, pctX, pctY } from '../../scene/layout'
import { useFrameBlend } from '../../hooks/useFrameBlend'
import { useLoopSeam } from '../../hooks/useLoopSeam'
import { CatOverlay, type CatHandle } from './overlays/CatOverlay'
import { CoffeeOverlay } from './overlays/CoffeeOverlay'
import { WomanOverlay } from './overlays/WomanOverlay'
import { HotspotLayer } from './HotspotLayer'
import { PressedObject, SceneObject } from './overlays/SceneObject'
import { PowerLight, VinylPlayer } from './overlays/VinylPlayer'
import { LampLiquid } from './lamp/LampLiquid'
import { LampColour } from './lamp/LampColour'
import { nextTone, splashColour, toneAt } from '../../scene/lampTones'
import { LampSplash, type LampSplashHandle } from './lamp/LampSplash'
import { TowerLight } from './window/TowerLight'
import { LaptopTerminal } from './overlays/LaptopTerminal'
import { useSection } from '../../hooks/useSection'
import { WindowLife } from './window/WindowLife'
import { WindowView } from './window/WindowView'
import { SceneControl } from './controls/SceneControl'
import { timeAt, type TimeOfDay } from '../../scene/windowViews'
import { ENTRANCE_MAX_WAIT_MS, ENTRANCE_SETTLE_MS, entranceImages, sceneReady, whenEntered, whenSettled } from '../../scene/entrance'
import { WeatherLayer, WeatherSky } from './window/WeatherLayer'
import { DEFAULT_WEATHER, WEATHER_CHOICES, WEATHER_WORDS, isWeather, type Weather } from '../../scene/weather'
import './HeroScene.css'

/** The room as a picture's description; the weather outside follows the control. */
const sceneDescription = (weather: Weather, words = WEATHER_WORDS[weather]) =>
  `An illustrated room on ${words.evening}. A woman with long brown hair sits at a wooden desk by a tall window, writing in a notebook under a brass lamp, beside an open laptop, a small stack of books, a vase of blossoms, a steaming cup of coffee, headphones and a sleeping ginger-and-cream cat. ${words.outside} Behind her, a bookshelf holds books, an orchid and a vintage camera, and a record player rests on a low wooden cabinet.`

// Development only: ?weather=clear|rain|snow starts the room in that weather.
const weatherRequested = (() => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  const asked = new URLSearchParams(window.location.search).get('weather')
  return isWeather(asked) ? asked : null
})()

// Development-only alignment overlay: ?debug=1 (or ?debugHotspots=1), or press D.
const HotspotDebug = import.meta.env.DEV ? lazy(() => import('./dev/HotspotDebug')) : null
const debugRequested =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  ['debug', 'debugHotspots'].some((key) => new URLSearchParams(window.location.search).get(key) === '1')

// Development-only placement sandbox: ?sandbox=1.
const SceneSandbox = import.meta.env.DEV ? lazy(() => import('./dev/SceneSandbox')) : null
const sandboxRequested =
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sandbox') === '1'

const OBJECTS = OVERLAYS.filter((o) => o.id !== 'cat' && o.id !== 'vinyl' && o.id !== 'coffee' && o.id !== 'woman')
// The optional breathing pulse before the first interaction (off when every object's `invite` is 0).
const INVITE = OVERLAYS.some((o) => (o.glow?.invite ?? 0) > 0)
// The clip and its poster are drawn slightly zoomed so the painted room lines up with the objects.
const ROOM_BOX = {
  left: pctX(ROOM_FRAME.x),
  top: pctY(ROOM_FRAME.y),
  width: pctX(ROOM_FRAME.width),
  height: pctY(ROOM_FRAME.height),
}
// Left to right: the order the objects light up in on a first look (not the cat: it is a playful extra).
const DISCOVERY_ORDER = ['vinyl', 'books', 'woman', 'deskbooks', 'laptop', 'coffee']
const discoveryIndex = (id: string) => DISCOVERY_ORDER.indexOf(id)
/**
 * Pause after the room has settled, then each object glows for 820 ms, 180 ms apart
 * (halo-discover in HeroScene.css). Settled is 1300 ms after the entrance, so the sweep starts
 * about 3.4 s in, as her greeting fades, and the chip lands as the last halo peaks
 * (--hint-delay in DiscoveryHint.css is worked out from these numbers).
 */
const DISCOVERY_DELAY_MS = 2100
const DISCOVERY_STEP_MS = 180
const DISCOVERY_TOTAL_MS = DISCOVERY_DELAY_MS + (DISCOVERY_ORDER.length - 1) * DISCOVERY_STEP_MS + 820 + 100
/** The lamp's current light, as announced (or that it's off). */
const lampName = (step: number) => {
  const tone = toneAt(step)
  return tone ? content.lamp.tones[tone.id] : content.lamp.off
}
/** How often the window checks the visitor's clock (a new hour may bring a new view). */
const CLOCK_CHECK_MS = 60_000
/** Her greeting on a first visit: how long into the entrance it rises in, and how long it stays. */
const GREETING_IN_MS = 550
const GREETING_FOR_MS = 4700 // as long as its float (HotspotSpeech.css: greet-float)
const OVERLAY_OF = new Map(HOTSPOTS.flatMap((h) => (h.overlay ? [[h.id, h.overlay] as const] : [])))
/** Each object's left and right edge on the canvas, to bring it into view on a phone's panning room. */
const SPAN_OF = new Map(
  HOTSPOTS.map((h) => {
    const box = boundsOf(h.polygons)
    return [h.id, [box.x, box.x + box.width] as const]
  }),
)

interface HeroSceneProps {
  stageRef: RefObject<HTMLDivElement | null>
  videoRef: RefObject<HTMLVideoElement | null>
  playback: ScenePlayback
  /** Where to draw the scene control (time of day and weather): the masthead above the room. */
  controlSlot?: HTMLElement | null
}

export function HeroScene({ stageRef, videoRef, playback, controlSlot }: HeroSceneProps) {
  const [posterFailed, setPosterFailed] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [debug, setDebug] = useState(debugRequested)
  const catRef = useRef<CatHandle>(null)
  const announcementTimer = useRef<number | undefined>(undefined)
  const { style: sceneStyle, pan } = useCoverFit(stageRef)
  const entered = useEntered() // the room's video waits for the page's entrance (the poster shows till then)
  const seamRef = useRef<HTMLCanvasElement>(null)
  const blendARef = useRef<HTMLCanvasElement>(null)
  const blendBRef = useRef<HTMLCanvasElement>(null)
  const [blendRefs] = useState(() => [blendARef, blendBRef] as const)
  const reducedMotion = usePrefersReducedMotion()
  // A portrait phone pans across the room (App.css): keyboard focus brings each object into view.
  const roomPan = useRoomPan(stageRef, pan, reducedMotion)
  const { reveal } = roomPan
  const revealObject = useCallback(
    (id: string) => {
      const span = SPAN_OF.get(id)
      if (span) reveal(span[0], span[1])
    },
    [reveal],
  )
  // Dissolve the clip's last frame into its first at every loop instead of cutting.
  useLoopSeam(videoRef, seamRef, { fadeMs: 500, enabled: playback.shouldLoad && !playback.unavailable })
  // The clip plays slowed (0.6×): blend each frame into the next so the motion stays smooth.
  useFrameBlend(videoRef, blendRefs, {
    enabled: playback.shouldLoad && !playback.unavailable && ROOM_PLAYBACK_RATE < 1,
    frameRate: 24,
  })
  // A one-time, staggered glow across the objects, once the page's entrance has settled.
  const [discovery, setDiscovery] = useState<'pending' | 'running' | 'done'>('pending')
  useEffect(() => {
    if (discovery !== 'pending' || reducedMotion) return
    let start: number | undefined
    let live = true
    void whenSettled().then(() => {
      if (live) start = window.setTimeout(() => setDiscovery('running'), DISCOVERY_DELAY_MS)
    })
    return () => {
      live = false
      window.clearTimeout(start)
    }
  }, [discovery, reducedMotion])
  useEffect(() => {
    if (discovery !== 'running') return
    const end = window.setTimeout(() => setDiscovery('done'), DISCOVERY_TOTAL_MS - DISCOVERY_DELAY_MS)
    return () => window.clearTimeout(end)
  }, [discovery])
  const discovering = discovery === 'running'

  const litOverlay = active ? OVERLAY_OF.get(active) : undefined
  // The object under a pointer press sinks a touch (HeroScene.css), as a sign the press was heard.
  const [pressed, setPressed] = useState<string | null>(null)
  const pressedOverlay = (pressed && OVERLAY_OF.get(pressed)) || null
  const section = useSection()
  // Until the visitor first hovers, focuses or taps an object (used by the optional invitation pulse).
  const [explored, setExplored] = useState(false)
  // First visit: her greeting ("Hey there, I'm Susana") is part of the entrance: it rises in
  // as the room arrives, stays a few seconds, then fades away (sooner if the visitor touches
  // the room). After that it shows on hover, like every object's line.
  const [greetingOn, setGreetingOn] = useState(false)
  useEffect(() => {
    let live = true
    let on: number | undefined
    let off: number | undefined
    void whenEntered().then(() => {
      if (!live) return
      on = window.setTimeout(() => setGreetingOn(true), GREETING_IN_MS)
      off = window.setTimeout(() => setGreetingOn(false), GREETING_IN_MS + GREETING_FOR_MS)
    })
    return () => {
      live = false
      window.clearTimeout(on)
      window.clearTimeout(off)
    }
  }, [])
  const greeting = greetingOn && !explored
  useEffect(() => {
    if (active) setExplored(true)
  }, [active])

  // The time of day outside the window follows the visitor's own clock, from the
  // first paint, until they pick a time themselves; then it stays as they left it.
  // (A time they pick is said by screen readers, as the control is a radio group;
  // one the clock brings is not, like the rest of the room's ambient changes.)
  const [time, setTime] = useState<TimeOfDay>(() => timeAt(new Date()))
  // The weather outside: the painting's rain until the visitor picks another.
  const [weather, setWeather] = useState<Weather>(weatherRequested ?? DEFAULT_WEATHER)
  // The room's light (the washes, the tower light, the lit windows) waits for the
  // window to really show its view; until then it's the painting's own dawn.
  const [viewReady, setViewReady] = useState(false)
  const onViewReady = useCallback(() => setViewReady(true), [])
  const lightTime: TimeOfDay = viewReady ? time : 'dawn'
  const pickedTime = useRef(false)
  const pickTime = useCallback((next: TimeOfDay) => {
    pickedTime.current = true
    setViewReady(true)
    setTime(next)
  }, [])
  useEffect(() => {
    // Checked each minute, and on coming back to the tab (timers sleep in the
    // background). A change waits until the page is visible, so it's seen to fade,
    // and while the time control has focus, so its options don't move under the keys.
    const follow = () => {
      if (pickedTime.current || document.hidden) return
      if (document.activeElement?.closest('.time-control')) return
      setTime(timeAt(new Date()))
    }
    const timer = window.setInterval(follow, CLOCK_CHECK_MS)
    document.addEventListener('visibilitychange', follow)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', follow)
    }
  }, [])

  // The entrance: the room waits, unseen, until its pictures and fonts are ready (never more
  // than a few seconds), then the whole page is revealed at once (see scene/entrance.ts).
  useEffect(() => {
    const root = document.documentElement
    if (root.dataset.entered !== undefined) return
    let cancelled = false
    void sceneReady(entranceImages(timeAt(new Date())), ENTRANCE_MAX_WAIT_MS).then(() => {
      if (cancelled) return
      // two frames, so the decoded pictures are painted before the fade starts
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          root.dataset.entered = ''
          window.setTimeout(() => (root.dataset.settled = ''), ENTRANCE_SETTLE_MS)
        }),
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  // The desk lamp's light colour (a click steps to the next one).
  const [lampTone, setLampTone] = useState(0)
  const lampToneRef = useRef(0)
  const lampSplash = useRef<LampSplashHandle>(null)
  // Arriving on the lamp with a mouse or the keyboard: it twitches (three tiny comic
  // jiggle marks) and its bulb warms. On a touch screen a tap is the click itself.
  const coarsePointer = useCoarsePointer()
  const lampLit = active === 'lamp' && !coarsePointer
  useEffect(() => {
    if (lampLit) lampSplash.current?.tease()
  }, [lampLit])
  const onAction = useCallback((action: HotspotAction) => {
    setExplored(true)
    if (action === 'pet') catRef.current?.pet()
    if (action === 'light') {
      const next = nextTone(lampToneRef.current)
      lampToneRef.current = next
      setLampTone(next)
      lampSplash.current?.burst(splashColour(toneAt(next)))
      window.clearTimeout(announcementTimer.current)
      setAnnouncement(lampName(next))
      announcementTimer.current = window.setTimeout(() => setAnnouncement(''), 1500)
    }
  }, [])

  // The cat answers in the room itself (a purr, floating z's); screen readers hear what it did.
  const onCatReaction = useCallback((phase: CatPhase, _style: PetStyle | null, reaction: string | null) => {
    window.clearTimeout(announcementTimer.current)
    if (phase === 'petting') {
      setAnnouncement(
        reaction === 'head-turn'
          ? content.cat.headTurnAnnouncement
          : reaction === 'stretch'
            ? content.cat.stretchAnnouncement
            : content.cat.announcement,
      )
    } else {
      announcementTimer.current = window.setTimeout(() => setAnnouncement(''), 1000)
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'd' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], dialog[open]')) return
      setDebug((on) => !on)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <div
        ref={stageRef}
        className="stage"
        data-has-frame={playback.hasFrame && !playback.unavailable ? '' : undefined}
        data-poster-failed={posterFailed ? '' : undefined}
      >
        <div
          className="scene"
          style={sceneStyle}
          data-time={lightTime}
          data-weather={weather}
          data-discovering={discovering ? '' : undefined}
          data-inviting={INVITE && !explored && !discovering ? '' : undefined}
        >
          {posterFailed ? (
            <div className="stage__fallback" role="img" aria-label={sceneDescription(weather)} />
          ) : (
            <img
              className="stage__poster"
              style={ROOM_BOX}
              src={ROOM_POSTER_SRC}
              width={1920}
              height={1080}
              alt={sceneDescription(weather)}
              decoding="async"
              fetchPriority="high"
              onError={() => setPosterFailed(true)}
            />
          )}

          {ROOM_VIDEO_SRC && !playback.unavailable && (
            <video
              ref={videoRef}
              className="stage__video"
              style={ROOM_BOX}
              src={playback.shouldLoad && entered ? ROOM_VIDEO_SRC : undefined}
              width={1920}
              height={1080}
              muted
              loop
              playsInline
              preload="none"
              disablePictureInPicture
              disableRemotePlayback
              aria-hidden="true"
              tabIndex={-1}
              // Slowed to a calmer pace. Set on load because a new source resets the rate.
              onLoadedMetadata={(event) => {
                event.currentTarget.defaultPlaybackRate = ROOM_PLAYBACK_RATE
                event.currentTarget.playbackRate = ROOM_PLAYBACK_RATE
              }}
            />
          )}

          {ROOM_VIDEO_SRC && (
            <>
              <canvas ref={blendARef} className="stage__blend" style={ROOM_BOX} aria-hidden="true" />
              <canvas ref={blendBRef} className="stage__blend" style={ROOM_BOX} aria-hidden="true" />
              <canvas ref={seamRef} className="stage__seam" style={ROOM_BOX} aria-hidden="true" />
            </>
          )}

          <WindowView time={time} motionAllowed={playback.motionAllowed} onReady={onViewReady} />
          <TowerLight time={lightTime} motionAllowed={playback.motionAllowed} />
          <WeatherSky weather={weather} time={lightTime} />
          <WindowLife time={lightTime} motionAllowed={playback.motionAllowed} />
          <WeatherLayer weather={weather} time={lightTime} motionAllowed={playback.motionAllowed} />

          <PressedObject value={pressedOverlay}>
            {OBJECTS.map((object) => (
              <SceneObject
                key={object.id}
                overlay={object}
                highlighted={litOverlay === object.id}
                discoveryIndex={discoveryIndex(object.id)}
                extra={
                  object.id === 'laptop' ? (
                    <LaptopTerminal open={litOverlay === 'laptop' || section === 'work'} motionAllowed={playback.motionAllowed} />
                  ) : undefined
                }
              />
            ))}
            <VinylPlayer
              highlighted={litOverlay === 'vinyl'}
              motionAllowed={playback.motionAllowed}
              discoveryIndex={discoveryIndex('vinyl')}
            />
            <WomanOverlay
              motionAllowed={playback.motionAllowed}
              highlighted={litOverlay === 'woman'}
              discoveryIndex={discoveryIndex('woman')}
            />
            <CoffeeOverlay
              motionAllowed={playback.motionAllowed}
              highlighted={litOverlay === 'coffee'}
              discoveryIndex={discoveryIndex('coffee')}
            />
            <CatOverlay
              ref={catRef}
              motionAllowed={playback.motionAllowed}
              highlighted={litOverlay === 'cat'}
              discoveryIndex={-1}
              onReaction={onCatReaction}
            />
          </PressedObject>
          {/* Evening mood over the room and every object; the lamp's light sits above it. */}
          <span className="room-mood" aria-hidden="true" />
          {/* The time of day in the room's light (none at dawn: the painting as it is). */}
          <span className="time-light time-light--day" aria-hidden="true" />
          <span className="time-light time-light--night" aria-hidden="true" />
          <PowerLight highlighted={litOverlay === 'vinyl'} motionAllowed={playback.motionAllowed} />

          <LampLiquid motionAllowed={playback.motionAllowed} tone={lampTone} hovered={lampLit} />
          <LampColour tone={lampTone} />
          <LampSplash ref={lampSplash} />

          <HotspotLayer
            onActiveChange={setActive}
            onPressChange={setPressed}
            onAction={onAction}
            onFocusObject={revealObject}
            lampTone={lampName(lampTone)}
            greeting={greeting}
          />

          {/* Drawn in the masthead above the room (after the menu in the tab order). */}
          {controlSlot &&
            createPortal(
              <SceneControl value={time} onChange={pickTime} weather={weather} weathers={WEATHER_CHOICES} onWeatherChange={setWeather} />,
              controlSlot,
            )}

          {SceneSandbox && sandboxRequested && (
            <Suspense fallback={null}>
              <SceneSandbox />
            </Suspense>
          )}

          {HotspotDebug && debug && (
            <Suspense fallback={null}>
              <HotspotDebug />
            </Suspense>
          )}
        </div>

        <p className="visually-hidden" aria-live="polite">
          {announcement}
        </p>
      </div>
      {/* A portrait phone's room pans: soft fades at the edges with more of the room beyond them. */}
      {pan && (
        <span
          className="stage-edges"
          data-start={roomPan.more.start ? '' : undefined}
          data-end={roomPan.more.end ? '' : undefined}
          aria-hidden="true"
        />
      )}
    </>
  )
}
