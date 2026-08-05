import { apiFetch } from './client'

// Transcribed from the panel's api/flows/index.js + [id].js — see
// docs/superpowers/specs/2026-08-05-testerify-mobile-phase-3-design.md §2.
export type FlowStatus = 'active' | 'paused'

export type Flow = {
  id: string
  name: string
  status: FlowStatus
  // Step objects belong to the desktop flow builder; mobile only ever counts
  // them, so the shape stays opaque here rather than half-modelled.
  steps: unknown[]
  campaignId: string | null
  // Left join on campaigns — null when the flow points at nothing (or at a
  // campaign that has since been deleted).
  campaignName: string | null
  createdAt: string
  updatedAt: string
}

export const fetchFlows = () => apiFetch<{ flows: Flow[] }>('/api/flows').then((r) => r.flows)

export const updateFlowStatus = (id: string, status: FlowStatus) =>
  apiFetch<{ flow: unknown }>(`/api/flows/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })

export const deleteFlow = (id: string) =>
  apiFetch<{ message: string }>(`/api/flows/${id}`, { method: 'DELETE' })
