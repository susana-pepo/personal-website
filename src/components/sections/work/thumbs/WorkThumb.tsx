import { useId, type CSSProperties, type ReactNode } from "react";
import { safeId } from "../../books/defs";
import { GROUND, P, SHADOW, type ThumbKind } from "./palette";
import "./work-thumbs.css";

/**
 * Drawn thumbnails for the Work grid: each piece of work as a small object seen
 * from above, lying on a room-coloured surface, lit from the lamp on the right
 * so shadows fall down and to the left. No text inside the drawings; the
 * caption beside them carries the words. Decorative, so hidden from screen readers.
 *
 * Each has one small motion, played once when its tile is hovered or focused
 * (see work-thumbs.css). Nothing loops.
 */
export function WorkThumb({ kind }: { kind: ThumbKind }) {
  const id = safeId(useId());
  const Drawing = DRAWINGS[kind];
  return (
    <svg
      className="wthumb"
      data-kind={kind}
      viewBox="0 0 320 240"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter
          id={`${id}-shadow`}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={`${id}-soft`} x="-50%" y="-10%" width="200%" height="120%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.14  0 0 0 0 0.1  0 0 0 0.09 0" />
        </filter>
      </defs>
      <rect width="320" height="240" fill={GROUND[kind]} />
      <Drawing id={id} />
      <rect width="320" height="240" filter={`url(#${id}-grain)`} />
    </svg>
  );
}

const DRAWINGS: Record<ThumbKind, (props: { id: string }) => ReactNode> = {
  keys: Keys,
  guide: Guide,
  ledger: Ledger,
  plan: Plan,
  network: Network,
};

/** A soft shadow cast down and to the left, from a shape's outline. */
function Shadow({
  id,
  children,
  opacity = 0.34,
}: {
  id: string;
  children: ReactNode;
  opacity?: number;
}) {
  return (
    <g
      filter={`url(#${id}-shadow)`}
      opacity={opacity}
      transform="translate(-7 8)"
      fill={SHADOW}
    >
      {children}
    </g>
  );
}

/* ── Chord builder: one octave, C major pressed ── */
const KEY_X0 = 44;
const KEY_W = 29;
const BLACK_AFTER = [1, 2, 4, 5, 6];
const PRESSED = [0, 2, 4];

function Keys({ id }: { id: string }) {
  return (
    <>
      <Shadow id={id}>
        <rect x="38" y="50" width="244" height="138" rx="4" />
      </Shadow>
      {/* The cheek block and its felt strip. */}
      <rect x="38" y="50" width="244" height="24" rx="4" fill={P.ink} />
      <rect x="38" y="70" width="244" height="3" fill={P.terracotta} />
      {Array.from({ length: 8 }, (_, k) => {
        const x = KEY_X0 + k * KEY_W;
        const pressed = PRESSED.includes(k);
        return (
          <rect
            key={k}
            className={pressed ? "wt-key" : undefined}
            style={
              pressed
                ? ({ "--i": PRESSED.indexOf(k) } as CSSProperties)
                : undefined
            }
            x={x + 0.5}
            y="73"
            width={KEY_W - 1}
            height="114"
            rx="2"
            fill={pressed ? P.shade : P.card}
            stroke={P.ink3}
            strokeOpacity="0.35"
            strokeWidth="0.8"
          />
        );
      })}
      {BLACK_AFTER.map((k) => {
        const x = KEY_X0 + k * KEY_W - 8.5;
        return (
          <g key={k}>
            <rect x={x} y="73" width="17" height="70" rx="1.8" fill={P.ink} />
            <rect
              x={x + 3}
              y="76"
              width="11"
              height="58"
              rx="1.2"
              fill="oklch(0.3 0.01 45)"
            />
          </g>
        );
      })}
      {PRESSED.map((k, i) => (
        <circle
          key={k}
          className="wt-note"
          style={{ "--i": i } as CSSProperties}
          cx={KEY_X0 + k * KEY_W + KEY_W / 2}
          cy="170"
          r="4.5"
          fill={P.spot}
        />
      ))}
    </>
  );
}

/* ── PM frameworks guidebook: an open field guide with tabs ── */
const TABS = [
  { y: 58, fill: P.teal },
  { y: 80, fill: P.terracotta },
  { y: 102, fill: P.ink },
  { y: 124, fill: P.rose },
];
const BARS = [48, 36, 28, 20, 12];

function Guide({ id }: { id: string }) {
  return (
    <>
      <Shadow id={id} opacity={0.26}>
        <rect x="40" y="42" width="246" height="160" rx="4" />
      </Shadow>
      {TABS.map((tab, i) => (
        <rect
          key={tab.y}
          className="wt-tab"
          style={{ "--i": i } as CSSProperties}
          x="274"
          y={tab.y}
          width="14"
          height="14"
          rx="1.5"
          fill={tab.fill}
        />
      ))}
      <rect x="40" y="42" width="240" height="160" rx="4" fill={P.slate} />
      <rect x="46" y="46" width="113" height="152" rx="1.5" fill={P.card} />
      <rect x="161" y="46" width="113" height="152" rx="1.5" fill={P.card} />
      <rect
        x="156"
        y="46"
        width="8"
        height="152"
        fill={SHADOW}
        opacity="0.16"
        filter={`url(#${id}-soft)`}
      />

      {/* Left page: a heading, then a 2×2 with a few items placed in it. */}
      <rect x="58" y="60" width="46" height="4.5" rx="1" fill={P.ink2} />
      <rect
        x="58"
        y="70"
        width="72"
        height="2.5"
        rx="1"
        fill={P.ink3}
        opacity="0.7"
      />
      <path d="M102 90 V172 M62 131 H142" stroke={P.ink3} strokeWidth="0.9" />
      <circle cx="84" cy="108" r="4" fill={P.teal} />
      <circle cx="122" cy="150" r="4" fill={P.terracotta} />
      <circle cx="80" cy="156" r="4" fill={P.ochre} />
      <circle cx="124" cy="106" r="4" fill={P.spot} />

      {/* Right page: a ranked list. */}
      <rect x="174" y="60" width="54" height="4.5" rx="1" fill={P.ink2} />
      {BARS.map((w, i) => {
        const y = 84 + i * 18;
        return (
          <g key={w}>
            <rect
              x="174"
              y={y}
              width="28"
              height="2.5"
              rx="1"
              fill={P.ink3}
              opacity="0.7"
            />
            <rect
              className={i === 0 ? "wt-bar" : undefined}
              x="210"
              y={y - 2}
              width={w}
              height="6.5"
              rx="1.2"
              fill={i === 0 ? P.spot : P.ink2}
              opacity={i === 0 ? 1 : 0.42}
            />
          </g>
        );
      })}
      <rect
        x="157"
        y="196"
        width="5"
        height="22"
        rx="1"
        fill={P.terracotta}
        transform="rotate(6 159 196)"
      />
    </>
  );
}

/* ── Licensing engine: a ledger of works, each with its share split ── */
const ROWS: {
  title: number;
  split: number[];
  mark: "check" | "flag" | null;
}[] = [
  { title: 52, split: [0.5, 0.3, 0.2], mark: "check" },
  { title: 40, split: [0.7, 0.3], mark: "check" },
  { title: 60, split: [0.4, 0.35, 0.25], mark: "check" },
  { title: 34, split: [1], mark: "check" },
  { title: 48, split: [0.6, 0.25, 0.15], mark: "flag" },
  { title: 44, split: [0.5, 0.5], mark: "check" },
];
const SPLIT_COLOURS = [P.terracotta, P.teal, P.ochre, P.slate];
const BAR_X = 140;
const BAR_W = 80;

function Ledger({ id }: { id: string }) {
  let check = 0;
  return (
    <>
      <Shadow id={id}>
        <rect
          x="58"
          y="38"
          width="200"
          height="166"
          transform="rotate(-2.5 158 121)"
        />
      </Shadow>
      <rect
        x="72"
        y="40"
        width="196"
        height="164"
        rx="1.5"
        fill={P.shade}
        transform="rotate(4 170 122)"
      />
      <g transform="rotate(-2.5 158 121)">
        <rect x="58" y="38" width="200" height="166" rx="1.5" fill={P.card} />
        <rect x="74" y="54" width="60" height="5" rx="1" fill={P.ink2} />
        <rect
          x="74"
          y="64"
          width="92"
          height="2.5"
          rx="1"
          fill={P.ink3}
          opacity="0.7"
        />
        <path d="M74 77 H242" stroke={P.ink3} strokeWidth="0.8" />
        {ROWS.map((row, i) => {
          const y = 90 + i * 19;
          let x = BAR_X;
          return (
            <g key={i}>
              <rect
                x="74"
                y={y - 1.5}
                width={row.title}
                height="3"
                rx="1"
                fill={P.ink2}
                opacity="0.6"
              />
              {row.split.map((share, s) => {
                const w = share * BAR_W;
                const seg = (
                  <rect
                    key={s}
                    x={x}
                    y={y - 3.5}
                    width={w - 1}
                    height="7"
                    fill={SPLIT_COLOURS[s]}
                  />
                );
                x += w;
                return seg;
              })}
              {row.mark === "check" && (
                <path
                  className="wt-check"
                  style={{ "--i": check++ } as CSSProperties}
                  d={`M229 ${y} l3.2 3.2 l6.4 -7`}
                  fill="none"
                  stroke={P.ink2}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength="1"
                />
              )}
              {row.mark === "flag" && (
                <circle
                  cx="234"
                  cy={y}
                  r="3.6"
                  fill="none"
                  stroke={P.spot}
                  strokeWidth="1.6"
                />
              )}
            </g>
          );
        })}
      </g>
    </>
  );
}

/* ── Apartment studio: a floor plan, furnished ── */
const PLAN_GRID = (() => {
  const d: string[] = [];
  for (let y = 46; y <= 196; y += 12) d.push(`M48 ${y} H272`);
  for (let x = 54; x <= 270; x += 12) d.push(`M${x} 40 V200`);
  return d.join(" ");
})();

function Plan({ id }: { id: string }) {
  return (
    <>
      <Shadow id={id}>
        <rect
          x="42"
          y="34"
          width="236"
          height="172"
          transform="rotate(1.5 160 120)"
        />
      </Shadow>
      <g transform="rotate(1.5 160 120)">
        <rect x="42" y="34" width="236" height="172" rx="1.5" fill={P.card} />
        <path
          d={PLAN_GRID}
          stroke={P.slate}
          strokeOpacity="0.1"
          strokeWidth="0.7"
        />
        {/* Walls, with a door in the outer wall and one between the rooms. */}
        <path
          d="M76 60 H244 V180 H150 M170 60 V108 M170 132 V180"
          fill="none"
          stroke={P.ink}
          strokeWidth="5"
          strokeLinecap="square"
        />
        <path
          d="M126 180 H76 V60"
          fill="none"
          stroke={P.ink}
          strokeWidth="5"
          strokeLinecap="square"
        />
        <rect
          x="100"
          y="57.5"
          width="44"
          height="5"
          fill={P.card}
          stroke={P.ink}
          strokeWidth="0.8"
        />
        <path d="M126 180 V156" stroke={P.ink} strokeWidth="1.6" />
        <path
          d="M126 156 A24 24 0 0 1 150 180"
          fill="none"
          stroke={P.ink3}
          strokeWidth="0.8"
        />
        <path d="M170 108 H192" stroke={P.ink} strokeWidth="1.6" />
        <path
          d="M192 108 A22 22 0 0 1 170 130"
          fill="none"
          stroke={P.ink3}
          strokeWidth="0.8"
        />

        <g className="wt-bed">
          <rect x="88" y="72" width="46" height="62" rx="2.5" fill={P.teal} />
          <rect x="92" y="76" width="18" height="10" rx="2" fill={P.card} />
          <rect x="112" y="76" width="18" height="10" rx="2" fill={P.card} />
          <path
            d="M88 108 H134"
            stroke={P.card}
            strokeOpacity="0.5"
            strokeWidth="1"
          />
        </g>
        <rect x="140" y="72" width="13" height="13" rx="1.5" fill={P.ochre} />
        <circle cx="212" cy="104" r="13" fill={P.ochre} />
        <g className="wt-sofa">
          <rect
            x="188"
            y="148"
            width="46"
            height="20"
            rx="3"
            fill={P.terracotta}
          />
          <rect
            x="188"
            y="162"
            width="46"
            height="6"
            rx="2"
            fill={SHADOW}
            opacity="0.22"
          />
        </g>
        <path
          d="M76 194 H244 M76 190 V198 M244 190 V198"
          stroke={P.spot}
          strokeWidth="1.2"
        />
      </g>
    </>
  );
}

/* ── Rights intelligence: a pencilled sketch of works, owners and contracts ── */
const WORKS = [76, 116, 156];
const OWNERS = [94, 148];
const CONTRACTS = [82, 152];
const EDGES = [
  `M82 ${WORKS[0]} L152 ${OWNERS[0]}`,
  `M82 ${WORKS[1]} L152 ${OWNERS[0]}`,
  `M82 ${WORKS[1]} L152 ${OWNERS[1]}`,
  `M82 ${WORKS[2]} L152 ${OWNERS[1]}`,
  `M168 ${OWNERS[0]} L234 ${CONTRACTS[0]}`,
  `M168 ${OWNERS[0]} L234 ${CONTRACTS[1]}`,
  `M168 ${OWNERS[1]} L234 ${CONTRACTS[1]}`,
];

const NET_DOTS = (() => {
  const d: string[] = [];
  for (let x = 52; x <= 270; x += 14)
    for (let y = 46; y <= 196; y += 14) d.push(`M${x} ${y}h0.01`);
  return d.join("");
})();

function Network({ id }: { id: string }) {
  return (
    <>
      <Shadow id={id}>
        <rect
          x="40"
          y="34"
          width="240"
          height="172"
          transform="rotate(-1.5 160 120)"
        />
      </Shadow>
      <g transform="rotate(-1.5 160 120)">
        <rect x="40" y="34" width="240" height="172" rx="1.5" fill={P.card} />
        <path
          d={NET_DOTS}
          stroke={P.ink3}
          strokeOpacity="0.35"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {EDGES.map((d, i) => (
          <path
            key={d}
            className="wt-edge"
            style={{ "--i": i } as CSSProperties}
            d={d}
            stroke={P.ink3}
            strokeWidth="1.2"
            strokeDasharray="4 3.5"
            fill="none"
          />
        ))}
        {WORKS.map((y) => (
          <rect
            key={y}
            x="64"
            y={y - 9}
            width="18"
            height="18"
            rx="2"
            fill={P.card}
            stroke={P.ink2}
            strokeWidth="1.3"
          />
        ))}
        {OWNERS.map((y) => (
          <circle
            key={y}
            cx="160"
            cy={y}
            r="9"
            fill={P.card}
            stroke={P.ink2}
            strokeWidth="1.3"
          />
        ))}
        {CONTRACTS.map((y) => (
          <g key={y}>
            <rect
              x="234"
              y={y - 11}
              width="22"
              height="22"
              rx="1.5"
              fill={P.card}
              stroke={P.ink2}
              strokeWidth="1.3"
            />
            <path
              d={`M239 ${y - 4} h12 M239 ${y + 1} h12 M239 ${y + 6} h7`}
              stroke={P.ink3}
              strokeWidth="1"
            />
          </g>
        ))}
        {/* In progress: a ring not yet closed. */}
        <circle
          className="wt-ring"
          cx="160"
          cy={OWNERS[1]}
          r="15"
          fill="none"
          stroke={P.spot}
          strokeWidth="1.8"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray="0.72 1"
          transform={`rotate(-90 160 ${OWNERS[1]})`}
        />
      </g>
    </>
  );
}
