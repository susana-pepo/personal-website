import { PLAYLIST, RAIN_SRC, type RadioTrack } from './playlist'

/**
 * The room radio. One instance for the page, driven from the footer player.
 *
 * - Nothing plays until the visitor presses play (browsers require a click).
 * - Music and rain run through Web Audio gains, so every change fades (and
 *   fades work on iPhones, where an <audio> element's volume is fixed).
 * - The rain is a short recording looped with a crossfade, so there is no seam.
 *   It is heard while the radio is on, the rain switch is on and the window
 *   shows rain.
 */

export type RadioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export interface RadioState {
  status: RadioStatus
  index: number
  /** The visitor's rain switch (remembered). */
  rainOn: boolean
  /** The window shows rain right now. */
  raining: boolean
}

/* ── Pure helpers (tested) ── */

export const nextIndex = (index: number, count: number) => (count > 0 ? (index + 1) % count : 0)

/** The rain is heard only while the radio plays, the switch is on and it rains outside. */
export const rainAudible = (s: Pick<RadioState, 'status' | 'rainOn' | 'raining'>) =>
  (s.status === 'playing' || s.status === 'loading') && s.rainOn && s.raining

export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Saved preferences, read defensively: anything unexpected falls back to the defaults. */
export function readPrefs(raw: string | null, count: number): { rainOn: boolean; index: number } {
  const fallback = { rainOn: true, index: 0 }
  if (!raw) return fallback
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    const index = Number.isInteger(data.index) && (data.index as number) >= 0 && (data.index as number) < count ? (data.index as number) : 0
    return { rainOn: data.rainOn !== false, index }
  } catch {
    return fallback
  }
}

/** When each looped copy of the rain starts, so neighbours overlap by `fade` seconds. */
export const rainStarts = (from: number, length: number, fade: number, count: number) =>
  Array.from({ length: count }, (_, i) => from + i * (length - fade))

/* ── The player ── */

const PREFS_KEY = 'room-radio'
const MUSIC_LEVEL = 0.7
const RAIN_LEVEL = 0.4
const FADE_IN = 0.8
const FADE_OUT = 0.35
const RAIN_FADE = 2.5
const RAIN_XFADE = 3

type Listener = () => void

class RoomRadio {
  private state: RadioState
  private listeners = new Set<Listener>()
  private ctx: AudioContext | null = null
  private musicGain: GainNode | null = null
  private rainGain: GainNode | null = null
  private audio: HTMLAudioElement | null = null
  private rainBuffer: AudioBuffer | null = null
  private rainLoading: Promise<void> | null = null
  private rainSources: AudioBufferSourceNode[] = []
  private rainNext = 0
  private rainTimer: number | undefined
  private pauseTimer: number | undefined

  constructor() {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(PREFS_KEY)
    } catch {
      /* storage blocked: defaults */
    }
    const prefs = readPrefs(raw, PLAYLIST.length)
    this.state = { status: 'idle', index: prefs.index, rainOn: prefs.rainOn, raining: false }
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.state

  get track(): RadioTrack {
    return PLAYLIST[this.state.index] ?? PLAYLIST[0]!
  }

  /** Seconds into the current track, and its length. */
  position(): { time: number; duration: number } {
    const a = this.audio
    const duration = a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration : this.track.duration
    return { time: a ? a.currentTime : 0, duration }
  }

  toggle = () => {
    if (this.state.status === 'playing' || this.state.status === 'loading') this.pause()
    else void this.play()
  }

  next = () => {
    const index = nextIndex(this.state.index, PLAYLIST.length)
    const wasOn = this.state.status === 'playing' || this.state.status === 'loading'
    this.set({ index })
    if (this.audio) {
      this.audio.src = this.track.src
      if (wasOn) void this.play()
    }
    this.save()
  }

  setRainOn = (rainOn: boolean) => {
    this.set({ rainOn })
    this.save()
  }

  setRaining = (raining: boolean) => {
    if (raining !== this.state.raining) this.set({ raining })
  }

  async play() {
    // Created inside the click, as browsers require.
    if (!this.graph()) return this.set({ status: 'error' })
    const ctx = this.ctx!
    const audio = this.audio!
    window.clearTimeout(this.pauseTimer)
    if (!audio.src) audio.src = this.track.src
    this.set({ status: 'loading' })
    try {
      if (ctx.state !== 'running') await ctx.resume()
      this.ramp(this.musicGain!, MUSIC_LEVEL, FADE_IN)
      await audio.play()
      this.set({ status: 'playing' })
    } catch {
      this.set({ status: 'error' })
    }
  }

  pause() {
    if (!this.ctx || !this.audio) return this.set({ status: 'paused' })
    this.ramp(this.musicGain!, 0, FADE_OUT)
    this.set({ status: 'paused' })
    const audio = this.audio
    window.clearTimeout(this.pauseTimer)
    this.pauseTimer = window.setTimeout(() => audio.pause(), FADE_OUT * 1000 + 60)
  }

  private set(patch: Partial<RadioState>) {
    this.state = { ...this.state, ...patch }
    this.syncRain()
    this.syncMediaSession()
    this.listeners.forEach((listener) => listener())
  }

  private save() {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ rainOn: this.state.rainOn, index: this.state.index }))
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
      if (this.state.status !== 'idle') this.set({ status: 'error' })
    })
    const music = ctx.createGain()
    music.gain.value = 0
    ctx.createMediaElementSource(audio).connect(music).connect(ctx.destination)
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
      this.ramp(this.rainGain, 0, RAIN_FADE / 2)
      window.clearInterval(this.rainTimer)
      this.rainTimer = undefined
      const sources = this.rainSources
      this.rainSources = []
      window.setTimeout(() => sources.forEach((s) => s.stop()), (RAIN_FADE / 2) * 1000 + 100)
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
    if (this.rainSources.length) {
      this.ramp(this.rainGain!, RAIN_LEVEL, RAIN_FADE)
      return
    }
    if (this.rainTimer !== undefined) return
    this.rainNext = ctx.currentTime + 0.05
    this.scheduleRain()
    this.ramp(this.rainGain!, RAIN_LEVEL, RAIN_FADE)
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
    const track = this.track
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: 'Lo-fi radio' })
      navigator.mediaSession.playbackState = this.state.status === 'playing' ? 'playing' : 'paused'
      navigator.mediaSession.setActionHandler('play', () => void this.play())
      navigator.mediaSession.setActionHandler('pause', () => this.pause())
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next())
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
