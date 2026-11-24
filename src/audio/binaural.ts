/**
 * Binaural focus: made live in the browser, so there are no files and no licence.
 *
 * Each ear hears a soft sine tone, the right a little higher than the left; the
 * brain hears the difference as a slow pulse. Beneath them, a quiet bed of brown
 * noise (deeper and softer than white noise). The tones only work on headphones;
 * on speakers it is simply a calm hum.
 *
 * We make no claims for it: studies of binaural beats and attention are mixed.
 */

/** The left ear's tone, and the right's a few hertz above it. */
export const BINAURAL = { carrier: 200, beat: 10 } as const

export const beatFrequencies = (carrier: number, beat: number) => ({ left: carrier, right: carrier + beat })

/**
 * Brown noise: a random walk, kept within [-1, 1] and gently pulled back to zero
 * so it never drifts into a hum of its own.
 */
export function brownNoise(length: number, random: () => number = Math.random): Float32Array<ArrayBuffer> {
  const out = new Float32Array(length)
  let last = 0
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * (random() * 2 - 1)) / 1.02
    out[i] = Math.max(-1, Math.min(1, last * 3.5))
  }
  return out
}

const TONE_LEVEL = 0.1
const NOISE_LEVEL = 0.22
/** Seconds of noise, looped. */
const NOISE_SECONDS = 8

/** The tones and the noise bed, playing into `output` until stopped. */
export function startBinaural(ctx: AudioContext, output: AudioNode): () => void {
  const { left, right } = beatFrequencies(BINAURAL.carrier, BINAURAL.beat)
  const merger = ctx.createChannelMerger(2)
  merger.connect(output)

  const tone = (frequency: number, channel: number) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = frequency
    const gain = ctx.createGain()
    gain.gain.value = TONE_LEVEL
    osc.connect(gain).connect(merger, 0, channel)
    osc.start()
    return osc
  }
  const oscillators = [tone(left, 0), tone(right, 1)]

  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) buffer.copyToChannel(brownNoise(buffer.length), channel)
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  noise.loop = true
  const soften = ctx.createBiquadFilter()
  soften.type = 'lowpass'
  soften.frequency.value = 900
  const noiseGain = ctx.createGain()
  noiseGain.gain.value = NOISE_LEVEL
  noise.connect(soften).connect(noiseGain).connect(output)
  noise.start()

  return () => {
    for (const node of [...oscillators, noise]) {
      try {
        node.stop()
      } catch {
        /* already stopped */
      }
    }
    merger.disconnect()
    noiseGain.disconnect()
  }
}
