import { RAIN_SRC, isStationId, stationById, type RadioTrack, type Station, type StationId } from './playlist'
import { startBinaural } from './binaural'

/**
 * The room radio: "Focus with me". One instance for the page, driven from the footer player.
 *
 * - A press starts a 25-minute focus session on the chosen station (lo-fi, binaural
 *   tones or classical piano), with rain if wanted. At the end the music fades away
 *   slowly and the session is done; a press starts another.
 * - Nothing plays until the visitor presses play (browsers require a click).
 * - Music and rain run through Web Audio gains, so every change fades (and
 *   fades work on iPhones, where an <audio> element's volume is fixed).
 * - The rain is a short recording looped with a crossfade, so there is no seam.
 *   Until the visitor sets its level, it follows the window: on while it rains outside.
 */

export type RadioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'done' | 'error'

export interface RadioState {
  status: RadioStatus
  station: StationId
  /** The track within the station (file stations only). */
  index: number
  /** The music's level, 0 to 1 (remembered). */
  musicLevel: number
  /** The rain's level, 0 to 1, once the visitor sets it (remembered); null follows the window. */
  rainLevel: number | null
  /** The window shows rain right now. */
  raining: boolean
}

/* ── Pure helpers (tested) ── */

export const nextIndex = (index: number, count: number) => (count > 0 ? (index + 1) % count : 0)

/** The rain level used when the visitor hasn't chosen one and it rains outside. */
export const WINDOW_RAIN = 0.65

/** How loud the rain is: the visitor's level, or else the window's weather. */
export const rainLevelOf = (s: Pick<RadioState, 'rainLevel' | 'raining'>) => s.rainLevel ?? (s.raining ? WINDOW_RAIN : 0)

/** The rain is heard while the radio plays and its level is above zero. */
export const rainAudible = (s: Pick<RadioState, 'status' | 'rainLevel' | 'raining'>) =>
  (s.status === 'playing' || s.status === 'loading') && rainLevelOf(s) > 0

export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** One focus session, in seconds. */
export const FOCUS_SECONDS = 25 * 60

/** Seconds left in a session, never below zero. */
export const focusLeft = (elapsed: number, total = FOCUS_SECONDS) => Math.max(0, total - Math.max(0, elapsed))

export interface RadioPrefs {
  station: StationId
  index: number
  musicLevel: number
  rainLevel: number | null
}

export const DEFAULT_PREFS: RadioPrefs = { station: 'lofi', index: 0, musicLevel: 0.85, rainLevel: null }

const level = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined

/** Saved preferences, read defensively: anything unexpected falls back to the defaults. */
export function readPrefs(raw: string | null): RadioPrefs {
  if (!raw) return { ...DEFAULT_PREFS }
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    const station = isStationId(data.station) ? data.station : DEFAULT_PREFS.station
    const count = stationById(station).tracks.length
    const index =
      Number.isInteger(data.index) && (data.index as number) >= 0 && (data.index as number) < count ? (data.index as number) : 0
    // an earlier version saved an on/off rain switch
    const rainLevel = level(data.rainLevel) ?? (data.rainOn === false ? 0 : null)
    return { station, index, musicLevel: level(data.musicLevel) ?? DEFAULT_PREFS.musicLevel, rainLevel }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

/** When each looped copy of the rain starts, so neighbours overlap by `fade` seconds. */
export const rainStarts = (from: number, length: number, fade: number, count: number) =>
  Array.from({ length: count }, (_, i) => from + i * (length - fade))

/* ── The player ── */

const PREFS_KEY = 'room-radio'
/** The gains at full level on the sliders. */
const MUSIC_MAX = 0.8
const RAIN_MAX = 0.6
const FADE_IN = 0.8
const FADE_OUT = 0.35
/** Changing station: the old one dips away, the new one rises. */
const SWITCH_FADE = 0.3
/** A slider being moved. */
const NUDGE = 0.12
const RAIN_FADE = 2.5
const RAIN_XFADE = 3
/** The music's slow fade at the end of a session. */
const END_FADE = 6

type Listener = () => void

class RoomRadio {
  private state: RadioState
  private listeners = new Set<Listener>()
  private ctx: AudioContext | null = null
  private musicGain: GainNode | null = null
  private rainGain: GainNode | null = null
  private audio: HTMLAudioElement | null = null
  /** The file the audio element holds (its own `src` is resolved to a full URL). */
  private loadedSrc = ''
  /** Stops the binaural tones while they play. */
  private stopTones: (() => void) | null = null
  private rainBuffer: AudioBuffer | null = null
  private rainLoading: Promise<void> | null = null
  private rainSources: AudioBufferSourceNode[] = []
  private rainNext = 0
  private rainTimer: number | undefined
  private rainTarget = -1
  private pauseTimer: number | undefined
  private switchTimer: number | undefined
  /** Focus time from earlier stretches of this session (seconds), and when the current stretch began. */
  private focusBanked = 0
  private focusSince: number | null = null
  private endTimer: number | undefined
  /** The levels to come back to when music or rain is switched on again. */
  private lastMusic = DEFAULT_PREFS.musicLevel
  private lastRain = WINDOW_RAIN

  constructor() {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(PREFS_KEY)
    } catch {
      /* storage blocked: defaults */
    }
    this.state = { status: 'idle', raining: false, ...readPrefs(raw) }
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.state

  get station(): Station {
    return stationById(this.state.station)
  }

  get track(): RadioTrack | undefined {
    const { tracks } = this.station
    return tracks[this.state.index] ?? tracks[0]
  }

  /** Seconds focused in this session so far, and the session's length. */
  focus(): { elapsed: number; total: number } {
    const running = this.focusSince === null ? 0 : (performance.now() - this.focusSince) / 1000
    return { elapsed: Math.min(FOCUS_SECONDS, this.focusBanked + running), total: FOCUS_SECONDS }
  }

  private get on() {
    return this.state.status === 'playing' || this.state.status === 'loading'
  }

  toggle = () => {
    if (this.on) this.pause()
    else void this.play()
  }

  next = () => {
    const count = this.station.tracks.length
    if (!count) return
    this.set({ index: nextIndex(this.state.index, count) })
    this.save()
    if (this.on) void this.play()
  }

  setStation = (station: StationId) => {
    if (station === this.state.station) return
    const wasOn = this.on
    this.set({ station, index: 0 })
    this.save()
    if (!this.ctx) return
    window.clearTimeout(this.switchTimer)
    if (!wasOn) {
      this.stopSource()
      return
    }
    this.ramp(this.musicGain!, 0, SWITCH_FADE)
    this.switchTimer = window.setTimeout(
      () => {
        this.stopSource()
        if (this.on) void this.play()
      },
      SWITCH_FADE * 1000 + 40,
    )
  }

  setMusicLevel = (musicLevel: number) => {
    this.set({ musicLevel: Math.min(1, Math.max(0, musicLevel)) })
    this.save()
    if (this.ctx && this.on) this.ramp(this.musicGain!, this.musicTarget, NUDGE)
  }

  setRainLevel = (rainLevel: number) => {
    this.set({ rainLevel: Math.min(1, Math.max(0, rainLevel)) })
    this.save()
  }

  /** Music on or off, coming back at the level it had. */
  toggleMusic = () => {
    const now = this.state.musicLevel
    if (now > 0) this.lastMusic = now
    this.setMusicLevel(now > 0 ? 0 : this.lastMusic || DEFAULT_PREFS.musicLevel)
  }

  /** Rain on or off, coming back at the level it had. */
  toggleRain = () => {
    const now = rainLevelOf(this.state)
    if (now > 0) this.lastRain = now
    this.setRainLevel(now > 0 ? 0 : this.lastRain || WINDOW_RAIN)
  }

  setRaining = (raining: boolean) => {
    if (raining !== this.state.raining) this.set({ raining })
  }

  async play() {
    // Created inside the click, as browsers require.
    if (!this.graph()) return this.set({ status: 'error' })
    const ctx = this.ctx!
    window.clearTimeout(this.pauseTimer)
    window.clearTimeout(this.switchTimer)
    if (this.state.status === 'done') this.focusBanked = 0
    this.set({ status: 'loading' })
    try {
      if (ctx.state !== 'running') await ctx.resume()
      this.ramp(this.musicGain!, this.musicTarget, FADE_IN)
      await this.startSource()
      this.startFocus()
      this.set({ status: 'playing' })
    } catch {
      this.set({ status: 'error' })
    }
  }

  pause() {
    this.stopFocus()
    window.clearTimeout(this.switchTimer)
    if (!this.ctx) return this.set({ status: 'paused' })
    this.ramp(this.musicGain!, 0, FADE_OUT)
    this.set({ status: 'paused' })
    window.clearTimeout(this.pauseTimer)
    this.pauseTimer = window.setTimeout(() => this.stopSource(), FADE_OUT * 1000 + 60)
  }

  private get musicTarget() {
    return MUSIC_MAX * this.state.musicLevel
  }

  /** Starts the station's sound: its current file, or the binaural tones. */
  private async startSource() {
    const track = this.track
    if (!track) {
      this.audio!.pause()
      this.stopTones ??= startBinaural(this.ctx!, this.musicGain!)
      return
    }
    this.stopTones?.()
    this.stopTones = null
    const audio = this.audio!
    if (this.loadedSrc !== track.src) {
      audio.src = track.src
      this.loadedSrc = track.src
    }
    await audio.play()
  }

  private stopSource() {
    this.audio?.pause()
    this.stopTones?.()
    this.stopTones = null
  }

  /* ── The focus session ── */

  private startFocus() {
    if (this.focusSince !== null) return
    this.focusSince = performance.now()
    window.clearTimeout(this.endTimer)
    this.endTimer = window.setTimeout(() => this.finish(), focusLeft(this.focusBanked) * 1000)
  }

  private stopFocus() {
    window.clearTimeout(this.endTimer)
    if (this.focusSince === null) return
    this.focusBanked = this.focus().elapsed
    this.focusSince = null
  }

  /** The session is over: the music fades away slowly (the rain follows), then stops. */
  private finish() {
    // a timer in a background tab can fire early or late; trust the clock
    const left = focusLeft(this.focus().elapsed)
    if (left > 1) {
      this.endTimer = window.setTimeout(() => this.finish(), left * 1000)
      return
    }
    this.stopFocus()
    this.focusBanked = FOCUS_SECONDS
    if (this.ctx) {
      this.ramp(this.musicGain!, 0, END_FADE)
      window.clearTimeout(this.pauseTimer)
      this.pauseTimer = window.setTimeout(() => this.stopSource(), END_FADE * 1000 + 100)
    }
    this.set({ status: 'done' })
  }

  private set(patch: Partial<RadioState>) {
    this.state = { ...this.state, ...patch }
    this.syncRain()
    this.syncMediaSession()
    this.listeners.forEach((listener) => listener())
  }

  private save() {
    const { station, index, musicLevel, rainLevel } = this.state
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ station, index, musicLevel, rainLevel }))
    } catch {
      /* storage blocked: nothing remembered */
    }
  }

  /** The audio graph: music and rain each through their own gain. Built on first play. */
  private graph(): boolean {
    if (this.ctx) return true
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return false
    const ctx = new Ctx()
    const audio = new Audio()
    audio.preload = 'none'
    audio.addEventListener('ended', () => this.next())
    audio.addEventListener('error', () => {
      if (this.on && this.track) this.set({ status: 'error' })
    })
    const music = ctx.createGain()
    music.gain.value = 0
    music.connect(ctx.destination)
    ctx.createMediaElementSource(audio).connect(music)
    const rain = ctx.createGain()
    rain.gain.value = 0
    rain.connect(ctx.destination)
    this.ctx = ctx
    this.audio = audio
    this.musicGain = music
    this.rainGain = rain
    return true
  }

  private ramp(gain: GainNode, to: number, seconds: number) {
    const now = this.ctx!.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(to, now + seconds)
  }

  /* ── Rain ── */

  private syncRain() {
    if (!this.ctx || !this.rainGain) return
    if (rainAudible(this.state)) {
      void this.startRain()
    } else if (this.rainTimer !== undefined || this.rainSources.length) {
      // at the end of a session the rain fades away with the music
      const fade = this.state.status === 'done' ? END_FADE : RAIN_FADE / 2
      this.ramp(this.rainGain, 0, fade)
      this.rainTarget = -1
      window.clearInterval(this.rainTimer)
      this.rainTimer = undefined
      const sources = this.rainSources
      this.rainSources = []
      window.setTimeout(() => sources.forEach((s) => s.stop()), fade * 1000 + 100)
    }
  }

  private async startRain() {
    const ctx = this.ctx!
    if (!this.rainBuffer) {
      this.rainLoading ??= fetch(RAIN_SRC)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => {
          this.rainBuffer = buffer
        })
        .catch(() => {
          this.rainLoading = null
        })
      await this.rainLoading
      if (!this.rainBuffer || !rainAudible(this.state)) return
    }
    const target = RAIN_MAX * rainLevelOf(this.state)
    if (this.rainSources.length) {
      // already raining: follow the slider quickly
      if (target !== this.rainTarget) this.ramp(this.rainGain!, target, NUDGE)
      this.rainTarget = target
      return
    }
    if (this.rainTimer !== undefined) return
    this.rainNext = ctx.currentTime + 0.05
    this.scheduleRain()
    this.ramp(this.rainGain!, target, RAIN_FADE)
    this.rainTarget = target
    this.rainTimer = window.setInterval(() => this.scheduleRain(), 1000)
  }

  /** Keeps the next copies of the rain queued a few seconds ahead, each fading into the next. */
  private scheduleRain() {
    const ctx = this.ctx
    const buffer = this.rainBuffer
    if (!ctx || !buffer || !this.rainGain) return
    const length = buffer.duration
    const fade = Math.min(RAIN_XFADE, length / 3)
    while (this.rainNext < ctx.currentTime + 6) {
      const [start] = rainStarts(this.rainNext, length, fade, 1)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const envelope = ctx.createGain()
      envelope.gain.setValueAtTime(0, start!)
      envelope.gain.linearRampToValueAtTime(1, start! + fade)
      envelope.gain.setValueAtTime(1, start! + length - fade)
      envelope.gain.linearRampToValueAtTime(0, start! + length)
      source.connect(envelope).connect(this.rainGain)
      source.start(start)
      source.onended = () => {
        this.rainSources = this.rainSources.filter((s) => s !== source)
      }
      this.rainSources.push(source)
      this.rainNext = start! + length - fade
    }
  }

  /* ── The system's media controls (lock screen, keyboard keys) ── */

  private syncMediaSession() {
    if (!('mediaSession' in navigator) || this.state.status === 'idle') return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'Focus with me', artist: this.station.name })
      navigator.mediaSession.playbackState = this.state.status === 'playing' ? 'playing' : 'paused'
      navigator.mediaSession.setActionHandler('play', () => void this.play())
      navigator.mediaSession.setActionHandler('pause', () => this.pause())
      navigator.mediaSession.setActionHandler('nexttrack', this.station.tracks.length ? () => this.next() : null)
    } catch {
      /* not supported here */
    }
  }
}

let instance: RoomRadio | null = null

/** The page's one radio, created on first use (never during server rendering or tests that don't ask). */
export function roomRadio(): RoomRadio {
  instance ??= new RoomRadio()
  return instance
}

export type { RoomRadio }
