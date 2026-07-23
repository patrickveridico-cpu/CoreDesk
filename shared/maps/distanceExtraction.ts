export const SAFE_DISTANCE_SCORE = 170

export type DistanceConfidence = 'high' | 'medium' | 'low'

export interface DistanceCandidateFeatures {
  hasDuration: boolean
  hasVia: boolean
  selected: boolean
  inRoutesPanel: boolean
  nearDuration: boolean
  significantArea: boolean
  compactBlock: boolean
  routeCardRole: boolean
  recommended: boolean
  scale: boolean
  footer: boolean
  instruction: boolean
  placeResult: boolean
  farFromDuration: boolean
  mapChrome: boolean
  distanceCount: number
}

export function parseDistanceToKm(value: string): number | null {
  const match = String(value).match(/(\d[\d.,]*)\s*(km|m|mi)\b/i)
  if (!match) return null
  let numberText = match[1].replace(/\s/g, '')
  const unit = match[2].toLowerCase()
  if (numberText.includes('.') && numberText.includes(',')) {
    const decimal = Math.max(numberText.lastIndexOf('.'), numberText.lastIndexOf(','))
    numberText = numberText.slice(0, decimal).replace(/[.,]/g, '') + '.' + numberText.slice(decimal + 1)
  } else if (numberText.includes(',')) {
    const parts = numberText.split(',')
    numberText = parts[1]?.length === 3 ? parts.join('') : parts[0] + '.' + parts.slice(1).join('')
  } else if (numberText.includes('.')) {
    const parts = numberText.split('.')
    numberText = parts[1]?.length === 3 ? parts.join('') : parts.join('.')
  }
  const number = Number(numberText)
  if (!Number.isFinite(number)) return null
  return unit === 'm' ? number / 1000 : unit === 'mi' ? number * 1.60934 : number
}

export function scoreDistanceCandidate(features: DistanceCandidateFeatures): number {
  let score = 0
  if (features.hasDuration) score += 100
  if (features.hasVia) score += 80
  if (features.selected) score += 60
  if (features.inRoutesPanel) score += 40
  if (features.nearDuration) score += 20
  if (features.significantArea) score += 10
  if (features.compactBlock) score += 35
  if (features.routeCardRole) score += 30
  if (features.recommended) score += 20
  if (features.scale) score -= 100
  if (features.footer) score -= 100
  if (features.instruction) score -= 80
  if (features.placeResult) score -= 80
  if (!features.hasDuration || features.farFromDuration) score -= 50
  if (features.mapChrome) score -= 50
  score -= Math.min(80, Math.max(0, features.distanceCount - 1) * 15)
  return score
}

export function distanceConfidence(score: number, crossValidated: boolean, safeScore: number): DistanceConfidence {
  if (crossValidated && score >= safeScore) return 'high'
  if (crossValidated && score >= 100) return 'medium'
  return 'low'
}

export function createBudgetMapsDistanceExtractorScript(): string {
  return `(() => {
    const parseDistanceToKm = ${parseDistanceToKm.toString()}
    const scoreDistanceCandidate = ${scoreDistanceCandidate.toString()}
    const distanceConfidence = ${distanceConfidence.toString()}
    const safeDistanceScore = ${SAFE_DISTANCE_SCORE}
    const key = '__coreDeskBudgetMapsObserverInstalled'
    const previous = window[key]
    if (previous?.disconnect) previous.disconnect()
    const distancePattern = /\\d[\\d.,]*\\s*(?:km|m|mi)\\b/i
    const distancePatternGlobal = /\\d[\\d.,]*\\s*(?:km|m|mi)\\b/gi
    const durationPattern = /(?:\\d+\\s*(?:dia|dias|d)\\b(?:\\s+)?|\\d+\\s*(?:h|hora|horas)\\b(?:\\s+)?|\\d+\\s*(?:min|minuto|minutos)\\b)/i
    const routeTextPattern = /\\b(via|pela|por)\\s+(.{2,120}?)(?=\\s+\\d+\\s*(?:dia|dias|h|hora|horas|min|minuto|minutos|km|mi)\\b|$)/i
    const normalizeText = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
    const visible = (node) => {
      const style = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0
    }
    const nodeText = (node) => normalizeText(node.getAttribute('aria-label') || node.textContent || '')
    const rectObject = (rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    const inspect = (candidate) => {
      const node = candidate.node
      const parent = node.parentElement
      const grandParent = parent?.parentElement
      return {
        selectedText: candidate.distanceText,
        parsedDistanceKm: candidate.distanceKm,
        score: candidate.score,
        confidence: candidate.confidence,
        tagName: node.tagName,
        className: String(node.className || '').slice(0, 250),
        ariaLabel: node.getAttribute('aria-label'),
        role: node.getAttribute('role'),
        rect: rectObject(node.getBoundingClientRect()),
        parentText: normalizeText(parent?.innerText || '').slice(0, 250),
        parentAriaLabel: parent?.getAttribute('aria-label') || null,
        grandParentText: normalizeText(grandParent?.innerText || '').slice(0, 250),
        grandParentAriaLabel: grandParent?.getAttribute('aria-label') || null,
      }
    }
    const durationMinutes = (value) => {
      const text = String(value).toLowerCase()
      const days = Number(text.match(/(\\d+)\\s*(?:dia|dias|d)\\b/)?.[1] || 0)
      const hours = Number(text.match(/(\\d+)\\s*(?:h|hora|horas)\\b/)?.[1] || 0)
      const minutes = Number(text.match(/(\\d+)\\s*(?:min|minuto|minutos)\\b/)?.[1] || 0)
      return days * 1440 + hours * 60 + minutes || null
    }
    const bestRouteBlock = (node, distanceText) => {
      const blocks = []
      let current = node
      for (let depth = 0; current && depth < 9; depth += 1, current = current.parentElement) {
        if (!visible(current)) continue
        const text = normalizeText(current.innerText || current.getAttribute('aria-label') || '')
        if (!durationPattern.test(text) || !text.includes(normalizeText(distanceText))) continue
        const rect = current.getBoundingClientRect()
        const durations = [...current.querySelectorAll('*')]
          .filter((item) => visible(item))
          .map((item) => ({ node: item, text: nodeText(item) }))
          .filter((item) => item.text.length <= 100 && durationPattern.test(item.text))
        const distanceRect = node.getBoundingClientRect()
        const nearestDuration = durations.sort((a, b) => Math.abs(a.node.getBoundingClientRect().y - distanceRect.y) - Math.abs(b.node.getBoundingClientRect().y - distanceRect.y))[0]
        const durationGap = nearestDuration ? Math.abs(nearestDuration.node.getBoundingClientRect().y - distanceRect.y) : Number.POSITIVE_INFINITY
        const semanticText = (text + ' ' + normalizeText(current.getAttribute('aria-label'))).toLowerCase()
        const classText = String(current.className || '').toLowerCase()
        const distanceCount = text.match(distancePatternGlobal)?.length || 1
        const features = {
          hasDuration: Boolean(nearestDuration),
          hasVia: routeTextPattern.test((current.innerText || '').trim()),
          selected: current.matches('[aria-selected="true"],[aria-checked="true"],[aria-current="true"]') || Boolean(current.closest('[aria-selected="true"],[aria-checked="true"],[aria-current="true"]')),
          inRoutesPanel: Boolean(current.closest('[role="main"],[aria-label*="direções" i],[aria-label*="directions" i],[aria-label*="rotas" i],[aria-label*="routes" i]')),
          nearDuration: durationGap <= 140,
          significantArea: rect.width >= 120 && rect.height >= 32,
          compactBlock: text.length <= 650,
          routeCardRole: current.matches('[role="radio"],[role="option"],[data-trip-index]') || Boolean(current.closest('[role="radio"],[role="option"],[data-trip-index]')),
          recommended: /recomendad|melhor rota|mais rápid|fastest|best route/.test(semanticText),
          scale: Boolean(node.closest('.widget-scale,.gm-style-cc,[class*="scale" i],[aria-label*="escala" i],[aria-label*="scale" i]')),
          footer: Boolean(node.closest('footer,.scene-footer,[class*="copyright" i],[class*="footer" i]')),
          instruction: Boolean(node.closest('[data-step-index],[class*="directions-mode-step" i],[aria-label*="passo" i],[aria-label*="etapa" i],[aria-label*="step" i]')),
          placeResult: Boolean(node.closest('[data-result-index],.Nv2PK,[role="article"]')) && !Boolean(nearestDuration),
          farFromDuration: durationGap > 260,
          mapChrome: /camadas|layers|termos|terms|dados do mapa|map data|localização do mouse|mouse location/.test(semanticText) || /widget-scale|scene-footer|gm-style-cc/.test(classText),
          distanceCount,
        }
        const score = scoreDistanceCandidate(features)
        blocks.push({ node: current, text, durationText: nearestDuration?.text.match(durationPattern)?.[0] || null, durationGap, features, score })
      }
      return blocks.sort((a, b) => b.score - a.score || a.text.length - b.text.length)[0] || null
    }
    const extract = () => {
      const elements = [...document.querySelectorAll('div,span,button,[aria-label],[role]')].filter(visible)
      const atomicDistanceNodes = elements.filter((node) => {
        const text = nodeText(node)
        if (!distancePattern.test(text) || text.length > 250) return false
        return ![...node.children].some((child) => visible(child) && distancePattern.test(nodeText(child)))
      })
      const candidates = atomicDistanceNodes.flatMap((node) => {
        const text = nodeText(node)
        const matches = [...text.matchAll(distancePatternGlobal)]
        return matches.map((match) => {
          const distanceText = match[0]
          const distanceKm = parseDistanceToKm(distanceText)
          const block = bestRouteBlock(node, distanceText)
          const crossValidated = Boolean(block?.features.hasDuration && !block.features.scale && !block.features.footer && !block.features.instruction && !block.features.placeResult)
          const score = block?.score || -50
          return { node, distanceText, distanceKm, block, score, confidence: distanceConfidence(score, crossValidated, safeDistanceScore), crossValidated }
        })
      }).filter((candidate) => candidate.distanceKm !== null && Number.isFinite(candidate.distanceKm) && candidate.distanceKm >= 0)
        .sort((a, b) => b.score - a.score)
      const routeVisible = candidates.some((candidate) => Boolean(candidate.block?.features.hasDuration && !candidate.block.features.scale && !candidate.block.features.footer))
      const selected = candidates.find((candidate) => candidate.crossValidated && candidate.score >= safeDistanceScore) || null
      const inputValues = [...document.querySelectorAll('input')].map((input) => ({ label: input.getAttribute('aria-label') || input.getAttribute('placeholder') || '', value: input.value.trim() })).filter((item) => item.value)
      const origin = inputValues.find((item) => /origem|from|partida/i.test(item.label))?.value || null
      const destination = inputValues.find((item) => /destino|to|chegada/i.test(item.label))?.value || null
      const blockText = selected?.block?.text || ''
      const routeMatch = blockText.match(routeTextPattern)
      const routeText = routeMatch ? ('via ' + routeMatch[2]).trim() : null
      const diagnosticCandidates = candidates.slice(0, 20).map(inspect)
      return {
        distanceKm: selected?.distanceKm ?? null,
        distanceText: selected?.distanceText ?? null,
        durationText: selected?.block?.durationText ?? null,
        durationMinutes: selected?.block?.durationText ? durationMinutes(selected.block.durationText) : null,
        routeText,
        hasTolls: selected ? /pedágio|pedagio|toll/i.test(blockText) || null : null,
        origin,
        destination,
        confidence: selected?.confidence ?? 'low',
        score: selected?.score ?? candidates[0]?.score ?? 0,
        routeVisible,
        diagnostic: { selected: selected ? inspect(selected) : null, candidates: diagnosticCandidates },
      }
    }
    const publish = () => { window.__coreDeskBudgetMapsRoute = { ...extract(), source: 'google-maps-dom', capturedAt: new Date().toISOString() } }
    const observer = new MutationObserver(() => { clearTimeout(window.__coreDeskBudgetMapsDebounce); window.__coreDeskBudgetMapsDebounce = setTimeout(publish, 450) })
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
    window[key] = observer
    publish()
    return true
  })()`
}
