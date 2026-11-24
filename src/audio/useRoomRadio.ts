import { useEffect, useSyncExternalStore } from 'react'
import { roomRadio, type RadioState } from './radio'

/** The radio's state, for React. */
export function useRoomRadio(): RadioState {
  const radio = roomRadio()
  return useSyncExternalStore(radio.subscribe, radio.getSnapshot, radio.getSnapshot)
}

/**
 * Tells the radio whether it is raining outside the window. The room marks its
 * weather on the scene (`.scene[data-weather]`); this follows that attribute,
 * so the radio needs nothing from the room's own code.
 */
export function useRainFromScene() {
  useEffect(() => {
    const radio = roomRadio()
    let observer: MutationObserver | null = null
    const watch = (scene: Element) => {
      const update = () => radio.setRaining(scene.getAttribute('data-weather') === 'rain')
      update()
      observer?.disconnect()
      observer = new MutationObserver(update)
      observer.observe(scene, { attributes: true, attributeFilter: ['data-weather'] })
    }
    const found = document.querySelector('.scene[data-weather]')
    if (found) {
      watch(found)
    } else {
      // The room may mount a moment later.
      observer = new MutationObserver(() => {
        const scene = document.querySelector('.scene[data-weather]')
        if (scene) watch(scene)
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }
    return () => observer?.disconnect()
  }, [])
}
