import { useEffect, useRef, useState } from 'react'
import { LAMP_TONES, type LampTone } from '../../../scene/lampTones'
import { usePrefersReducedMotion } from '../../../hooks/useMediaQuery'
import { BULB, CONE_FOOT, POOL, RIM } from '../../../scene/lampGeometry'
import { LampLight } from './LampLight'

/*
 * The desk lamp's light as a tiny GPU shader: the same bloom, beam and desk
 * pool as the SVG version (LampLight), with slow, layered noise warping their brightness so the
 * light flows and folds like warm air or light through water. Drawn at low
 * resolution (the light is soft anyway) and stretched, ~30 frames a second.
 */

const VERTEX = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`

const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_core;  // light colour near the bulb
uniform vec3 u_glow;  // light colour further out (beam, desk)
uniform float u_gain; // overall strength (the click's flicker, hover)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = vec2(uv.x * 1920.0, (1.0 - uv.y) * 1080.0);
  float t = u_time;

  // This canvas is overlay-blended onto the room (see .lamp-liquid), around a
  // neutral mid-grey: 0.5 changes nothing, and each step above it brightens what
  // the light falls on in that thing's own colour, proportionally in shadows and
  // midtones and rolling off gently near white (bright skin and paper glow
  // instead of burning out). So it describes light arriving on things, not a
  // glow laid on top; the glare round the bulb is drawn in the page (LampColour).

  // Room light: the lamp lighting everything near it, falling off softly with
  // distance, strongest just below the shade (desk, her hands, the wall).
  vec2 lc = p - vec2(${BULB.x.toFixed(1)}, ${(BULB.y + 90).toFixed(1)});
  float room = exp(-dot(lc, lc) / (2.0 * 285.0 * 285.0)) * 0.21;

  // The pool where the beam lands on the desk.
  vec2 pd = (p - vec2(${POOL.x.toFixed(1)}, ${POOL.y.toFixed(1)})) / vec2(${POOL.rx.toFixed(1)}, ${POOL.ry.toFixed(1)});
  float pool = exp(-dot(pd, pd) * 1.6) * 0.21;

  // The beam itself, faint: the shade's cone, brightest on its axis (a Gaussian
  // across it, never a hard edge).
  float rimY = ${((RIM.left[1] + RIM.right[1]) / 2).toFixed(1)};
  float footY = ${((CONE_FOOT.left[1] + CONE_FOOT.right[1]) / 2).toFixed(1)};
  float v = (p.y - rimY) / (footY - rimY);
  float vc = clamp(v, 0.0, 1.0);
  float leftX = mix(${RIM.left[0].toFixed(1)}, ${CONE_FOOT.left[0].toFixed(1)}, vc);
  float rightX = mix(${RIM.right[0].toFixed(1)}, ${CONE_FOOT.right[0].toFixed(1)}, vc);
  float mid = (leftX + rightX) * 0.5;
  float halfW = (rightX - leftX) * 0.5;
  float x = (p.x - mid) / max(halfW, 1.0);
  float beam = exp(-x * x * 1.4) * smoothstep(-0.02, 0.12, v) * pow(1.0 - vc, 1.4) * 0.16;

  // Right at the bulb: the painted bulb burns a little hotter.
  float d = length(p - vec2(${BULB.x.toFixed(1)}, ${BULB.y.toFixed(1)}));
  float bulb = exp(-d * d / (2.0 * 26.0 * 26.0)) * 0.35;

  // Air: a very large, slow drift of brightness, like warm air turning over.
  // Low contrast and wide, so it never draws shapes.
  vec2 q = vec2(p.x / 260.0, p.y / 420.0);
  float drift = fbm(q + vec2(t * 0.018, -t * 0.03) + 0.6 * fbm(q * 0.7 + vec2(-t * 0.012, t * 0.01)));
  beam *= 0.82 + 0.36 * smoothstep(0.3, 0.7, drift);
  pool *= 0.94 + 0.12 * smoothstep(0.3, 0.7, fbm(p / 300.0 + vec2(t * 0.015, -t * 0.012)));
  room *= 0.97 + 0.06 * smoothstep(0.3, 0.7, drift);

  // A barely-there, irregular flicker.
  float n1 = noise(vec2(t * 1.7, 0.0));
  bulb *= 1.0 - 0.05 * n1;
  room *= 1.0 - 0.015 * n1;

  vec3 rgb = (u_core * (bulb + beam) + u_glow * (room + pool)) * u_gain;
  rgb = min(rgb * 1.55, vec3(0.62));
  gl_FragColor = vec4(0.5 + rgb * 0.5, 1.0);
}
`

type Rgb = [number, number, number]
const mixRgb = (a: readonly number[], b: readonly number[], t: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as Rgb
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/*
 * A colour change, like turning a dimmer on a lamp with a coloured shade:
 *  - secondary: a quick dip in brightness (the switch catching), then it swells back;
 *  - primary: the colour glides to the new tone, starting just after the dip;
 *  - ambient: the light's slow drift carries on throughout.
 */
const CHANGE_MS = 1150
const DIP_AT_MS = 90 // deepest point of the flicker
const DIP_DEPTH = 0.4
const SWELL_MS = 620 // back to full strength
const COLOUR_FROM_MS = 70
/** Hovering the lamp warms it up a little, as an invitation to click. */
const HOVER_GAIN = 1.1
/**
 * Its glimmer hint (src/scene/glimmers.ts): the bulb catches, as if a switch had been touched:
 * a soft dip and back, then a smaller one, each eased in and out (never a cut). [ms, strength]
 */
const FLICK: readonly (readonly [number, number])[] = [
  [0, 1],
  [320, 0.76],
  [660, 1],
  [900, 0.88],
  [1220, 1],
]
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

interface LampLiquidProps {
  /** Which light colour is on (index into LAMP_TONES). */
  tone?: number
  /** The pointer or keyboard focus is on the lamp. */
  hovered?: boolean
  /** The room is allowed to move: the light flows only then. */
  motionAllowed: boolean
  /** Bumped to ask for its glimmer hint: the bulb catches (FLICK). Not with reduced motion. */
  flick?: number
}

export function LampLiquid({ motionAllowed, tone = 0, hovered = false, flick = 0 }: LampLiquidProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [failed, setFailed] = useState(false)
  // Hidden until its first frame is drawn: a blank (black) canvas would darken the room.
  const [ready, setReady] = useState(false)
  const running = motionAllowed && !reducedMotion
  const draw = useRef<((time: number) => void) | null>(null)
  const timeRef = useRef(12.0) // start mid-flow, not at a symmetric moment
  // The light as drawn right now; the click choreography and hover move it.
  const light = useRef({ core: [...LAMP_TONES[0]!.core] as Rgb, glow: [...LAMP_TONES[0]!.glow] as Rgb, gain: 1, flicker: 1, hover: 1, catch: 1 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' })
    if (!gl) {
      if (import.meta.env.DEV) console.warn('Lamp light: WebGL unavailable, using the still version')
      return setFailed(true)
    }
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader')
      return shader
    }
    try {
      const program = gl.createProgram()!
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link')
      gl.useProgram(program)
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
      const loc = gl.getAttribLocation(program, 'a')
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
      const uRes = gl.getUniformLocation(program, 'u_res')
      const uTime = gl.getUniformLocation(program, 'u_time')
      const uCore = gl.getUniformLocation(program, 'u_core')
      const uGlow = gl.getUniformLocation(program, 'u_glow')
      const uGain = gl.getUniformLocation(program, 'u_gain')
      draw.current = (time: number) => {
        const l = light.current
        gl.uniform3f(uCore, l.core[0], l.core[1], l.core[2])
        gl.uniform3f(uGlow, l.glow[0], l.glow[1], l.glow[2])
        gl.uniform1f(uGain, l.gain * l.flicker * l.hover * l.catch)
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.uniform2f(uRes, canvas.width, canvas.height)
        gl.uniform1f(uTime, time)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      draw.current(timeRef.current)
      setReady(true)
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Lamp light: shader failed, using the still version.', error)
      setFailed(true)
    }
    // If the GPU drops the context (common on phones after a while in the
    // background), the canvas would freeze on its last frame: use the still version.
    const onLost = () => {
      draw.current = null
      setFailed(true)
    }
    canvas.addEventListener('webglcontextlost', onLost)
    // The context is freed with the canvas; releasing it here would break React's
    // development double-run of effects, which reuses the same canvas.
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      draw.current = null
    }
  }, [])

  useEffect(() => {
    if (!running || !draw.current) {
      draw.current?.(timeRef.current) // one still frame
      return
    }
    let frame = 0
    let last = performance.now()
    let acc = 0
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      timeRef.current += dt
      acc += dt
      if (acc >= 1 / 30) {
        acc = 0
        draw.current?.(timeRef.current)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running])

  // A new colour: the flicker and the glide, drawn every frame until it settles
  // (the room's own loop may be paused, so this keeps its own frames).
  const shown = useRef(0)
  // Read, not depended on: a change of the setting mid-glide must not cut the glide short.
  const reducedRef = useRef(reducedMotion)
  reducedRef.current = reducedMotion
  useEffect(() => {
    if (tone === shown.current) return
    shown.current = tone
    const l = light.current
    // Off: the light fades away in its own colour (light only ever adds, so at 0 the room
    // shows just its own painted light).
    const target: LampTone = LAMP_TONES[tone] ?? { ...LAMP_TONES[0]!, core: [...l.core] as Rgb, glow: [...l.glow] as Rgb, gain: 0 }
    const from = { core: [...l.core] as Rgb, glow: [...l.glow] as Rgb, gain: l.gain }
    // A click during the flicker carries on from the brightness it's at, without a jump.
    const fromFlicker = l.flicker
    const calm = reducedRef.current
    const total = calm ? 260 : CHANGE_MS
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const ms = Math.max(0, now - start)
      const c = calm ? Math.min(1, ms / total) : easeInOutCubic(Math.min(1, Math.max(0, (ms - COLOUR_FROM_MS) / (total - COLOUR_FROM_MS))))
      l.core = mixRgb(from.core, target.core, c)
      l.glow = mixRgb(from.glow, target.glow, c)
      l.gain = from.gain + (target.gain - from.gain) * c
      if (!calm) {
        // down quickly to the dip, then an easy swell back up
        const low = Math.min(fromFlicker, 1 - DIP_DEPTH)
        l.flicker =
          ms < DIP_AT_MS
            ? fromFlicker + (low - fromFlicker) * easeOutCubic(ms / DIP_AT_MS)
            : low + (1 - low) * easeOutCubic(Math.min(1, (ms - DIP_AT_MS) / (SWELL_MS - DIP_AT_MS)))
      }
      draw.current?.(timeRef.current)
      if (ms < total) frame = requestAnimationFrame(step)
      else l.flicker = 1
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [tone])

  // Hover: the bulb warms up a touch, gently. With reduced motion it is a short,
  // even fade (120 ms), like the rest of the room's answers.
  useEffect(() => {
    const l = light.current
    const from = l.hover
    const to = hovered ? HOVER_GAIN : 1
    const calm = reducedRef.current
    const duration = calm ? 120 : hovered ? 280 : 360
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      l.hover = from + (to - from) * (calm ? t : easeOutCubic(t))
      draw.current?.(timeRef.current)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [hovered])

  // The glimmer hint: the bulb catches (its own frames, like the colour change above).
  useEffect(() => {
    if (flick === 0 || reducedRef.current) return
    const l = light.current
    const start = performance.now()
    const end = FLICK[FLICK.length - 1]![0]
    let frame = 0
    const step = (now: number) => {
      const ms = Math.min(end, now - start)
      const i = Math.max(0, FLICK.findIndex(([at]) => at >= ms) - 1)
      const [a, from] = FLICK[i]!
      const [b, to] = FLICK[i + 1] ?? FLICK[i]!
      l.catch = b > a ? from + (to - from) * easeInOutSine((ms - a) / (b - a)) : to
      draw.current?.(timeRef.current)
      if (ms < end) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      l.catch = 1
    }
  }, [flick])

  if (failed) return LAMP_TONES[tone] ? <LampLight motionAllowed={motionAllowed} /> : null // the still version, unless the light is off
  return <canvas ref={canvasRef} className="lamp-liquid" width={640} height={360} aria-hidden="true" data-ready={ready ? '' : undefined} />
}
