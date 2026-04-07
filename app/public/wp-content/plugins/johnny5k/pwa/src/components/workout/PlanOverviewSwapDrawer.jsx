import { useEffect, useState } from 'react'
import { adminApi, aiApi, trainingApi } from '../../api/client'
import { useAuthStore } from '../../store/authStore'

export default function PlanOverviewSwapDrawer({
  isOpen,
  dayType,
  exercise,
  onClose,
  onSwap,
  onClearSwap,
}) {
  const isAdmin = useAuthStore(state => state.isAdmin)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchingLibrary, setSearchingLibrary] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectingExerciseId, setSelectingExerciseId] = useState(0)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiOpinion, setAiOpinion] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiSources, setAiSources] = useState([])
  const [savingSuggestionName, setSavingSuggestionName] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setSearchQuery('')
    setSearchResults([])
    setSearchError('')
    setSelectingExerciseId(0)
    setAiPrompt('')
    setAiLoading(false)
    setAiError('')
    setAiOpinion('')
    setAiSuggestions([])
    setAiSources([])
    setSavingSuggestionName('')
    setSaveMessage('')
  }, [exercise?.plan_exercise_id, isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !exercise) return undefined

    const query = searchQuery.trim()
    if (query.length < 2) {
      setSearchResults([])
      setSearchError('')
      setSearchingLibrary(false)
      return undefined
    }

    let active = true
    const timer = window.setTimeout(async () => {
      setSearchingLibrary(true)
      setSearchError('')

      try {
        const rows = await trainingApi.getExercises({
          q: query,
          limit: 10,
          day_type: dayType || '',
          preferred_muscle: exercise.primary_muscle || '',
          preferred_equipment: exercise.equipment || '',
        })

        if (!active) return
        setSearchResults(Array.isArray(rows) ? rows.filter(candidate => Number(candidate.id) !== Number(exercise.exercise_id)) : [])
      } catch (error) {
        if (!active) return
        setSearchError(error?.message || 'Could not search the exercise library.')
      } finally {
        if (active) {
          setSearchingLibrary(false)
        }
      }
    }, 240)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [dayType, exercise, isOpen, searchQuery])

  if (!isOpen || !exercise) {
    return null
  }

  const localOptions = dedupeExercisePool([
    ...(Array.isArray(exercise.swap_options) ? exercise.swap_options : []),
    ...searchResults,
  ]).filter(option => Number(option.id) !== Number(exercise.exercise_id))

  async function handleChoose(option) {
    setSelectingExerciseId(option.id)
    try {
      await onSwap(exercise.plan_exercise_id, option.id)
      onClose()
    } finally {
      setSelectingExerciseId(0)
    }
  }

  async function handleResetToProgrammed() {
    setSelectingExerciseId(-1)
    try {
      await onClearSwap(exercise.plan_exercise_id)
      onClose()
    } finally {
      setSelectingExerciseId(0)
    }
  }

  async function handleAskJohnny(event) {
    event?.preventDefault()
    const prompt = aiPrompt.trim()
    if (!prompt || aiLoading) return

    setAiLoading(true)
    setAiError('')
    setAiOpinion('')
    setAiSuggestions([])
    setAiSources([])
    setSaveMessage('')

    const listedOptions = (exercise.swap_options ?? []).map(option => option.name).filter(Boolean).join(', ')
    const message = `I am editing a pre-workout plan in Johnny5k before starting the session. Current exercise: ${exercise.exercise_name}. Program slot: ${humanizeToken(exercise.slot_type) || 'accessory'}. Target area: ${humanizeToken(exercise.primary_muscle) || 'general'}. Equipment setup: ${humanizeToken(exercise.equipment) || 'mixed'}. Current library replacements: ${listedOptions || 'none listed'}. User request: ${prompt}. Review whether this is a good idea for this training slot. Prefer replacements that already fit the current library and only broaden beyond that if the user's request clearly asks for it. Respond in exactly this format: Opinion: one short paragraph. Then a line that says Options:. Then 2 to 4 lines in this format only: Exercise Name | short reason.`

    try {
      const data = await aiApi.chat(message, `workout-plan-swap-${exercise.plan_exercise_id}`, 'coach', {
        context: {
          surface: 'workout_plan_swap',
          current_screen: 'workout',
          current_exercise: exercise.exercise_name,
          plan_exercise_id: exercise.plan_exercise_id,
          day_type: dayType || '',
          slot_type: exercise.slot_type || '',
          primary_muscle: exercise.primary_muscle || '',
          equipment: exercise.equipment || '',
          available_swap_names: (exercise.swap_options ?? []).map(option => option.name),
        },
      })

      const parsed = parseAiSwapReviewReply(data.reply || '')
      const suggestions = parsed.options.length
        ? await resolveAiSwapSuggestions(parsed.options, exercise, dayType)
        : []

      setAiOpinion(parsed.opinion)
      setAiSuggestions(suggestions)
      setAiSources(Array.isArray(data.sources) ? data.sources : [])
    } catch (error) {
      setAiError(error?.message || 'Johnny could not review that swap right now.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSaveSuggestion(suggestion) {
    if (!isAdmin || !suggestion?.name || savingSuggestionName) return

    setSavingSuggestionName(suggestion.name)
    setAiError('')
    setSaveMessage('')

    try {
      const payload = buildSuggestedExercisePayload({
        suggestion,
        exercise,
        dayType,
        aiPrompt,
      })
      const result = await adminApi.saveExercise(payload)
      const savedExerciseId = Number(result?.id)

      if (!savedExerciseId) {
        throw new Error('Johnny could not save that exercise to the library.')
      }

      const baseExerciseId = getSubstitutionBaseExerciseId(exercise)
      if (baseExerciseId > 0 && baseExerciseId !== savedExerciseId) {
        await adminApi.saveSubstitution({
          exercise_id: baseExerciseId,
          substitute_exercise_id: savedExerciseId,
          reason_code: inferSubstitutionReasonCode({ exercise, aiPrompt }),
          priority: 1,
        })
      }

      const savedExercise = {
        id: savedExerciseId,
        name: suggestion.name,
        primary_muscle: exercise.primary_muscle || '',
        equipment: exercise.equipment || 'other',
        difficulty: exercise.difficulty || 'beginner',
      }

      setSaveMessage(`${suggestion.name} was added to the exercise library, registered as a future swap option, and swapped into this plan.`)
      await handleChoose(savedExercise)
    } catch (error) {
      setAiError(error?.message || 'Could not save that exercise to the library.')
    } finally {
      setSavingSuggestionName('')
    }
  }

  return (
    <div className="exercise-drawer-shell" role="dialog" aria-modal="true" aria-labelledby={`plan-overview-swap-${exercise.plan_exercise_id}`}>
      <button type="button" className="exercise-drawer-backdrop" aria-label="Close swap drawer" onClick={onClose} />
      <aside className="exercise-drawer workout-plan-swap-drawer">
        <div className="exercise-drawer-head">
          <div>
            <p className="exercise-drawer-eyebrow">Plan Overview</p>
            <h3 id={`plan-overview-swap-${exercise.plan_exercise_id}`}>Swap {exercise.exercise_name}</h3>
          </div>
          <button type="button" className="exercise-drawer-close" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="exercise-drawer-subtitle">
          {exercise.was_swapped
            ? `${exercise.exercise_name} is currently replacing ${exercise.original_exercise_name}.`
            : `Pick a replacement from your exercise library first, then ask Johnny to review anything more specific.`}
        </p>

        <section className="workout-context-card workout-plan-drawer-section">
          <div className="dashboard-card-head">
            <span className="dashboard-chip subtle">Current fit</span>
          </div>
          <div className="exercise-context-grid">
            <div className="exercise-context-item">
              <span className="exercise-card-label">Slot</span>
              <strong>{humanizeToken(exercise.slot_type) || 'Accessory'}</strong>
            </div>
            <div className="exercise-context-item">
              <span className="exercise-card-label">Target</span>
              <strong>{humanizeToken(exercise.primary_muscle) || 'General'}</strong>
            </div>
            <div className="exercise-context-item">
              <span className="exercise-card-label">Equipment</span>
              <strong>{humanizeToken(exercise.equipment) || 'Mixed'}</strong>
            </div>
          </div>
          {exercise.was_swapped ? (
            <button type="button" className="btn-outline small johnny-action-link" onClick={handleResetToProgrammed} disabled={selectingExerciseId === -1}>
              {selectingExerciseId === -1 ? 'Resetting...' : 'Use programmed exercise'}
            </button>
          ) : null}
        </section>

        <section className="workout-context-card workout-plan-drawer-section">
          <div className="dashboard-card-head">
            <span className="dashboard-chip subtle">Exercise library</span>
          </div>
          <label className="exercise-note-label" htmlFor={`plan-swap-search-${exercise.plan_exercise_id}`}>Search saved exercises</label>
          <input
            id={`plan-swap-search-${exercise.plan_exercise_id}`}
            type="text"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search your exercise library"
          />
          {searchingLibrary ? <p className="settings-subtitle">Searching the library...</p> : null}
          {searchError ? <p className="error">{searchError}</p> : null}
          {localOptions.length ? (
            <div className="workout-swap-list">
              {localOptions.map(option => (
                <div key={option.id} className="workout-swap-row">
                  <div>
                    <strong>{option.name}</strong>
                    <p>{option.swap_reason || buildLocalOptionReason(option, exercise)}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-outline small"
                    onClick={() => handleChoose(option)}
                    disabled={selectingExerciseId === option.id}
                  >
                    {selectingExerciseId === option.id ? 'Swapping...' : 'Swap in'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="settings-subtitle">No saved replacements match this slot yet. Ask Johnny below if you want a broader review.</p>
          )}
        </section>

        <section className="workout-context-card workout-plan-drawer-section">
          <div className="dashboard-card-head">
            <span className="dashboard-chip coach">Ask Johnny</span>
          </div>
          <p className="settings-subtitle">Johnny will stay inside your saved exercise library by default. If you explicitly ask him to check broader options, he can review that too and show sources when available.</p>
          <form className="exercise-ai-swap-form" onSubmit={handleAskJohnny}>
            <label className="exercise-note-label" htmlFor={`plan-swap-ai-${exercise.plan_exercise_id}`}>Describe what you want instead</label>
            <textarea
              id={`plan-swap-ai-${exercise.plan_exercise_id}`}
              value={aiPrompt}
              onChange={event => setAiPrompt(event.target.value)}
              placeholder="Example: I want a machine-based chest option because my shoulder feels touchy."
            />
            <div className="exercise-panel-actions">
              <button type="submit" className="btn-secondary small" disabled={aiLoading || !aiPrompt.trim()}>
                {aiLoading ? 'Reviewing...' : 'Ask Johnny to review'}
              </button>
            </div>
          </form>

          {aiError ? <p className="error">{aiError}</p> : null}
          {saveMessage ? <p className="success-msg">{saveMessage}</p> : null}
          {aiOpinion ? (
            <div className="exercise-ai-swap-reply">
              <p>{aiOpinion}</p>
            </div>
          ) : null}
          {aiSuggestions.length ? (
            <div className="exercise-ai-swap-list">
              {aiSuggestions.map((suggestion, index) => {
                const matchedExercise = suggestion.match

                return (
                  <div key={`${exercise.plan_exercise_id}-ai-${index}`} className="exercise-ai-swap-row">
                    <div>
                      <strong>{matchedExercise?.name || suggestion.name}</strong>
                      {matchedExercise && matchedExercise.name !== suggestion.name ? (
                        <p>Johnny suggested {suggestion.name}. Closest library match: {matchedExercise.name}. {suggestion.reason}</p>
                      ) : (
                        <p>{suggestion.reason}</p>
                      )}
                    </div>
                    {matchedExercise ? (
                      <button
                        type="button"
                        className="btn-outline small"
                        onClick={() => handleChoose(matchedExercise)}
                        disabled={selectingExerciseId === matchedExercise.id}
                      >
                        {selectingExerciseId === matchedExercise.id ? 'Swapping...' : 'Swap in'}
                      </button>
                    ) : isAdmin ? (
                      <button
                        type="button"
                        className="btn-outline small"
                        onClick={() => handleSaveSuggestion(suggestion)}
                        disabled={savingSuggestionName === suggestion.name}
                      >
                        {savingSuggestionName === suggestion.name ? 'Saving...' : 'Save and swap in'}
                      </button>
                    ) : (
                      <span className="exercise-ai-swap-missing">No saved match</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}
          {aiSources.length ? (
            <div className="chat-sources workout-plan-drawer-sources">
              {aiSources.map(source => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.title || source.url}
                </a>
              ))}
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  )
}

function buildSuggestedExercisePayload({ suggestion, exercise, dayType, aiPrompt }) {
  return {
    name: suggestion.name,
    slug: slugifyExerciseName(suggestion.name),
    description: buildSuggestedExerciseDescription(suggestion, aiPrompt),
    movement_pattern: exercise.movement_pattern || '',
    primary_muscle: exercise.primary_muscle || '',
    equipment: exercise.equipment || 'other',
    difficulty: exercise.difficulty || 'beginner',
    day_types: dayType ? [dayType] : [],
    slot_types: exercise.slot_type ? [exercise.slot_type] : [],
    active: 1,
  }
}

function buildSuggestedExerciseDescription(suggestion, aiPrompt) {
  const parts = [String(suggestion?.reason || '').trim(), String(aiPrompt || '').trim()]
    .filter(Boolean)

  return parts.join(' Request context: ')
}

function slugifyExerciseName(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getSubstitutionBaseExerciseId(exercise) {
  const originalExerciseId = Number(exercise?.original_exercise_id || 0)
  if (originalExerciseId > 0) {
    return originalExerciseId
  }

  return Number(exercise?.exercise_id || 0)
}

function inferSubstitutionReasonCode({ exercise, aiPrompt }) {
  const prompt = String(aiPrompt || '').toLowerCase()
  const equipment = String(exercise?.equipment || '').toLowerCase()

  if (/shoulder|elbow|wrist|knee|hip|back|pain|hurt|injur|joint/.test(prompt)) {
    return 'joint_friendly'
  }

  if (equipment && prompt.includes('machine')) {
    return 'equipment'
  }

  if (/beginner|easier|simpler|learn|skill|advanced|harder/.test(prompt)) {
    return 'skill_level'
  }

  return 'variation'
}

function parseAiSwapReviewReply(reply) {
  const lines = String(reply || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const opinionLine = lines.find(line => /^opinion\s*:/i.test(line)) || ''
  const optionLines = lines.filter(line => line.includes('|'))
  const opinion = opinionLine
    ? opinionLine.replace(/^opinion\s*:/i, '').trim()
    : lines.filter(line => !/^options\s*:/i.test(line) && !line.includes('|')).join(' ').trim()

  return {
    opinion,
    options: optionLines
      .map(line => {
        const parts = line.split('|')
        if (parts.length < 2) {
          return null
        }

        return {
          name: parts[0].trim(),
          reason: parts.slice(1).join('|').trim(),
        }
      })
      .filter(Boolean)
      .slice(0, 4),
  }
}

async function resolveAiSwapSuggestions(suggestions, exercise, dayType) {
  const swapOptions = (exercise.swap_options ?? []).map(option => ({
    id: option.id,
    name: option.name,
    primary_muscle: exercise.primary_muscle,
    equipment: exercise.equipment,
    difficulty: option.difficulty,
  }))

  return Promise.all(suggestions.map(async suggestion => {
    let searchResults = []

    try {
      searchResults = await trainingApi.getExercises({
        q: suggestion.name,
        limit: 8,
        day_type: dayType || '',
        preferred_muscle: exercise.primary_muscle || '',
        preferred_equipment: exercise.equipment || '',
      })
    } catch {
      searchResults = []
    }

    const pool = dedupeExercisePool([
      ...swapOptions,
      ...(Array.isArray(searchResults) ? searchResults : []),
    ]).filter(candidate => Number(candidate.id) !== Number(exercise.exercise_id))

    return {
      ...suggestion,
      match: findBestExerciseMatch(suggestion.name, pool),
    }
  }))
}

function dedupeExercisePool(items) {
  const seen = new Map()

  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue
    seen.set(item.id, item)
  }

  return Array.from(seen.values())
}

function findBestExerciseMatch(name, pool) {
  const target = normalizeExerciseName(name)
  if (!target) return null

  let bestMatch = null
  let bestScore = 0

  for (const candidate of pool) {
    const candidateName = normalizeExerciseName(candidate?.name)
    if (!candidateName) continue

    let score = 0
    if (candidateName === target) {
      score = 100
    } else if (candidateName.includes(target) || target.includes(candidateName)) {
      score = 82
    } else {
      const targetTokens = tokeniseExerciseName(target)
      const candidateTokens = tokeniseExerciseName(candidateName)
      const overlap = targetTokens.filter(token => candidateTokens.includes(token)).length
      score = overlap * 22

      if (targetTokens[0] && targetTokens[0] === candidateTokens[0]) {
        score += 8
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = candidate
    }
  }

  return bestScore >= 30 ? bestMatch : null
}

function normalizeExerciseName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokeniseExerciseName(value) {
  return normalizeExerciseName(value)
    .split(' ')
    .filter(token => token.length > 2)
}

function buildLocalOptionReason(option, exercise) {
  const reasons = []

  if (option.primary_muscle && option.primary_muscle === exercise.primary_muscle) {
    reasons.push('Hits the same primary muscle.')
  }
  if (option.equipment && option.equipment !== exercise.equipment) {
    reasons.push(`Changes the setup to ${humanizeToken(option.equipment).toLowerCase()}.`)
  }
  if (!reasons.length) {
    reasons.push('Fits the same training slot from your saved exercise library.')
  }

  return reasons.slice(0, 2).join(' ')
}

function humanizeToken(value) {
  if (!value) return ''
  return String(value).replace(/[_-]+/g, ' ').trim()
}