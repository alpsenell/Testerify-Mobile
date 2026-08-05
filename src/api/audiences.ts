import { apiFetch } from './client'

// Transcribed from the panel's api/audiences/* + api/_lib/audiences.js.
// Conditions AND together; an absent field means "no constraint". The server
// refuses to store an audience with no real constraints (it would match
// everyone), so create/update always carry at least one field.
export type Device = 'desktop' | 'mobile' | 'tablet'
export type VisitorKind = 'new' | 'returning'

export type AudienceConditions = {
  devices?: Device[]
  visitor?: VisitorKind
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  referrer?: string
  // References one of the company's own flows — completing that flow's
  // journey this session is the membership signal.
  completedFlow?: string
}

export type Audience = {
  id: string
  name: string
  conditions: AudienceConditions | null
  createdAt: string
  updatedAt: string
}

export const fetchAudiences = () =>
  apiFetch<{ audiences: Audience[] }>('/api/audiences').then((r) => r.audiences)

export const createAudience = (name: string, conditions: AudienceConditions) =>
  apiFetch<{ audience: Audience }>('/api/audiences', {
    method: 'POST',
    body: JSON.stringify({ name, conditions }),
  }).then((r) => r.audience)

export const updateAudience = (id: string, patch: { name?: string; conditions?: AudienceConditions }) =>
  apiFetch<{ audience: Audience }>(`/api/audiences/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((r) => r.audience)

// 409 when a campaign or flow still references the audience — the server
// message says what's pointing at it; surface it verbatim.
export const deleteAudience = (id: string) =>
  apiFetch<{ message: string }>(`/api/audiences/${id}`, { method: 'DELETE' })
