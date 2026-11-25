import { useMemo, useState, type ReactNode } from "react";
import { content } from "../../content/content";
import type {
  BookColour,
  EducationEntry,
  ExperienceRole,
} from "../../content/types";
import { prefersReducedMotion } from "../../lib/motion";
import { DeskPile, type DeskItem } from "./experience/DeskPile";
import { spineTitle, startYear, yearsOf } from "./experience/years";
import { Topics } from "./Topics";

const TOOLKIT = "toolkit";
const CV = "cv";
const EDUCATION = "education";
const tabId = (item: { id: string }) => `cv-tab-${item.id}`;
/** Books for employers after the latest, so each pile reads as its own (the latest takes the desk's bindings in turn). */
const EARLIER_COLOURS: (BookColour | undefined)[] = ["terracotta", "rose"];
const pageId = (item: { id: string }) => `cv-page-${item.id}`;

interface PileItem extends DeskItem {
  role?: ExperienceRole;
}

/**
 * Experience, set like my CV, on the desk.
 *
 * Each employer is a row, newest first: the company on the left (years, place
 * and name), and its roles on the right as a pile of books, the first role at
 * the bottom and the latest on top. Choosing a book slides it out
 * and opens its role underneath; choosing it again closes it. At the end, a
 * smaller pile holds what sits outside any one job: my CV, a thin notebook of
 * languages and tools, and my degrees.
 *
 * Figures from the PDF are left out until they can be backed up.
 */
export default function ExperienceSection() {
  const { experience } = content;
  const { employers, education } = experience;
  const hasToolkit =
    experience.languages.length > 0 || experience.tools.length > 0;
  /** One pile per employer, newest first; each role a book, the latest on top. */
  const work = useMemo(
    () =>
      employers
        .filter((employer) => employer.roles.length > 0)
        .map((employer, e) => ({
          employer,
          headingId: `cv-employer-${e}`,
          items: employer.roles.map(
            (role): PileItem => ({
              id: role.id,
              title: spineTitle(role.title),
              byline: startYear(role.period),
              label: `${role.title}, ${role.period}`,
              // The latest employer takes the desk's bindings in turn; earlier ones their own colour.
              colour: EARLIER_COLOURS[e - 1],
              role,
            }),
          ),
        })),
    [employers],
  );

  /** Top of the pile first: my CV (when the PDF is there), the notebook, then the degrees. */
  const beyond = useMemo<PileItem[]>(
    () => [
      ...(__CV_PATH__
        ? [
            {
              id: CV,
              title: experience.cvTitle,
              byline: "PDF",
              label: `${experience.cvTitle}, to download as a PDF`,
              kind: "document" as const,
            },
          ]
        : []),
      ...(hasToolkit
        ? [
            {
              id: TOOLKIT,
              title: experience.toolkitTitle,
              kind: "notebook" as const,
            },
          ]
        : []),
      // One book for every degree, the letters of each on its spine; its page lists them, newest first.
      ...(education.length > 0
        ? [
            {
              id: EDUCATION,
              title: experience.educationTitle,
              byline: education
                .map((entry) => entry.spineNote)
                .filter(Boolean)
                .join(" · "),
              label: `${experience.educationTitle}: ${education
                .map((entry) => `${entry.qualification}, ${entry.institution}`)
                .join("; ")}`,
              colour: "oxblood" as const,
            },
          ]
        : []),
    ],
    [
      education,
      hasToolkit,
      experience.toolkitTitle,
      experience.cvTitle,
      experience.educationTitle,
    ],
  );

  if (work.length === 0 && beyond.length === 0) return null;

  return (
    <div className="section section--folio">
      <p className="lede cv-lede">{experience.intro}</p>

      <div className="cv-desk">
        {/* Each company on the left, its role books on the right; the chosen role opens underneath. */}
        {work.map(({ employer, headingId, items }) => (
          <Pile
            key={headingId}
            id={headingId}
            items={items}
            // Closed at first: the pile and its spines are the overview; a book opens its role.
            initial={null}
            label={`Roles at ${employer.name}`}
            lead={
              <div className="cv-company">
                <p className="cv-company__when">
                  {keepTogether(yearsOf(employer.period))} ·{" "}
                  {keepTogether(employer.location)}
                </p>
                <h3 id={headingId} className="cv-company__name">
                  {employer.name}
                </h3>
              </div>
            }
            render={(item) =>
              item.role ? (
                <RoleBody role={item.role} employer={employer.name} />
              ) : null
            }
          />
        ))}

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
            render={(item) =>
              item.id === CV ? (
                <CvBody />
              ) : item.id === EDUCATION ? (
                <EducationBody entries={education} />
              ) : (
                <ToolkitBody title={item.title} />
              )
            }
          />
        )}
      </div>
    </div>
  );
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
  id?: string;
  items: PileItem[];
  initial: string | null;
  label: string;
  head?: ReactNode;
  lead?: ReactNode;
  /** Drawn at about two thirds of the size, for supporting details. */
  small?: boolean;
  render: (item: PileItem) => ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  const closable = initial === null;
  // A page chosen with the keyboard changes instantly; one chosen by pointer fades in.
  const [instant, setInstant] = useState(true);

  return (
    <section
      className={[
        "cv-pile",
        lead && "cv-pile--beside",
        small && "cv-pile--small",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={id}
      aria-label={id ? undefined : label}
    >
      {head && <header className="cv-pile__head">{head}</header>}
      {lead}
      <DeskPile
        entries={items}
        label={label}
        selected={selected ?? ""}
        tabId={tabId}
        panelId={pageId}
        onSelect={(item, byKeyboard) => {
          setInstant(byKeyboard);
          const next =
            closable && !byKeyboard && item.id === selected ? null : item.id;
          setSelected(next);
          // On a phone the page opens below the fold: bring it up, or the tap seems to do nothing.
          // Not for the keyboard, whose focus stays on the pile.
          if (next && !byKeyboard) revealPage(pageId(item));
        }}
      />
      {items.map((item) => (
        <Page
          key={item.id}
          item={item}
          hidden={item.id !== selected}
          instant={instant}
          onClose={
            closable
              ? () => {
                  setSelected(null);
                  putBack(tabId(item));
                }
              : undefined
          }
        >
          {render(item)}
        </Page>
      ))}
    </section>
  );
}

/** The desktop panel, floating beside the room (the same breakpoint as its CSS). */
const DESKTOP = "(min-width: 1025px)";

/** "2022 to 2026", "Berlin, Germany": a short phrase that should never break inside. */
const keepTogether = (text: string) => text.replace(/ /g, "\u00a0");

/**
 * Scroll a page that has just opened into view, if it starts too low in the panel to be
 * seen (on a phone, below the pile). Waits a frame for it to be shown.
 */
function revealPage(id: string) {
  requestAnimationFrame(() => {
    const page = document.getElementById(id);
    const scroller = page?.closest(".panel__body");
    if (!page || !scroller) return;
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    const box = page.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    // Desktop: the panel is short, and a page opening under its row often shows only its
    // top. Bring up just enough to show all of it, keeping the books above in view where
    // it fits; a page taller than the panel comes up to its top.
    if (window.matchMedia(DESKTOP).matches) {
      const margin = 24;
      const below = box.bottom + margin - view.bottom;
      if (below > 0) {
        scroller.scrollBy({
          top: Math.max(0, Math.min(below, box.top - view.top - margin)),
          behavior,
        });
      }
      return;
    }
    // Less than about four lines of it showing: bring its top up.
    if (box.top > view.bottom - 96) {
      page.scrollIntoView({ block: "start", behavior });
    }
  });
}

/**
 * After a page is closed from inside it, its button is gone: focus goes back to its book,
 * and the pile comes back into view if the page had been scrolled past it.
 */
function putBack(id: string) {
  requestAnimationFrame(() => {
    const tab = document.getElementById(id);
    if (!tab) return;
    tab.focus({ preventScroll: true });
    tab.closest(".cv-pile")?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  });
}

/** One open page, under the desk. */
function Page({
  item,
  hidden,
  instant,
  onClose,
  children,
}: {
  item: PileItem;
  hidden: boolean;
  instant: boolean;
  /** Puts the book back on its pile: a quiet control at the page's top right. */
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <article
      id={pageId(item)}
      role="tabpanel"
      aria-labelledby={tabId(item)}
      className="cv-page"
      hidden={hidden}
      data-instant={instant ? "" : undefined}
    >
      {onClose && (
        <button
          type="button"
          className="cv-page__close"
          aria-label={`Close ${item.title}`}
          onClick={onClose}
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M2.5 7.75 6 4.25l3.5 3.5" />
          </svg>
        </button>
      )}
      {children}
    </article>
  );
}

function RoleBody({
  role,
  employer,
}: {
  role: ExperienceRole;
  employer?: string;
}) {
  return (
    <>
      <h4 className="cv-page__title">{role.title}</h4>
      <p className="cv-page__period">
        {employer ? `${employer}, ` : ""}
        {role.period}
      </p>
      {role.points.length > 0 && (
        <ul className="cv-points" role="list">
          {role.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Every degree, newest first, each as a role is set: the qualification, then where and when. */
function EducationBody({ entries }: { entries: readonly EducationEntry[] }) {
  return (
    <ul className="cv-degrees" role="list">
      {entries.map((entry) => (
        <li key={entry.id} className="cv-degree">
          <h4 className="cv-page__title">{entry.qualification}</h4>
          <p className="cv-page__period">
            {entry.institution}
            {entry.period ? `, ${entry.period}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ToolkitBody({ title }: { title: string }) {
  const { languages, tools } = content.experience;
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
  );
}

/**
 * My CV, opened from its folder on the pile: a copy of its first page laid on the desk like
 * the portrait print on About, and the download beside it.
 */
function CvBody() {
  const { experience } = content;
  return (
    <div className="cv-print">
      <a
        className="cv-print__sheet"
        href={__CV_PATH__}
        download
        tabIndex={-1}
        aria-hidden="true"
      >
        <img
          src="/cv/cv-page.webp"
          alt=""
          width={240}
          height={339}
          decoding="async"
          loading="lazy"
        />
      </a>
      <div className="cv-print__text">
        <h4 className="cv-page__title">{experience.cvTitle}</h4>
        <a className="text-link cv-print__link" href={__CV_PATH__} download>
          {experience.cvLabel}
        </a>
      </div>
    </div>
  );
}
