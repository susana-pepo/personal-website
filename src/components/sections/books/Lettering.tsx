import { useLayoutEffect, useRef, useSyncExternalStore, type SVGProps } from 'react'
import { fitLettering } from '../../../content/bookGeometry'

/* Lettering is measured once the web fonts are in, and again whenever more arrive. */
let fontVersion = 0
const listeners = new Set<() => void>()
let watching = false

function watchFonts() {
  if (watching || typeof document === 'undefined' || !document.fonts) return
  watching = true
  const bump = () => {
    fontVersion++
    listeners.forEach((listener) => listener())
  }
  void document.fonts.ready.then(bump)
  document.fonts.addEventListener('loadingdone', bump)
}

function subscribe(listener: () => void) {
  watchFonts()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const useFontVersion = () =>
  useSyncExternalStore(
    subscribe,
    () => fontVersion,
    () => 0,
  )

type FitTextProps = Omit<SVGProps<SVGTextElement>, 'ref' | 'children' | 'fontSize'> & {
  text: string
  fontSize: number
  /** Longest the lettering may run, in the drawing's own units. */
  max: number
  /** Optional lettering (an author's name) is left off when it does not fit, never cut short. */
  optional?: boolean
}

/**
 * SVG text that shrinks to fit its panel. Measured with getComputedTextLength()
 * in a layout effect, so the first paint already has the fitted size.
 */
export function FitText({ text, fontSize, max, optional = false, ...rest }: FitTextProps) {
  const ref = useRef<SVGTextElement>(null)
  const fonts = useFontVersion()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof el.getComputedTextLength !== 'function') return
    el.textContent = text
    el.setAttribute('font-size', String(fontSize))
    el.removeAttribute('visibility')
    const fit = fitLettering(el.getComputedTextLength(), max, fontSize, optional)
    if (fit.kind === 'shrink') el.setAttribute('font-size', fit.fontSize.toFixed(2))
    else if (fit.kind === 'hide') el.setAttribute('visibility', 'hidden')
    else if (fit.kind === 'truncate') {
      // Too long even when small: keep a legible size and end with an ellipsis.
      el.setAttribute('font-size', String(fit.fontSize))
      let n = text.length
      while (n > 3 && el.getComputedTextLength() > max) el.textContent = text.slice(0, --n).trimEnd() + '…'
    }
  }, [text, fontSize, max, optional, fonts])

  return (
    <text ref={ref} fontSize={fontSize} {...rest}>
      {text}
    </text>
  )
}
