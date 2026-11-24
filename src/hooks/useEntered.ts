import { useEffect, useState } from 'react'
import { whenSettled } from '../scene/entrance'

/** Whether the page's entrance has settled (see scene/entrance.ts): heavy animations wait for it. */
export function useEntered(): boolean {
  const [entered, setEntered] = useState(() => typeof document !== 'undefined' && document.documentElement.dataset.settled !== undefined)
  useEffect(() => {
    if (entered) return
    let live = true
    void whenSettled().then(() => live && setEntered(true))
    return () => {
      live = false
    }
  }, [entered])
  return entered
}
