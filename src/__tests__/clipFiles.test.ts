import { describe, expect, it } from 'vitest'
import { clipFileUrl, clipFormat } from '../scene/clipFiles'
import { CAT_MEDIA } from '../scene/layout'
import { HOME_CLIP, WOMAN_BREATH, WOMAN_CLIPS } from '../scene/womanClips'

// Every clip file in public/, by its path on the site (/media/...).
const FILES = new Set(Object.keys(import.meta.glob('/public/media/scene/**/*.{webp,webm,mov}')).map((p) => p.replace(/^\/public/, '')))

describe('the clips’ files', () => {
  it('names each clip by its WebP and finds its video beside it', () => {
    expect(clipFileUrl('/media/scene/cat/cat-sleep.webp', 'webm')).toBe('/media/scene/cat/cat-sleep.webm')
    expect(clipFileUrl('/media/scene/cat/cat-sleep.webp', 'mov')).toBe('/media/scene/cat/cat-sleep.mov')
    expect(clipFileUrl('/media/scene/cat/cat-sleep.webp', 'webp')).toBe('/media/scene/cat/cat-sleep.webp')
  })

  it('plays the WebP where there is no browser to play video', () => {
    expect(clipFormat()).toBe('webp')
  })

  it('has every clip of the woman and the cat as WebM, as HEVC for Safari, and as the WebP fallback', () => {
    const clips = [HOME_CLIP, ...WOMAN_CLIPS, WOMAN_BREATH, CAT_MEDIA.sleep, ...CAT_MEDIA.variations, ...CAT_MEDIA.reactions]
    for (const clip of clips) {
      for (const as of ['webp', 'webm', 'mov'] as const) {
        const file = clipFileUrl(clip.src, as)
        expect(FILES.has(file), file).toBe(true)
      }
    }
  })
})
