interface TopicsProps {
  label: string
  items: string[]
}

/** A quiet inline list of topics, separated by thin dots rather than pills. */
export function Topics({ label, items }: TopicsProps) {
  if (items.length === 0) return null
  return (
    <ul className="topics" role="list" aria-label={label}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
