import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'
import { useSheets } from '../stores/sheets'
import { colors, radius } from '../theme'
import { MoreSheet } from './sheets/MoreSheet'
// CopilotSheet (Task 15) and ShipSheet (Task 13) are added to CONTENT when built.

export function SheetHost() {
  const sheet = useSheets((s) => s.sheet)
  const close = useSheets((s) => s.close)
  const ref = useRef<BottomSheetModal>(null)

  useEffect(() => {
    if (sheet) ref.current?.present()
    else ref.current?.dismiss()
  }, [sheet])

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      onDismiss={close}
      backdropComponent={(p) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.34} />}
      backgroundStyle={{ backgroundColor: colors.paper, borderTopLeftRadius: Platform.OS === 'android' ? 16 : radius.sheet, borderTopRightRadius: Platform.OS === 'android' ? 16 : radius.sheet }}
      handleIndicatorStyle={{ backgroundColor: colors.handle, width: 38 }}
    >
      <BottomSheetView style={{ padding: 16, paddingBottom: 34 }}>
        {sheet?.kind === 'more' && <MoreSheet />}
      </BottomSheetView>
    </BottomSheetModal>
  )
}
