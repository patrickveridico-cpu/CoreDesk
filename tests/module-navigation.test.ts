import { describe, expect, it } from 'vitest'
import { buildGoogleSearchUrl, buildMapsUrl, shouldReuseWebView, toEmbeddedBounds } from '../src/utils/moduleNavigation'

describe('module navigation contracts', () => {
  it('encodes a Google search and ignores empty input', () => {
    expect(buildGoogleSearchUrl('guincho Curitiba')).toBe('https://www.google.com/search?q=guincho+Curitiba')
    expect(buildGoogleSearchUrl('   ')).toBeUndefined()
  })

  it('reuses the same view identifier when switching back', () => {
    expect(shouldReuseWebView('app-maps', 'app-maps')).toBe(true)
    expect(shouldReuseWebView('whatsapp:one', 'app-maps')).toBe(false)
  })

  it('builds a safe Maps route and falls back to the Maps home page', () => {
    expect(buildMapsUrl()).toBe('https://www.google.com/maps')
    expect(buildMapsUrl('São José', 'Curitiba')).toBe('https://www.google.com/maps/dir/?api=1&origin=S%C3%A3o+Jos%C3%A9&destination=Curitiba')
  })

  it('converts the real panel rectangle into integer WebContentsView bounds', () => {
    expect(toEmbeddedBounds({ left: 10.6, top: 48.4, width: 900.7, height: 500.2 })).toEqual({ x: 11, y: 48, width: 901, height: 500 })
    expect(toEmbeddedBounds({ left: 0, top: 0, width: 1200, height: 700 })).toEqual({ x: 0, y: 0, width: 1200, height: 700 })
    expect(toEmbeddedBounds({ left: 10, top: 20, width: 600, height: 400 }, 1.1)).toEqual({ x: 11, y: 22, width: 660, height: 440 })
  })
})
