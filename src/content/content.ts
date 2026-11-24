import type { SiteContent } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  All site copy lives here. Edit freely.
 *
 *  Ground rules this draft follows (please keep them):
 *  - No invented employers, dates, titles, results, testimonials or links.
 *  - Optional fields (organization, period, href, email, links…) stay empty
 *    until you have the real value. Empty fields are simply not rendered.
 *  - In development (`npm run dev`) a small "Content checklist" button lists
 *    everything that still needs your input.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const content: SiteContent = {
  profile: {
    fullName: 'Susana Pérez Posada',
    displayName: 'Susana Pérez',
    disciplines: ['Product', 'Music', 'Technology'],
    tagline: 'I create thoughtful experiences where music, learning, and technology meet.',
    exploreHint: 'Explore the room',
  },

  sections: {
    work: {
      id: 'work',
      navLabel: 'Work',
      title: 'Selected work',
      summary: 'Where music, learning and rights meet product.',
      roomLabel: 'Selected work',
      objectName: 'the laptop',
    },
    about: {
      id: 'about',
      navLabel: 'About',
      title: 'Hi there, I’m Susana',
      summary: 'Music first, then product, and the thread between them.',
      roomLabel: 'My story',
      objectName: 'the woman at the desk',
    },
    experience: {
      id: 'experience',
      navLabel: 'Experience',
      title: 'Experience',
      summary: 'The threads that run through my work.',
      roomLabel: 'Experience',
      objectName: 'the books on the desk',
    },
    bookshelf: {
      id: 'bookshelf',
      navLabel: 'Bookshelf',
      title: 'Bookshelf',
      summary: 'What I’m reading and the books I love.',
      roomLabel: 'My bookshelf',
      objectName: 'the books on the shelf',
    },
    music: {
      id: 'music',
      navLabel: 'Music',
      title: 'Music',
      summary: 'Playing, listening and learning.',
      roomLabel: 'Music',
      objectName: 'the record player',
    },
    contact: {
      id: 'contact',
      navLabel: 'Contact',
      title: 'Say hello',
      summary: 'Ways to get in touch.',
      roomLabel: 'Say hello',
      // The coffee mug on the desk opens it (tooltip: “Let’s chat”).
      objectName: 'the coffee mug',
    },
  },

  work: {
    intro:
      'Most of my work sits where music meets the systems around it: how people learn it, how it is licensed, and how products can make both feel simpler than they are.',
    // The map: each area of focus fills one quadrant (see `place` below). The axis
    // words come from the intro above; change them freely.
    map: {
      label: 'Areas of focus',
      hint: 'Choose one to read about it',
      axes: { top: 'Music', bottom: 'Product', left: 'People', right: 'Systems' },
    },
    themes: [
      {
        id: 'music-learning',
        place: 'top-left',
        title: 'Music learning experiences',
        kind: 'Area of focus',
        summary:
          'Designing thoughtful, accessible learning experiences that help people build a lasting relationship with music. I care about the first five minutes as much as the hundredth hour: what makes someone feel capable, and what brings them back to the instrument tomorrow.',
        topics: ['Learning design', 'Accessibility', 'Practice habits', 'Motivation'],
      },
      {
        id: 'discovery-engagement',
        place: 'bottom-left',
        title: 'Product discovery and engagement',
        kind: 'Area of focus',
        summary:
          'Exploring how onboarding, learning progression, personalisation and everyday product decisions can support engagement that means something to the learner, and not only to a chart.',
        topics: ['Onboarding', 'Learning progression', 'Personalisation', 'Product discovery'],
      },
      {
        id: 'rights-licensing',
        place: 'bottom-right',
        title: 'Music rights and licensing',
        kind: 'Area of focus',
        summary:
          'Connecting the moving parts behind a single song in a digital product: musical works and repertoire, rights data, licensing agreements, and the product decisions that depend on all of them. Much of this work is translation, making a complex system legible for the people who build on it.',
        topics: ['Musical works & repertoire', 'Rights data', 'Licensing agreements', 'Digital products'],
      },
      {
        id: 'notation-learning',
        place: 'top-right',
        title: 'Notation and interactive learning',
        kind: 'Area of focus',
        summary:
          'Working where music pedagogy, notation systems, content design and interactive technology overlap. A score on a screen can do more than a score on paper, as long as it still respects how musicians read.',
        topics: ['Music pedagogy', 'Notation systems', 'Content design', 'Interactive technology'],
      },
    ],
    // Things I've made, each drawn as a small object (thumb). `area` ties a project to
    // a quadrant of the map above. Only link things that are live and public.
    projects: {
      label: 'Things I’ve made',
      items: [
        {
          id: 'chord-builder',
          title: 'Interactive chord builder',
          line: 'A concept-heavy topic turned into something learners can inspect and play.',
          summary:
            'Choose a root note and a chord type, see the chord on the keyboard and tap the keys to hear it. A topic that is usually only explained becomes something learners can inspect, test and move between explanation and practice.',
          status: 'Live',
          area: 'notation-learning',
          thumb: 'keys',
          href: 'https://www.skoove.com/en/tools/piano-chords',
          linkLabel: 'Try it on Skoove',
        },
        {
          id: 'pm-frameworks',
          title: 'PM frameworks guidebook',
          line: 'A field guide to product frameworks, for people who learn by doing.',
          summary:
            'A hands-on guide to RICE, MoSCoW, Kano, Jobs-to-be-Done and more, built as a web experience rather than a course: somewhere to find the right framework, use it and come back to it.',
          status: 'Live',
          area: 'discovery-engagement',
          thumb: 'guide',
          href: 'https://susana-pepo.github.io/PM-Frameworks-Guidebook/',
          linkLabel: 'Open the guidebook',
        },
        {
          id: 'licensing-engine',
          title: 'Licensing engine',
          line: 'Rights clearance for a song catalogue, with the business rules kept as data.',
          summary:
            'An in-house rights-clearance system for a music-learning catalogue. The business rules, from how publisher shares map to rights groups to deal terms and restricted writers, live in data files rather than code, so they can be changed without a developer and every change can be reviewed. A dashboard on top shows coverage, scenarios and a plan of action.',
          status: 'Internal tool',
          area: 'rights-licensing',
          thumb: 'ledger',
          topics: ['Rights data', 'Clearance', 'Rules as data'],
        },
        {
          id: 'apartment-studio',
          title: 'Apartment studio',
          line: 'Furnishing a new home at exact scale, in a 2D plan and a 3D walk-through.',
          summary:
            'A private planner for furnishing a new apartment at real-world scale. The floor plans are converted from the official drawings; furniture is placed on a 2D plan and checked in a 3D walk-through.',
          status: 'Personal',
          thumb: 'plan',
        },
        {
          id: 'rights-intelligence',
          title: 'Rights Intelligence',
          line: 'An independent exploration of tooling for music rights data.',
          summary:
            'A personal exploration of data-driven tooling for musical-work identification, ownership, contract coverage and rights reconciliation. I use it to test ideas about how rights information could become easier to trust and act on. It is an independent project, not a commercial product.',
          status: 'Exploration in progress',
          thumb: 'network',
          topics: ['Work identification', 'Ownership data', 'Contract coverage', 'Reconciliation'],
        },
      ],
    },
  },

  about: {
    intro: 'Music has always been a big part of my life, and somehow it keeps finding its way into everything I do.',
    paragraphs: [
      'I work on products that bring music, learning and technology together. Most of all, I try to make complicated experiences feel a bit easier and more enjoyable.',
      'I’m interested in what keeps people going when something gets difficult. Learning music can be wonderful, but also incredibly frustrating. I know the feeling of trying something over and over until it finally clicks. When I build learning experiences, I think most about the person who’s just about ready to give up.',
      'I ask lots of questions and want to know how things work. I love the behind-the-scenes side too: the little details, the unexpected problems, the conversations that make you reconsider an idea, all the pieces that have to come together to make something work. I like being somewhere between the creative and the technical.',
      'Outside of work, I enjoy long walks, cooking for friends, slow mornings with coffee, and getting completely absorbed in projects of my own. This website is one of them.',
    ],
    closing:
      'I suppose this little room is a pretty good introduction to me too. Music playing, a notebook nearby, a cosy corner, and probably too many things I want to try.',
  },

  experience: {
    intro:
      'The threads that run through my work so far, across product, music licensing and music education.',
    entries: [
      {
        id: 'product',
        title: 'Product management',
        summary:
          'Shaping digital music-learning experiences, from discovery and onboarding to learning progression, with a focus on what helps learners build a lasting practice.',
        focus: ['Product discovery', 'Onboarding', 'Learning progression', 'Cross-functional collaboration'],
      },
      {
        id: 'licensing',
        title: 'Digital music licensing',
        summary:
          'Working with musical works, repertoire and rights data to bring music into digital products, and translating licensing requirements into decisions product teams can act on.',
        focus: ['Musical works & repertoire', 'Rights data', 'Licensing requirements'],
      },
      {
        id: 'education',
        title: 'Music education',
        summary:
          'A grounding in music education and pedagogy that still shapes how I think about learning design, feedback and progression.',
        focus: ['Pedagogy', 'Learning design', 'Notation'],
      },
      {
        id: 'piano',
        title: 'Piano',
        summary:
          'The instrument at the root of my musical life. It informs how I listen, how I practise, and how I think about learning.',
        focus: ['Musicianship', 'Practice', 'Listening'],
      },
    ],
    education: [],
    cvLabel: 'Download CV (PDF)',
  },

  bookshelf: {
    // Optional paragraph above the shelves; the section summary already introduces it.
    intro: '',
    shelves: [
      { id: 'reading', title: 'Reading now', description: 'Open on the desk.' },
      { id: 'work', title: 'Books for work', description: 'The ones I work with.' },
      { id: 'loved', title: 'Books I love', description: 'The ones that stayed.', object: 'bookend' },
    ],
    // Add your books here. Each needs a title, an author and a shelf ('reading', 'work' or 'loved');
    // a note is optional. e.g. { title: '…', author: '…', shelf: 'work', note: '…' }
    // A shelf with no books yet stays hidden.
    // Each book is drawn from its data. Optional extras: kind ('cloth' | 'leather' | 'jacket' | 'paperback'),
    // colour (a room colour such as 'teal' or 'ochre'), pose ('upright' | 'face' | 'lean' | 'flat'),
    // heightMm and thicknessMm (real sizes), and spineAuthor (defaults to the surname).
    books: [
      { title: 'El infinito en un junco', author: 'Irene Vallejo', shelf: 'reading' },

      { title: 'Good Strategy Bad Strategy', author: 'Richard Rumelt', shelf: 'work' },
      { title: 'Music Law in the Digital Age', author: 'Allen Bargfrede', shelf: 'work' },
      { title: 'Inspired', author: 'Marty Cagan', shelf: 'work' },
      { title: 'Never Split the Difference', author: 'Chris Voss', shelf: 'work' },
      { title: 'Prophecy', author: 'Carissa Véliz', shelf: 'work' },

      { title: 'La perra', author: 'Pilar Quintana', shelf: 'loved' },
      { title: 'Los abismos', author: 'Pilar Quintana', shelf: 'loved' },
      { title: 'Lo que no tiene nombre', author: 'Piedad Bonnet', shelf: 'loved' },
      // Han is the family name, so the spine shows the full name rather than "Kang".
      { title: 'La clase de griego', author: 'Han Kang', shelf: 'loved', spineAuthor: 'Han Kang' },
      { title: 'La vegetariana', author: 'Han Kang', shelf: 'loved', spineAuthor: 'Han Kang' },
      { title: 'La ridícula idea de no volver a verte', author: 'Rosa Montero', shelf: 'loved' },
    ],
    emptyNote: 'The shelf is being arranged. Books will be here soon.',
  },

  music: {
    listening: {
      heading: 'What I’m listening to',
      description: '',
      liveLabel: 'Listening now',
      recentLabel: 'Last played',
    },
    collection: {
      heading: 'On my shelf of records',
      description: 'Albums and playlists I keep coming back to.',
      // Paste Spotify share links (Share → Copy link). Title and cover load automatically.
      // e.g. { url: 'https://open.spotify.com/album/…', subtitle: 'Artist name', note: 'Why I love it.' }
      items: [],
    },
    intro: '',
    cards: [],
    closing: '',
  },

  contact: {
    heading: 'Say hello',
    intro:
      'Whether it’s about music learning, licensing, product work, or a piece of music you think I’d love, I’m always glad to hear from thoughtful people.',
    // Add a public address once you're happy to publish it, e.g. 'hello@example.com'.
    email: '',
    // e.g. { label: 'LinkedIn', href: 'https://www.linkedin.com/in/…', display: 'linkedin.com/in/…' }
    links: [],
    pendingNote: 'Direct contact details will be added here very soon.',
  },

  objectTooltips: {
    vinyl: 'What I’m listening to',
    books: 'My booklist',
    laptop: 'My work',
    deskbooks: 'My experience',
    woman: 'Hey there, I’m Susana',
    coffee: 'Let’s chat',
  },

  discovery: {
    title: 'Explore the room',
    hint: 'Hover or tap the objects',
    dismissLabel: 'Dismiss hint',
  },

  lamp: {
    hint: 'Switch the light',
    actionLabel: 'Switch the desk lamp on or off',
    tones: { warm: 'Lamp light on' },
    off: 'Lamp light off',
  },

  cat: {
    hint: 'Pet the cat',
    actionLabel: 'Pet the cat',
    stillReply: 'Purr…',
    announcement: 'The cat stirs, then settles back to sleep.',
    headTurnAnnouncement: 'The cat turns its head a little, then settles back to sleep.',
    stretchAnnouncement: 'The cat wakes, stretches its front paws, and settles back to sleep.',
  },

  timeOfDay: {
    label: 'Time of day',
    dawn: 'Dawn',
    midday: 'Midday',
    night: 'Night',
  },

  /** The small control under the room for its time of day and weather. */
  sceneControl: {
    label: 'Scene',
  },

  /** The quiet menu above the room: one clear way in, besides the objects. */
  nav: {
    label: 'Sections',
    items: ['about', 'work', 'contact'],
  },

  weather: {
    label: 'Weather',
    clear: 'Clear',
    rain: 'Rain',
    snow: 'Snow',
  },

  footer: {
    // Optional line after the copyright, e.g. an illustration credit.
    note: '',
  },
}
