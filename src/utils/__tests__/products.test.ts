import { filterProducts, isLeaky } from '../products'
import type { Product, ProductTotals } from '../products'

const product = (over: Partial<Product> = {}): Product => ({
  productId: 'p1', handle: 'candle', title: 'Amber candle', image: null, price: 2400,
  views: 1000, viewers: 800, adders: 90, checkouters: 40, purchasers: 30, units: 32, revenue: 76800,
  addRate: 11.3, checkoutRate: 5, conversionRate: 3.8, ...over,
})

const totals: ProductTotals = {
  views: 3000, viewers: 2400, adders: 260, purchasers: 120, units: 130, revenue: 300000,
  addRate: 10.8, conversionRate: 5,
}

test('a high-traffic product converting below the store rate is leaky', () => {
  expect(isLeaky(product({ views: 1500, conversionRate: 2.1 }), totals, 3)).toBe(true)
})

test('a product converting at or above the store rate is not leaky, however busy', () => {
  expect(isLeaky(product({ views: 2500, conversionRate: 5 }), totals, 3)).toBe(false)
  expect(isLeaky(product({ views: 2500, conversionRate: 7.4 }), totals, 3)).toBe(false)
})

test('a below-average-traffic product is not leaky even if it converts badly', () => {
  expect(isLeaky(product({ views: 100, conversionRate: 0.2 }), totals, 3)).toBe(false)
})

test('nothing is flagged when either conversion rate is unmeasured', () => {
  expect(isLeaky(product({ conversionRate: null }), totals, 3)).toBe(false)
  expect(isLeaky(product(), { ...totals, conversionRate: null }, 3)).toBe(false)
})

test('an empty or view-less catalogue flags nothing instead of dividing by zero', () => {
  expect(isLeaky(product(), totals, 0)).toBe(false)
  expect(isLeaky(product(), { ...totals, views: 0 }, 3)).toBe(false)
})

test('search matches title and handle', () => {
  const products = [product(), product({ productId: 'p2', title: 'Linen throw', handle: 'throw-linen' })]
  expect(filterProducts(products, '')).toHaveLength(2)
  expect(filterProducts(products, ' AMBER ').map((p) => p.productId)).toEqual(['p1'])
  expect(filterProducts(products, 'throw-l').map((p) => p.productId)).toEqual(['p2'])
  expect(filterProducts(products, 'nope')).toEqual([])
})
