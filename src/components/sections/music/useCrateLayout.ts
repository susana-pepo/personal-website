import { useLayoutEffect, useMemo, useState, type RefObject } from 'react'
import { crateOffsets } from './crate'

/**
 * Sleeve offsets for the crate, kept in step with its width. The first layout
 * (and the first one after the sleeve count changes) is applied without
 * transitions, so the sleeves don't slide in from the left edge.
 */
export function useCrateLayout(listRef: RefObject<HTMLElement | null>, count: number, focus: number | null) {
  const [box, setBox] = useState({ width: 0, sleeve: 0 })
  const [instant, setInstant] = useState(true)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const width = list.clientWidth
      const first = list.firstElementChild
      const sleeve = first instanceof HTMLElement ? first.offsetWidth : 0
      setBox((prev) => (prev.width === width && prev.sleeve === sleeve ? prev : { width, sleeve }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [listRef, count])

  const measured = box.width > 0 && box.sleeve > 0
  useLayoutEffect(() => {
    if (!measured) return
    setInstant(true)
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setInstant(false))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [measured, count])

  const offsets = useMemo(() => crateOffsets(count, box.sleeve, box.width, focus), [count, box, focus])
  return { offsets, instant }
}
