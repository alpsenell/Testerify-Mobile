import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { deleteFlow, fetchFlows, updateFlowStatus } from '../api/flows'
import type { Flow, FlowStatus } from '../api/flows'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { StatusPill } from '../components/StatusPill'
import { Icon } from '../components/Icon'
import { useToast } from '../stores/toast'
import { confirmDestructive } from '../utils/confirm'
import { colors, fonts, type } from '../theme'

const FLOWS_KEY = ['flows']

function FlowCard({ flow }: { flow: Flow }) {
  const qc = useQueryClient()
  const show = useToast((s) => s.show)
  const active = flow.status === 'active'

  // Pause/resume is cheap and reversible, so the pill moves immediately and
  // rolls back if the server disagrees (Phase 1 mutation rule).
  const toggle = useMutation({
    mutationFn: (next: FlowStatus) => updateFlowStatus(flow.id, next),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: FLOWS_KEY })
      const previous = qc.getQueryData<Flow[]>(FLOWS_KEY)
      qc.setQueryData<Flow[]>(FLOWS_KEY, (rows) =>
        (rows ?? []).map((f) => (f.id === flow.id ? { ...f, status: next } : f)))
      return { previous }
    },
    onError: (e, _next, context) => {
      if (context?.previous) qc.setQueryData(FLOWS_KEY, context.previous)
      show(e instanceof Error ? e.message : 'Could not change the flow. Try again.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: FLOWS_KEY }),
  })

  // Deleting is not reversible from here, so it confirms and waits.
  const remove = useMutation({
    mutationFn: () => deleteFlow(flow.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FLOWS_KEY })
      show(`"${flow.name}" deleted.`)
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not delete the flow. Try again.'),
  })

  const askDelete = () => confirmDestructive({
    title: 'Delete this flow?',
    message: `"${flow.name}" stops running immediately, and it can't be restored from mobile.`,
    confirmLabel: 'Delete',
    onConfirm: () => remove.mutate(),
  })

  return (
    <View style={{ gap: 12, padding: 15, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <Icon name="flow" size={18} color={colors.secondary} />
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.ink }} numberOfLines={1}>{flow.name}</Text>
        </View>
        <StatusPill label={active ? 'Active' : 'Paused'} tone={active ? 'pos' : 'neutral'} pulse={active} />
      </View>

      {/* Step objects are the desktop builder's shape — mobile counts them
          rather than half-decoding a journey it can't edit. */}
      <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, lineHeight: 19, color: colors.secondary }}>
        {flow.steps.length} step{flow.steps.length === 1 ? '' : 's'}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <Icon name="beaker" size={14} color={colors.muted} />
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted }} numberOfLines={1}>
            {flow.campaignName ?? 'No test linked'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${active ? 'Pause' : 'Resume'} ${flow.name}`}
            onPress={() => toggle.mutate(active ? 'paused' : 'active')}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
          >
            <Icon name={active ? 'pause' : 'play'} size={16} color={colors.secondary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${flow.name}`}
            disabled={remove.isPending}
            onPress={askDelete}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, opacity: remove.isPending ? 0.5 : 1 }}
          >
            <Icon name="trash" size={16} color={colors.secondary} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

export function FlowsScreen() {
  const flows = useQuery({ queryKey: FLOWS_KEY, queryFn: fetchFlows })
  const qc = useQueryClient()

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      refreshControl={<RefreshControl refreshing={flows.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Automation</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Flows</Text>
        {/* No "New" button: building a flow is the desktop canvas. */}
        <Text style={[type.body, { marginTop: 6 }]}>Trigger an A/B test when a visitor follows a journey.</Text>
      </View>

      {flows.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={130} />
          <Skeleton height={130} />
        </View>
      ) : flows.isError ? (
        <RetryCard onRetry={() => flows.refetch()} />
      ) : flows.data.length === 0 ? (
        <EmptyState message="No flows yet — build one on the desktop panel." />
      ) : (
        flows.data.map((f) => <FlowCard key={f.id} flow={f} />)
      )}
    </ScrollView>
  )
}
