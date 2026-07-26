import { Pressable, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCampaign, promoteCampaign } from '../../api/campaigns'
import { useSheets } from '../../stores/sheets'
import { useToast } from '../../stores/toast'
import { pct, signedPct } from '../../utils/format'
import { Icon } from '../Icon'
import { colors, fonts, type } from '../../theme'

function FactRow({ label, value, valueColor, last = false }: {
  label: string; value: string; valueColor?: string; last?: boolean
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.hairline,
    }}>
      <Text style={type.small}>{label}</Text>
      <Text style={{ fontFamily: fonts.monoSemi, fontSize: 13.5, color: valueColor ?? colors.ink }}>{value}</Text>
    </View>
  )
}

export function ShipSheet() {
  const sheet = useSheets((s) => s.sheet)
  const close = useSheets((s) => s.close)
  const show = useToast((s) => s.show)
  const qc = useQueryClient()

  const campaignId = sheet?.kind === 'ship' ? sheet.campaignId : null

  const { data: campaign } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => fetchCampaign(campaignId as string),
    enabled: !!campaignId,
  })

  // Defensive: the challenger variant may not exist yet (data still loading,
  // or a malformed/older campaign record with no challengerId).
  const challenger = campaign?.variants.find((v) => v.id === campaign.challengerId) ?? null
  const challengerName = challenger?.name ?? 'the winner'

  const promote = useMutation({
    mutationFn: () => promoteCampaign(campaignId as string, campaign!.challengerId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', campaignId] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      close()
      show(`${challenger?.name ?? 'The winner'} is live for everyone. Rollback stays available for 30 days.`)
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not ship. Try again.'),
  })

  if (!campaignId) return null

  // Ship it stays disabled without a real challenger to promote — never fire
  // the mutation with a bad/undefined variant id.
  const canShip = !!challenger && !!campaign?.challengerId
  const shipDisabled = !canShip || promote.isPending

  return (
    <View>
      <Text style={{ fontFamily: fonts.sans, fontSize: 19, lineHeight: 25, color: colors.ink, marginBottom: 8 }}>
        Ship <Text style={{ fontStyle: 'italic', color: colors.accent }}>{challengerName}</Text> to 100% of traffic?
      </Text>
      <Text style={[type.body, { marginBottom: 14 }]}>
        {challengerName} becomes the only version every visitor sees. The test stops collecting and moves to Learnings — you can roll back for 30 days.
      </Text>

      <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, marginBottom: 16 }}>
        <FactRow label="Winner" value={challenger?.name ?? '—'} />
        <FactRow
          label="Measured uplift"
          value={campaign?.significance ? signedPct(campaign.significance.uplift) : '—'}
          valueColor={colors.pos}
        />
        <FactRow label="Confidence" value={pct(campaign?.significance?.confidence ?? 0, 0)} last />
      </View>

      <Pressable
        disabled={shipDisabled}
        onPress={() => promote.mutate()}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          backgroundColor: colors.accent, borderRadius: 14, minHeight: 52,
          opacity: shipDisabled ? 0.6 : 1,
        }}
      >
        <Icon name="check" size={18} color={colors.white} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.white }}>
          {promote.isPending ? 'Shipping…' : 'Ship it'}
        </Text>
      </Pressable>

      <Pressable
        onPress={close}
        style={{ marginTop: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>Keep testing</Text>
      </Pressable>
    </View>
  )
}
