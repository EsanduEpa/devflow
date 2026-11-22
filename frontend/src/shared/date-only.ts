const calendarDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

export function formatDateOnly(date: string | null) {
  return date ? calendarDateFormat.format(new Date(`${date}T00:00:00.000Z`)) : 'Not set'
}
