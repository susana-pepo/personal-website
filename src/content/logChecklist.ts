import { content } from './content'
import { contentChecklist } from './checklist'

/** Development only: list content that still needs real details, in the console. */
export function logContentChecklist() {
  const items = contentChecklist(content, Boolean(__CV_PATH__))
  if (items.length === 0) return
  console.groupCollapsed(`%cContent checklist · ${items.length} items (edit src/content/content.ts)`, 'color:#c96341')
  items.forEach((item) => console.info(`• ${item}`))
  console.groupEnd()
}
