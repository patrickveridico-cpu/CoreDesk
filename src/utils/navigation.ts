const HOSTNAME_PATTERN = /^(localhost|(?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#].*)?$/i

export function toNavigableUrl(input: string) {
  const value = input.trim()
  if (!value) return 'https://www.google.com'

  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
  } catch {
    // Continue with hostname/search detection.
  }

  if (HOSTNAME_PATTERN.test(value)) return `https://${value}`
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`
}
