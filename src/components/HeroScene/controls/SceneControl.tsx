import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { content } from '../../../content/content'
import { TIMES, type TimeOfDay } from '../../../scene/windowViews'
import { optionForKey } from '../../../lib/radioGroup'
import type { Weather } from '../../../scene/weather'
import './SceneControl.css'

export { TIMES, type TimeOfDay }

/**
 * The time a key moves to from `current`, or null for a key the group ignores.
 * Arrows step and wrap (Right/Down forward, Left/Up back); Home and End jump to the ends.
 */
export function timeForKey(current: TimeOfDay, key: string): TimeOfDay | null {
  return optionForKey(TIMES, current, key)
}

/** How long an option's name stays up after a tap, where there is no hover to show it. */
const NAME_HOLD_MS = 1600

interface SceneControlProps {
  value: TimeOfDay
  /** Called on every choice, including the time already shown (the visitor has now chosen it). */
  onChange: (next: TimeOfDay) => void
  weather: Weather
  /** The weathers on offer, in order. */
  weathers: readonly Weather[]
  onWeatherChange: (next: Weather) => void
}

/**
 * The scene control, at the far right of the masthead (the room draws it there
 * through a portal): a quiet "Scene" caption beside two small glass pills, the
 * time of day (dawn, midday, night) and the weather (clear, rain, snow). Each is
 * a radio group of hairline icons with a soft highlight that slides to the
 * chosen one; an option's name shows as a tooltip on hover or keyboard focus,
 * and for a moment after a tap.
 */
export function SceneControl({ value, onChange, weather, weathers, onWeatherChange }: SceneControlProps) {
  const captionId = useId()
  const [tapped, setTapped] = useState<string | null>(null)
  const hold = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(hold.current), [])

  const flash = (key: string) => {
    window.clearTimeout(hold.current)
    setTapped(key)
    hold.current = window.setTimeout(() => setTapped(null), NAME_HOLD_MS)
  }

  return (
    <div className="time-control" role="group" aria-labelledby={captionId} data-time={value} data-weather={weather}>
      <span id={captionId} className="time-control__caption">
        {content.sceneControl.label}
      </span>
      <div className="time-control__row">
        <ChoiceGroup
          label={content.timeOfDay.label}
          options={TIMES}
          value={value}
          nameOf={(t) => content.timeOfDay[t]}
          icon={(t) => <TimeIcon time={t} />}
          tapped={tapped}
          onChoose={(t, how) => {
            if (how === 'pointer') flash(`time:${t}`)
            onChange(t) // even the time already shown: choosing it keeps it there
          }}
          keyPrefix="time"
        />
        <ChoiceGroup
          label={content.weather.label}
          options={weathers}
          value={weather}
          nameOf={(w) => content.weather[w]}
          icon={(w) => <WeatherIcon weather={w} />}
          tapped={tapped}
          onChoose={(w, how) => {
            if (how === 'pointer') flash(`weather:${w}`)
            onWeatherChange(w)
          }}
          keyPrefix="weather"
        />
      </div>
    </div>
  )
}

interface ChoiceGroupProps<T extends string> {
  label: string
  options: readonly T[]
  value: T
  nameOf: (option: T) => string
  icon: (option: T) => ReactNode
  tapped: string | null
  keyPrefix: string
  onChoose: (option: T, how: 'pointer' | 'keys') => void
}

/** One radio group of icon options in its own glass pill; one tab stop, arrows move within. */
function ChoiceGroup<T extends string>({ label, options, value, nameOf, icon, tapped, keyPrefix, onChoose }: ChoiceGroupProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Step from the option that has focus (normally the chosen one; not if the
    // value has just changed on its own).
    const focused = buttons.current.findIndex((b) => b === document.activeElement)
    const next = optionForKey(options, focused >= 0 ? options[focused]! : value, event.key)
    if (!next) return
    event.preventDefault()
    onChoose(next, 'keys')
    buttons.current[options.indexOf(next)]?.focus()
  }

  return (
    <div
      className="time-control__group"
      role="radiogroup"
      aria-label={label}
      style={{ '--index': Math.max(0, options.indexOf(value)) } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <span className="time-control__thumb" aria-hidden="true" />
      {options.map((option, i) => {
        const checked = option === value
        return (
          <button
            key={option}
            ref={(el) => {
              buttons.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={nameOf(option)}
            tabIndex={checked ? 0 : -1}
            className="time-control__option"
            data-checked={checked || undefined}
            data-tapped={tapped === `${keyPrefix}:${option}` || undefined}
            onClick={() => onChoose(option, 'pointer')}
          >
            {icon(option)}
            <span className="time-control__tip" aria-hidden="true">
              {nameOf(option)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Hairline icons on a 24-unit grid: a half sun on the horizon, a full sun, a crescent. */
function TimeIcon({ time }: { time: TimeOfDay }) {
  return (
    <svg className="time-control__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {time === 'dawn' && (
        <>
          <path d="M3.5 17.5h17" />
          <path d="M7.5 17.5a4.5 4.5 0 0 1 9 0" />
          <path d="M12 8.25v2M5.8 11.3l1.4 1.4M18.2 11.3l-1.4 1.4" />
        </>
      )}
      {time === 'midday' && (
        <>
          <circle cx="12" cy="12" r="3.75" />
          <path d="M12 3.5v1.75M12 18.75v1.75M3.5 12h1.75M18.75 12h1.75M6 6l1.25 1.25M16.75 16.75 18 18M6 18l1.25-1.25M16.75 7.25 18 6" />
        </>
      )}
      {time === 'night' && <path d="M18.9 14.6A7.25 7.25 0 0 1 9.4 5.1a7.25 7.25 0 1 0 9.5 9.5Z" />}
    </svg>
  )
}

/** Hairline weather icons on the same grid: a clear-air glint, slanting rain, a six-armed flake. */
function WeatherIcon({ weather }: { weather: Weather }) {
  return (
    <svg className="time-control__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {weather === 'clear' && <path d="M12 4.5c.55 4 3.5 6.95 7.5 7.5-4 .55-6.95 3.5-7.5 7.5-.55-4-3.5-6.95-7.5-7.5 4-.55 6.95-3.5 7.5-7.5Z" />}
      {weather === 'rain' && <path d="M8.6 4.5 7 9M13.6 4.5 12 9M18.6 4.5 17 9M7.1 12.5l-1.6 4.5M12.1 12.5l-1.6 4.5M17.1 12.5l-1.6 4.5M9.6 17.5 9 19.5M14.6 17.5 14 19.5" />}
      {weather === 'snow' && (
        <>
          <path d="M12 4v16M5.07 8l13.86 8M5.07 16l13.86-8" />
          <path d="M10.2 5.4 12 6.6l1.8-1.2M10.2 18.6 12 17.4l1.8 1.2" />
        </>
      )}
    </svg>
  )
}
