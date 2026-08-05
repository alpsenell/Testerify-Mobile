import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAudience, deleteAudience, fetchAudiences, updateAudience } from '../api/audiences'
import type { Audience, AudienceConditions, Device, VisitorKind } from '../api/audiences'
import { fetchFlows } from '../api/flows'
import { qk } from '../api/keys'
import { Icon } from '../components/Icon'
import { EmptyState } from '../components/EmptyState'
import { ScreenShell } from '../components/ScreenShell'
import { SegmentedControl } from '../components/SegmentedControl'
import { useToast } from '../stores/toast'
import { confirmDestructive } from '../utils/confirm'
import { colors, fonts, type } from '../theme'

const DEVICES: Device[] = ['desktop', 'mobile', 'tablet']

type FormState = {
  id: string | null
  name: string
  devices: Device[]
  visitor: 'all' | VisitorKind
  utmSource: string
  utmMedium: string
  utmCampaign: string
  referrer: string
  completedFlow: string | null
}

const emptyForm: FormState = {
  id: null, name: '', devices: [], visitor: 'all',
  utmSource: '', utmMedium: '', utmCampaign: '', referrer: '', completedFlow: null,
}

const formFrom = (a: Audience): FormState => ({
  id: a.id,
  name: a.name,
  devices: a.conditions?.devices ?? [],
  visitor: a.conditions?.visitor ?? 'all',
  utmSource: a.conditions?.utmSource ?? '',
  utmMedium: a.conditions?.utmMedium ?? '',
  utmCampaign: a.conditions?.utmCampaign ?? '',
  referrer: a.conditions?.referrer ?? '',
  completedFlow: a.conditions?.completedFlow ?? null,
})

// Only real constraints travel — mirrors the server's normalizer, which
// treats all-3-devices and visitor 'all' as no constraint at all.
const conditionsFrom = (f: FormState): AudienceConditions => {
  const c: AudienceConditions = {}
  if (f.devices.length > 0 && f.devices.length < DEVICES.length) c.devices = f.devices
  if (f.visitor !== 'all') c.visitor = f.visitor
  if (f.utmSource.trim()) c.utmSource = f.utmSource.trim()
  if (f.utmMedium.trim()) c.utmMedium = f.utmMedium.trim()
  if (f.utmCampaign.trim()) c.utmCampaign = f.utmCampaign.trim()
  if (f.referrer.trim()) c.referrer = f.referrer.trim()
  if (f.completedFlow) c.completedFlow = f.completedFlow
  return c
}

function summarize(conditions: AudienceConditions | null, flowName: (id: string) => string | null): string {
  if (!conditions) return 'Everyone'
  const parts: string[] = []
  if (conditions.devices?.length) parts.push(conditions.devices.join(' + '))
  if (conditions.visitor) parts.push(`${conditions.visitor} visitors`)
  if (conditions.utmSource) parts.push(`utm_source ${conditions.utmSource}`)
  if (conditions.utmMedium) parts.push(`utm_medium ${conditions.utmMedium}`)
  if (conditions.utmCampaign) parts.push(`utm_campaign ${conditions.utmCampaign}`)
  if (conditions.referrer) parts.push(`from ${conditions.referrer}`)
  if (conditions.completedFlow) parts.push(`completed “${flowName(conditions.completedFlow) ?? 'a flow'}”`)
  return parts.length ? parts.join(' · ') : 'Everyone'
}

const inputStyle = {
  minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
  backgroundColor: colors.paper, paddingHorizontal: 13,
  fontFamily: fonts.sans, fontSize: 14, color: colors.ink,
} as const

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.secondary }}>{label}</Text>
      {children}
    </View>
  )
}

export function AudiencesScreen() {
  const qc = useQueryClient()
  const show = useToast((s) => s.show)
  const audiences = useQuery({ queryKey: qk.audiences(), queryFn: fetchAudiences })
  const flows = useQuery({ queryKey: qk.flows(), queryFn: fetchFlows })
  const [form, setForm] = useState<FormState | null>(null)

  const flowName = (id: string) => flows.data?.find((f) => f.id === id)?.name ?? null

  const save = useMutation({
    mutationFn: (f: FormState) => {
      const conditions = conditionsFrom(f)
      return f.id
        ? updateAudience(f.id, { name: f.name.trim(), conditions })
        : createAudience(f.name.trim(), conditions)
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: qk.audiences() })
      setForm(null)
      show(`Audience “${a.name}” saved.`)
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not save the audience. Try again.'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteAudience(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.audiences() })
      show('Audience deleted.')
    },
    // 409 carries "still used by N campaign(s)" — say it verbatim.
    onError: (e) => show(e instanceof Error ? e.message : 'Could not delete the audience. Try again.'),
  })

  const canSave = form !== null
    && form.name.trim().length > 0
    && Object.keys(conditionsFrom(form)).length > 0
    && !save.isPending

  return (
    <ScreenShell
      kicker="Targeting"
      title="Audiences"
      subtitle="Reusable “who sees it” presets for tests and flows."
      refreshing={audiences.isRefetching}
      pending={audiences.isPending}
      errored={audiences.isError}
      onRetry={() => audiences.refetch()}
      skeletonHeights={[88, 88, 88]}
      keyboardShouldPersistTaps="handled"
      toolbar={
        form === null ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setForm(emptyForm)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.accent, borderRadius: 11, minHeight: 48 }}
          >
            <Icon name="plus" size={15} color={colors.white} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.white }}>New audience</Text>
          </Pressable>
        ) : undefined
      }
    >
      {form !== null ? (
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 14 }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15.5, color: colors.ink }}>
            {form.id ? 'Edit audience' : 'New audience'}
          </Text>
          <Field label="Name">
            <TextInput
              value={form.name}
              onChangeText={(t) => setForm({ ...form, name: t })}
              placeholder="Mobile newcomers"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Audience name"
              style={inputStyle}
            />
          </Field>
          <Field label="Devices">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DEVICES.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  active={form.devices.includes(d)}
                  onPress={() => setForm({
                    ...form,
                    devices: form.devices.includes(d) ? form.devices.filter((x) => x !== d) : [...form.devices, d],
                  })}
                />
              ))}
            </View>
          </Field>
          <Field label="Visitor">
            <SegmentedControl
              options={[{ key: 'all', label: 'All' }, { key: 'new', label: 'New' }, { key: 'returning', label: 'Returning' }]}
              active={form.visitor}
              onPick={(k) => setForm({ ...form, visitor: k as FormState['visitor'] })}
            />
          </Field>
          <Field label="UTM source">
            <TextInput value={form.utmSource} onChangeText={(t) => setForm({ ...form, utmSource: t })}
              placeholder="instagram" placeholderTextColor={colors.muted} accessibilityLabel="UTM source"
              autoCapitalize="none" autoCorrect={false} style={inputStyle} />
          </Field>
          <Field label="UTM medium">
            <TextInput value={form.utmMedium} onChangeText={(t) => setForm({ ...form, utmMedium: t })}
              placeholder="cpc" placeholderTextColor={colors.muted} accessibilityLabel="UTM medium"
              autoCapitalize="none" autoCorrect={false} style={inputStyle} />
          </Field>
          <Field label="UTM campaign">
            <TextInput value={form.utmCampaign} onChangeText={(t) => setForm({ ...form, utmCampaign: t })}
              placeholder="summer-sale" placeholderTextColor={colors.muted} accessibilityLabel="UTM campaign"
              autoCapitalize="none" autoCorrect={false} style={inputStyle} />
          </Field>
          <Field label="Referrer contains">
            <TextInput value={form.referrer} onChangeText={(t) => setForm({ ...form, referrer: t })}
              placeholder="tiktok.com" placeholderTextColor={colors.muted} accessibilityLabel="Referrer"
              autoCapitalize="none" autoCorrect={false} style={inputStyle} />
          </Field>
          {flows.data?.length ? (
            <Field label="Completed a flow">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Any" active={form.completedFlow === null} onPress={() => setForm({ ...form, completedFlow: null })} />
                {flows.data.map((f) => (
                  <Chip key={f.id} label={f.name} active={form.completedFlow === f.id}
                    onPress={() => setForm({ ...form, completedFlow: f.id })} />
                ))}
              </View>
            </Field>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            onPress={() => { if (canSave) save.mutate(form) }}
            style={{ alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 11, backgroundColor: colors.accent, opacity: canSave ? 1 : 0.55 }}
          >
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.white }}>
              {save.isPending ? 'Saving…' : form.id ? 'Save changes' : 'Create audience'}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setForm(null)} style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.muted }}>Cancel</Text>
          </Pressable>
          <Text style={[type.small, { fontSize: 11.5, lineHeight: 16 }]}>
            Conditions AND together. An audience needs at least one — one that matches everyone isn't an audience.
          </Text>
        </View>
      ) : null}

      {!audiences.data ? null : audiences.data.length === 0 && form === null ? (
        <EmptyState message="No audiences yet. Create one and reuse it across tests and flows." />
      ) : (
        audiences.data.map((a) => (
          <View key={a.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 15, gap: 9 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>{a.name}</Text>
            <Text style={[type.small, { fontSize: 12.5, lineHeight: 17 }]}>{summarize(a.conditions, flowName)}</Text>
            <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 9 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${a.name}`}
                onPress={() => setForm(formFrom(a))}
                style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}
              >
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.secondary }}>Edit</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${a.name}`}
                onPress={() => confirmDestructive({
                  title: `Delete “${a.name}”?`,
                  message: 'Tests and flows still using it must be detached first.',
                  confirmLabel: 'Delete',
                  onConfirm: () => remove.mutate(a.id),
                })}
                style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}
              >
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.neg }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScreenShell>
  )
}
