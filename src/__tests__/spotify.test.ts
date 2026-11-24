import { describe, expect, it } from 'vitest'
import { embedHeight, embedUrl, parseSpotifyUrl } from '../lib/spotify'

describe('parseSpotifyUrl', () => {
  it('reads share links, including tracking params and locale prefixes', () => {
    expect(parseSpotifyUrl('https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv?si=abc')).toEqual({
      kind: 'album',
      id: '4LH4d3cOWNNsVw41Gqt2kv',
      url: 'https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv',
    })
    expect(parseSpotifyUrl('https://open.spotify.com/intl-es/playlist/37i9dQZF1DXcBWIGoYBM5M')?.kind).toBe('playlist')
  })

  it('rejects anything that is not a Spotify item link', () => {
    expect(parseSpotifyUrl('https://example.com/album/4LH4d3cOWNNsVw41Gqt2kv')).toBeNull()
    expect(parseSpotifyUrl('http://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv')).toBeNull()
    expect(parseSpotifyUrl('https://open.spotify.com/album/short')).toBeNull()
  })

  it('builds the official embed player URL and a sensible height', () => {
    const album = parseSpotifyUrl('https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv')!
    expect(embedUrl(album)).toMatch(/^https:\/\/open\.spotify\.com\/embed\/album\/4LH4d3cOWNNsVw41Gqt2kv/)
    expect(embedHeight(album)).toBe(352)
    expect(embedHeight({ ...album, kind: 'track' })).toBe(152)
  })
})
