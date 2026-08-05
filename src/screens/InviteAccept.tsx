import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { fetchInvitePreview } from '../api/auth'
import { ApiError } from '../api/client'
import { RetryCard } from '../components/RetryCard'
import { Skeleton } from '../components/Skeleton'
import { useAuth } from '../stores/auth'
import { extractInviteToken, inviteRejectionCopy } from '../utils/invite'
import { roleLabel } from '../utils/roles'
import { colors, fonts, type } from '../theme'

const inputStyle = {
  height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
  backgroundColor: colors.card, color: colors.ink, fontFamily: fonts.sans, fontSize: 14, paddingHorizontal: 13,
} as const

// Mirrors api/auth/invite.js's own check.
const MIN_PASSWORD = 8

// Reached as testerifymobile://invite/<token> (expo-router maps the scheme from
// app.json — no Linking code needed) or by pasting a panel link. Universal
// links are deferred: they need a paid Apple account.
export function InviteAcceptScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>()
  const paramToken = Array.isArray(params.token) ? params.token[0] : params.token

  const signedIn = useAuth((s) => s.status === 'signedIn')
  const signOut = useAuth((s) => s.signOut)
  const acceptInvite = useAuth((s) => s.acceptInvite)

  // Fallback for a link that couldn't be opened in-app (no universal links yet):
  // paste the panel URL and we take the token off the end.
  const [pasted, setPasted] = useState('')
  const [pastedToken, setPastedToken] = useState<string | null>(null)
  const [pasteError, setPasteError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const token = extractInviteToken(paramToken) ?? pastedToken

  const preview = useQuery({
    queryKey: ['invite', token],
    queryFn: () => fetchInvitePreview(token as string),
    enabled: !!token,
    // A 410 (expired/revoked/already used) never becomes valid on a retry.
    retry: false,
  })

  const err = preview.error
  const rejection = err instanceof ApiError && err.status === 410
    ? inviteRejectionCopy((err.body as { reason?: string } | null)?.reason)
    : null

  const usePasted = () => {
    const found = extractInviteToken(pasted)
    if (!found) return setPasteError("That doesn't look like an invite link. Paste the whole link from the email.")
    setPasteError(null)
    setPastedToken(found)
  }

  const submit = async () => {
    if (password.length < MIN_PASSWORD) {
      return setError(`Password must be at least ${MIN_PASSWORD} characters.`)
    }
    setBusy(true); setError(null)
    try {
      await acceptInvite(token as string, name.trim(), password)
      router.replace('/(tabs)')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept this invitation.')
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || !name.trim() || !password

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 14 }}>
          <Text style={type.kicker}>Testerify · Invitation</Text>

          {!token ? (
            <>
              <Text style={type.h1}>Open your invite</Text>
              <Text style={type.body}>Paste the invite link your teammate sent you.</Text>
              <TextInput style={inputStyle} placeholder="https://panel.testerify.com/invite/…" placeholderTextColor={colors.muted}
                autoCapitalize="none" autoCorrect={false} accessibilityLabel="Invite link"
                value={pasted} onChangeText={setPasted} testID="invite-link" />
              {pasteError && <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.neg }}>{pasteError}</Text>}
              <Pressable accessibilityRole="button" onPress={usePasted} disabled={!pasted.trim()}
                style={{ backgroundColor: colors.accent, opacity: pasted.trim() ? 1 : 0.6, borderRadius: 13, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.white }}>Continue</Text>
              </Pressable>
            </>
          ) : preview.isPending ? (
            <View style={{ gap: 10 }}>
              <Text style={type.h1}>Loading invitation…</Text>
              <Skeleton height={120} />
            </View>
          ) : rejection ? (
            <>
              <Text style={type.h1}>Invitation unavailable</Text>
              <Text style={type.body}>{rejection}</Text>
            </>
          ) : preview.isError || !preview.data ? (
            <>
              <Text style={type.h1}>Invitation</Text>
              <RetryCard message="Couldn't load this invitation. Check your connection." onRetry={() => preview.refetch()} />
            </>
          ) : (
            <>
              <Text style={type.h1}>Join {preview.data.companyName}</Text>
              <Text style={type.body}>
                You've been invited as {roleLabel(preview.data.role).toLowerCase()} ({preview.data.email}). Set a password to get started.
              </Text>

              {/* Accepting mints a NEW user for the invited email, so it
                  replaces the session that's open — say so before the form. */}
              {signedIn ? (
                <View style={{ gap: 9, padding: 13, backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
                  <Text style={[type.body, { color: colors.secondary }]}>
                    You're already signed in. Accepting this invitation creates a separate account for {preview.data.email} and signs you out of the current one.
                  </Text>
                  <Pressable accessibilityRole="button" onPress={() => { signOut().catch(() => {}) }}
                    style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 11 }}>
                    <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.neg }}>Sign out first</Text>
                  </Pressable>
                </View>
              ) : null}

              <TextInput style={inputStyle} placeholder="Your name" placeholderTextColor={colors.muted}
                value={name} onChangeText={setName} testID="name" accessibilityLabel="Your name" />
              <TextInput style={inputStyle} placeholder={`Password (${MIN_PASSWORD}+ characters)`} placeholderTextColor={colors.muted}
                secureTextEntry value={password} onChangeText={setPassword} testID="password" accessibilityLabel="Password" />
              {error && <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.neg }}>{error}</Text>}
              <Pressable accessibilityRole="button" onPress={submit} disabled={disabled}
                style={{ backgroundColor: colors.accent, opacity: disabled ? 0.6 : 1, borderRadius: 13, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.white }}>
                  {busy ? 'Joining…' : 'Join workspace'}
                </Text>
              </Pressable>
            </>
          )}

          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.accent }}>Back to sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
