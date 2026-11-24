/** "August 2023 to October 2026" → "2023 to 2026"; a single year stays as it is. */
export function yearsOf(period: string): string {
  const years = [...new Set(period.match(/\d{4}/g) ?? [])]
  return years.join(' to ')
}

/** The year a period starts, for a book's spine: "October 2022 to July 2023" → "2022". */
export function startYear(period: string): string {
  return period.match(/\d{4}/)?.[0] ?? ''
}

/** The part of a job title that fits on a spine: "Product Owner, Learning Experience & Content" → "Product Owner". */
export function spineTitle(title: string): string {
  return title.split(/\s*[,&]\s*/)[0]!.trim()
}
