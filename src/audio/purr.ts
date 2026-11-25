import { roomRadio } from './radio'

/**
 * The cat's purr, following the petting: a real cat (a seamless 7.6 s loop cut at its breath
 * pauses from "Cat purring #2" by Joseph Sardin, BigSoundBank, sound no. 981, CC0, public
 * domain: https://bigsoundbank.com/cat-purring-2-s0981.html).
 *
 * - It starts softly as a pet begins, grows fuller the more the hand strokes, settles to a
 *   quiet resting purr when the hand stays still on the cat, and fades away as it leaves.
 *   A click (a pat) gives it a little swell. A tap or a key, with no hand resting there,
 *   purrs for a moment and fades on its own.
 * - Browsers allow sound only after a click, so the first purr waits for one on the cat: a
 *   visitor who hasn't clicked it never hears anything. After that, stroking alone purrs.
 * - It is as loud as the music is set (the room's one volume, 30% unless the visitor has
 *   changed it), follows that setting as it changes, and is silent at zero.
 * - Nothing loads until the first click on the cat.
 */

export const PURR_LOOP = '/media/scene/cat/purr/purr-loop.m4a'

/** The purr at full music volume (the music itself tops out at 0.8). */
const PURR_MAX = 0.8
/** How loud the resting purr is (hand still on the cat), as a share of a full stroke's. */
export const RESTING = 0.35
/** A stroke this fast (px a second) is a full one. */
const FULL_STROKE_PX_S = 900
/** Seconds for the stroking's energy to settle by about two thirds once the hand stops. */
const SETTLE_S = 0.9
/** How long a tap or key purrs, with no hand resting on the cat. */
const TAP_PURR_S = 2.4

/** How loud a purr plays for the music's volume (0-1). */
export const purrGain = (musicLevel: number) => PURR_MAX * Math.min(1, Math.max(0, musicLevel))

/** The stroking's energy (0-1): a new stroke of `speed` px/s lifts it; it settles over time. */
export function strokeEnergy(energy: number, speed: number, dt: number): number {
  const settled = energy * Math.exp(-Math.max(0, dt) / SETTLE_S)
  const stroke = Math.min(1, Math.max(0, speed) / FULL_STROKE_PX_S)
  return Math.min(1, Math.max(settled, settled + (stroke - settled) * 0.35))
}

/** The purr's loudness for a volume and a stroking energy: never below the resting purr while petted. */
export const purrLevel = (gain: number, energy: number) => gain * (RESTING + (1 - RESTING) * Math.min(1, Math.max(0, energy)))

/* ── The voice ── */

let ctx: AudioContext | null = null
let buffer: Promise<AudioBuffer | null> | null = null
let voice: { source: AudioBufferSourceNode; gain: GainNode } | null = null
let unlocked = false
let hovering = false
let energy = 0
let lastStroke = 0
let ticker: number | undefined
let tapTimer: number | undefined
let stopTimer: number | undefined

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  try {
    ctx = new Ctx()
  } catch {
    return null
  }
  return ctx
}

const load = (audio: AudioContext) =>
  (buffer ??= fetch(PURR_LOOP)
    .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(PURR_LOOP))))
    .then((data) => audio.decodeAudioData(data))
    .catch(() => null))

/** Where the sound really starts and ends in the decoded loop (an encoder may pad either end with silence). */
function trim(data: AudioBuffer): [number, number] {
  const samples = data.getChannelData(0)
  let a = 0
  let b = samples.length - 1
  while (a < b && Math.abs(samples[a]!) < 1e-4) a++
  while (b > a && Math.abs(samples[b]!) < 1e-4) b--
  return [a / data.sampleRate, (b + 1) / data.sampleRate]
}

/** Glides the purr's loudness to where the petting has it now. */
function follow() {
  if (!ctx || !voice) return
  const gain = purrGain(roomRadio().getSnapshot().musicLevel)
  const now = ctx.currentTime
  energy = strokeEnergy(energy, 0, (performance.now() - lastStroke) / 1000 > 0.12 ? 0.1 : 0)
  voice.gain.gain.setTargetAtTime(purrLevel(gain, energy), now, 0.12)
}

function begin() {
  const audio = context()
  if (!audio) return
  if (audio.state !== 'running') void audio.resume().catch(() => {})
  window.clearTimeout(stopTimer)
  window.clearInterval(ticker)
  ticker = window.setInterval(follow, 100)
  if (voice) return follow()
  void load(audio).then((data) => {
    if (!data || voice || ticker === undefined) return
    const source = audio.createBufferSource()
    source.buffer = data
    source.loop = true
    const [start, end] = trim(data)
    source.loopStart = start
    source.loopEnd = end
    // start anywhere in the loop, so it never sounds like the same take twice
    const offset = start + Math.random() * (end - start)
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0, audio.currentTime)
    source.connect(gain).connect(audio.destination)
    source.start(audio.currentTime, offset)
    voice = { source, gain }
    follow()
  })
}

function end() {
  window.clearInterval(ticker)
  ticker = undefined
  window.clearTimeout(tapTimer)
  energy = 0
  if (!ctx || !voice) return
  const playing = voice
  playing.gain.gain.cancelScheduledValues(ctx.currentTime)
  playing.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3) // fades away over about a second
  window.clearTimeout(stopTimer)
  stopTimer = window.setTimeout(() => {
    playing.source.stop()
    if (voice === playing) voice = null
  }, 1600)
}

/** Hush the purr at once (the room's other sounds stop for the piano computer up close). */
export function purrStop() {
  if (typeof window === 'undefined') return
  hovering = false
  end()
}

/** A mouse arrives on the cat (true) or leaves it (false). Silent until the cat has been clicked once. */
export function purrHover(on: boolean) {
  if (typeof window === 'undefined') return
  hovering = on
  if (!on) return end()
  if (!unlocked) return
  energy = Math.max(energy, 0.5) // a pet begins
  lastStroke = performance.now()
  begin()
}

/** The hand moves over the cat at `speed` px a second. */
export function purrStroke(speed: number) {
  if (!hovering || !unlocked) return
  const now = performance.now()
  energy = strokeEnergy(energy, speed, (now - lastStroke) / 1000)
  lastStroke = now
}

/** A click, tap or key on the cat: a pat. The first one lets the purr be heard at all. */
export function purrPat() {
  if (typeof window === 'undefined') return
  unlocked = true
  energy = Math.min(1, energy + 0.6)
  lastStroke = performance.now()
  begin()
  // a tap or a key, with no hand resting on the cat, purrs for a moment and fades
  window.clearTimeout(tapTimer)
  if (!hovering) tapTimer = window.setTimeout(() => !hovering && end(), TAP_PURR_S * 1000)
}
