/**
 * One WebGL2 context on the panel's own canvas. Its textures live only while a move runs:
 * they're uploaded as a move starts and freed when it ends, and between moves the canvas is
 * shrunk to 1x1 px, so a settled panel or a quiet room holds no GPU memory for the genie.
 */
import type { Plan, Shape } from './geometry'
import { TUNING, appearAt, neckAt } from './geometry'
import type { Surface } from './raster'
import { FRAGMENT, VERTEX } from './shaders'

/** Mesh slices per axis. */
const GRID = 128

/** How a frame looks, beyond the move's geometry. */
export interface Look {
  T: number
  shape: Shape
  /** The lamp's glint, 0-1. */
  glint: number
  /** The shadow on the room, 0-1. */
  shadow: number
  /** The landing sweep's progress 0-1, or null. */
  sweep: number | null
}

/**
 * How the slab looks in flight. It stays the settled slab's material: the piece in the object is
 * nearly opaque (neckAlpha) and opaque by a third of its way; the neck and stream take the slab's
 * own mean smoke (neckSmoke) rather than a lighter, milkier average of its lit edge; a trace of the
 * lamp's warmth is carried in transit (warm); its travelling edges are soft (feather, shares of the
 * slab along and across the travel); and one faint sweep of lamp light crosses it as it lands.
 */
const WARM = [1, 0.78, 0.52] as const
const SWEEP = [1, 0.93, 0.84] as const
export const LIGHT = { warm: 0.025, neckAlpha: 0.82, neckSmoke: 0.75, feather: [0.1, 0.07] as const, sweep: 0.045 }

const UNIFORMS = [
  'uView', 'uPadN', 'uNeck', 'uDock', 'uAxis', 'uShape', 'uT', 'uSeed', 'uLag', 'uE', 'uFlare', 'uFan',
  'uPass', 'uTex', 'uGlintTex', 'uGlintBox', 'uGlint', 'uShadow', 'uWarm', 'uWarmK', 'uAppear',
  'uNeckAlpha', 'uNeckSmoke', 'uFeather', 'uSize', 'uLamp', 'uSweep', 'uSweepK', 'uSweepColor',
] as const
type UniformName = (typeof UNIFORMS)[number]

export class Renderer {
  readonly gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private vao: WebGLVertexArrayObject
  private count = 0
  private u = {} as Record<UniformName, WebGLUniformLocation | null>
  private tex: { slab: WebGLTexture; shadow: WebGLTexture; glint: WebGLTexture | null } | null = null
  private uploaded: Surface | null = null
  private aniso: EXT_texture_filter_anisotropic | null
  lost = false

  /** Throws when there is no WebGL2, or the shaders won't build. */
  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = canvas.height = 1
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false })
    if (!gl) throw new Error('no webgl2')
    this.gl = gl
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.bindAttribLocation(prog, 0, 'aUV')
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
    this.prog = prog
    gl.useProgram(prog)
    for (const n of UNIFORMS) this.u[n] = gl.getUniformLocation(prog, n)
    gl.uniform1i(this.u.uTex, 0)
    gl.uniform1i(this.u.uGlintTex, 1)
    this.vao = this.mesh()
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic')
  }

  private mesh(): WebGLVertexArrayObject {
    const gl = this.gl
    const n = GRID
    const v = new Float32Array((n + 1) * (n + 1) * 2)
    let o = 0
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) (v[o++] = i / n), (v[o++] = j / n)
    const idx = new Uint16Array(n * n * 6)
    o = 0
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i
        const b = a + 1
        const c = a + n + 1
        const d = c + 1
        idx.set([a, c, b, b, c, d], o)
        o += 6
      }
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
    gl.bindVertexArray(null)
    this.count = idx.length
    return vao
  }

  private texture(source: TexImageSource | { pixels: Uint8Array; width: number; height: number }, mips: boolean): WebGLTexture {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    if ('pixels' in source) {
      // already premultiplied, and an added light: its alpha is not a coverage
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.pixels)
    } else {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    }
    if (mips) gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    if (mips && this.aniso)
      gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)))
    return t
  }

  /** Puts the slab's pictures on the GPU (a few ms), unless they are there already. */
  upload(s: Surface) {
    if (this.uploaded === s && this.tex) return
    this.free()
    this.tex = {
      slab: this.texture(s.slab, true),
      shadow: this.texture(s.shadow, true),
      glint: s.glint ? this.texture(s.glint, false) : null,
    }
    this.uploaded = s
  }

  /** Frees the textures and the back buffer. */
  free() {
    const gl = this.gl
    if (this.tex) {
      gl.deleteTexture(this.tex.slab)
      gl.deleteTexture(this.tex.shadow)
      if (this.tex.glint) gl.deleteTexture(this.tex.glint)
    }
    this.tex = null
    this.uploaded = null
    this.canvas.width = this.canvas.height = 1
  }

  /** Sizes the back buffer to the window, at up to 2 device px per CSS px. */
  size(vw: number, vh: number, scale: number) {
    const w = Math.max(1, Math.round(vw * scale))
    const h = Math.max(1, Math.round(vh * scale))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  clear() {
    const gl = this.gl
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  draw(plan: Plan, s: Surface, look: Look, vw: number, vh: number) {
    const gl = this.gl
    const u = this.u
    if (!this.tex) return
    this.clear()
    gl.useProgram(this.prog)
    gl.bindVertexArray(this.vao)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const sh = s.shell
    gl.uniform2f(u.uView, vw, vh)
    gl.uniform4f(u.uPadN, s.x0 / sh.w, s.y0 / sh.h, (s.W - s.x0 - sh.w) / sh.w, (s.H - s.y0 - sh.h) / sh.h)
    gl.uniform4f(u.uNeck, ...neckAt(plan, look.T, look.shape))
    gl.uniform4f(u.uDock, ...plan.D)
    gl.uniform1i(u.uAxis, plan.axis)
    gl.uniform1i(u.uShape, look.shape === 'open' ? 0 : 1)
    gl.uniform1f(u.uT, look.T)
    gl.uniform1f(u.uSeed, look.shape === 'open' ? TUNING.seed.open : TUNING.seed.close)
    gl.uniform1f(u.uLag, TUNING.lag)
    gl.uniform4f(u.uE, ...(look.shape === 'open' ? TUNING.ease : TUNING.closeEase))
    gl.uniform1f(u.uFlare, TUNING.flare)
    gl.uniform2f(u.uFan, ...TUNING.fan)
    gl.uniform1f(u.uAppear, appearAt(look.T, look.shape))
    gl.uniform1f(u.uNeckAlpha, LIGHT.neckAlpha)
    gl.uniform1f(u.uNeckSmoke, LIGHT.neckSmoke)
    gl.uniform2f(u.uFeather, ...LIGHT.feather)
    gl.uniform3f(u.uWarm, ...WARM)
    gl.uniform1f(u.uWarmK, LIGHT.warm)
    gl.uniform2f(u.uSize, sh.w, sh.h)
    gl.uniform2f(u.uLamp, s.lamp.u, s.lamp.v)
    gl.uniform1f(u.uSweep, look.sweep ?? -1)
    gl.uniform1f(u.uSweepK, LIGHT.sweep)
    gl.uniform3f(u.uSweepColor, ...SWEEP)
    gl.uniform1f(u.uShadow, look.shadow)
    // the shadow on the room first, then the slab over it
    gl.activeTexture(gl.TEXTURE0)
    if (look.shadow > 0.001) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex.shadow)
      gl.uniform1i(u.uPass, 0)
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0)
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tex.slab)
    gl.uniform1i(u.uPass, 1)
    const g = this.tex.glint && s.glint ? look.glint : 0
    gl.uniform1f(u.uGlint, g)
    if (g > 0 && this.tex.glint && s.glint) {
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this.tex.glint)
      gl.uniform4f(u.uGlintBox, ...s.glint.box)
      gl.activeTexture(gl.TEXTURE0)
    }
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0)
    gl.bindVertexArray(null)
  }

  /** Waits for the GPU (a 1 px read): for warming up and measuring only. */
  finish() {
    this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array(4))
  }

  /**
   * Frees what this renderer holds. The context itself is left to the browser: losing it on
   * purpose would hand a remount on the same canvas (Fast Refresh) a dead context.
   */
  destroy() {
    this.free()
  }
}
