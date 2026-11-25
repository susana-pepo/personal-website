import { useEffect, useRef, type RefObject } from 'react'
import { closeSection } from '../../../lib/router'
import { whenSettled } from '../../../scene/entrance'
import { Genie } from './genie'
import './genie.css'

/**
 * The genie for one panel: created once its dialog and canvas are mounted, so a deep link that
 * opens the panel with the page (before this runs) never pours. SectionPanel drives it through
 * the returned ref: open() after showModal(), close() as the section goes, reopen() if it comes
 * back mid-close.
 */
export function useGenie(
  dialogRef: RefObject<HTMLDialogElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  /** Dresses a dialog as at open (place, lamp, reflection); keep it stable. */
  dress: (dialog: HTMLDialogElement) => void,
) {
  const genieRef = useRef<Genie | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const canvas = canvasRef.current
    if (!dialog || !canvas || typeof window.matchMedia !== 'function') return
    const genie = new Genie({ dialog, canvas, dress })
    genieRef.current = genie
    genie.start(whenSettled())

    // Escape while the genie carries the panel: always our own close, so the pour can turn
    // round (Chrome may otherwise close the dialog on the spot, with no pour back).
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dialog.hasAttribute('data-genie')) return
      event.preventDefault()
      if (dialog.dataset.state !== 'closing') closeSection()
    }
    // Closed under us after all: let go.
    const onClose = () => genie.closed()
    dialog.addEventListener('keydown', onKey)
    dialog.addEventListener('close', onClose)

    // Development: a changed stylesheet may change the glass.
    const hot = import.meta.hot
    const onUpdate = () => genie.schedulePrepare(300)
    hot?.on('vite:afterUpdate', onUpdate)

    if (import.meta.env.DEV) (window as unknown as { __panelGenie?: Genie }).__panelGenie = genie

    return () => {
      dialog.removeEventListener('keydown', onKey)
      dialog.removeEventListener('close', onClose)
      hot?.off?.('vite:afterUpdate', onUpdate)
      genie.destroy()
      genieRef.current = null
    }
  }, [dialogRef, canvasRef, dress])

  return genieRef
}
