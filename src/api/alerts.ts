import { apiFetch } from './client'

// The server-truth alerts feed (panel: api/alerts/index.js). One row per alert
// the backend actually DELIVERED — including the kinds the client can't derive
// from campaign state at all: srm, no_data / no_data_48h, autoPromoted,
// autoPaused. This is history; "Needs action" stays client-derived from the
// live campaign list (src/utils/alerts.ts).
export type ServerAlertKey =
  | 'significant'
  | 'ended'
  | 'srm'
  | 'no_data'
  | 'no_data_48h'
  | 'autoPromoted'
  | 'autoPaused'

export type ServerAlert = {
  id: string
  campaignId: string | null
  key: ServerAlertKey | string | null
  title: string | null
  body: string | null
  createdAt: string
}

// Newest 100, newest first.
export const fetchAlerts = () => apiFetch<{ alerts: ServerAlert[] }>('/api/alerts').then((r) => r.alerts)
