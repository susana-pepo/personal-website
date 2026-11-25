import { useMemo, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { PALETTE, specFor } from "../../../content/bookGeometry";
import type { Book, BookColour, BookKind } from "../../../content/types";
import { BookSpine } from "../books/BookSpine";
import { ShelfBoard } from "../books/ShelfBoard";
import { ShelfDefs } from "../books/ShelfDefs";
// The shared book drawing's styles (.bs-board, .bs-shade, .bs-t-*) still live in the Bookshelf's sheet.
import "../bookshelf/bookshelf.css";
import "./desk-pile.css";

/* Bindings and room colours, taken in turn. Sizes in millimetres, as for real books. */
const BINDINGS: {
  kind: BookKind;
  colour: BookColour;
  heightMm: number;
  thicknessMm: number;
  dx: number;
}[] = [
  // Dust jackets only: their titles are printed in near-white on a dark spine, the
  // most legible lying down. Cloth debosses its title and leather gilds it, both too faint.
  { kind: "jacket", colour: "teal", heightMm: 214, thicknessMm: 40, dx: 10 },
  { kind: "jacket", colour: "slate", heightMm: 234, thicknessMm: 38, dx: 2 },
  { kind: "jacket", colour: "walnut", heightMm: 224, thicknessMm: 42, dx: 14 },
  { kind: "jacket", colour: "oxblood", heightMm: 245, thicknessMm: 44, dx: 0 },
];

/** A document: the CV, in a slim card folder laid on top, set furthest back so it reads as paper, not a book. */
const DOCUMENT = {
  kind: "paperback",
  colour: "card",
  heightMm: 212,
  thicknessMm: 26,
  dx: 30,
} as const;

/** The notebook: a thin ochre paperback, set a little back on the pile, so it reads as a different object. */
const NOTEBOOK = {
  kind: "paperback",
  colour: "ochre",
  heightMm: 196,
  thicknessMm: 30,
  dx: 22,
} as const;

type Binding = {
  kind: BookKind;
  colour: BookColour;
  heightMm: number;
  thicknessMm: number;
  dx: number;
};

/** Books take the bindings in turn (or their own colour); a notebook always looks like the notebook. */
function bindingsFor(entries: readonly DeskItem[]): Binding[] {
  let n = 0;
  return entries.map((entry): Binding => {
    if (entry.kind === "notebook") return NOTEBOOK;
    if (entry.kind === "document") return DOCUMENT;
    const binding = BINDINGS[n++ % BINDINGS.length]!;
    return entry.colour ? { ...binding, colour: entry.colour } : binding;
  });
}

/** The room colour each entry is drawn in, in order, so a page can match its book. */
export function pileColours(entries: readonly DeskItem[]): string[] {
  return bindingsFor(entries).map((b) => PALETTE[b.colour].c);
}

/** Desk books carry a short title, so they are drawn longer than shelf books to give it room. */
const LENGTHEN = 1.5;

/** One book on the desk: its spine title, and an optional second line (drawn where an author would be). */
export interface DeskItem {
  id: string;
  title: string;
  byline?: string;
  /** Read out in full by assistive tech; defaults to the title. */
  label?: string;
  /** A book (the default), the notebook, or a document (the CV, in a thin card folder). */
  kind?: "book" | "notebook" | "document";
  /** A room colour for this book, instead of the next in turn. */
  colour?: BookColour;
}

interface DeskPileProps<T extends DeskItem> {
  entries: readonly T[];
  label: string;
  /** The chosen entry's id; empty or another pile's id when none here is chosen. */
  selected: string;
  tabId: (entry: T) => string;
  panelId: (entry: T) => string;
  /** `byKeyboard`: chosen with the arrow keys, so the page should change without animating. */
  onSelect: (entry: T, byKeyboard: boolean) => void;
}

/**
 * One drawn book per entry, lying in a pile on the desk, first entry on top.
 * The pile is a vertical tab list: the chosen book slides out of the pile and
 * its page opens under the desk. Up and Down move between books (wrapping),
 * Home and End jump to the top and bottom.
 */
export function DeskPile<T extends DeskItem>({
  entries,
  label,
  selected,
  tabId,
  panelId,
  onSelect,
}: DeskPileProps<T>) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const books = useMemo(
    () =>
      bindingsFor(entries).map((binding, i) => {
        const entry = entries[i]!;
        const book: Book = {
          title: entry.title,
          author: entry.byline ?? "",
          // Printed as given ("MA · BA"), not cut to its last word as an author's surname is.
          spineAuthor: entry.byline ?? "",
          shelf: "loved",
          ...binding,
        };
        // One jacket design for every book (title, then year, then a light foot band), so the pile reads as a set.
        const spec = { ...specFor(book), variant: 0, alt: PALETTE.card };
        return {
          entry,
          book,
          spec,
          length: Math.round(spec.height * LENGTHEN),
          dx: binding.dx,
        };
      }),
    [entries],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const focused = tabs.current.findIndex((t) => t === document.activeElement);
    const current =
      focused >= 0 ? focused : entries.findIndex((e) => e.id === selected);
    const last = entries.length - 1;
    const next =
      event.key === "ArrowDown"
        ? (current + 1) % entries.length
        : event.key === "ArrowUp"
          ? (current - 1 + entries.length) % entries.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null || current < 0) return;
    event.preventDefault();
    const entry = entries[next]!;
    onSelect(entry, true);
    tabs.current[next]?.focus();
  };

  return (
    <div className="xp-desk">
      <ShelfDefs />
      <ol
        className="xp-pile"
        role="tablist"
        aria-orientation="vertical"
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        {books.map(({ entry, book, spec, length, dx }, i) => {
          const isSelected = entry.id === selected;
          // One book per pile is reachable with Tab: the chosen one, or the top one if the choice is in another pile.
          const tabStop =
            isSelected || (i === 0 && !entries.some((e) => e.id === selected));
          return (
            <li
              key={entry.id}
              role="presentation"
              className="xp-pile__item"
              style={
                {
                  "--w": length,
                  "--h": spec.thick,
                  "--dx": dx,
                  "--b": books.length - 1 - i,
                } as CSSProperties
              }
            >
              <button
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={tabId(entry)}
                className="xp-book"
                aria-label={entry.label ?? entry.title}
                aria-selected={isSelected}
                aria-controls={panelId(entry)}
                tabIndex={tabStop ? 0 : -1}
                onClick={() => onSelect(entry, false)}
              >
                <span className="xp-book__rot">
                  <BookSpine book={book} spec={spec} h={length} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <ShelfBoard className="bs-board xp-desk__board" />
    </div>
  );
}
