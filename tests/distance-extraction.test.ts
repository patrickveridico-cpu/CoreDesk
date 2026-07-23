import { describe, expect, it } from 'vitest'
import { createBudgetMapsDistanceExtractorScript, distanceConfidence, parseDistanceToKm, SAFE_DISTANCE_SCORE, scoreDistanceCandidate, type DistanceCandidateFeatures } from '../shared/maps/distanceExtraction'

const baseFeatures: DistanceCandidateFeatures = {
  hasDuration: true,
  hasVia: false,
  selected: false,
  inRoutesPanel: true,
  nearDuration: true,
  significantArea: true,
  compactBlock: true,
  routeCardRole: true,
  recommended: false,
  scale: false,
  footer: false,
  instruction: false,
  placeResult: false,
  farFromDuration: false,
  mapChrome: false,
  distanceCount: 1,
}

describe('extração segura de distância do Google Maps', () => {
  it('prioriza a distância total no card selecionado da rota BR-280', () => {
    const score = scoreDistanceCandidate({ ...baseFeatures, hasVia: true, selected: true })
    expect(parseDistanceToKm('291 km')).toBe(291)
    expect(score).toBe(375)
    expect(score).toBeGreaterThanOrEqual(SAFE_DISTANCE_SCORE)
    expect(distanceConfidence(score, true, SAFE_DISTANCE_SCORE)).toBe('high')
  })

  it('rejeita 60 m de uma instrução mesmo quando um ancestral amplo contém a rota', () => {
    const score = scoreDistanceCandidate({
      ...baseFeatures,
      hasVia: true,
      nearDuration: false,
      compactBlock: false,
      routeCardRole: false,
      instruction: true,
      farFromDuration: true,
      distanceCount: 3,
    })
    expect(parseDistanceToKm('60 m')).toBeCloseTo(0.06)
    expect(score).toBe(70)
    expect(score).toBeLessThan(SAFE_DISTANCE_SCORE)
    expect(distanceConfidence(score, false, SAFE_DISTANCE_SCORE)).toBe('low')
  })

  it('aceita uma rota curta quando distância e duração pertencem ao mesmo card', () => {
    const score = scoreDistanceCandidate({ ...baseFeatures, selected: true })
    expect(parseDistanceToKm('650 m')).toBeCloseTo(0.65)
    expect(distanceConfidence(score, true, SAFE_DISTANCE_SCORE)).toBe('high')
  })

  it('rejeita distâncias da escala e do rodapé do mapa', () => {
    const score = scoreDistanceCandidate({
      ...baseFeatures,
      hasDuration: false,
      inRoutesPanel: false,
      nearDuration: false,
      compactBlock: false,
      routeCardRole: false,
      scale: true,
      footer: true,
      farFromDuration: true,
      mapChrome: true,
    })
    expect(score).toBeLessThan(0)
    expect(distanceConfidence(score, false, SAFE_DISTANCE_SCORE)).toBe('low')
  })

  it('gera um script injetável sem referência externa ao limite de segurança', () => {
    const script = createBudgetMapsDistanceExtractorScript()
    expect(script).toContain('const safeDistanceScore = 170')
    expect(script).not.toContain('score >= SAFE_DISTANCE_SCORE')
  })
})
