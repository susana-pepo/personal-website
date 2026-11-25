import { useEffect, useRef, useState } from 'react'
import { HeroScene } from './components/HeroScene/HeroScene'
import { SectionPanel } from './components/SectionPanel/SectionPanel'
import { SiteFooter } from './components/SiteFooter/SiteFooter'
import { Masthead } from './components/Masthead/Masthead'
import { preloadSections } from './components/sections/registry'
import { useScenePlayback } from './hooks/useScenePlayback'
import { useSection } from './hooks/useSection'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import './App.css'

export function App() {
  const section = useSection()
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playback = useScenePlayback(videoRef, stageRef)
  // The masthead spot where the room draws its scene control.
  const [sceneSlot, setSceneSlot] = useState<HTMLDivElement | null>(null)

  useDocumentTitle(section)

  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200))
    idle(() => preloadSections())
    if (import.meta.env.DEV) void import('./content/logChecklist').then((m) => m.logContentChecklist())
  }, [])

  return (
    <>
      <div className="page">
        <Masthead current={section} sceneSlotRef={setSceneSlot} />
        <main id="main" className="cover" tabIndex={-1}>
          <HeroScene stageRef={stageRef} videoRef={videoRef} playback={playback} controlSlot={sceneSlot} />
        </main>
        <SiteFooter />
      </div>
      <SectionPanel section={section} />
    </>
  )
}
