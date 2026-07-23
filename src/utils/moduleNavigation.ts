export function buildGoogleSearchUrl(query: string) {
  const value = query.trim()
  if (!value) return undefined
  const url = new URL('https://www.google.com/search')
  url.search = new URLSearchParams({ q: value }).toString()
  return url.toString()
}

export function buildMapsUrl(origin?: string, destination?: string) {
  const url = new URL('https://www.google.com/maps')
  const from = origin?.trim()
  const to = destination?.trim()
  if (from && to) {
    url.pathname = '/maps/dir/'
    url.search = new URLSearchParams({ api: '1', origin: from, destination: to }).toString()
  }
  return url.toString()
}

export function shouldReuseWebView(previousId: string | null, targetId: string) {
  return previousId === targetId
}

export function toEmbeddedBounds(rect: { left: number; top: number; width: number; height: number }, scale = 1) {
  return {
    x: Math.round(rect.left * scale),
    y: Math.round(rect.top * scale),
    width: Math.max(0, Math.round(rect.width * scale)),
    height: Math.max(0, Math.round(rect.height * scale)),
  }
}
