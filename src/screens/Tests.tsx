import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { fetchCampaigns } from '../api/campaigns'
import type { CampaignListItem } from '../api/campaigns'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { EmptyState } from '../components/EmptyState'
import { FilterChips } from '../components/FilterChips'
import { TestCard } from '../components/TestCard'
import { Icon } from '../components/Icon'
import { colors, fonts, type } from '../theme'

type FilterKey = 'all' | 'running' | 'draft' | 'shipped'

const isShipped = (c: CampaignListItem) => c.status === 'rollout' || c.status === 'completed'

const matchesFilter = (c: CampaignListItem, filter: FilterKey) => {
  if (filter === 'all') return true
  if (filter === 'running') return c.status === 'running'
  if (filter === 'draft') return c.status === 'draft'
  return isShipped(c)
}

export function TestsScreen() {
  const [filter, setFilter] = useState<FilterKey>('all')
  const camps = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns })
  const qc = useQueryClient()

  const all = camps.data ?? []
  const options = [
    { key: 'all', label: 'All', count: all.length },
    { key: 'running', label: 'Running', count: all.filter((c) => c.status === 'running').length },
    { key: 'draft', label: 'Draft', count: all.filter((c) => c.status === 'draft').length },
    { key: 'shipped', label: 'Shipped', count: all.filter(isShipped).length },
  ]
  const filtered = all.filter((c) => matchesFilter(c, filter))

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 14 }}
      refreshControl={<RefreshControl refreshing={camps.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}>

      {/* Header — creation goes to the native wizard; the co-pilot keeps its
          own entries on Home and the tab bar. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={type.h1}>Tests</Text>
        <Pressable onPress={() => router.push('/screens/create-test')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: 11, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' }}>
          <Icon name="plus" size={15} color={colors.white} />
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.white }}>New test</Text>
        </Pressable>
      </View>

      {/* Filter chips */}
      <FilterChips options={options} active={filter} onPick={(k) => setFilter(k as FilterKey)} />

      {/* List */}
      {camps.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={110} /><Skeleton height={110} /><Skeleton height={110} /><Skeleton height={110} /><Skeleton height={110} />
        </View>
      ) : camps.isError ? (
        <RetryCard onRetry={() => camps.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState message="No tests match this filter." />
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((c) => <TestCard key={c.id} campaign={c} onPress={() => router.push(`/test/${c.id}`)} />)}
        </View>
      )}
    </ScrollView>
  )
}
