import { REDUCED_MOTION_QUERY } from '../lib/motion'
import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverFallback,
  )
}

export const usePrefersReducedMotion = () => useMediaQuery(REDUCED_MOTION_QUERY)
export const useCoarsePointer = () => useMediaQuery('(hover: none) and (pointer: coarse)')
