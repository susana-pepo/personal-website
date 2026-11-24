import type { ShelfId } from '../../content/types'

/**
 * The book notes page asks a few quick questions and puts your answers together, word for
 * word. Nothing is written for you: the note is only ever your own words, joined. The voice
 * check then points out the phrases that make a note sound like a blurb.
 */

export interface Prompt {
  /** Stored answers are keyed by this. */
  key: 'one' | 'two' | 'three'
  question: string
  /** An example of the tone, never a fact about you. */
  example: string
  /** Words put in front of the answer when the note is put together, e.g. "For ". */
  lead?: string
}

/** Each shelf asks its own three questions. Every one can be skipped. */
export const PROMPTS: Record<ShelfId, Prompt[]> = {
  loved: [
    { key: 'one', question: 'What stayed with you?', example: 'How quiet it is, and how much it still hurts.' },
    { key: 'two', question: 'When or how did you read it?', example: 'In two evenings, without stopping.' },
    { key: 'three', question: 'Who would you give it to?', lead: 'For ', example: 'anyone who likes short, sharp novels.' },
  ],
  work: [
    { key: 'one', question: 'What do you use from it?', example: 'Naming the real problem before choosing what to do.' },
    { key: 'two', question: 'When do you reach for it?', example: 'Before planning a new quarter.' },
    { key: 'three', question: 'Who should read it?', lead: 'For ', example: 'anyone starting out in product.' },
  ],
  reading: [
    { key: 'one', question: 'Why this one, now?', example: 'A friend gave it to me.' },
    { key: 'two', question: 'What has caught you so far?', example: 'How much she loves libraries.' },
    { key: 'three', question: 'Where are you in it?', example: 'About halfway.' },
  ],
}

export type Answers = Partial<Record<Prompt['key'], string>>

/** One answer as a sentence: trimmed, first letter capitalised, a full stop if it has no ending. */
export function sentence(text: string, lead = ''): string {
  const body = text.trim().replace(/\s+/g, ' ')
  if (!body) return ''
  const joined = lead ? `${lead}${body.replace(new RegExp(`^${lead.trim()}\\s+`, 'i'), '')}` : body
  const capped = joined.charAt(0).toLocaleUpperCase() + joined.slice(1)
  return /[.!?…»”"')]$/.test(capped) ? capped : `${capped}.`
}

/** Your answers, in order, as one short note. */
export function compose(prompts: Prompt[], answers: Answers): string {
  return prompts
    .map((p) => sentence(answers[p.key] ?? '', p.lead))
    .filter(Boolean)
    .join(' ')
}

export interface VoiceFlag {
  /** What was found, as it appears in the note. */
  found: string
  /** A plain suggestion. */
  hint: string
}

/** Phrases that read as a blurb or as written by a machine, each with what to do instead. */
const BLURB: { pattern: RegExp; hint: string }[] = [
  { pattern: /must[- ]read/i, hint: 'Say who it is for instead.' },
  { pattern: /page[- ]turner|unputdownable|couldn['’]t put it down/i, hint: 'Say when or how you read it instead.' },
  { pattern: /masterpiece|tour de force|instant classic|game[- ]changer/i, hint: 'Say what it did for you instead.' },
  { pattern: /beautifully written|beautiful prose|stunning|breathtaking|captivating|compelling|gripping/i, hint: 'Name the line or the moment instead.' },
  { pattern: /thought[- ]provoking|eye[- ]opening|mind[- ]blowing|life[- ]changing/i, hint: 'Say what it made you think or change.' },
  { pattern: /highly recommend|i recommend|a great read|worth the read/i, hint: 'Being on your shelf already says that.' },
  { pattern: /\bresonated?\b|\bprofound(ly)?\b|\bpoignant\b|\bnuanced\b|\bpowerful\b/i, hint: 'A plainer word, or the detail itself.' },
  { pattern: /\bjourney\b|\btapestry\b|\bdelve\b|\btestament to\b|\bdeep dive\b|\bunpack(s|ing)?\b/i, hint: 'This one sounds machine-written. Say it plainly.' },
  { pattern: /not (just|only) [^.,;]+,? but/i, hint: 'Say the one thing it is.' },
  { pattern: /—|–/, hint: 'A comma or a full stop reads calmer.' },
  { pattern: /!/, hint: 'A full stop is calmer.' },
]

/** The longest a note should be before it stops feeling like a note. */
export const NOTE_SENTENCES = 3
export const NOTE_CHARS = 220

export function voiceCheck(note: string): VoiceFlag[] {
  const flags: VoiceFlag[] = []
  for (const { pattern, hint } of BLURB) {
    const match = note.match(pattern)
    if (match) flags.push({ found: match[0], hint })
  }
  const sentences = note.split(/(?<=[.!?…])\s+/).filter((s) => s.trim()).length
  if (sentences > NOTE_SENTENCES || note.trim().length > NOTE_CHARS) {
    flags.push({ found: `${sentences} sentences, ${note.trim().length} characters`, hint: 'A few short sentences is plenty. Keep the ones you would say out loud.' })
  }
  return flags
}
