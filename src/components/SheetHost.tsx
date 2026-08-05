import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'
import { useSheets } from '../stores/sheets'
import { colors, radius } from '../theme'
import { MoreSheet } from './sheets/MoreSheet'
import { ShipSheet } from './sheets/ShipSheet'
import { CopilotSheet } from './sheets/CopilotSheet'
import { StoreSwitcherSheet } from './sheets/StoreSwitcherSheet'

export function SheetHost() {
  const sheet = useSheets((s) => s.sheet)
  const close = useSheets((s) => s.close)
  const ref = useRef<BottomSheetModal>(null)
  // Whether present() has ever run. Calling dismiss() on a modal that was
  // never presented wedges it: BottomSheetModal sets status DISMISSING, the
  // close animation has no mounted sheet to run on, the status never
  // resolves, and every later present() is silently dropped by
  // handlePortalRender. The mount-time effect (sheet = null) must no-op.
  const presented = useRef(false)

  useEffect(() => {
    if (sheet) {
      presented.current = true
      ref.current?.present()
    } else if (presented.current) {
      presented.current = false
      ref.current?.dismiss()
    }
  }, [sheet])

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      onDismiss={close}
      backdropComponent={(p) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.34} style={{ backgroundColor: colors.ink }} />}
      backgroundStyle={{ backgroundColor: colors.paper, borderTopLeftRadius: Platform.OS === 'android' ? 16 : radius.sheet, borderTopRightRadius: Platform.OS === 'android' ? 16 : radius.sheet }}
      handleIndicatorStyle={{ backgroundColor: colors.handle, width: 38 }}
    >
      <BottomSheetView style={{ padding: 16, paddingBottom: 34 }}>
        {sheet?.kind === 'more' && <MoreSheet />}
        {sheet?.kind === 'ship' && <ShipSheet />}
        {sheet?.kind === 'copilot' && <CopilotSheet />}
        {sheet?.kind === 'storeSwitcher' && <StoreSwitcherSheet />}
      </BottomSheetView>
    </BottomSheetModal>
  )
}
