import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSuggestions, generateSuggestions, generateTestDraft, type AiIdea } from '../../api/ai'
import { useSheets } from '../../stores/sheets'
import { useToast } from '../../stores/toast'
import { useFavorites } from '../../stores/favorites'
import { draftRequestFor, ideaTag, impactColor } from '../../utils/copilot'
import { Icon } from '../Icon'
import { Skeleton } from '../Skeleton'
import { colors, fonts, radius, type } from '../../theme'

const GOAL_CHIPS = [
  'Increase add-to-cart rate',
  'Reduce mobile checkout drop-off',
  'Raise average order value',
  'Improve email signup',
]

const errMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

function IdeaCard({ idea, active, disabled, onBuild, onSave, saved }: {
  idea: AiIdea; active: boolean; disabled: boolean; onBuild: () => void; onSave: () => void; saved: boolean
}) {
  return (
    <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ backgroundColor: colors.accentSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.accent }}>
            {ideaTag(idea)}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: impactColor(idea.impact) }}>{idea.impact} impact</Text>
      </View>
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink, marginBottom: 4 }}>{idea.title}</Text>
      <Text style={[type.body, { marginBottom: 12 }]}>{idea.hypothesis}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          disabled={disabled}
          onPress={onBuild}
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: colors.accent, borderRadius: 12, minHeight: 44,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Icon name="sparkle" size={16} color={colors.white} />
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: colors.white }}>
            {active ? 'Building…' : 'Build draft'}
          </Text>
        </Pressable>
        {/* Saves the idea to the on-device Favorites store so it survives the
            sheet closing — the Phase-1 omission this closes. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={saved ? `Saved: ${idea.title}` : `Save ${idea.title} to favorites`}
          onPress={onSave}
          style={{
            width: 48, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: saved ? colors.accent : colors.border,
            backgroundColor: saved ? colors.accentSoft : 'transparent',
            borderRadius: 12, minHeight: 44,
          }}
        >
          <Icon name={saved ? 'check' : 'plus'} size={18} color={saved ? colors.accent : colors.secondary} />
        </Pressable>
      </View>
    </View>
  )
}

export function CopilotSheet() {
  const close = useSheets((s) => s.close)
  const show = useToast((s) => s.show)
  const qc = useQueryClient()
  const saveIdea = useFavorites((s) => s.saveIdea)
  const savedIdeas = useFavorites((s) => s.savedIdeas)
  const [goal, setGoal] = useState('')

  const { data, isPending: suggestionsPending } = useQuery({ queryKey: ['suggestions'], queryFn: fetchSuggestions })

  // No client-side timeout: this scans the store + calls the AI and can
  // legitimately take 30-60s. Let it run.
  const generate = useMutation({ mutationFn: (g: string) => generateSuggestions(g) })

  const build = useMutation({
    mutationFn: (input: ReturnType<typeof draftRequestFor>) => generateTestDraft(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      close()
      show('Draft created — find it under Tests. Edit variants on the desktop panel.')
    },
    onError: (e) => show(errMessage(e, 'Could not build the draft. Try again.')),
  })

  const submitGoal = () => {
    const trimmed = goal.trim()
    if (!trimmed || generate.isPending) return
    generate.mutate(trimmed)
  }

  const ideas: AiIdea[] = generate.isSuccess ? generate.data.ideas : (data?.ideas ?? [])
  const listHeader = generate.isSuccess ? 'Generated ideas' : 'Suggested for your store'
  const status = generate.isPending ? 'thinking…' : generate.isSuccess ? 'ready' : 'online'

  // Concurrent builds aren't supported (a success closes the whole sheet), so
  // ANY card's Build button is disabled while a build is in flight — only the
  // one actually being built shows "Building…"; the rest just look dimmed.
  const isActiveBuild = (idea: AiIdea) => build.isPending && build.variables?.name === idea.title

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={17} color={colors.accent} />
        </View>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 17, color: colors.ink, flex: 1 }}>Co-pilot</Text>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}>{status}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <TextInput
          testID="copilot-goal-input"
          style={{
            flex: 1, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
            backgroundColor: colors.card, color: colors.ink, fontFamily: fonts.sans, fontSize: 13.5, paddingHorizontal: 13,
          }}
          placeholder="Describe a goal — e.g. increase add-to-cart rate"
          placeholderTextColor={colors.muted}
          value={goal}
          onChangeText={setGoal}
          onSubmitEditing={submitGoal}
          returnKeyType="send"
        />
        <Pressable
          testID="copilot-send"
          onPress={submitGoal}
          disabled={generate.isPending || !goal.trim()}
          style={{
            width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent,
            alignItems: 'center', justifyContent: 'center',
            opacity: generate.isPending || !goal.trim() ? 0.6 : 1,
          }}
        >
          <Icon name="send" size={17} color={colors.white} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 14 }}>
        {GOAL_CHIPS.map((chip) => (
          <Pressable
            key={chip}
            onPress={() => !generate.isPending && generate.mutate(chip)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, borderRadius: radius.chip,
              paddingHorizontal: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
            }}
          >
            <Icon name="bolt" size={13} color={colors.accent} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12.5, color: colors.secondary }}>{chip}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {generate.isError && (
        <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.neg, marginBottom: 12 }}>
          {errMessage(generate.error, 'Could not generate ideas. Try again.')}
        </Text>
      )}

      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.ink, marginBottom: 10 }}>{listHeader}</Text>

      {generate.isPending || suggestionsPending ? (
        <>
          <Skeleton height={128} borderRadius={radius.card} />
          <View style={{ height: 10 }} />
          <Skeleton height={128} borderRadius={radius.card} />
          <View style={{ height: 10 }} />
          <Skeleton height={128} borderRadius={radius.card} />
        </>
      ) : ideas.length === 0 ? (
        <Text style={type.body}>
          No suggestions yet. Describe a goal above or tap a chip to get one.
        </Text>
      ) : (
        ideas.map((idea, i) => (
          <IdeaCard
            key={`${idea.title}-${i}`}
            idea={idea}
            active={isActiveBuild(idea)}
            disabled={build.isPending}
            onBuild={() => build.mutate(draftRequestFor(idea))}
            saved={savedIdeas.some((i) => i.title === idea.title)}
            onSave={() => { saveIdea(idea); show(`Saved "${idea.title}" to Favorites.`) }}
          />
        ))
      )}
    </View>
  )
}
