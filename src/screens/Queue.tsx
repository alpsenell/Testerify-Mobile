import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchQueue, updateQueueItem } from '../api/queue'
import type { QueueItem, QueueStatus } from '../api/queue'
import { qk } from '../api/keys'
import { EmptyState } from '../components/EmptyState'
import { FilterChips } from '../components/FilterChips'
import { ScreenShell } from '../components/ScreenShell'
import { useToast } from '../stores/toast'
import { colors, fonts, type } from '../theme'

const IMPACT_COLOR: Record<QueueItem['impact'], string> = {
  high: colors.pos, medium: colors.warn, low: colors.muted,
}

const SOURCE_LABEL: Record<QueueItem['source'], string> = {
  ai_scan: 'AI scan', revenue_map: 'Revenue map', manual: 'Added by hand', followup: 'Follow-up',
}

function Badge({ label, color = colors.secondary }: { label: string; color?: string }) {
  return (
    <Text style={{
      fontFamily: fonts.sansSemi, fontSize: 11, color,
      borderWidth: 1, borderColor: color, borderRadius: 99,
      paddingVertical: 1, paddingHorizontal: 8, overflow: 'hidden',
    }}>{label}</Text>
  )
}

function QueueRow({ item, onDismiss, onRestore, onDraft, busy }: {
  item: QueueItem
  onDismiss: () => void
  onRestore: () => void
  onDraft: () => void
  busy: boolean
}) {
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 15, gap: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 14, lineHeight: 19, color: colors.ink }}>{item.title}</Text>
        <Text style={{ fontFamily: fonts.monoSemi, fontSize: 13, color: colors.accent }}>{item.score}</Text>
      </View>
      {item.hypothesis ? (
        <Text style={[type.body, { fontSize: 12.5 }]} numberOfLines={3}>{item.hypothesis}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <Badge label={`${item.impact} impact`} color={IMPACT_COLOR[item.impact]} />
        <Badge label={`${item.effort} effort`} />
        {item.page || item.path ? <Badge label={(item.page ?? item.path) as string} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 9 }}>
        <Text style={[type.small, { fontSize: 11.5 }]}>{SOURCE_LABEL[item.source]}</Text>
        {item.status === 'drafted' && item.draftedCampaignId ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/test/${item.draftedCampaignId}`)}
            style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.accent }}>Open draft</Text>
          </Pressable>
        ) : item.status === 'dismissed' ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={onRestore}
            style={{ minHeight: 44, justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.accent }}>Restore</Text>
          </Pressable>
        ) : item.status === 'queued' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Draft ${item.title}`} onPress={onDraft}
              style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.accent }}>Draft this</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={onDismiss}
              style={{ minHeight: 44, justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.muted }}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export function QueueScreen() {
  const [status, setStatus] = useState<QueueStatus>('queued')
  const show = useToast((s) => s.show)
  const qc = useQueryClient()
  const queue = useQuery({ queryKey: qk.queue(), queryFn: fetchQueue })

  const move = useMutation({
    mutationFn: ({ id, to }: { id: string; to: QueueStatus }) => updateQueueItem(id, { status: to }),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: qk.queue() })
      show(item.status === 'dismissed' ? 'Idea dismissed.' : 'Back in the queue.')
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not update the idea.'),
  })

  const items = queue.data ?? []
  const counts = useMemo(() => ({
    queued: items.filter((i) => i.status === 'queued').length,
    drafted: items.filter((i) => i.status === 'drafted').length,
    dismissed: items.filter((i) => i.status === 'dismissed').length,
  }), [items])
  const visible = items.filter((i) => i.status === status)

  return (
    <ScreenShell
      kicker="Backlog"
      title="Test queue"
      subtitle="Ideas ranked by impact and effort — the top one is your next test."
      refreshing={queue.isRefetching}
      pending={queue.isPending}
      errored={queue.isError}
      onRetry={() => queue.refetch()}
      toolbar={
        <FilterChips
          options={[
            { key: 'queued', label: 'Queued', count: counts.queued },
            { key: 'drafted', label: 'Drafted', count: counts.drafted },
            { key: 'dismissed', label: 'Dismissed', count: counts.dismissed },
          ]}
          active={status}
          onPick={(k) => setStatus(k as QueueStatus)}
        />
      }
    >
      {visible.length === 0 ? (
        <EmptyState message={
          status === 'queued'
            ? 'Nothing queued. Ideas from the co-pilot and heatmap scans land here.'
            : `No ${status} ideas yet.`
        } />
      ) : visible.map((item) => (
        <QueueRow
          key={item.id}
          item={item}
          busy={move.isPending && move.variables?.id === item.id}
          onDismiss={() => move.mutate({ id: item.id, to: 'dismissed' })}
          onRestore={() => move.mutate({ id: item.id, to: 'queued' })}
          // Prefill the wizard; once the draft lands, the wizard PATCHes this
          // item to 'drafted' with the new campaign id.
          onDraft={() => router.push({
            pathname: '/screens/create-test',
            params: {
              queueId: item.id,
              title: item.title,
              ...(item.page ? { page: item.page } : {}),
              ...(item.path ? { path: item.path } : {}),
            },
          })}
        />
      ))}
    </ScreenShell>
  )
}
