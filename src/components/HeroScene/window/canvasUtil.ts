/** Small canvas helpers shared by the layers drawn on the window's glass (GlassDrops, FrostLayer). */

export function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  return img.decode().then(() => img)
}

/** A copy of a canvas as it is now (an empty one if it has nothing yet). */
export function copyOf(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement('canvas')
  copy.width = source.width
  copy.height = source.height
  if (source.width && source.height) copy.getContext('2d')!.drawImage(source, 0, 0)
  return copy
}

/** `target` = `from` blended toward `to` by k (0-1), as premultiplied colour, so a fade never flashes. */
export function mix(target: HTMLCanvasElement, from: HTMLCanvasElement, to: HTMLCanvasElement, k: number) {
  target.width = to.width
  target.height = to.height
  const ctx = target.getContext('2d')!
  ctx.clearRect(0, 0, target.width, target.height)
  ctx.globalCompositeOperation = 'lighter'
  if (k < 1 && from.width && from.height) {
    ctx.globalAlpha = 1 - k
    ctx.drawImage(from, 0, 0, target.width, target.height)
  }
  ctx.globalAlpha = k
  ctx.drawImage(to, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

/** An image drawn small and soft (down to half of `width` × `height`, then up), as RGBA pixels. */
export function softPixels(img: HTMLImageElement, width: number, height: number): Uint8ClampedArray {
  const half = document.createElement('canvas')
  half.width = Math.max(1, Math.round(width / 2))
  half.height = Math.max(1, Math.round(height / 2))
  half.getContext('2d')!.drawImage(img, 0, 0, half.width, half.height)
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(half, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height).data
}
