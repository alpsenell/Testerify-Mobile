// Notification settings stored on companies.notifications (jsonb). The
// server-side normalization lives in the panel's api/_lib/alerts.js
// (normalizeNotifications): alertsEnabled defaults true, a bad Slack webhook
// URL or alert email 400s with a human message.
export type NotificationSettings = {
  alertsEnabled: boolean
  autoStop: boolean
  slackWebhookUrl: string
  alertEmail: string
}

// The stored blob may be {} or partial — apply the server's defaults so the
// form renders the effective values.
export function readNotifications(raw: unknown): NotificationSettings {
  const n = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    alertsEnabled: n.alertsEnabled !== false,
    autoStop: n.autoStop === true,
    slackWebhookUrl: typeof n.slackWebhookUrl === 'string' ? n.slackWebhookUrl : '',
    alertEmail: typeof n.alertEmail === 'string' ? n.alertEmail : '',
  }
}
