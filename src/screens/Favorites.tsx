import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchCampaigns } from '../api/campaigns'
import type { CampaignListItem } from '../api/campaigns'
import { generateTestDraft } from '../api/ai'
import type { AiIdea } from '../api/ai'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { StatusPill } from '../components/StatusPill'
import { Sparkline } from '../components/charts/Sparkline'
import { Icon } from '../components/Icon'
import { useFavorites } from '../stores/favorites'
import { useToast } from '../stores/toast'
import { pct, signedPct } from '../utils/format'
import { statusLabel, statusPulse, statusTone } from '../utils/testModel'
import { draftRequestFor, ideaTag, impactColor } from '../utils/copilot'
import { colors, fonts, type } from '../theme'

function SectionLabel({ children, style }: { children: string; style?: object }) {
  return (
    <Text style={[{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.muted }, style]}>
      {children}
    </Text>
  )
}

function Stat({ value, label, color = colors.ink }: { value: string; label: string; color?: string }) {
  return (
    <View>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 17, color }}>{value}</Text>
      <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 1 }}>{label}</Text>
    </View>
  )
}

function PinnedCard({ campaign }: { campaign: CampaignListItem }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/test/${campaign.id}`)}
      style={{
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 18, gap: 12,
        shadowColor: '#282214', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <StatusPill label={statusLabel(campaign.status)} tone={statusTone(campaign.status)} pulse={statusPulse(campaign.status)} />
        <Icon name="star" size={16} color={colors.warn} filled />
      </View>
      <Text style={{ fontFamily: fonts.sans, fontSize: 22, lineHeight: 25, color: colors.ink }}>{campaign.name}</Text>
      <Text style={[type.body]}>{campaign.targetUrl ?? 'Any page'}</Text>
      <View style={{ marginVertical: 2 }}>
        <Sparkline data={campaign.trend} color={colors.accent} width={300} height={44} />
      </View>
      <View style={{ flexDirection: 'row', gap: 26, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 13 }}>
        <Stat value={pct(campaign.conversionRate)} label="conv. rate" />
        <Stat value={signedPct(campaign.uplift)} label="uplift" color={campaign.uplift < 0 ? colors.neg : colors.pos} />
        <Stat value={pct(campaign.confidence, 0)} label="confidence" />
      </View>
    </Pressable>
  )
}

function SavedIdeaCard({ idea }: { idea: AiIdea }) {
  const removeIdea = useFavorites((s) => s.removeIdea)
  const show = useToast((s) => s.show)
  const qc = useQueryClient()

  const build = useMutation({
    mutationFn: () => generateTestDraft(draftRequestFor(idea)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      show(`Draft created from "${idea.title}". Finish it on desktop.`)
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not build a draft. Try again.'),
  })

  return (
    <View style={{
      flexDirection: 'row', gap: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 14, padding: 15,
      shadowColor: '#282214', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="sparkle" size={16} color={colors.white} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.accent, backgroundColor: colors.accentSoft, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8, overflow: 'hidden' }}>
            {ideaTag(idea)}
          </Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: impactColor(idea.impact) }}>{idea.impact} impact</Text>
        </View>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, lineHeight: 19, color: colors.ink }}>{idea.title}</Text>
        <Text style={[type.body, { fontSize: 12.5 }]}>{idea.hypothesis}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
          <Pressable
            accessibilityRole="button"
            disabled={build.isPending}
            onPress={() => build.mutate()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accentSoft, borderRadius: 10, paddingHorizontal: 13, minHeight: 44, justifyContent: 'center', opacity: build.isPending ? 0.6 : 1 }}
          >
            <Icon name="plus" size={16} color={colors.accent} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.accent }}>{build.isPending ? 'Building…' : 'Build'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${idea.title} from saved ideas`}
            onPress={() => removeIdea(idea.title)}
            style={{ minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.muted }}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

export function FavoritesScreen() {
  const pinnedIds = useFavorites((s) => s.pinnedIds)
  const savedIdeas = useFavorites((s) => s.savedIdeas)
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns })
  const qc = useQueryClient()

  // Pins live on device (there is no server-side favorites store), so a pinned
  // id can outlive the test it points at — anything the backend no longer
  // returns simply drops out of the list.
  const pinned = (campaigns.data ?? []).filter((c) => pinnedIds.includes(c.id))

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
        <Text style={type.kicker}>Saved</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Favorites</Text>
        <Text style={[type.body, { marginTop: 6 }]}>Pinned tests and saved AI ideas. Both live on this device.</Text>
      </View>

      <SectionLabel style={{ marginTop: 4 }}>Pinned tests</SectionLabel>
      {campaigns.isPending ? (
        <Skeleton height={190} />
      ) : campaigns.isError ? (
        <RetryCard onRetry={() => campaigns.refetch()} />
      ) : pinned.length === 0 ? (
        <EmptyState message="No pinned tests yet — tap the star on a test to pin it here." />
      ) : (
        pinned.map((c) => <PinnedCard key={c.id} campaign={c} />)
      )}

      <SectionLabel style={{ marginTop: 8 }}>Saved AI ideas</SectionLabel>
      {savedIdeas.length === 0 ? (
        <EmptyState message="No saved ideas yet — save one from the co-pilot to keep it here." />
      ) : (
        savedIdeas.map((idea) => <SavedIdeaCard key={idea.title} idea={idea} />)
      )}
    </ScrollView>
  )
}
