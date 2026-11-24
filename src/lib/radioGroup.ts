/**
 * The option a key moves to in a radio group, or null for a key the group ignores.
 * Arrows step and wrap (Right/Down forward, Left/Up back); Home and End jump to the ends.
 */
export function optionForKey<T>(options: readonly T[], current: T, key: string): T | null {
  const last = options.length - 1
  if (last < 0) return null
  const found = options.indexOf(current)
  const at = found < 0 ? 0 : found
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return options[at === last ? 0 : at + 1]!
    case 'ArrowLeft':
    case 'ArrowUp':
      return options[at === 0 ? last : at - 1]!
    case 'Home':
      return options[0]!
    case 'End':
      return options[last]!
    default:
      return null
  }
}
