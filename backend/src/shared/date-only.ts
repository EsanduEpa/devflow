export function dateAtUtcMidnight(value: string | null) {
  return value === null ? null : new Date(`${value}T00:00:00.000Z`)
}
