import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { content } from '../../content/content'
import type { EducationEntry, ExperienceRole } from '../../content/types'
import { objectLabel, pad } from '../SectionPanel/folio'
import { DeskPile, pileColours, type DeskItem } from './experience/DeskPile'
import { spineTitle, startYear, yearsOf } from './experience/years'
import { Topics } from './Topics'

const TOOLKIT = 'toolkit'
const tabId = (item: { id: string }) => `cv-tab-${item.id}`
const pageId = (item: { id: string }) => `cv-page-${item.id}`

interface PileItem extends DeskItem {
  role?: ExperienceRole
  education?: EducationEntry
}

/**
 * Experience, set like my CV, on the desk.
 *
 * Learnfield is the focus: the company on the left (years, place, name, what
 * the work spanned, a cue), and its roles on the right as a pile of books, the
 * first role at the bottom and the latest on top. Choosing a book slides it out
 * and opens its role underneath; choosing it again closes it. At the end, a
 * smaller pile holds what sits outside any one job: my degree, and a thin
 * notebook of languages and tools.
 *
 * Figures from the PDF are left out until they can be backed up.
 */
export default function ExperienceSection() {
  const { experience } = content
  const { employer, roles, education } = experience
  const hasToolkit = experience.languages.length > 0 || experience.tools.length > 0
  const work = useMemo<PileItem[]>(
    () =>
      roles.map((role) => ({
        id: role.id,
        title: spineTitle(role.title),
        byline: startYear(role.period),
        label: `${role.title}, ${role.period}`,
        role,
      })),
    [roles],
  )

  /** Top of the pile first: the notebook, then the degrees. */
  const beyond = useMemo<PileItem[]>(
    () => [
      ...(hasToolkit ? [{ id: TOOLKIT, title: experience.toolkitTitle, kind: 'notebook' as const }] : []),
      ...education.map((entry) => ({
        id: entry.id,
        title: entry.spine ?? entry.qualification,
        byline: entry.spineNote,
        label: `${entry.qualification}, ${entry.institution}`,
        colour: 'oxblood' as const,
        education: entry,
      })),
    ],
    [education, hasToolkit, experience.toolkitTitle],
  )

  if (work.length === 0 && beyond.length === 0) return null

  return (
    <div className="section section--folio">
      <p className="lede cv-lede">{experience.intro}</p>

      <div className="cv-desk">
        {/* The company on the left, its role books on the right; the chosen role opens underneath. */}
        {work.length > 0 && (
          <Pile
            id="cv-employer"
            items={work}
            // Closed at first: the pile and its spines are the overview; a book opens its role.
            initial={null}
            label={objectLabel('experience') || 'The books on the desk'}
            lead={
              <div className="cv-company">
                {employer && (
                  <p className="cv-company__when">
                    {yearsOf(employer.period)} · {employer.location}
                  </p>
                )}
                <h3 id="cv-employer" className="cv-company__name">
                  {employer?.name ?? 'Work'}
                </h3>
                {employer?.focus && <p className="cv-company__focus">{employer.focus}</p>}
                <p className="cv-company__hint">{experience.pileHint}</p>
              </div>
            }
            render={(item) =>
              item.role ? (
                <RoleBody role={item.role} n={roles.length - roles.indexOf(item.role)} employer={employer?.name} />
              ) : null
            }
          />
        )}

        {/* What sits outside any one job: smaller, at the end. */}
        {beyond.length > 0 && (
          <Pile
            id="cv-beyond"
            items={beyond}
            initial={null}
            small
            label={experience.beyondTitle}
            head={
              <h3 id="cv-beyond" className="cv-background__title">
                {experience.beyondTitle}
              </h3>
            }
            render={(item) => (item.education ? <EducationBody entry={item.education} /> : <ToolkitBody title={item.title} />)}
          />
        )}
      </div>

      {__CV_PATH__ && (
        <p className="section__actions">
          <a className="text-link" href={__CV_PATH__} download>
            {experience.cvLabel}
          </a>
        </p>
      )}
    </div>
  )
}

/**
 * One pile on the desk, and the page of its chosen book open directly beneath
 * it. Each pile keeps its own choice, so moving between books never moves the
 * other pile. With `lead`, the pile sits beside that content (two columns,
 * stacking on narrow screens). With `initial` null, no page is open at first
 * and choosing the open book again closes it.
 */
function Pile({
  id,
  items,
  initial,
  label,
  head,
  lead,
  small = false,
  render,
}: {
  id?: string
  items: PileItem[]
  initial: string | null
  label: string
  head?: ReactNode
  lead?: ReactNode
  /** Drawn at about two thirds of the size, for supporting details. */
  small?: boolean
  render: (item: PileItem) => ReactNode
}) {
  const [selected, setSelected] = useState<string | null>(initial)
  const closable = initial === null
  // A page chosen with the keyboard changes instantly; one chosen by pointer fades in.
  const [instant, setInstant] = useState(true)
  const colours = useMemo(() => pileColours(items), [items])

  return (
    <section
      className={['cv-pile', lead && 'cv-pile--beside', small && 'cv-pile--small'].filter(Boolean).join(' ')}
      aria-labelledby={id}
      aria-label={id ? undefined : label}
    >
      {head && <header className="cv-pile__head">{head}</header>}
      {lead}
      <DeskPile
        entries={items}
        label={label}
        selected={selected ?? ''}
        tabId={tabId}
        panelId={pageId}
        onSelect={(item, byKeyboard) => {
          setInstant(byKeyboard)
          setSelected(closable && !byKeyboard && item.id === selected ? null : item.id)
        }}
      />
      {items.map((item, i) => (
        <Page key={item.id} item={item} colour={colours[i]!} hidden={item.id !== selected} instant={instant}>
          {render(item)}
        </Page>
      ))}
    </section>
  )
}

/** One open page, under the desk, in the colour of the book it came from. */
function Page({
  item,
  colour,
  hidden,
  instant,
  children,
}: {
  item: PileItem
  colour: string
  hidden: boolean
  instant: boolean
  children: ReactNode
}) {
  return (
    <article
      id={pageId(item)}
      role="tabpanel"
      aria-labelledby={tabId(item)}
      className="cv-page"
      hidden={hidden}
      data-instant={instant ? '' : undefined}
      style={{ '--book': colour } as CSSProperties}
    >
      {children}
    </article>
  )
}

function RoleBody({ role, n, employer }: { role: ExperienceRole; n: number; employer?: string }) {
  return (
    <>
      <p className="cv-page__chapter">
        <span className="cv-page__n">{pad(n)}</span>
        <span>{role.stage}</span>
      </p>
      <h4 className="cv-page__title">{role.title}</h4>
      <p className="cv-page__period">
        {employer ? `${employer}, ` : ''}
        {role.period}
      </p>
      {role.points.length > 0 && (
        <ul className="cv-points" role="list">
          {role.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
      {role.skills.length > 0 && (
        <div className="cv-page__skills">
          <Topics label={`Skills in ${role.title}`} items={role.skills} />
        </div>
      )}
    </>
  )
}

function EducationBody({ entry }: { entry: EducationEntry }) {
  return (
    <>
      <p className="cv-page__chapter">
        <span>Education</span>
      </p>
      <h4 className="cv-page__title">{entry.qualification}</h4>
      <p className="cv-page__period">
        {entry.institution}
        {entry.period ? `, ${entry.period}` : ''}
      </p>
    </>
  )
}

function ToolkitBody({ title }: { title: string }) {
  const { languages, tools } = content.experience
  return (
    <>
      <h4 className="cv-page__title">{title}</h4>
      <dl className="cv-facts">
        {languages.length > 0 && (
          <div>
            <dt>Languages</dt>
            <dd>
              <Topics label="Languages" items={languages} />
            </dd>
          </div>
        )}
        {tools.length > 0 && (
          <div>
            <dt>Tools</dt>
            <dd>
              <Topics label="Tools" items={tools} />
            </dd>
          </div>
        )}
      </dl>
    </>
  )
}
