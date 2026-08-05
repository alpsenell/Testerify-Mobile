import { useRef, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { createCampaign, patchCampaign } from '../api/createCampaign'
import { fetchAudiences } from '../api/audiences'
import { updateQueueItem } from '../api/queue'
import { qk } from '../api/keys'
import { Icon } from '../components/Icon'
import { SegmentedControl } from '../components/SegmentedControl'
import { useToast } from '../stores/toast'
import { isPlanGated } from '../utils/planGate'
import {
  buildCreateBody, buildLaunchPatch, buildSchedulePatch, clampSplit, cleanGoals,
  GOAL_LABELS, isPageType, isValidDateInput, MAX_GOALS, PAGE_TYPES, servesIdenticalPages,
  SPLIT_DEFAULT,
} from '../utils/createTest'
import type { GoalDraft, GoalType, PageType, TargetingMode, TestKind, WizardDraft } from '../utils/createTest'
import { colors, fonts, type } from '../theme'

const STEPS = ['Basics', 'Targeting', 'Goals', 'Review'] as const

const PAGE_LABELS: Record<PageType, string> = {
  home: 'Home', product: 'Product', collection: 'Collection', cart: 'Cart',
}

const inputStyle = {
  minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
  backgroundColor: colors.paper, paddingHorizontal: 13,
  fontFamily: fonts.sans, fontSize: 14, color: colors.ink,
} as const

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.secondary }}>{label}</Text>
      {children}
      {hint ? <Text style={[type.small, { fontSize: 11.5, lineHeight: 16 }]}>{hint}</Text> : null}
    </View>
  )
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 40, borderRadius: 11, paddingHorizontal: 14, justifyContent: 'center',
        backgroundColor: active ? colors.accentSoft : colors.card,
        borderWidth: 1, borderColor: active ? colors.accent : colors.border,
      }}
    >
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: active ? colors.accent : colors.secondary }}>{label}</Text>
    </Pressable>
  )
}

// Dependency-free 10–90 stepper: same control shape for the traffic split
// here and the holdout in NudgeCreate.
function Stepper({ label, onLess, onMore, lessLabel, moreLabel }: {
  label: string; onLess: () => void; onMore: () => void; lessLabel: string; moreLabel: string
}) {
  const btn = {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card,
  } as const
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={lessLabel} onPress={onLess} style={btn}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 18, color: colors.secondary }}>−</Text>
      </Pressable>
      <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.monoSemi, fontSize: 13.5, color: colors.ink }}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={moreLabel} onPress={onMore} style={btn}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 18, color: colors.secondary }}>+</Text>
      </Pressable>
    </View>
  )
}

function ActionButton({ label, onPress, disabled, primary }: {
  label: string; onPress: () => void; disabled?: boolean; primary?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => { if (!disabled) onPress() }}
      style={{
        alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 11,
        backgroundColor: primary ? colors.accent : colors.card,
        borderWidth: 1, borderColor: primary ? colors.accent : colors.border,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: primary ? colors.white : colors.secondary }}>{label}</Text>
    </Pressable>
  )
}

export function CreateTestScreen() {
  const params = useLocalSearchParams<{ queueId?: string; title?: string; page?: string; path?: string }>()
  const queueId = typeof params.queueId === 'string' ? params.queueId : null
  const qc = useQueryClient()
  const show = useToast((s) => s.show)

  const [step, setStep] = useState(0)

  // Basics
  const [name, setName] = useState(typeof params.title === 'string' ? params.title : '')
  const [kind, setKind] = useState<TestKind>('ab')

  // Targeting — a queue idea prefills its page or path.
  const [mode, setMode] = useState<TargetingMode>(
    typeof params.path === 'string' && params.path ? 'url' : isPageType(params.page) ? 'pages' : 'all')
  const [pages, setPages] = useState<PageType[]>(isPageType(params.page) ? [params.page] : [])
  const [target, setTarget] = useState(typeof params.path === 'string' ? params.path : '')
  const [audienceId, setAudienceId] = useState<string | null>(null)
  const [redirectUrl, setRedirectUrl] = useState('')

  // Goals — order preselected, like the panel's builder.
  const [goals, setGoals] = useState<GoalDraft[]>([{ id: 'g1', type: 'order', selector: '', url: '' }])
  const goalSeq = useRef(2)

  // Split + schedule
  const [split, setSplit] = useState(SPLIT_DEFAULT)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

  const [busy, setBusy] = useState<null | 'draft' | 'launch' | 'schedule'>(null)
  const [gateMessage, setGateMessage] = useState<string | null>(null)
  // Once the POST succeeds the draft exists — later actions PATCH it instead
  // of creating a twin (e.g. Launch hit the plan cap, then Save draft).
  const [createdId, setCreatedId] = useState<string | null>(null)

  const audiences = useQuery({ queryKey: qk.audiences(), queryFn: fetchAudiences })

  const draft: WizardDraft = { name, kind, mode, pages, target, audienceId, redirectUrl, goals, trafficSplit: split }
  const identical = servesIdenticalPages(draft)

  const canNext =
    step === 0 ? name.trim().length > 0
    : step === 1 ? (mode === 'url' ? target.trim().length > 0 : mode === 'pages' ? pages.length > 0 : true)
    : true

  const back = () => {
    if (step > 0) setStep(step - 1)
    else router.back()
  }

  async function ensureCreated(): Promise<string> {
    if (createdId) return createdId
    const campaign = await createCampaign(buildCreateBody(draft))
    setCreatedId(campaign.id)
    qc.invalidateQueries({ queryKey: qk.campaigns() })
    if (queueId) {
      // Best-effort: the wizard shouldn't fail because the backlog PATCH did.
      updateQueueItem(queueId, { status: 'drafted', draftedCampaignId: campaign.id })
        .then(() => qc.invalidateQueries({ queryKey: qk.queue() }))
        .catch(() => {})
    }
    return campaign.id
  }

  async function submit(action: 'draft' | 'launch' | 'schedule') {
    if (busy) return
    setBusy(action)
    setGateMessage(null)
    try {
      const id = await ensureCreated()
      if (action === 'launch') await patchCampaign(id, buildLaunchPatch(endsAt))
      if (action === 'schedule') await patchCampaign(id, buildSchedulePatch(startsAt, endsAt))
      qc.invalidateQueries({ queryKey: qk.campaigns() })
      show(action === 'draft' ? 'Draft saved.' : action === 'launch' ? 'Test launched.' : 'Test scheduled.')
      router.push(`/test/${id}`)
    } catch (e) {
      if (isPlanGated(e)) {
        // Launch cap or personalization gate. If the POST already went
        // through, the draft is kept — only the status change was refused.
        setGateMessage(e instanceof Error && e.message ? e.message : 'Your plan limit is reached — upgrade to run this test.')
      } else {
        show(e instanceof Error ? e.message : 'Could not save the test. Try again.')
      }
    } finally {
      setBusy(null)
    }
  }

  const setGoal = (id: string, patch: Partial<GoalDraft>) =>
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)))

  const targetingSummary =
    mode === 'url' ? `URL ${target.trim() || '/'}`
    : mode === 'pages' && pages.length ? `Pages: ${pages.map((p) => PAGE_LABELS[p]).join(', ')}`
    : 'All pages'
  const audienceName = audienceId
    ? audiences.data?.find((a) => a.id === audienceId)?.name ?? 'Saved audience'
    : 'Everyone'
  const keptGoals = cleanGoals(goals)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 62, paddingBottom: 30, gap: 13 }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable accessibilityRole="button" onPress={back} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={18} color={colors.secondary} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.secondary }}>
          {step === 0 ? 'Tests' : 'Back'}
        </Text>
      </Pressable>

      <View>
        <Text style={type.kicker}>New test</Text>
        <Text style={[type.h1, { marginTop: 4 }]}>Create a test</Text>
        <Text style={[type.body, { marginTop: 6 }]}>{`Step ${step + 1} of ${STEPS.length} — ${STEPS[step]}`}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.accent : colors.track }} />
        ))}
      </View>

      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 14 }}>
        {step === 0 ? (
          <>
            <Field label="Name">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="PDP: sticky add-to-cart"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Test name"
                style={inputStyle}
              />
            </Field>
            <Field
              label="Type"
              hint={kind === 'personalization'
                ? 'An always-on experience measured against a permanent 10% holdout. Part of the Scale plan.'
                : 'A classic A/B test: Control vs Variation, winner ships.'}
            >
              <SegmentedControl
                options={[{ key: 'ab', label: 'A/B test' }, { key: 'personalization', label: 'Personalization' }]}
                active={kind}
                onPick={(k) => setKind(k as TestKind)}
              />
            </Field>
          </>
        ) : step === 1 ? (
          <>
            <Field label="Where it runs">
              <SegmentedControl
                options={[{ key: 'all', label: 'All pages' }, { key: 'pages', label: 'Page types' }, { key: 'url', label: 'One URL' }]}
                active={mode}
                onPick={(k) => setMode(k as TargetingMode)}
              />
            </Field>
            {mode === 'pages' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PAGE_TYPES.map((p) => (
                  <Chip
                    key={p}
                    label={PAGE_LABELS[p]}
                    active={pages.includes(p)}
                    onPress={() => setPages((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]))}
                  />
                ))}
              </View>
            ) : null}
            {mode === 'url' ? (
              <Field label="Page" hint="A path like /collections/sale — or paste the full URL.">
                <TextInput
                  value={target}
                  onChangeText={setTarget}
                  placeholder="/collections/sale"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Target path"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={inputStyle}
                />
              </Field>
            ) : null}
            <Field label="Audience" hint="Who sees the test. Manage presets under More → Audiences.">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Everyone" active={audienceId === null} onPress={() => setAudienceId(null)} />
                {(audiences.data ?? []).map((a) => (
                  <Chip key={a.id} label={a.name} active={audienceId === a.id} onPress={() => setAudienceId(a.id)} />
                ))}
              </View>
            </Field>
            <Field
              label="Redirect URL (optional)"
              hint="Split-URL test: the variant sends visitors to this page instead of an edited one. The one way a mobile-created A/B test is complete without the desktop editor."
            >
              <TextInput
                value={redirectUrl}
                onChangeText={setRedirectUrl}
                placeholder="https://store.com/pages/new-landing"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Redirect URL"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={inputStyle}
              />
            </Field>
          </>
        ) : step === 2 ? (
          <>
            <Text style={[type.small, { fontSize: 12.5, lineHeight: 18 }]}>
              What counts as a conversion. Goals are OR-ed — the first to fire records it.
            </Text>
            {goals.map((g, i) => (
              <View key={g.id} style={{ gap: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.hairline, paddingTop: i === 0 ? 0 : 12 }}>
                <SegmentedControl
                  options={(['order', 'cart', 'click', 'url'] as GoalType[]).map((t) => ({ key: t, label: GOAL_LABELS[t] }))}
                  active={g.type}
                  onPick={(k) => setGoal(g.id, { type: k as GoalType })}
                />
                {g.type === 'click' ? (
                  <TextInput
                    value={g.selector}
                    onChangeText={(t) => setGoal(g.id, { selector: t })}
                    placeholder=".add-to-cart, #buy-now"
                    placeholderTextColor={colors.muted}
                    accessibilityLabel={`Goal ${i + 1} selector`}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={inputStyle}
                  />
                ) : g.type === 'url' ? (
                  <TextInput
                    value={g.url}
                    onChangeText={(t) => setGoal(g.id, { url: t })}
                    placeholder="/pages/thank-you"
                    placeholderTextColor={colors.muted}
                    accessibilityLabel={`Goal ${i + 1} URL`}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={inputStyle}
                  />
                ) : null}
                {goals.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove goal ${i + 1}`}
                    onPress={() => setGoals((gs) => gs.filter((x) => x.id !== g.id))}
                    style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}
                  >
                    <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.neg }}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            {goals.length < MAX_GOALS ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setGoals((gs) => [...gs, { id: `g${goalSeq.current++}`, type: 'order', selector: '', url: '' }])}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}
              >
                <Icon name="plus" size={14} color={colors.accent} />
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.accent }}>Add goal</Text>
              </Pressable>
            ) : null}
            {keptGoals.length < goals.length ? (
              <Text style={[type.small, { fontSize: 11.5 }]}>
                Click goals without a selector and URL goals without a URL are skipped.
              </Text>
            ) : null}
          </>
        ) : (
          <>
            {kind === 'ab' ? (
              <Field label="Traffic split">
                <Stepper
                  label={`Control ${split}% · Variant ${100 - split}%`}
                  lessLabel="Give the control less traffic"
                  moreLabel="Give the control more traffic"
                  onLess={() => setSplit((s) => clampSplit(s - 5))}
                  onMore={() => setSplit((s) => clampSplit(s + 5))}
                />
              </Field>
            ) : (
              <Text style={[type.small, { fontSize: 12.5, lineHeight: 18 }]}>
                Personalization always serves the experience to 90% of visitors, with a permanent 10% holdout.
              </Text>
            )}
            <Field label="Starts (optional)" hint="YYYY-MM-DD — set a date to schedule instead of launching now.">
              <TextInput
                value={startsAt}
                onChangeText={setStartsAt}
                placeholder="2026-08-15"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Start date"
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />
            </Field>
            <Field label="Ends (optional)" hint="YYYY-MM-DD — the cron completes the test on this date.">
              <TextInput
                value={endsAt}
                onChangeText={setEndsAt}
                placeholder="2026-09-01"
                placeholderTextColor={colors.muted}
                accessibilityLabel="End date"
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />
            </Field>

            <View style={{ gap: 5, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 12 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink }}>{name.trim() || 'Untitled test'}</Text>
              <Text style={[type.small, { fontSize: 12.5 }]}>
                {kind === 'ab' ? 'A/B test' : 'Personalization'} · {targetingSummary} · {audienceName}
              </Text>
              <Text style={[type.small, { fontSize: 12.5 }]}>
                {keptGoals.length
                  ? `Goals: ${keptGoals.map((g) => GOAL_LABELS[g.type]).join(', ')}`
                  : 'No goals — conversions will not be recorded.'}
              </Text>
              {redirectUrl.trim() ? (
                <Text style={[type.small, { fontSize: 12.5 }]} numberOfLines={1}>Variant redirects to {redirectUrl.trim()}</Text>
              ) : null}
            </View>

            {identical ? (
              <View style={{ flexDirection: 'row', gap: 9, padding: 12, backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: colors.warn, borderRadius: 12 }}>
                <Icon name="warning" size={17} color={colors.warn} />
                <Text style={[type.small, { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.secondary }]}>
                  This test doesn't change anything yet — both sides serve identical pages. Add variant changes in the desktop editor, or set a redirect URL, before launching.
                </Text>
              </View>
            ) : null}

            {gateMessage ? (
              <View style={{ gap: 4, padding: 12, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 12 }}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.ink }}>Plan limit reached</Text>
                <Text style={[type.small, { fontSize: 12.5, lineHeight: 18 }]}>
                  {gateMessage}{createdId ? ' Your draft is saved — launch it after upgrading.' : ''}
                </Text>
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              {/* An identical-pages ab test defaults to Save draft; launching
                  it would only prove that a page beats itself. */}
              {identical ? (
                <>
                  <ActionButton primary label={busy === 'draft' ? 'Saving…' : 'Save draft'} disabled={busy !== null} onPress={() => submit('draft')} />
                  <ActionButton label={busy === 'launch' ? 'Launching…' : 'Launch now'} disabled={busy !== null} onPress={() => submit('launch')} />
                </>
              ) : (
                <>
                  <ActionButton primary label={busy === 'launch' ? 'Launching…' : 'Launch now'} disabled={busy !== null} onPress={() => submit('launch')} />
                  <ActionButton label={busy === 'draft' ? 'Saving…' : 'Save draft'} disabled={busy !== null} onPress={() => submit('draft')} />
                </>
              )}
              <ActionButton
                label={busy === 'schedule' ? 'Scheduling…' : 'Schedule'}
                disabled={busy !== null || !isValidDateInput(startsAt)}
                onPress={() => submit('schedule')}
              />
            </View>
          </>
        )}
      </View>

      {step < STEPS.length - 1 ? (
        <ActionButton primary label="Next" disabled={!canNext} onPress={() => setStep(step + 1)} />
      ) : null}
    </ScrollView>
  )
}
