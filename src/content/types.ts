/**
 * Content types for the site. Every visible string lives in `content.ts`,
 * typed by these interfaces, so copy can be edited without touching components.
 */

export const SECTION_IDS = ['about', 'work', 'experience', 'bookshelf', 'music', 'contact'] as const
export type SectionId = (typeof SECTION_IDS)[number]

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value)
}

export interface SectionMeta {
  id: SectionId
  /** Short name used in navigation, e.g. "Work". */
  navLabel: string
  /** Panel heading. */
  title: string
  /** One-line description used on navigation cards and under the panel heading. */
  summary: string
  /** Label shown on the object in the room that opens this section. */
  roomLabel: string
  /** The object's plain name, used in accessible labels: "the laptop". Empty if no object opens it. */
  objectName: string
}

export interface Profile {
  fullName: string
  /** Shorter name for the homepage heading. */
  displayName: string
  disciplines: string[]
  tagline: string
  exploreHint: string
}

export interface WorkTheme {
  id: string
  title: string
  /** e.g. "Area of focus" or "Independent exploration". */
  kind: string
  summary: string
  /** Topics this theme touches, shown as a quiet inline list. */
  topics: string[]
  /** Optional: shown as a status note, e.g. "In progress". */
  status?: string
  /** Optional link to a case study or write-up. Leave undefined until one exists. */
  href?: string
  /**
   * Optional: the quadrant this theme fills on the Work map. Each quadrant holds
   * one theme; a theme without one (or a second theme in a taken quadrant) is
   * drawn just off the map, as an outpost.
   */
  place?: WorkPlace
}

/** A quadrant of the Work map, named by where it sits on the page. */
export type WorkPlace = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** The Work map: themes laid out on two axes, in Susana's own words. */
export interface WorkMap {
  /** Small caption above the map, on the left. */
  label: string
  /** Small caption above the map, on the right: how to use it. */
  hint: string
  /** The word at each end of the two axes. */
  axes: { top: string; bottom: string; left: string; right: string }
}

/** The drawing that stands for a project in the Work grid (see sections/work/thumbs). */
export type WorkThumbKind = 'keys' | 'guide' | 'ledger' | 'plan' | 'network'

/** Something Susana has made, shown as a drawn tile in the Work grid. */
export interface WorkProject {
  id: string
  title: string
  /** One line under the title. */
  line: string
  /** A few sentences, shown when the tile is opened. */
  summary: string
  /** A short state, e.g. "Live", "Personal", "Internal tool", "Exploration in progress". */
  status: string
  /** Optional: the area of focus it belongs to (a theme id with a place on the map). Empty: off the map. */
  area?: string
  thumb: WorkThumbKind
  /** Optional topics, as for themes. */
  topics?: string[]
  /** Optional public link. Only for things that are live and public. */
  href?: string
  /** Text for the link, e.g. "Try it on Skoove". */
  linkLabel?: string
}

export interface ExperienceEntry {
  id: string
  /** Role or area of practice. */
  title: string
  /** Optional organisation. Leave undefined rather than guessing. */
  organization?: string
  /** Optional period, e.g. "2021 — present". Leave undefined rather than guessing. */
  period?: string
  /** Optional location. */
  location?: string
  summary: string
  focus: string[]
}

/** One role on the CV. */
export interface ExperienceRole {
  id: string
  /** The chapter this role was in my path, as on my portfolio, e.g. "Owning the learning experience". */
  stage: string
  title: string
  /** e.g. "August 2023 to October 2026". No dashes. */
  period: string
  /** What I did, from my CV. No figures until they can be backed up. */
  points: string[]
  /** The skills this role used, as tagged on my portfolio. */
  skills: string[]
}

export interface Employer {
  name: string
  location: string
  period: string
  /** Newest first: the books of this employer's pile, the latest on top. */
  roles: ExperienceRole[]
}

export interface EducationEntry {
  id: string
  qualification: string
  institution: string
  period?: string
  /** Short form for a book's spine, e.g. "Therapy and Educational Sciences". */
  spine?: string
  /** The degree's letters, printed on the Education book's spine, e.g. "MA". */
  spineNote?: string
}

export interface MusicCard {
  id: string
  title: string
  eyebrow: string
  body: string
  /** Only add links to content you own or that is publicly and legally available. */
  link?: { label: string; href: string }
}

export interface SpotifyPick {
  /** A Spotify share link: album, playlist, track, artist, show or episode. */
  url: string
  /** Shown under the title, e.g. the artist. Spotify's public lookup doesn't include it. */
  subtitle?: string
  /** Optional overrides. When empty, title and cover come from Spotify automatically. */
  title?: string
  cover?: string
  /** A line in your own words, shown when the record is opened. */
  note?: string
  /** Liner notes on the desk. Each is optional; any left empty is simply not shown. */
  year?: string | number
  /** The track to start with, e.g. { number: '04', title: 'Song name' }. */
  startWith?: { number: string; title: string }
  /** e.g. '9 tracks, 41 min'. */
  length?: string
}

export type ShelfId = 'reading' | 'work' | 'loved'

/** How a book is bound. It decides the lettering, texture and wear. */
export type BookKind = 'cloth' | 'leather' | 'jacket' | 'paperback'

/** Book colours, all taken from the room (plus oxblood for old leather). */
export type BookColour = 'walnut' | 'terracotta' | 'rose' | 'teal' | 'slate' | 'ochre' | 'card' | 'ink' | 'oxblood'

/** How a book sits on the shelf. Each shelf has a default layout; this overrides it. */
export type BookPose = 'upright' | 'face' | 'lean' | 'flat'

/** A small decorative thing that lives on a shelf. */
export type ShelfObject = 'bookend'

export interface Shelf {
  id: ShelfId
  title: string
  description: string
  /** Optional: a travertine bookend at the end of the row. */
  object?: ShelfObject
}

export interface Book {
  title: string
  author: string
  shelf: ShelfId
  /** One or two sentences in your own words: why it matters to you. */
  note?: string
  /** Optional link (publisher, bookshop, library). */
  href?: string
  /** Optional. Derived from the title when missing. */
  kind?: BookKind
  /** Optional. Derived from the title when missing. */
  colour?: BookColour
  /** Optional. Overrides the shelf's default layout. */
  pose?: BookPose
  /** Optional real height in millimetres. Wins over the derived height. */
  heightMm?: number
  /** Optional real thickness in millimetres. Wins over the derived thickness. */
  thicknessMm?: number
  /** Optional name for the spine. Defaults to the author's surname. */
  spineAuthor?: string
  /** Optional photo of the real front cover, e.g. '/media/books/la-perra.webp'. Replaces the drawn cover. */
  cover?: string
  /** Optional real spine colour as a hex value, e.g. '#891a1e'. Wins over colour; the lettering picks light or dark ink to suit. */
  spineColour?: string
}

export interface ContactLink {
  label: string
  href: string
  /** The handle or address, e.g. "linkedin.com/in/…" (kept for reference; not shown on the note). */
  display: string
  /** The visible action on the contact note, e.g. "Connect on LinkedIn". Falls back to the label. */
  action?: string
}

export interface ContactContent {
  heading: string
  intro: string
  /** The note's heading, e.g. "Let’s chat"; also the subject of the email it opens. */
  cta: string
  /** Public email address. Leave empty until approved for publishing. */
  email: string
  /** The visible email action, e.g. "Send me an email". The address itself is never printed. */
  emailAction: string
  links: ContactLink[]
  /** Shown when no email or links are configured yet. */
  pendingNote: string
  location?: string
}

export interface SiteContent {
  profile: Profile
  sections: Record<SectionId, SectionMeta>
  work: { intro: string; map: WorkMap; themes: WorkTheme[]; projects: { label: string; items: WorkProject[] } }
  about: {
    /** The sentence the page hangs on, set a size up under the panel heading (the greeting). */
    intro: string
    paragraphs: string[]
    /** A quieter last word under the prose, in the faintest ink. Omit for none. */
    closing?: string
    /** My photo, set as a small warm-toned print beside the intro. Omit to show none. */
    portrait?: { src: string; srcSmall: string; alt: string }
  }
  experience: {
    /** One line from my CV's profile, set as the lede. */
    intro: string
    /** Newest first. Each heads its own pile of role books. */
    employers: Employer[]
    /** Heading of the smaller pile at the end, the things outside any one job. */
    beyondTitle: string
    /** The notebook on top of that pile: its spine title, e.g. "Languages and tools". */
    toolkitTitle: string
    /** The one book that holds every degree, e.g. "Education". */
    educationTitle: string
    languages: string[]
    tools: string[]
    /** The earlier "books on the desk" threads. Set aside for now and not shown. */
    entries: ExperienceEntry[]
    education: EducationEntry[]
    cvLabel: string
    /** The CV's folder on the background pile, and its title when opened. */
    cvTitle: string
  }
  bookshelf: { intro: string; shelves: Shelf[]; books: Book[]; emptyNote: string }
  music: {
    intro: string
    listening: {
      heading: string
      description: string
      liveLabel: string
      recentLabel: string
      /** Shown above the chosen record when there is no live feed (as on the published site). */
      turntableLabel: string
      /** A record from the shelf that sits on the turntable when there is no live feed. */
      onTurntable?: { url: string; title: string; artist: string; cover?: string }
    }
    collection: { heading: string; description: string; items: SpotifyPick[] }
    /** Podcasts: Spotify show (or episode) links, on their own shelf. */
    podcasts: { heading: string; description: string; items: SpotifyPick[] }
    cards: MusicCard[]
    closing: string
  }
  contact: ContactContent
  /** Small tooltips on the transparent objects (shown after a short hover, or on focus). */
  objectTooltips: { vinyl: string; books: string; laptop: string; deskbooks: string; woman: string; coffee: string }
  /**
   * What Susana says, above her like her greeting: an invitation that floats up on its own just
   * behind the greeting (a second line beneath it), then, each time she's hovered, a line about one thing in the room the
   * visitor hasn't found or opened yet. `about` is that object (a glimmer's id, or a section
   * object's overlay id); it answers as she says it (src/scene/roomCues.ts).
   */
  susana: { invite: string; lines: readonly { about: string; text: string }[] }
  /** A quiet, dismissible first-visit hint under the room. Hidden after the first interaction. */
  discovery: {
    title: string
    hint: string
    dismissLabel: string
    /** The arrows at the edges of a phone's panning room (accessible names). */
    panStart: string
    panEnd: string
  }
  /** The desk lamp: clicking it changes the colour of its light (not a section). */
  lamp: {
    /** Hover tag. */
    hint: string
    /** Accessible name of the lamp button. */
    actionLabel: string
    /** The light's name, announced to screen readers when a click turns it on (see scene/lampTones.ts). */
    tones: { warm: string }
    /** Announced when a click turns the lamp's light off (the room keeps its own light). */
    off: string
  }
  /** The piano computer on the top shelf: a glimmer; a click brings it close, to be played. */
  piano: {
    /** Hover tag. */
    hint: string
    /** Accessible name of the piano button (on the shelf). */
    actionLabel: string
    /** The close-up's accessible name. */
    closeUpLabel: string
    /** How to play it, under the close-up (and its keys' accessible description). */
    howTo: string
    /** The close-up's close control. */
    close: string
    /** The choices beside the piano: the screen's landscape (with a line saying what it is) and the loop. */
    landscape: string
    landscapeHelp: string
    loop: string
    /** The brass knobs: their printed names, and what they're called aloud (the top one sets the
     * loop's volume, the bottom one the keys'). */
    loopKnob: string
    loopVolume: string
    keysKnob: string
    keysVolume: string
    /** The dials' arrows. */
    previous: string
    next: string
    /** The orange light: the loop's play/pause. */
    playLoop: string
    pauseLoop: string
    /** The loop's credit, under the piano: "Loop “Title” by Kevin MacLeod (incompetech.com), CC BY 4.0". */
    loopCredit: string
    by: string
  }
  /** The sleeping cat on the desk: a small easter egg, not a section. */
  cat: {
    /** Hover tag. */
    hint: string
    /** Accessible name of the cat button. */
    actionLabel: string
    /** Whispered after a pet when the room is still (reduced motion, paused). */
    stillReply: string
    /** Announced to screen readers after a pet when it stays asleep (a purr and z's). */
    announcement: string
    /** Announced after a pet when it turns its head. */
    headTurnAnnouncement: string
    /** Announced after a pet when it wakes and stretches. */
    stretchAnnouncement: string
  }
  /** The time-of-day control in the room's top-right corner: the group's name and each time's name. */
  timeOfDay: { label: string; dawn: string; midday: string; night: string }
  weather: { label: string; clear: string; rain: string; snow: string }
  sceneControl: { label: string }
  nav: { label: string; items: SectionId[] }
  footer: { note: string }
}
