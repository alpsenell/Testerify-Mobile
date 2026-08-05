import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../stores/auth'
import { colors, fonts, type } from '../theme'

const inputStyle = {
  height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
  backgroundColor: colors.card, color: colors.ink, fontFamily: fonts.sans, fontSize: 14, paddingHorizontal: 13,
} as const

// Mirrors api/auth/register.js's own check, so the obvious mistake is caught
// before a round-trip. The server stays the authority.
const MIN_PASSWORD = 8

export function RegisterScreen() {
  const signUp = useAuth((s) => s.signUp)
  const [companyName, setCompanyName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const filled = !!companyName.trim() && !!name.trim() && !!email.trim() && !!password
  const disabled = busy || !filled

  const submit = async () => {
    if (password.length < MIN_PASSWORD) {
      return setError(`Password must be at least ${MIN_PASSWORD} characters.`)
    }
    setBusy(true); setError(null)
    try {
      await signUp(companyName.trim(), name.trim(), email.trim(), password)
      router.replace('/(tabs)')
    } catch (e) {
      // A taken email comes back as a 409 whose message ApiError already
      // carries ("Email already registered") — surface it as-is.
      setError(e instanceof Error ? e.message : 'Could not create your workspace.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 14 }}>
          <Text style={type.kicker}>Testerify · Mobile</Text>
          <Text style={type.h1}>Create a workspace</Text>
          <Text style={type.body}>You'll be its admin. Add the storefront snippet from the desktop panel afterwards.</Text>
          <TextInput style={inputStyle} placeholder="Store or company name" placeholderTextColor={colors.muted}
            value={companyName} onChangeText={setCompanyName} testID="companyName" accessibilityLabel="Company name" />
          <TextInput style={inputStyle} placeholder="Your name" placeholderTextColor={colors.muted}
            value={name} onChangeText={setName} testID="name" accessibilityLabel="Your name" />
          <TextInput style={inputStyle} placeholder="you@store.com" placeholderTextColor={colors.muted}
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            value={email} onChangeText={setEmail} testID="email" accessibilityLabel="Email" />
          <TextInput style={inputStyle} placeholder={`Password (${MIN_PASSWORD}+ characters)`} placeholderTextColor={colors.muted}
            secureTextEntry value={password} onChangeText={setPassword} testID="password" accessibilityLabel="Password" />
          {error && <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.neg }}>{error}</Text>}
          <Pressable accessibilityRole="button" onPress={submit} disabled={disabled}
            style={{ backgroundColor: colors.accent, opacity: disabled ? 0.6 : 1, borderRadius: 13, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.white }}>
              {busy ? 'Creating…' : 'Create workspace'}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.accent }}>
              Already have an account? Sign in
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
