import { describe, expect, it } from 'vitest'
import { TIMES, timeForKey } from '../components/HeroScene/controls/SceneControl'
import { TIME_STARTS, WINDOW_VIEWS, WINDOW_VIEW_MASK, timeAt, timeForHour } from '../scene/windowViews'
import indexHtml from '../../index.html?raw'
import { content } from '../content/content'

describe('TIMES', () => {
  it('runs dawn, midday, night, with dawn first', () => {
    expect(TIMES).toEqual(['dawn', 'midday', 'night'])
  })

  it('has a name for the group and every time', () => {
    expect(content.timeOfDay.label.length).toBeGreaterThan(0)
    for (const time of TIMES) expect(content.timeOfDay[time].length).toBeGreaterThan(0)
  })
})

describe('timeForKey', () => {
  it('steps forward with Right and Down, wrapping at the end', () => {
    expect(timeForKey('dawn', 'ArrowRight')).toBe('midday')
    expect(timeForKey('midday', 'ArrowDown')).toBe('night')
    expect(timeForKey('night', 'ArrowRight')).toBe('dawn')
    expect(timeForKey('night', 'ArrowDown')).toBe('dawn')
  })

  it('steps back with Left and Up, wrapping at the start', () => {
    expect(timeForKey('night', 'ArrowLeft')).toBe('midday')
    expect(timeForKey('midday', 'ArrowUp')).toBe('dawn')
    expect(timeForKey('dawn', 'ArrowLeft')).toBe('night')
    expect(timeForKey('dawn', 'ArrowUp')).toBe('night')
  })

  it('jumps to the ends with Home and End', () => {
    for (const time of TIMES) {
      expect(timeForKey(time, 'Home')).toBe('dawn')
      expect(timeForKey(time, 'End')).toBe('night')
    }
  })

  it('ignores every other key', () => {
    for (const key of ['Enter', ' ', 'Tab', 'Escape', 'a', 'PageDown']) {
      expect(timeForKey('midday', key)).toBeNull()
    }
  })
})

describe('timeForHour', () => {
  it('is dawn from 5:00, midday from 11:00 and night from 18:00, through midnight', () => {
    const byHour = Array.from({ length: 24 }, (_, hour) => timeForHour(hour))
    expect(byHour).toEqual([
      ...Array(5).fill('night'), // 0-4
      ...Array(6).fill('dawn'), // 5-10
      ...Array(7).fill('midday'), // 11-17
      ...Array(6).fill('night'), // 18-23
    ])
  })

  it('starts each time at its own hour', () => {
    for (const time of TIMES) expect(timeForHour(TIME_STARTS[time])).toBe(time)
  })
})

describe('timeAt', () => {
  it("reads the visitor's local clock, to the minute", () => {
    expect(timeAt(new Date(2026, 10, 23, 4, 59))).toBe('night')
    expect(timeAt(new Date(2026, 10, 23, 5, 0))).toBe('dawn')
    expect(timeAt(new Date(2026, 10, 23, 10, 59))).toBe('dawn')
    expect(timeAt(new Date(2026, 10, 23, 11, 0))).toBe('midday')
    expect(timeAt(new Date(2026, 10, 23, 17, 59))).toBe('midday')
    expect(timeAt(new Date(2026, 10, 23, 18, 0))).toBe('night')
    expect(timeAt(new Date(2026, 10, 23, 23, 59))).toBe('night')
    expect(timeAt(new Date(2026, 10, 24, 0, 0))).toBe('night')
  })
})

describe('the early fetch in index.html', () => {
  it('picks the same view as the app, from the same files', () => {
    const script = indexHtml.match(/var t = (.+)\n/)?.[1] ?? ''
    // the hours it compares against are the app's own cut-offs
    expect(script).toBe(
      `h >= ${TIME_STARTS.night} || h < ${TIME_STARTS.dawn} ? 'night' : h >= ${TIME_STARTS.midday} ? 'midday' : 'dawn'`,
    )
    for (const time of TIMES) {
      expect(WINDOW_VIEWS[time].still).toBe(`/media/scene/window-views/${time}-still.webp`)
    }
    expect(WINDOW_VIEW_MASK).toBe('/media/scene/window-views/view-mask.png')
    expect(indexHtml).toContain("'/media/scene/window-views/' + t + '-still.webp'")
    expect(indexHtml).toContain("'/media/scene/window-views/view-mask.png'")
  })
})
