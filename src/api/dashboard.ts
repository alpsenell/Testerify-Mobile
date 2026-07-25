import { apiFetch } from './client'

export type DashboardStats = {
  currency: { code: string | null; mixed: boolean }
  stats: { visitors: number; activeCampaigns: number; avgConversionRate: number; conversions: number; revenue: number }
  visitorTraffic: { date: string; visitors: number }[]
  campaignPerformance: { x: string; y: number }[]
}

export const fetchDashboard = () => apiFetch<DashboardStats>('/api/stats/dashboard')
