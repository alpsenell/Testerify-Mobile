import type { ProductsResponse } from '../api/stats'

export type Product = ProductsResponse['products'][number]
export type ProductTotals = ProductsResponse['totals']

// The design's "High traffic · low conversion" badge has no backing field —
// the endpoint reports per-product counts, not a leak flag — so it is derived
// here, on device, from two real numbers: the product pulls at least an
// average share of the store's product views, yet converts below the store's
// own rate. Both sides must be measurable; a store with no conversion rate
// (nothing purchased, or purchase tracking off) flags nothing.
export function isLeaky(product: Product, totals: ProductTotals, productCount: number): boolean {
  if (totals.conversionRate === null || product.conversionRate === null) return false
  if (productCount === 0 || totals.views === 0) return false
  const averageViews = totals.views / productCount
  return product.views >= averageViews && product.conversionRate < totals.conversionRate
}

export function filterProducts(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase()
  if (!q) return products
  return products.filter((p) => `${p.title} ${p.handle ?? ''}`.toLowerCase().includes(q))
}
