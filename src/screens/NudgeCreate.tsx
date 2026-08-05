import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { createNudge, fetchNudgeCatalog } from '../api/nudges'
import type { NudgeParam, NudgeTemplate } from '../api/nudges'
import { setCampaignStatus } from '../api/campaigns'
import { qk } from '../api/keys'
import { Icon } from '../components/Icon'
import { Skeleton } from '../components/Skeleton'
import { RetryCard } from '../components/RetryCard'
import { useToast } from '../stores/toast'
import { isPlanGated } from '../utils/planGate'
import { colors, fonts, type } from '../theme'

const HOLDOUT_MIN = 10
const HOLDOUT_MAX = 50

const IMPACT_COLOR: Record<string, string> = {
  high: colors.pos, medium: colors.warn, low: colors.muted,
}

const inputStyle = {
  minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
  backgroundColor: colors.paper, paddingHorizontal: 13,
  fontFamily: fonts.sans, fontSize: 14, color: colors.ink,
} as const

// Typed param values → the POST body. Numbers travel as numbers (the server
// clamps to min/max and falls back to the default on NaN); everything else is
// the raw string — colors and text get sanitized server-side too.
function buildParams(defs: NudgeParam[], values: Record<string, string>): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const def of defs) {
    const raw = values[def.key] ?? String(def.default)
    out[def.key] = def.type === 'number' ? Number(raw) : raw
  }
  return out
}

export function NudgeCreateScreen() {
  const qc = useQueryClient()
  const show = useToast((s) => s.show)
  const catalog = useQuery({ queryKey: qk.nudgeCatalog(), queryFn: fetchNudgeCatalog })

  const [picked, setPicked] = useState<NudgeTemplate | null>(null)
  const [name, setName] = useState('')
  const [holdout, setHoldout] = useState(20)
  const [values, setValues] = useState<Record<string, string>>({})
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null)
  const [gateMessage, setGateMessage] = useState<string | null>(null)

  const pick = (n: NudgeTemplate) => {
    setPicked(n)
    setName(n.name)
    setHoldout(catalog.data?.defaultHoldout ?? 20)
    setValues(Object.fromEntries(n.params.map((p) => [p.key, String(p.default)])))
    setGateMessage(null)
  }

  const create = useMutation({
    mutationFn: () =>
      createNudge({ nudgeId: picked!.id, name: name.trim() || undefined, holdout, params: buildParams(picked!.params, values) }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: qk.campaigns() })
      setCreated({ id: r.campaign.id, name: r.campaign.name })
      show('Nudge draft created.')
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not create the nudge. Try again.'),
  })

  const launch = useMutation({
    mutationFn: () => setCampaignStatus(created!.id, 'running'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.campaigns() })
      show('Nudge launched.')
      router.push(`/test/${created!.id}`)
    },
    onError: (e) => {
      // Running-test cap: the draft stays — surface the upgrade note in place.
      if (isPlanGated(e)) setGateMessage(e instanceof Error && e.message ? e.message : 'Your plan limit is reached — upgrade to run more tests.')
      else show(e instanceof Error ? e.message : 'Could not launch the nudge. Try again.')
    },
  })

  const back = () => {
    if (picked && !created) { setPicked(null); return }
    router.back()
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={catalog.isRefetching} onRefresh={() => qc.invalidateQueries()} tintColor={colors.muted} />}
    >
      <Pressable accessibilityRole="button" onPress={back} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>
          {picked && !created ? 'Back' : 'Nudges'}
        </Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>Widget library</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>New nudge</Text>
        <Text style={[type.body, { marginTop: 6 }]}>
          {picked ? 'Tune it, then launch against a holdout that proves it pays for itself.' : 'Pick a widget — every nudge ships as a draft first.'}
        </Text>
      </View>

      {catalog.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={110} />
          <Skeleton height={110} />
          <Skeleton height={110} />
        </View>
      ) : catalog.isError ? (
        <RetryCard onRetry={() => catalog.refetch()} />
      ) : created ? (
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 12 }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15.5, color: colors.ink }}>Draft created</Text>
          <Text style={[type.body, { fontSize: 13 }]}>
            “{created.name}” is saved as a draft. Launch it now to start proving its value against the holdout.
          </Text>
          {gateMessage ? (
            <View style={{ gap: 4, padding: 12, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 12 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.ink }}>Plan limit reached</Text>
              <Text style={[type.small, { fontSize: 12.5, lineHeight: 18 }]}>
                {gateMessage} Your draft is saved — launch it after upgrading.
              </Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={launch.isPending}
            onPress={() => { if (!launch.isPending) launch.mutate() }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.accent, borderRadius: 11, minHeight: 48, opacity: launch.isPending ? 0.6 : 1 }}
          >
            <Icon name="play" size={15} color={colors.white} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.white }}>
              {launch.isPending ? 'Launching…' : 'Launch now'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/test/${created.id}`)}
            style={{ alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>View draft</Text>
          </Pressable>
        </View>
      ) : !picked ? (
        (catalog.data?.nudges ?? []).map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            onPress={() => pick(n)}
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 15, gap: 8 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>{n.name}</Text>
              <Text style={{
                fontFamily: fonts.sansSemi, fontSize: 11, color: IMPACT_COLOR[n.impact] ?? colors.secondary,
                borderWidth: 1, borderColor: IMPACT_COLOR[n.impact] ?? colors.secondary, borderRadius: 99,
                paddingVertical: 1, paddingHorizontal: 8, overflow: 'hidden',
              }}>{`${n.impact} impact`}</Text>
            </View>
            <Text style={[type.body, { fontSize: 12.5 }]}>{n.description}</Text>
          </Pressable>
        ))
      ) : (
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.secondary }}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholderTextColor={colors.muted}
              accessibilityLabel="Nudge name"
              style={inputStyle}
            />
          </View>

          {picked.params.map((p) => (
            <View key={p.key} style={{ gap: 6 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.secondary }}>{p.label}</Text>
              <TextInput
                value={values[p.key] ?? ''}
                onChangeText={(t) => setValues((v) => ({ ...v, [p.key]: t }))}
                placeholder={String(p.default)}
                placeholderTextColor={colors.muted}
                accessibilityLabel={p.label}
                keyboardType={p.type === 'number' ? 'numeric' : 'default'}
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />
              {p.hint ? <Text style={[type.small, { fontSize: 11.5, lineHeight: 16 }]}>{p.hint}</Text> : null}
              {p.type === 'number' && p.min != null && p.max != null ? (
                <Text style={[type.small, { fontSize: 11.5 }]}>{`Between ${p.min} and ${p.max}.`}</Text>
              ) : null}
            </View>
          ))}

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.secondary }}>Holdout</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease holdout"
                onPress={() => setHoldout((h) => Math.max(HOLDOUT_MIN, h - 5))}
                style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 18, color: colors.secondary }}>−</Text>
              </Pressable>
              <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.monoSemi, fontSize: 13.5, color: colors.ink }}>{`${holdout}% holdout`}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase holdout"
                onPress={() => setHoldout((h) => Math.min(HOLDOUT_MAX, h + 5))}
                style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 18, color: colors.secondary }}>+</Text>
              </Pressable>
            </View>
            <Text style={[type.small, { fontSize: 11.5, lineHeight: 16 }]}>
              The share of visitors who never see the nudge — the results read “this widget added $X” against them.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={create.isPending}
            onPress={() => { if (!create.isPending) create.mutate() }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.accent, borderRadius: 11, minHeight: 48, opacity: create.isPending ? 0.6 : 1 }}
          >
            <Icon name="plus" size={15} color={colors.white} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.white }}>
              {create.isPending ? 'Creating…' : 'Create draft'}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}
