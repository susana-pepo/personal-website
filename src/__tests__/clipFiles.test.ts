import { describe, expect, it } from 'vitest'
import { clipFileUrl, clipFormat } from '../scene/clipFiles'
import { CAT_MEDIA, PLANT_MEDIA } from '../scene/layout'
import { HOME_CLIP, WOMAN_BREATH, WOMAN_CLIPS } from '../scene/womanClips'

// Every clip file in public/, by its path on the site (/media/...).
const FILES = new Set(Object.keys(import.meta.glob('/public/media/scene/**/*.{webp,webm,mov}')).map((p) => p.replace(/^\/public/, '')))

describe('the clips’ files', () => {
  it('names each clip by its WebP and finds its video beside it', () => {
    expect(clipFileUrl('/media/scene/cat/cat-sleep.webp', 'webm')).toBe('/media/scene/cat/cat-sleep.webm')
    expect(clipFileUrl('/media/scene/cat/cat-sleep.webp', 'mov')).toBe('/media/scene/cat/cat-sleep.mov')
  })

  it('plays nothing where there is no browser to play video (the stills stay)', () => {
    expect(clipFormat()).toBe('none')
  })

  it('has every clip of the woman, the cat and the plant as WebM, and as HEVC for Safari', () => {
    const clips = [HOME_CLIP, ...WOMAN_CLIPS, WOMAN_BREATH, CAT_MEDIA.sleep, ...CAT_MEDIA.variations, ...CAT_MEDIA.reactions, PLANT_MEDIA.stir]
    for (const clip of clips) {
      for (const as of ['webm', 'mov'] as const) {
        const file = clipFileUrl(clip.src, as)
        expect(FILES.has(file), file).toBe(true)
      }
    }
  })

  it('has the plant’s still beside its sway', () => {
    expect(FILES.has(PLANT_MEDIA.still)).toBe(true)
  })
})
