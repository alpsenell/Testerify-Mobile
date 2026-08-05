import { useMemo } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchCampaigns, setCampaignStatus } from '../api/campaigns'
import type { CampaignListItem, CampaignStatus } from '../api/campaigns'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { StatusPill } from '../components/StatusPill'
import { Icon } from '../components/Icon'
import { useToast } from '../stores/toast'
import { compact, pct, signedPct } from '../utils/format'
import { onlyNudges } from '../utils/nudges'
import { statusLabel, statusPulse, statusTone } from '../utils/testModel'
import { colors, fonts, type } from '../theme'

const CAMPAIGNS_KEY = ['campaigns']

function Stat({ k, v, color = colors.ink }: { k: string; v: string; color?: string }) {
  return (
    <View style={{ width: '47%', gap: 2 }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.muted }}>{k}</Text>
      <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color }}>{v}</Text>
    </View>
  )
}

function NudgeCard({ nudge }: { nudge: CampaignListItem }) {
  const qc = useQueryClient()
  const show = useToast((s) => s.show)
  const running = nudge.status === 'running'

  // Same cheap-and-reversible rule as flows: move now, roll back on error.
  const toggle = useMutation({
    mutationFn: (next: CampaignStatus) => setCampaignStatus(nudge.id, next),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: CAMPAIGNS_KEY })
      const previous = qc.getQueryData<CampaignListItem[]>(CAMPAIGNS_KEY)
      qc.setQueryData<CampaignListItem[]>(CAMPAIGNS_KEY, (rows) =>
        (rows ?? []).map((c) => (c.id === nudge.id ? { ...c, status: next } : c)))
      return { previous }
    },
    onError: (e, _next, context) => {
      if (context?.previous) qc.setQueryData(CAMPAIGNS_KEY, context.previous)
      show(e instanceof Error ? e.message : 'Could not change the nudge. Try again.')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <View style={{ gap: 12, padding: 15, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.ink }} numberOfLines={1}>{nudge.name}</Text>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.muted }} numberOfLines={1}>
            {nudge.targetUrl ?? 'Any page'}
          </Text>
        </View>
        <StatusPill label={statusLabel(nudge.status)} tone={statusTone(nudge.status)} pulse={statusPulse(nudge.status)} />
      </View>

      {/* Every figure is the campaign's own: the holdout the design refers to
          is this nudge's control variant. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat k="Visitors" v={compact(nudge.visitors)} />
        <Stat k="Conv. rate" v={pct(nudge.conversionRate)} />
        <Stat k="Vs holdout" v={signedPct(nudge.uplift)} color={nudge.uplift < 0 ? colors.neg : colors.pos} />
        <Stat k="Confidence" v={pct(nudge.confidence, 0)} />
      </View>

      {nudge.status === 'running' || nudge.status === 'paused' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${running ? 'Pause' : 'Resume'} ${nudge.name}`}
            onPress={() => toggle.mutate(running ? 'paused' : 'running')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
          >
            <Icon name={running ? 'pause' : 'play'} size={15} color={colors.secondary} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.secondary }}>{running ? 'Pause' : 'Resume'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

export function NudgesScreen() {
  const campaigns = useQuery({ queryKey: CAMPAIGNS_KEY, queryFn: fetchCampaigns })
  const qc = useQueryClient()
  const nudges = useMemo(() => onlyNudges(campaigns.data ?? []), [campaigns.data])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      refreshControl={<RefreshControl refreshing={campaigns.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Widget library</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Nudges</Text>
        <Text style={[type.body, { marginTop: 6 }]}>Every nudge runs against a holdout that proves it pays for itself.</Text>
      </View>

      {campaigns.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={150} />
          <Skeleton height={150} />
        </View>
      ) : campaigns.isError ? (
        <RetryCard onRetry={() => campaigns.refetch()} />
      ) : nudges.length === 0 ? (
        <EmptyState message="No nudges yet — build one on the desktop panel." />
      ) : (
        <>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink }}>Your nudges</Text>
          {nudges.map((n) => <NudgeCard key={n.id} nudge={n} />)}
        </>
      )}
    </ScrollView>
  )
}
