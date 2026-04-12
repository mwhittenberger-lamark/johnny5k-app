import { useEffect, useState } from 'react'
import { aiApi } from '../../api/modules/ai'
import { trainingApi } from '../../api/modules/training'
import AppDrawer from '../ui/AppDrawer'
import ClearableInput from '../ui/ClearableInput'
import ErrorState from '../ui/ErrorState'
import Field from '../ui/Field'
import {
  buildExerciseMeta,
  buildLocalOptionReason,
  dedupeExercisePool,
  humanizeToken,
  isUserOwnedExercise,
  parseAiSwapReviewReply,
  resolveAiSwapSuggestions,
  saveSuggestedExerciseToLibrary,
} from './swapShared'
import { usePersonalExerciseLibrarySwap } from '../../hooks/usePersonalExerciseLibrarySwap'

export default function PlanOverviewSwapDrawer({
  isOpen,
  dayType,
  exercise,
  onClose,
  onSwap,
  onClearSwap,
}) {
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
  const {
    myExercises,
    loadingMyExercises,
    myExercisesError,
    editingExerciseId,
    editDraft,
    savingPersonalExerciseId,
    deletingPersonalExerciseId,
    savedExerciseIds,
    setEditingExerciseId,
    handleEditPersonalExercise: beginEditPersonalExercise,
    handleEditDraftChange: updateEditDraftField,
    handleSavePersonalExercise: persistPersonalExerciseEdit,
    handleDeletePersonalExercise: removePersonalExerciseFromLibrary,
    prependSavedExercise,
  } = usePersonalExerciseLibrarySwap({
    enabled: isOpen && Boolean(exercise),
    exercise,
    dayType,
    searchQuery,
  })

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

  const myExerciseIds = new Set(myExercises.map(option => Number(option.id)))
  const localOptions = dedupeExercisePool([
    ...(Array.isArray(exercise.swap_options) ? exercise.swap_options : []),
    ...searchResults,
  ]).filter(option => Number(option.id) !== Number(exercise.exercise_id) && !myExerciseIds.has(Number(option.id)))

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
    if (!suggestion?.name || savingSuggestionName) return

    setSavingSuggestionName(suggestion.name)
    setAiError('')
    setSaveMessage('')

    try {
      const { savedExercise } = await saveSuggestedExerciseToLibrary({
        suggestion,
        exercise,
        aiPrompt,
        dayTypes: dayType ? [dayType] : [],
        slotTypes: exercise.slot_type ? [exercise.slot_type] : [],
      })
      prependSavedExercise(savedExercise)
      setSaveMessage(`${suggestion.name} was added to your library, registered as a future swap option, and swapped into this plan.`)
      await handleChoose(savedExercise)
    } catch (error) {
      setAiError(error?.message || 'Could not save that exercise to the library.')
    } finally {
      setSavingSuggestionName('')
    }
  }

  function handleEditPersonalExercise(option) {
    beginEditPersonalExercise(option)
    setSearchError('')
  }

  function handleEditDraftChange(key, value) {
    updateEditDraftField(key, value)
  }

  async function handleSavePersonalExercise(optionId) {
    const saved = await persistPersonalExerciseEdit(optionId)
    if (saved) {
      setSaveMessage('Your personal exercise was updated.')
    }
  }

  async function handleDeletePersonalExercise(optionId) {
    const deleted = await removePersonalExerciseFromLibrary(optionId)
    if (deleted) {
      setSaveMessage('That personal exercise was removed from your library.')
    }
  }

  return (
    <AppDrawer
      open
      onClose={onClose}
      overlayClassName="exercise-drawer-shell"
      className="exercise-drawer workout-plan-swap-drawer"
    >
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
          <Field className="exercise-note-label" label="Search saved exercises">
            <ClearableInput
              id={`plan-swap-search-${exercise.plan_exercise_id}`}
              type="text"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search your exercise library"
            />
          </Field>
          {searchingLibrary ? <p className="settings-subtitle">Searching the library...</p> : null}
          {searchError ? <ErrorState className="workout-inline-state" message={searchError} title="Could not search your library" /> : null}
          <div className="workout-swap-subsection-head">
            <strong>My exercises</strong>
            <span className="workout-swap-badge personal">Personal library</span>
          </div>
          {loadingMyExercises ? <p className="settings-subtitle">Loading your saved exercises...</p> : null}
          {myExercisesError ? <ErrorState className="workout-inline-state" message={myExercisesError} title="Could not load your saved exercises" /> : null}
          {myExercises.length ? (
            <div className="workout-swap-list workout-swap-list-personal">
              {myExercises.map(option => {
                const isEditing = editingExerciseId === option.id
                const isRecentlySaved = savedExerciseIds.includes(Number(option.id))

                return (
                  <div key={`personal-${option.id}`} className="workout-swap-row workout-swap-row-card">
                    <div className="workout-swap-row-copy">
                      <div className="workout-swap-row-title">
                        <strong>{option.name}</strong>
                        <span className={`workout-swap-badge ${isRecentlySaved ? 'saved' : 'mine'}`}>
                          {isRecentlySaved ? 'Saved to your library' : 'My exercise'}
                        </span>
                      </div>
                      <p>{buildLocalOptionReason(option, exercise)}</p>
                      <p className="workout-swap-row-meta">{buildExerciseMeta(option)}</p>
                      {isEditing ? (
                        <div className="personal-exercise-editor">
                          <ClearableInput
                            type="text"
                            value={editDraft.name}
                            onChange={event => handleEditDraftChange('name', event.target.value)}
                            placeholder="Exercise name"
                          />
                          <div className="personal-exercise-editor-grid">
                            <ClearableInput
                              type="text"
                              value={editDraft.primary_muscle}
                              onChange={event => handleEditDraftChange('primary_muscle', event.target.value)}
                              placeholder="Primary muscle"
                            />
                            <ClearableInput
                              type="text"
                              value={editDraft.movement_pattern}
                              onChange={event => handleEditDraftChange('movement_pattern', event.target.value)}
                              placeholder="Movement pattern"
                            />
                            <ClearableInput
                              type="text"
                              value={editDraft.equipment}
                              onChange={event => handleEditDraftChange('equipment', event.target.value)}
                              placeholder="Equipment"
                            />
                            <select
                              value={editDraft.difficulty}
                              onChange={event => handleEditDraftChange('difficulty', event.target.value)}
                            >
                              <option value="beginner">Beginner</option>
                              <option value="intermediate">Intermediate</option>
                              <option value="advanced">Advanced</option>
                            </select>
                          </div>
                          <textarea
                            value={editDraft.description}
                            onChange={event => handleEditDraftChange('description', event.target.value)}
                            placeholder="Optional note for how this variation should feel or why you saved it."
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="workout-swap-row-actions">
                      <button
                        type="button"
                        className="btn-outline small"
                        onClick={() => handleChoose(option)}
                        disabled={selectingExerciseId === option.id}
                      >
                        {selectingExerciseId === option.id ? 'Swapping...' : 'Swap in'}
                      </button>
                      <button
                        type="button"
                        className="btn-outline small"
                        onClick={() => isEditing ? setEditingExerciseId(0) : handleEditPersonalExercise(option)}
                        disabled={savingPersonalExerciseId === option.id || deletingPersonalExerciseId === option.id}
                      >
                        {isEditing ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        className="btn-outline small"
                        onClick={() => isEditing ? handleSavePersonalExercise(option.id) : handleDeletePersonalExercise(option.id)}
                        disabled={savingPersonalExerciseId === option.id || deletingPersonalExerciseId === option.id}
                      >
                        {isEditing
                          ? (savingPersonalExerciseId === option.id ? 'Saving...' : 'Save')
                          : (deletingPersonalExerciseId === option.id ? 'Deleting...' : 'Delete')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : !loadingMyExercises ? (
            <p className="settings-subtitle">No personal exercises match yet. Save one from Johnny’s suggestions and it will appear here.</p>
          ) : null}
          <div className="workout-swap-subsection-head">
            <strong>All matching exercises</strong>
          </div>
          {localOptions.length ? (
            <div className="workout-swap-list">
              {localOptions.map(option => (
                <div key={option.id} className="workout-swap-row workout-swap-row-card">
                  <div className="workout-swap-row-copy">
                    <div className="workout-swap-row-title">
                      <strong>{option.name}</strong>
                      {isUserOwnedExercise(option) ? <span className="workout-swap-badge saved">Saved to your library</span> : null}
                    </div>
                    <p>{option.swap_reason || buildLocalOptionReason(option, exercise)}</p>
                    <p className="workout-swap-row-meta">{buildExerciseMeta(option)}</p>
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
          <p className="settings-subtitle">Johnny will stay inside your saved exercise library by default. If you explicitly ask him to check broader options, he can review that too and show sources when available. You can save a new suggestion into your personal library directly from here.</p>
          <form className="exercise-ai-swap-form" onSubmit={handleAskJohnny}>
            <Field className="exercise-note-label" label="Describe what you want instead">
              <textarea
                id={`plan-swap-ai-${exercise.plan_exercise_id}`}
                value={aiPrompt}
                onChange={event => setAiPrompt(event.target.value)}
                placeholder="Example: I want a machine-based chest option because my shoulder feels touchy."
              />
            </Field>
            <div className="exercise-panel-actions">
              <button type="submit" className="btn-secondary small exercise-ai-review-button" disabled={aiLoading || !aiPrompt.trim()}>
                {aiLoading ? 'Reviewing...' : 'Ask Johnny to review'}
              </button>
            </div>
          </form>

          {aiError ? <ErrorState className="workout-inline-state" message={aiError} title="Johnny could not review this swap" /> : null}
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
                      <div className="workout-swap-row-title">
                        <strong>{matchedExercise?.name || suggestion.name}</strong>
                        {matchedExercise && isUserOwnedExercise(matchedExercise) ? <span className="workout-swap-badge saved">Saved to your library</span> : null}
                      </div>
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
                    ) : (
                      <button
                        type="button"
                        className="btn-outline small"
                        onClick={() => handleSaveSuggestion(suggestion)}
                        disabled={savingSuggestionName === suggestion.name}
                      >
                        {savingSuggestionName === suggestion.name ? 'Saving...' : 'Save to my library and swap in'}
                      </button>
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
    </AppDrawer>
  )
}
