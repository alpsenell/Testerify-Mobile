import { ideaTag, impactColor, draftRequestFor } from '../copilot'
import { colors } from '../../theme'
import type { AiIdea } from '../../api/ai'

const BASE: AiIdea = {
  title: 'Sticky add-to-cart bar', hypothesis: 'A sticky bar keeps the CTA visible on long PDPs.',
  element: null, change: null, evidence: null,
  page: 'product', path: '/products/[handle]', metric: 'add_to_cart',
  impact: 'high', difficulty: 'easy',
}

describe('ideaTag', () => {
  test('Title Cases the page and appends a sentence-cased metric', () => {
    expect(ideaTag({ ...BASE, page: 'product', metric: 'add_to_cart' })).toBe('Product · Add to cart')
  })

  test('falls back to "Store" when page is null', () => {
    expect(ideaTag({ ...BASE, page: null, metric: null })).toBe('Store')
  })

  test('falls back to "Store" and keeps the metric when page is null but metric is present', () => {
    expect(ideaTag({ ...BASE, page: null, metric: 'checkout_started' })).toBe('Store · Checkout started')
  })

  test('omits the metric segment when metric is null', () => {
    expect(ideaTag({ ...BASE, page: 'checkout', metric: null })).toBe('Checkout')
  })

  test('Title Cases a multi-word snake_case page', () => {
    expect(ideaTag({ ...BASE, page: 'checkout_review', metric: null })).toBe('Checkout Review')
  })
})

describe('impactColor', () => {
  test('high impact maps to the positive color', () => {
    expect(impactColor('high')).toBe(colors.pos)
  })
  test('medium impact maps to the warning color', () => {
    expect(impactColor('medium')).toBe(colors.warn)
  })
  test('low impact maps to the muted color', () => {
    expect(impactColor('low')).toBe(colors.muted)
  })
})

describe('draftRequestFor', () => {
  test('passes title, hypothesis and path through', () => {
    expect(draftRequestFor({ ...BASE, path: '/products/sticky-bar' })).toEqual({
      name: 'Sticky add-to-cart bar',
      goal: 'A sticky bar keeps the CTA visible on long PDPs.',
      path: '/products/sticky-bar',
    })
  })

  test('omits path when it is null', () => {
    const result = draftRequestFor({ ...BASE, path: null })
    expect(result).toEqual({
      name: 'Sticky add-to-cart bar',
      goal: 'A sticky bar keeps the CTA visible on long PDPs.',
    })
    expect(result).not.toHaveProperty('path')
  })
})
