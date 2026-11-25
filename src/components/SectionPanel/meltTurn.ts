/**
 * The melt's one piece of JS (turn-melt.css does the rest): a tab clicked while the new page is
 * still condensing. When that page turns away it loses data-enter, so its arrival animations would
 * be dropped and it would snap sharp for a frame before melting away. So, just before the turn,
 * each arrival still running is written down where it is (commitStyles) and the leave carries on
 * from there; the written styles are removed a frame later from whatever isn't leaving (a leaving
 * page takes its styles with it when it goes). An interrupted turn also marks the dialog
 * (data-melt-quick), so the page replacing it starts condensing at once and the glass never stands
 * empty; the next uninterrupted turn clears the mark before its page renders.
 */
const ARRIVE = /^melt-(clear|settle)$/
const WRITTEN = ['opacity', 'filter', 'transform'] as const

export function holdArrival(dialog: HTMLDialogElement | null): void {
  if (!dialog) return
  const page = dialog.querySelector('.panel__page[data-enter="turn"]:not(.is-leaving)')
  const held: HTMLElement[] = []
  if (page) {
    for (const a of page.getAnimations({ subtree: true })) {
      if (!(a instanceof CSSAnimation) || !ARRIVE.test(a.animationName) || a.playState === 'finished') continue
      const el = (a.effect as KeyframeEffect | null)?.target
      if (!(el instanceof HTMLElement) || !el.isConnected) continue
      try {
        a.commitStyles()
        held.push(el)
      } catch {
        // an element without a layout box can't be written down; it simply melts from where it is
      }
    }
  }
  if (!held.length) {
    dialog.removeAttribute('data-melt-quick')
    return
  }
  dialog.setAttribute('data-melt-quick', '')
  // once React has committed the turn: only the leaving page keeps what was written down
  requestAnimationFrame(() => {
    for (const el of held) {
      if (el.closest('.panel__page.is-leaving')) continue
      for (const p of WRITTEN) el.style.removeProperty(p)
    }
  })
}

/** The panel closed: the next opening starts from the usual beat. */
export function clearMelt(dialog: HTMLDialogElement | null): void {
  dialog?.removeAttribute('data-melt-quick')
}
