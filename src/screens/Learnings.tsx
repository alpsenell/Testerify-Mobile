import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchCampaigns, updateLearningNote } from '../api/campaigns'
import type { CampaignListItem } from '../api/campaigns'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { FilterChips } from '../components/FilterChips'
import { SearchField } from '../components/SearchField'
import { Icon } from '../components/Icon'
import { useToast } from '../stores/toast'
import { compact, shortDate } from '../utils/format'
import { concludedAt, filterLearnings, learningCounts, outcomeLabel, toLearnings, wonLearning } from '../utils/learnings'
import type { LearningFilter } from '../utils/learnings'
import { colors, fonts, type } from '../theme'

const KIND_LABEL: Record<CampaignListItem['kind'], string> = {
  ab: 'A/B', nudge: 'Nudge', offer: 'Offer', personalization: 'Personalization',
}

const NOTE_PLACEHOLDER = 'Tap to add what you learned…'

function MetaCell({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ width: '47%', gap: 3, minWidth: 0 }}>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted }}>{k}</Text>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.secondary }} numberOfLines={1}>{v}</Text>
    </View>
  )
}

function LearningCard({ c }: { c: CampaignListItem }) {
  const won = wonLearning(c)
  const qc = useQueryClient()
  const show = useToast((s) => s.show)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(c.learningNote ?? '')

  const save = useMutation({
    mutationFn: (note: string) => updateLearningNote(c.id, note.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      setEditing(false)
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not save your note. Try again.'),
  })

  const ended = concludedAt(c)

  return (
    <View style={{
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16,
      padding: 16, gap: 13,
      shadowColor: '#282214', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    }}>
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15.5, lineHeight: 20, color: colors.ink }}>{c.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <Text style={{
            fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted,
            paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 7,
          }}>{KIND_LABEL[c.kind]}</Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10,
            borderRadius: 999, backgroundColor: won ? colors.posSoft : colors.track,
          }}>
            <Icon name={won ? 'check' : 'x'} size={12} color={won ? colors.pos : colors.muted} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: won ? colors.pos : colors.secondary }}>
              {outcomeLabel(c)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, columnGap: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
        <MetaCell k="Runs on" v={c.targetUrl ?? 'Any page'} />
        <MetaCell k="Visitors tested" v={compact(c.visitors)} />
        <MetaCell k="Started" v={shortDate(c.startsAt ?? c.createdAt)} />
        <MetaCell k="Concluded" v={ended ? shortDate(ended) : '—'} />
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 7 }}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted }}>Learning</Text>
        {editing ? (
          <>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              accessibilityLabel={`Learning note for ${c.name}`}
              placeholder={NOTE_PLACEHOLDER}
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.track, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 11, minHeight: 88,
                fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: colors.ink,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                disabled={save.isPending}
                onPress={() => save.mutate(draft)}
                style={{ flex: 1, minHeight: 44, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', opacity: save.isPending ? 0.6 : 1 }}
              >
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.white }}>{save.isPending ? 'Saving…' : 'Save'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => { setDraft(c.learningNote ?? ''); setEditing(false) }}
                style={{ flex: 1, minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink }}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit learning note for ${c.name}`}
            onPress={() => { setDraft(c.learningNote ?? ''); setEditing(true) }}
            style={{ backgroundColor: colors.track, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: c.learningNote ? colors.secondary : colors.muted }}>
              {c.learningNote || NOTE_PLACEHOLDER}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

export function LearningsScreen() {
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns })
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LearningFilter>('all')

  const rows = useMemo(() => toLearnings(campaigns.data ?? []), [campaigns.data])
  const visible = useMemo(() => filterLearnings(rows, filter, query), [rows, filter, query])
  const counts = learningCounts(rows)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={campaigns.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>Home</Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Testing</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Learnings</Text>
        <Text style={[type.body, { marginTop: 6 }]}>
          Every concluded test — what you tested, how it turned out, what you learned.
        </Text>
      </View>

      {campaigns.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={44} />
          <Skeleton height={190} />
          <Skeleton height={190} />
        </View>
      ) : campaigns.isError ? (
        <RetryCard onRetry={() => campaigns.refetch()} />
      ) : (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search name or note" />
          <FilterChips
            active={filter}
            onPick={(k) => setFilter(k as LearningFilter)}
            options={[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'won', label: 'Won', count: counts.won },
              { key: 'nowinner', label: 'No winner', count: counts.nowinner },
            ]}
          />
          {visible.length === 0 ? (
            <EmptyState message={rows.length === 0 ? 'No concluded tests yet.' : 'No learnings match.'} />
          ) : (
            visible.map((c) => <LearningCard key={c.id} c={c} />)
          )}
        </>
      )}
    </ScrollView>
  )
}
