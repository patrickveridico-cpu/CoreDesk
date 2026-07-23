import { useEffect, useRef, useState, type RefObject } from 'react'
import type { WebViewStateUpdate } from '../../shared/contracts'
import { CORECHAT_VIEW_ID, type CoreChatPanelPhase } from '../../shared/corechat'
import { useAppearanceStore } from '../store/useAppearanceStore'
import { toEmbeddedBounds } from '../utils/moduleNavigation'

export function useCoreChatPanelView(
  phase: CoreChatPanelPhase,
  containerRef: RefObject<HTMLDivElement | null>,
) {
  const [viewState, setViewState] = useState<WebViewStateUpdate>({ id: CORECHAT_VIEW_ID })
  const [zoomFactor, setZoomFactor] = useState<number | null>(null)
  const lastBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const frameRef = useRef(0)
  const themeMode = useAppearanceStore((state) => state.themeMode)
  const accentColor = useAppearanceStore((state) => state.accentColor)

  useEffect(() => window.coreDesk?.views.onStateChange((update) => {
    if (update.id !== CORECHAT_VIEW_ID) return
    setViewState((current) => ({
      ...current,
      ...update,
      error: update.error === null ? undefined : (update.error ?? current.error),
    }))
  }), [])

  useEffect(() => {
    let mounted = true
    void window.coreDesk?.zoom.get().then((factor) => { if (mounted) setZoomFactor(factor) })
    const remove = window.coreDesk?.zoom.onChanged(setZoomFactor)
    return () => { mounted = false; remove?.() }
  }, [])

  useEffect(() => {
    const element = containerRef.current
    const visible = phase === 'opening' || phase === 'open'
    if (!element || !visible || zoomFactor === null || viewState.error) {
      lastBoundsRef.current = null
      window.coreDesk?.views.setEmbedded(CORECHAT_VIEW_ID, null)
      return
    }
    let mounted = true
    const measure = () => {
      if (!mounted) return
      const rect = element.getBoundingClientRect()
      const bounds = toEmbeddedBounds(rect, zoomFactor)
      if (bounds.width <= 0 || bounds.height <= 0) {
        lastBoundsRef.current = null
        window.coreDesk?.views.setEmbedded(CORECHAT_VIEW_ID, null)
        return
      }
      const previous = lastBoundsRef.current
      if (previous && previous.x === bounds.x && previous.y === bounds.y && previous.width === bounds.width && previous.height === bounds.height) return
      lastBoundsRef.current = bounds
      window.coreDesk?.views.setEmbedded(CORECHAT_VIEW_ID, bounds)
    }
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = window.requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(element)
    if (element.parentElement) observer.observe(element.parentElement)
    window.addEventListener('resize', scheduleMeasure)
    scheduleMeasure()
    return () => {
      mounted = false
      observer.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
      window.cancelAnimationFrame(frameRef.current)
      lastBoundsRef.current = null
      window.coreDesk?.views.setEmbedded(CORECHAT_VIEW_ID, null)
    }
  }, [accentColor, containerRef, phase, themeMode, viewState.error, zoomFactor])

  return viewState
}
