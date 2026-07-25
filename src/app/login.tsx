import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../stores/auth'
import { colors, fonts, type } from '../theme'

const inputStyle = {
  height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
  backgroundColor: colors.card, color: colors.ink, fontFamily: fonts.sans, fontSize: 14, paddingHorizontal: 13,
} as const

export default function Login() {
  const signIn = useAuth((s) => s.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      await signIn(email.trim(), password)
      router.replace('/(tabs)')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center', padding: 24 }}>
      <View style={{ gap: 14 }}>
        <Text style={type.kicker}>Testerify · Mobile</Text>
        <Text style={type.h1}>Sign in</Text>
        <TextInput style={inputStyle} placeholder="you@store.com" placeholderTextColor={colors.muted}
          autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} testID="email" />
        <TextInput style={inputStyle} placeholder="Password" placeholderTextColor={colors.muted}
          secureTextEntry value={password} onChangeText={setPassword} testID="password" />
        {error && <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.neg }}>{error}</Text>}
        <Pressable onPress={submit} disabled={busy || !email || !password}
          style={{ backgroundColor: colors.accent, opacity: busy || !email || !password ? 0.6 : 1, borderRadius: 13, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: '#fff' }}>{busy ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
