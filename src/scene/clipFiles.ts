/**
 * The animated clips' files (the woman's and the cat's), each fetched once per visit and
 * kept as a Blob, so a clip can be played again and again from a fresh copy (a new object
 * URL always starts at its first frame) without downloading it twice.
 */
const files = new Map<string, Promise<Blob | null>>()
const arrived = new Map<string, Blob>()

export function fetchClipFile(src: string): Promise<Blob | null> {
  let file = files.get(src)
  if (!file) {
    file = fetch(src)
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null)
      .then((blob) => {
        if (blob) arrived.set(src, blob)
        else files.delete(src) // let a later turn try again
        return blob
      })
    files.set(src, file)
  }
  return file
}

/** The file, if it has already arrived (no waiting). */
export const arrivedClipFile = (src: string): Blob | undefined => arrived.get(src)

/** The clips that aren't needed at once load later, one after another, and only for visitors not saving data. */
export const LATER_CLIPS_AFTER_MS = 12_000

export function fetchLater(srcs: readonly string[], isStopped: () => boolean): number | undefined {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  if (saveData) return undefined
  return window.setTimeout(async () => {
    for (const src of srcs) {
      if (isStopped()) return
      await fetchClipFile(src)
    }
  }, LATER_CLIPS_AFTER_MS)
}
