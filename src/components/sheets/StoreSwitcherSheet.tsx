import { Pressable, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchStores } from '../../api/auth'
import type { Store } from '../../api/auth'
import { qk } from '../../api/keys'
import { useAuth } from '../../stores/auth'
import { useSheets } from '../../stores/sheets'
import { useToast } from '../../stores/toast'
import { roleLabel } from '../../utils/roles'
import { Icon } from '../Icon'
import { RetryCard } from '../RetryCard'
import { Skeleton } from '../Skeleton'
import { colors, fonts, type } from '../../theme'

export function StoreSwitcherSheet() {
  const close = useSheets((s) => s.close)
  const show = useToast((s) => s.show)
  const qc = useQueryClient()
  const switchStore = useAuth((s) => s.switchStore)
  const activeCompanyId = useAuth((s) => s.company?.id ?? null)

  const stores = useQuery({ queryKey: qk.stores(), queryFn: fetchStores })

  const pick = useMutation({
    mutationFn: (store: Store) => switchStore(store.id),
    onSuccess: (_company, store) => {
      // Every cached query is tenant-scoped, so this is a clear, not an
      // invalidate: an invalidate would keep serving the previous store's data
      // from cache while the refetches are in flight.
      qc.clear()
      close()
      show(`You're now in ${store.name}.`)
    },
    onError: (e) => show(e instanceof Error ? e.message : 'Could not switch store. Try again.'),
  })

  const active = stores.data?.activeCompanyId ?? activeCompanyId

  return (
    <View>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 19, color: colors.ink, marginBottom: 4 }}>Switch workspace</Text>
      <Text style={[type.body, { marginBottom: 14 }]}>
        Everything on every screen re-loads for the store you pick. Your role can differ per store.
      </Text>

      {stores.isPending ? (
        <View style={{ gap: 9 }}>
          <Skeleton height={60} />
          <Skeleton height={60} />
        </View>
      ) : stores.isError || !stores.data ? (
        <RetryCard onRetry={() => stores.refetch()} />
      ) : (
        <View style={{ gap: 9 }}>
          {stores.data.stores.map((store) => {
            const isActive = store.id === active
            return (
              <Pressable
                key={store.id}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${store.name}`}
                accessibilityState={{ selected: isActive, disabled: pick.isPending }}
                disabled={isActive || pick.isPending}
                onPress={() => pick.mutate(store)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 60, padding: 13,
                  backgroundColor: isActive ? colors.accentSoft : colors.card,
                  borderWidth: 1, borderColor: isActive ? colors.accentBorder : colors.border, borderRadius: 14,
                  opacity: pick.isPending && !isActive ? 0.6 : 1,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink }} numberOfLines={1}>{store.name}</Text>
                  <Text style={[type.small, { fontSize: 12.5, marginTop: 2 }]} numberOfLines={1}>
                    {roleLabel(store.role)}
                    {isActive ? ' · current' : ''}
                  </Text>
                </View>
                {isActive ? <Icon name="check" size={17} color={colors.accent} /> : null}
              </Pressable>
            )
          })}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={close}
        style={{ marginTop: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink }}>Cancel</Text>
      </Pressable>
    </View>
  )
}
