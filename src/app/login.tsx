import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../stores/auth'
import { extractInviteToken } from '../utils/invite'
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
  // Invite links point at the panel (universal links need a paid Apple
  // account), so a phone can't open one in-app — pasting it is the way in.
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const openInvite = () => {
    const token = extractInviteToken(inviteLink)
    if (!token) return setInviteError("That doesn't look like an invite link. Paste the whole link from the email.")
    setInviteError(null)
    router.push({ pathname: '/invite/[token]', params: { token } })
  }

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
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.white }}>{busy ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => router.push('/register')}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.accent }}>Create a workspace</Text>
        </Pressable>

        {inviteOpen ? (
          <View style={{ gap: 10 }}>
            <TextInput style={inputStyle} placeholder="https://panel.testerify.com/invite/…" placeholderTextColor={colors.muted}
              autoCapitalize="none" autoCorrect={false} accessibilityLabel="Invite link"
              value={inviteLink} onChangeText={setInviteLink} testID="invite-link" />
            {inviteError && <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.neg }}>{inviteError}</Text>}
            <Pressable accessibilityRole="button" onPress={openInvite} disabled={!inviteLink.trim()}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 13, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: inviteLink.trim() ? 1 : 0.6 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.ink }}>Open invitation</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setInviteOpen(true)}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.secondary }}>Have an invite link?</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
