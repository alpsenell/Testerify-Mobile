import { Alert } from 'react-native'

// One shape for every destructive confirm in the app, so "delete a flow",
// "remove a teammate" and "pause data collection" all read the same way.
// Follows the rollback precedent in TestDetail: native alert, cancel first,
// destructive action styled as such.
export function confirmDestructive({ title, message, confirmLabel, cancelLabel = 'Cancel', onConfirm }: {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
}): void {
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ])
}
