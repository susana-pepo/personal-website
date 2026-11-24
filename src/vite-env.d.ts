/// <reference types="vite/client" />

/** Public path of the CV PDF, or '' when no CV file exists (see vite.config.ts). */
declare const __CV_PATH__: string

interface ImportMetaEnv {
  /** Your own endpoint returning the Spotify track you're listening to (optional). */
  readonly VITE_NOW_PLAYING_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
