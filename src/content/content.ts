import type { SiteContent } from './types'
import { withNotes } from './notes'

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
      title: 'Things I’ve built',
      summary: 'Where music, learning and rights meet product.',
      roomLabel: 'Things I’ve built',
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
      summary: '',
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
      'A few things I’ve built out of curiosity or to solve a problem.',
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
    // Things I've built: files on the laptop's desktop, each drawn as a small object
    // (thumb). `area` is kept for reference but no longer shown. Only link things that are live and public.
    projects: {
      label: 'Things I’ve built',
      items: [
        {
          id: 'chord-builder',
          title: 'Interactive chord builder',
          line: 'A concept-heavy topic turned into something learners can inspect and play.',
          summary:
            'Choose a root note and a chord type, see the chord on the keyboard and tap the keys to hear it.',
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
          line: 'A tool to help figure out which songs can be used, where, and under which licensing conditions.',
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
            'A personal exploration of tooling for musical-work identification, ownership, contract coverage and rights reconciliation. I use it to test ideas about how rights information could become easier to trust and act on. It is an independent project, not a commercial product.',
          status: 'Exploration in progress',
          thumb: 'network',
          topics: ['Work identification', 'Ownership data', 'Contract coverage', 'Reconciliation'],
        },
      ],
    },
  },

  about: {
    // From my PM portfolio (headshot.jpg), toned to the room's ink and paper.
    portrait: { src: '/media/about/headshot.webp', srcSmall: '/media/about/headshot-280.webp', alt: 'Susana Pérez' },
    intro: 'Music has always been a big part of my life, and somehow it keeps finding its way into everything I do.',
    paragraphs: [
      'I work on products that bring music, learning and technology together. I enjoy figuring out how to make things that feel complicated a little easier and more enjoyable.',
      'I’m particularly curious about what keeps people going when learning gets difficult. I know the feeling of practising something over and over until it finally clicks. When designing learning experiences, I often think about the person who’s just about ready to give up.',
      'I ask a lot of questions because I like understanding how things work. I enjoy the little details, the unexpected problems and the conversations that make me rethink an idea. I like being somewhere between the creative and the technical.',
      'Outside of work, I love long walks, cooking for friends, slow mornings with coffee and getting a little too absorbed in my own projects. This little room is one of them.',
    ],
  },

  experience: {
    // A condensed version of my CV, without the figures (not yet backed up in the evidence bank).
    intro: 'A very brief snapshot of my journey.',
    // Newest first. Each employer heads a pile of its roles, the latest on top.
    employers: [
      {
        name: 'Learnfield GmbH',
        location: 'Berlin, Germany',
        period: 'April 2022 to October 2026',
        roles: [
          {
            id: 'product-owner',
            stage: 'Owning the learning experience',
            title: 'Product Owner, Learning Experience & Content',
            period: 'August 2023 to October 2026',
            points: [
              'Owned learning experience and content strategy across two learning products.',
              'Validated a step-by-step learning format that raised completion and retention, and was adopted at scale.',
              'Prototyped practice tools and short video formats with AI and low-code tools before committing engineering time.',
            ],
            skills: ['Learning experience design', 'Learner research', 'Learning analytics', 'AI prototyping', 'Localisation'],
          },
          {
            id: 'content-manager',
            stage: 'Scaling the content system',
            title: 'Education Content Manager & License Manager',
            period: 'October 2022 to July 2023',
            points: [
              'Ran learning content end to end, from scope through localisation, QA and release.',
              'Shipped a large quarterly module release, plus a separate release for Japan and Korea.',
            ],
            skills: ['Content operations', 'Localisation', 'Onboarding', 'Quality assurance'],
          },
          {
            id: 'content-creator',
            stage: 'Making the learning',
            title: 'Educational Content Creator',
            period: 'April 2022 to October 2022',
            points: ['Designed and scripted self-paced courses and interactive lessons with educators and subject experts.'],
            skills: ['Instructional design', 'Course design', 'Video-based learning'],
          },
        ],
      },
      {
        // From LinkedIn: "Teacher", full-time, with "Editorial Consulting and Curriculum Development".
        name: 'Johannesstift Diakonie',
        location: 'Berlin, Germany',
        period: 'January 2020 to April 2022',
        roles: [
          {
            id: 'music-teacher',
            stage: 'Teaching music',
            title: 'Music Teacher',
            period: 'January 2020 to April 2022',
            points: ['Taught music, and worked on editorial consulting and curriculum development.'],
            skills: ['Music education', 'Curriculum development', 'Editorial consulting'],
          },
        ],
      },
    ],
    beyondTitle: 'A little more background',
    toolkitTitle: 'Languages and tools',
    educationTitle: 'Education',
    languages: ['Spanish, native', 'English, C1+', 'German, B2+'],
    tools: ['Claude', 'ChatGPT', 'Lovable', 'Google Stitch', 'Figma', 'Mixpanel', 'Jira', 'Confluence'],
    // Set aside for now: the earlier "books on the desk" threads. Not shown.
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
    education: [
      {
        id: 'ma-srh',
        qualification: 'Master of Arts in Therapy and Educational Sciences',
        institution: 'SRH Heidelberg University',
        period: '2017 to 2020',
        spineNote: 'MA',
      },
      {
        id: 'ba-eafit',
        qualification: 'Bachelor of Arts in Music',
        institution: 'Universidad EAFIT',
        period: '2011 to 2016',
        spineNote: 'BA',
      },
    ],
    cvLabel: 'Download CV (PDF)',
    cvTitle: 'Curriculum vitae',
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
    // The easiest way to write notes: run `npm run dev` and open http://localhost:5173/?notes.
    // It asks a few quick questions per book and saves your note in bookNotes.json.
    // A shelf with no books yet stays hidden.
    // Each book is drawn from its data. Optional extras: kind ('cloth' | 'leather' | 'jacket' | 'paperback'),
    // colour (a room colour such as 'teal' or 'ochre'), pose ('upright' | 'face' | 'lean' | 'flat'),
    // heightMm and thicknessMm (real sizes), and spineAuthor (defaults to the surname).
    // cover is a photo of the real front cover (put it in public/media/books/), and spineColour
    // the real spine colour as a hex value, picked from the cover. Heights are the editions' formats:
    // 23 cm literary paperbacks, 19 cm pocket editions (Debolsillo, Booket), 24 cm hardbacks.
    books: withNotes([
      // Debolsillo edition.
      { title: 'El infinito en un junco', author: 'Irene Vallejo', shelf: 'reading', kind: 'paperback', cover: '/media/books/el-infinito-en-un-junco.webp', heightMm: 190, spineColour: '#fefbe8' },

      { title: 'Good Strategy Bad Strategy', author: 'Richard Rumelt', shelf: 'work', kind: 'jacket', cover: '/media/books/good-strategy-bad-strategy.webp', heightMm: 240, spineColour: '#1a1a1a' },
      // 4th edition (Berklee Press).
      { title: 'Music Law in the Digital Age', author: 'Allen Bargfrede', shelf: 'work', kind: 'paperback', cover: '/media/books/music-law-in-the-digital-age.webp', heightMm: 229, spineColour: '#432b18' },
      { title: 'Inspired', author: 'Marty Cagan', shelf: 'work', kind: 'jacket', cover: '/media/books/inspired.webp', heightMm: 235, spineColour: '#ffffff' },
      { title: 'Never Split the Difference', author: 'Chris Voss', shelf: 'work', kind: 'jacket', cover: '/media/books/never-split-the-difference.webp', heightMm: 240, spineColour: '#f4bf16' },
      { title: 'Prophecy', author: 'Carissa Véliz', shelf: 'work', kind: 'jacket', cover: '/media/books/prophecy.webp', heightMm: 240, spineColour: '#72a471' },

      // Alfaguara edition.
      { title: 'La perra', author: 'Pilar Quintana', shelf: 'loved', kind: 'paperback', cover: '/media/books/la-perra.webp', heightMm: 230, spineColour: '#141414' },
      { title: 'Los abismos', author: 'Pilar Quintana', shelf: 'loved', kind: 'paperback', cover: '/media/books/los-abismos.webp', heightMm: 230, spineColour: '#090818' },
      { title: 'Lo que no tiene nombre', author: 'Piedad Bonnett', shelf: 'loved', kind: 'paperback', cover: '/media/books/lo-que-no-tiene-nombre.webp', heightMm: 230, spineColour: '#46221d' },
      // Jaramillo Klinkert and Pinkola Estés are double surnames, so the spines carry both.
      { title: 'Donde cantan las ballenas', author: 'Sara Jaramillo Klinkert', shelf: 'loved', spineAuthor: 'Jaramillo Klinkert', kind: 'paperback', cover: '/media/books/donde-cantan-las-ballenas.webp', heightMm: 230, spineColour: '#ffffff' },
      { title: 'Mujeres que corren con los lobos', author: 'Clarissa Pinkola Estés', shelf: 'loved', spineAuthor: 'Pinkola Estés', kind: 'paperback', cover: '/media/books/mujeres-que-corren-con-los-lobos.webp', heightMm: 230, spineColour: '#891a1e', thicknessMm: 40 },
      // Han is the family name, so the spine shows the full name rather than "Kang". The two lie in a pile.
      { title: 'La clase de griego', author: 'Han Kang', shelf: 'loved', spineAuthor: 'Han Kang', pose: 'flat', kind: 'paperback', cover: '/media/books/la-clase-de-griego.webp', heightMm: 230, spineColour: '#fefefe' },
      { title: 'La vegetariana', author: 'Han Kang', shelf: 'loved', spineAuthor: 'Han Kang', pose: 'flat', kind: 'paperback', cover: '/media/books/la-vegetariana.webp', heightMm: 230, spineColour: '#ffffff' },
      // Booket edition.
      { title: 'La ridícula idea de no volver a verte', author: 'Rosa Montero', shelf: 'loved', kind: 'paperback', cover: '/media/books/la-ridicula-idea-de-no-volver-a-verte.webp', heightMm: 190, spineColour: '#ffffff' },
    ]),
    emptyNote: 'The shelf is being arranged. Books will be here soon.',
  },

  music: {
    listening: {
      heading: 'What I’m listening to',
      description: '',
      liveLabel: 'Listening now',
      recentLabel: 'Last played',
      turntableLabel: 'On the turntable',
      // Plays on the record player whenever the live Spotify feed isn't available.
      onTurntable: {
        url: 'https://open.spotify.com/album/4SWs218VfFoKTFwbJOHdYK',
        title: 'Beethoven: Emperor Concerto',
        artist: 'Michal Mašek, Czech Chamber Philharmonic Orchestra Pardubice',
        cover: 'https://i.scdn.co/image/ab67616d00001e02e045bffd3d9732d5c2116e0e',
      },
    },
    collection: {
      heading: 'On my shelf of records',
      description: '',
      // Paste Spotify share links (Share → Copy link). Title and cover load automatically.
      // e.g. { url: 'https://open.spotify.com/album/…', subtitle: 'Artist name', note: 'Why I love it.' }
      items: [
        { url: 'https://open.spotify.com/artist/1hcdI2N1023RvSwLzTtdsp' },
        { url: 'https://open.spotify.com/playlist/3Vah9wEV94Rq8NB3zp5lGd', subtitle: 'MAREANA' },
        {
          // Spotify lists this Brendel release under its Japanese title.
          url: 'https://open.spotify.com/album/4Y4mgF194WkmMglJwJTueI',
          title: 'Beethoven: Piano Sonatas Nos. 29, 30, 31 & 32',
          subtitle: 'Alfred Brendel',
        },
        { url: 'https://open.spotify.com/artist/72VywtXEoONiBLNu3ibGI7' },
        { url: 'https://open.spotify.com/album/5K79FLRUCSysQnVESLcTdb', subtitle: 'Bad Bunny' },
        { url: 'https://open.spotify.com/album/3x8EqFhf17Rupeyh0k1a0H', subtitle: 'Jorge Drexler' },
        { url: 'https://open.spotify.com/album/27Bgt9kGMzZDG0P78mcxXt', subtitle: 'Puerto Candelaria' },
        {
          url: 'https://open.spotify.com/album/30isRfL4u7fowKgTVsydDt',
          title: 'Musas, Vol. 1',
          subtitle: 'Natalia Lafourcade, Los Macorinos',
        },
        { url: 'https://open.spotify.com/album/02m1qgJzjEADPa353lcevb', subtitle: 'Crudo Means Raw' },
        { url: 'https://open.spotify.com/album/7sK3EbpjZwqnqwMPMwkJIT', subtitle: 'András Schiff' },
        { url: 'https://open.spotify.com/playlist/6nQQkRhfBJ0ulQ2xh4fQWt', subtitle: 'Santiago Moncada' },
        { url: 'https://open.spotify.com/playlist/5ogFDPsZtO0QRwQQEgPA0r', subtitle: 'Santiago Moncada' },
      ],
    },
    podcasts: {
      heading: 'On my podcast shelf',
      description: '',
      // Spotify show links (Share → Copy link). Set title and cover for shows: Spotify's public
      // lookup returns the latest episode instead of the show. Optional: note, startWith, length.
      items: [
        {
          url: 'https://open.spotify.com/show/3skDSKvB1twtAxgLh0645y',
          title: 'El hilo',
          subtitle: 'Radio Ambulante Studios',
          cover: 'https://i.scdn.co/image/ab6765630000ba8ab34d1f3c49dbd604425b04d2',
        },
        {
          url: 'https://open.spotify.com/show/0J74zdNxUVWHq4gLoq8MqX',
          title: 'Radio Ambulante',
          subtitle: 'Radio Ambulante Studios',
          cover: 'https://i.scdn.co/image/ab6765630000ba8a1b0770711d6778f62714ec83',
        },
        {
          url: 'https://open.spotify.com/show/07H1d02UXSbKcQ8NQPn9h7',
          title: 'Presunto',
          cover: 'https://i.scdn.co/image/ab6765630000ba8a1a4b86dfab6db62ea6d30397',
        },
        {
          url: 'https://open.spotify.com/show/5KhMVavoTzH3ssVZTVJNwI',
          title: 'The Way Out Is In',
          subtitle: 'Plum Village',
          cover: 'https://i.scdn.co/image/ab6765630000ba8a94c31759a1c100471cdbec52',
        },
        {
          url: 'https://open.spotify.com/show/5MMXYd6TL3cTtbHNnCdeLG',
          title: 'El Topo',
          subtitle: 'La No Ficción',
          cover: 'https://i.scdn.co/image/ab6765630000ba8af5f8c2b9450fcad27be0d729',
        },
        {
          url: 'https://open.spotify.com/show/3xIalu2XhZ2EjSbOcTg0U8',
          title: 'DianaUribe.fm',
          subtitle: 'Diana Uribe',
          cover: 'https://i.scdn.co/image/ab6765630000ba8afaf77eb827242ed2816bda82',
        },
        {
          url: 'https://open.spotify.com/show/08F60fHBihlcqWZTr7Thzc',
          title: 'On Being with Krista Tippett',
          subtitle: 'On Being Studios',
          cover: 'https://i.scdn.co/image/ab6765630000ba8a41fbb5a24e3b3595e3221203',
        },
      ],
    },
    intro: '',
    cards: [],
    closing: '',
  },

  contact: {
    heading: 'Say hello',
    intro:
      'I’m always curious about what other people are working on. Feel free to reach out and tell me about it.',
    // The invitation, and the email action itself: it opens an email to this address with it as the subject.
    cta: 'Let’s chat',
    email: 'susipp93@gmail.com',
    emailAction: 'Send me an email',
    links: [
      {
        label: 'LinkedIn',
        href: 'https://www.linkedin.com/in/susana-pepo-pm',
        display: 'linkedin.com/in/susana-pepo-pm',
        action: 'Or find me on LinkedIn',
      },
    ],
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

  susana: {
    invite: 'Make yourself at home, have a look around',
    lines: [
      { about: 'books', text: 'Explore my favourite reads on the bookshelf.' },
      { about: 'vinyl', text: 'Curious what I’ve been listening to? Check out my records' },
      { about: 'laptop', text: 'Have a look at my laptop to see what I’ve been working on.' },
      { about: 'deskbooks', text: 'Explore my work story on the desk' },
      { about: 'coffee', text: 'Fancy a coffee and a chat?' },
      { about: 'cat', text: 'Meet Pola. She loves a little attention.' },
      { about: 'lamp', text: 'Too dark in here? Feel free to turn on the lamp.' },
      { about: 'piano', text: 'There’s a little piano on the shelf. Wanna jam a little?' },
    ],
  },

  discovery: {
    title: 'Explore the room',
    hint: 'Hover or tap the objects',
    dismissLabel: 'Dismiss hint',
    panStart: 'Look left in the room',
    panEnd: 'Look right in the room',
  },

  lamp: {
    hint: 'Switch the light',
    actionLabel: 'Switch the desk lamp on or off',
    tones: { warm: 'Lamp light on' },
    off: 'Lamp light off',
  },

  piano: {
    hint: 'Play the Pixel Jam Piano',
    actionLabel: 'Bring the Pixel Jam Piano close, to play it',
    closeUpLabel: 'Pixel Jam Piano',
    howTo: 'Play with A–K or tap the keys. Your first note starts a loop, and every note fits. Use the brass knobs for volume and the orange light to pause or resume.',
    close: 'Close',
    landscape: 'Landscape',
    landscapeHelp: 'The scene on the screen',
    loop: 'Loop',
    loopKnob: 'Loop',
    loopVolume: 'Loop volume',
    keysKnob: 'Keys',
    keysVolume: 'Keys volume',
    previous: 'Previous',
    next: 'Next',
    playLoop: 'Play the loop',
    pauseLoop: 'Pause the loop',
    loopCredit: 'Loop',
    by: 'by',
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
