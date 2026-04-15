import { memo, useEffect, useState } from 'react'
import { aiApi } from '../../api/modules/ai'
import AppDrawer from '../ui/AppDrawer'
import ClearableInput from '../ui/ClearableInput'
import ErrorState from '../ui/ErrorState'
import Field from '../ui/Field'
import ExerciseDemoImageLightbox from './ExerciseDemoImageLightbox'
import { formatUsShortDate } from '../../lib/dateFormat'
import {
  buildExerciseMeta,
  buildLocalOptionReason,
  dedupeExercisePool,
  humanizeToken,
  isUserOwnedExercise,
  parseAiSwapSuggestions,
  parseStringList,
  resolveAiSwapSuggestions,
  saveSuggestedExerciseToLibrary,
} from './swapShared'
import { usePersonalExerciseLibrarySwap } from '../../hooks/usePersonalExerciseLibrarySwap'

function ExerciseCard({
  exercise,
  onCreateSet,
  onUpdateSet,
  onDeleteSet,
  onSwapExercise,
  onRemoveExercise,
  onSaveExerciseNote,
}) {
  const [setDrafts, setSetDrafts] = useState({})
  const [savingRowKey, setSavingRowKey] = useState('')
  const [deletingSetId, setDeletingSetId] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSwapOptions, setShowSwapOptions] = useState(false)
  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [showCuesDrawer, setShowCuesDrawer] = useState(false)
  const [noteDraft, setNoteDraft] = useState(exercise?.notes || '')
  const [savingNote, setSavingNote] = useState(false)
  const [removingExercise, setRemovingExercise] = useState(false)
  const [swappingId, setSwappingId] = useState(0)
  const [swapError, setSwapError] = useState('')
  const [aiSwapPrompt, setAiSwapPrompt] = useState('')
  const [aiSwapReply, setAiSwapReply] = useState('')
  const [aiSwapLoading, setAiSwapLoading] = useState(false)
  const [aiSwapError, setAiSwapError] = useState('')
  const [aiSwapSuggestions, setAiSwapSuggestions] = useState([])
  const [savingSuggestionName, setSavingSuggestionName] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [showDemoImage, setShowDemoImage] = useState(false)

  const activeSetSignature = (exercise?.sets ?? []).map(set => `${set.id}:${set.weight}:${set.reps}:${set.rir ?? ''}:${set.completed}`).join('|')
  const coachingCues = parseCoachingCues(exercise?.coaching_cues ?? exercise?.coaching_cues_json)
  const secondaryMuscles = parseStringList(exercise?.secondary_muscles ?? exercise?.secondary_muscles_json)
  const librarySlots = parseStringList(exercise?.slot_types ?? exercise?.slot_types_json)
  const demoImageUrl = String(exercise?.demo_image_url || '').trim()
  const nextRowKey = getNewRowKey(exercise)
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
    enabled: showSwapOptions && Boolean(exercise?.id),
    exercise,
  })

  useEffect(() => {
    setSetDrafts(buildSetDrafts(exercise))
    setNoteDraft(exercise?.notes || '')
    setMenuOpen(false)
    setShowSwapOptions(false)
    setShowNoteEditor(false)
    setShowCuesDrawer(false)
    setSwapError('')
    setAiSwapReply('')
    setAiSwapError('')
    setAiSwapSuggestions([])
    setSavingSuggestionName('')
    setSaveMessage('')
    setShowDemoImage(false)
  }, [exercise, exercise?.id, exercise?.notes, activeSetSignature])

  function handleSetDraftChange(rowKey, key, value) {
    setSetDrafts(current => ({
      ...current,
      [rowKey]: {
        ...(current[rowKey] ?? {}),
        [key]: value,
      },
    }))
  }

  async function handleCreateSet() {
    const draft = setDrafts[nextRowKey] ?? {}
    setSavingRowKey(nextRowKey)

    try {
      await onCreateSet(exercise.id, {
        set_number: (exercise.sets?.length ?? 0) + 1,
        weight: parseFloat(draft.weight) || 0,
        reps: parseInt(draft.reps, 10) || 0,
        rir: draft.rir !== '' ? parseFloat(draft.rir) : undefined,
        completed: true,
      })
    } finally {
      setSavingRowKey('')
    }
  }

  async function handleCommitSet(set) {
    const rowKey = String(set.id)
    const draft = setDrafts[rowKey] ?? {}
    const dirty = isSetDirty(set, draft)
    const nextCompleted = dirty ? true : !set.completed
    setSavingRowKey(rowKey)

    try {
      await onUpdateSet(set.id, {
        weight: parseFloat(draft.weight) || 0,
        reps: parseInt(draft.reps, 10) || 0,
        rir: draft.rir !== '' ? parseFloat(draft.rir) : null,
        completed: nextCompleted,
      })
    } finally {
      setSavingRowKey('')
    }
  }

  async function handleDeleteSet(setId) {
    setDeletingSetId(setId)
    try {
      await onDeleteSet(setId)
    } finally {
      setDeletingSetId(0)
    }
  }

  async function handleRemoveExercise() {
    setRemovingExercise(true)
    try {
      await onRemoveExercise(exercise.id)
    } finally {
      setRemovingExercise(false)
      setMenuOpen(false)
    }
  }

  async function handleSaveNote() {
    setSavingNote(true)
    try {
      await onSaveExerciseNote(exercise.id, noteDraft)
      setShowNoteEditor(false)
    } finally {
      setSavingNote(false)
    }
  }

  async function handleSwap(option) {
    setSwappingId(option.id)
    setSwapError('')
    try {
      await onSwapExercise(exercise.id, option.id)
      setMenuOpen(false)
      setShowSwapOptions(false)
    } catch (error) {
      setSwapError(error?.message || 'Swap did not complete. Try another option.')
    } finally {
      setSwappingId(0)
    }
  }

  function handleOpenDemo() {
    const query = encodeURIComponent(`${exercise.exercise_name} exercise tutorial`)
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener,noreferrer')
  }

  async function handleAskAiForSwap(event) {
    event?.preventDefault()
    const prompt = aiSwapPrompt.trim()
    if (!prompt || aiSwapLoading) return

    setAiSwapLoading(true)
    setAiSwapError('')
    setAiSwapSuggestions([])
    setSaveMessage('')

    const localOptions = (exercise.swap_options ?? []).map(option => option.name).join(', ')
    const coachingHint = coachingCues[0] ? ` Primary coaching cue: ${coachingCues[0]}.` : ''
    const message = `I am in a Johnny5k workout and want to swap out ${exercise.exercise_name}. Context: target ${formatTargetSummary(exercise)}, muscle focus ${exercise.primary_muscle || 'general'}, equipment ${exercise.equipment || 'mixed'}, movement pattern ${exercise.movement_pattern || 'unknown'}.${coachingHint} Available current swap suggestions: ${localOptions || 'none listed'}. User request: ${prompt}. Suggest 3 practical gym alternatives and respond using exactly 3 lines in this format only: Exercise Name | short reason. No numbering. No intro. No outro.`

    try {
      const data = await aiApi.chat(message, `workout-swap-${exercise.id}`, 'coach', {
        context: {
          surface: 'workout_swap',
          current_screen: 'workout',
          current_exercise: exercise.exercise_name,
          target_summary: formatTargetSummary(exercise),
          primary_muscle: exercise.primary_muscle || '',
          equipment: exercise.equipment || '',
          movement_pattern: exercise.movement_pattern || '',
          available_swap_names: (exercise.swap_options ?? []).map(option => option.name),
        },
      })
      const reply = data.reply || ''
      const suggestions = parseAiSwapSuggestions(reply)

      setAiSwapReply(reply)

      if (suggestions.length) {
        const resolvedSuggestions = await resolveAiSwapSuggestions(suggestions, exercise)
        setAiSwapSuggestions(resolvedSuggestions)
      }
    } catch (error) {
      setAiSwapError(error?.message || 'AI swap suggestions are unavailable right now.')
    } finally {
      setAiSwapLoading(false)
    }
  }

  async function handleSaveSuggestion(suggestion) {
    if (!suggestion?.name || savingSuggestionName) return

    setSavingSuggestionName(suggestion.name)
    setAiSwapError('')
    setSaveMessage('')

    try {
      const { savedExercise } = await saveSuggestedExerciseToLibrary({
        suggestion,
        exercise,
        aiPrompt: aiSwapPrompt,
      })

      prependSavedExercise(savedExercise)
      setSaveMessage(`${suggestion.name} was added to your library and swapped into this workout.`)
      await handleSwap(savedExercise)
    } catch (error) {
      setAiSwapError(error?.message || 'Could not save that exercise to the library.')
    } finally {
      setSavingSuggestionName('')
    }
  }

  function handleEditPersonalExercise(option) {
    beginEditPersonalExercise(option)
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

  function adjustNextSetWeight(delta) {
    const currentWeight = parseFloat(setDrafts[nextRowKey]?.weight || '0') || 0
    const nextWeight = Math.max(0, currentWeight + delta)
    handleSetDraftChange(nextRowKey, 'weight', nextWeight ? String(Number(nextWeight.toFixed(2))) : '')
  }

  function duplicateLastSetIntoDraft() {
    if (!exercise?.sets?.length) return
    const lastSet = exercise.sets[exercise.sets.length - 1]
    setSetDrafts(current => ({
      ...current,
      [nextRowKey]: {
        weight: lastSet.weight != null ? String(lastSet.weight) : '',
        reps: lastSet.reps != null ? String(lastSet.reps) : '',
        rir: lastSet.rir != null ? String(lastSet.rir) : '',
      },
    }))
  }

  return (
    <div className="exercise-card dash-card ex-detail-card">
      <div className="exercise-card-accent" aria-hidden="true" />

      <div className="exercise-card-header">
        <div className="exercise-card-header-copy">
          <h2>{exercise.exercise_name}</h2>
          <div className="exercise-card-header-meta">
            <span className="exercise-card-tag subtle">{humanizeToken(exercise.slot_type || librarySlots[0] || 'accessory')} slot</span>
            <span className="dashboard-chip subtle">{exercise.planned_sets} x {exercise.planned_rep_min}-{exercise.planned_rep_max}</span>
            {exercise.equipment ? <span className="exercise-card-tag subtle">{humanizeToken(exercise.equipment)}</span> : null}
            {exercise.is_bonus_fill ? <span className="exercise-card-tag bonus-fill">Full bonus {humanizeToken(exercise.slot_type || 'accessory')}</span> : null}
            {exercise.was_swapped && exercise.original_exercise_name ? (
              <span className="exercise-card-tag equipment-adjusted">Adjusted to your equipment</span>
            ) : null}
          </div>
        </div>

        <div className="exercise-card-header-actions">
          <div className="exercise-demo-actions">
            <button type="button" className="btn-secondary small exercise-demo-button" onClick={handleOpenDemo}>
              Demo
            </button>
            {demoImageUrl ? (
              <button type="button" className="btn-outline small exercise-demo-button" onClick={() => setShowDemoImage(true)}>
                Show Me
              </button>
            ) : null}
          </div>

          <div className="exercise-card-menu-wrap">
            <button type="button" className="exercise-menu-button" onClick={() => setMenuOpen(open => !open)} aria-expanded={menuOpen} aria-label="Exercise actions">
              ...
            </button>

            {menuOpen ? (
              <div className="exercise-card-menu" role="menu">
                <button type="button" onClick={() => { setShowSwapOptions(open => !open); setMenuOpen(false) }}>Swap exercise</button>
                <button type="button" onClick={() => { setShowNoteEditor(open => !open); setMenuOpen(false) }}>Add note</button>
                <button type="button" onClick={() => { setShowCuesDrawer(true); setMenuOpen(false) }} disabled={!coachingCues.length}>Coaching cues</button>
                <button type="button" onClick={handleRemoveExercise} disabled={removingExercise}>{removingExercise ? 'Removing...' : 'Remove exercise'}</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {exercise.was_swapped && exercise.original_exercise_name ? (
        <p className="workout-swap-note">Swapped in for {exercise.original_exercise_name}.</p>
      ) : null}
      {exercise.is_bonus_fill ? (
        <p className="workout-swap-note workout-bonus-note">Johnny added this movement automatically so your full session includes extra {humanizeToken(exercise.slot_type || 'accessory')} work.</p>
      ) : null}

      <div className="exercise-muscle-strip">
        <div className="exercise-muscle-pill primary">
          <span className="exercise-card-label">Target</span>
          <strong>{humanizeToken(exercise.primary_muscle) || 'General'}</strong>
        </div>
        {secondaryMuscles.length ? (
          <div className="exercise-muscle-pill">
            <span className="exercise-card-label">Support</span>
            <strong>{secondaryMuscles.slice(0, 3).map(humanizeToken).join(', ')}</strong>
          </div>
        ) : null}
      </div>

      <div className="exercise-card-summary">
        <div className="exercise-card-summary-block">
          <span className="exercise-card-label">Last</span>
          <strong>{formatLastSessionSummary(exercise.recent_history)}</strong>
        </div>
        <div className="exercise-card-summary-block exercise-card-summary-prescription">
          <span className="exercise-card-label">Prescription</span>
          <strong>{formatTargetSummary(exercise)}</strong>
          <span className="exercise-card-target-note">{exercise.planned_sets} planned sets in the {humanizeToken(exercise.slot_type || librarySlots[0] || 'accessory')} slot.</span>
        </div>
      </div>

      {exercise.suggestion_note ? (
        <div className="exercise-smart-prompt">
          <strong>Coach cue</strong>
          <p>{exercise.suggestion_note}</p>
        </div>
      ) : null}

      <div className="exercise-panel exercise-description-panel">
        <div className="exercise-description-head">
          <div>
            <strong>How this works</strong>
            <p>{exercise.exercise_description || exercise.exercise_summary || buildExerciseDescription(exercise, coachingCues)}</p>
          </div>
          <div className="exercise-description-actions">
            <button type="button" className="btn-outline small" onClick={() => setShowSwapOptions(open => !open)}>
              {showSwapOptions ? 'Hide swaps' : 'Swap exercise'}
            </button>
          </div>
        </div>
      </div>

      {showNoteEditor ? (
        <div className="exercise-panel exercise-note-panel">
          <label className="exercise-note-label" htmlFor={`exercise-note-${exercise.id}`}>Session note</label>
          <textarea
            id={`exercise-note-${exercise.id}`}
            value={noteDraft}
            onChange={event => setNoteDraft(event.target.value)}
            placeholder="Add a quick note about pain, setup, or coaching cues."
          />
          <div className="exercise-panel-actions">
            <button type="button" className="btn-primary" onClick={handleSaveNote} disabled={savingNote}>
              {savingNote ? 'Saving...' : 'Save note'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowNoteEditor(false)}>Close</button>
          </div>
        </div>
      ) : null}

      <div className="workout-context-grid">
        <section className="workout-context-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip subtle">Workout context</span>
          </div>
          <div className="exercise-context-grid">
            <div className="exercise-context-item">
              <span className="exercise-card-label">Primary muscle</span>
              <strong>{humanizeToken(exercise.primary_muscle) || 'General'}</strong>
            </div>
            {secondaryMuscles.length ? (
              <div className="exercise-context-item">
                <span className="exercise-card-label">Secondary muscles</span>
                <strong>{secondaryMuscles.map(humanizeToken).join(', ')}</strong>
              </div>
            ) : null}
            <div className="exercise-context-item">
              <span className="exercise-card-label">Program slot</span>
              <strong>{humanizeToken(exercise.slot_type || librarySlots[0] || '') || 'Accessory'}</strong>
            </div>
          </div>
          {(exercise.recent_history ?? []).length ? (
            <div className="workout-history-list">
              {exercise.recent_history.map(entry => (
                <div key={`${exercise.id}-${entry.snapshot_date}`} className="workout-history-row">
                  <span>{formatShortDate(entry.snapshot_date)}</span>
                  <span>{formatHistoryEntry(entry)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="settings-subtitle">No recent history yet. Today will set the baseline.</p>
          )}
        </section>

        {showSwapOptions ? (
          <section className="workout-context-card">
            {(() => {
              const myExerciseIds = new Set(myExercises.map(option => Number(option.id)))
              const libraryOptions = dedupeExercisePool(exercise.swap_options ?? []).filter(option => Number(option.id) !== Number(exercise.exercise_id) && !myExerciseIds.has(Number(option.id)))

              return (
                <>
            <div className="dashboard-card-head">
              <span className="dashboard-chip subtle">Swap options</span>
            </div>
            {swapError ? <ErrorState className="workout-inline-state" message={swapError} title="Could not load swap options" /> : null}
            <div className="workout-swap-subsection-head">
              <strong>My exercises</strong>
              <span className="workout-swap-badge personal">Personal library</span>
            </div>
            {loadingMyExercises ? <p className="settings-subtitle">Loading your saved exercises...</p> : null}
            {myExercisesError ? <ErrorState className="workout-inline-state" message={myExercisesError} title="Could not load your saved exercises" /> : null}
            {myExercises.length ? (
              <div className="workout-swap-list">
                {myExercises.map(option => {
                  const isEditing = editingExerciseId === option.id
                  const isRecentlySaved = savedExerciseIds.includes(Number(option.id))

                  return (
                    <div key={`my-exercise-${option.id}`} className="workout-swap-row workout-swap-row-card">
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
                              placeholder="Optional note for why this variation works well for you."
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="workout-swap-row-actions">
                        <button
                          type="button"
                          className="btn-outline small"
                          onClick={() => handleSwap(option)}
                          disabled={swappingId === option.id}
                        >
                          {swappingId === option.id ? 'Swapping...' : 'Swap'}
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
              <p className="settings-subtitle">No personal swap options yet. Save one from Johnny’s suggestions and it will appear here.</p>
            ) : null}

            <div className="workout-swap-subsection-head">
              <strong>Other library matches</strong>
            </div>
            {libraryOptions.length ? (
              <div className="workout-swap-list">
                {libraryOptions.map(option => (
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
                      onClick={() => handleSwap(option)}
                      disabled={swappingId === option.id}
                    >
                      {swappingId === option.id ? 'Swapping...' : 'Swap'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="settings-subtitle">No alternative movements loaded for this slot.</p>
            )}

            <form className="exercise-ai-swap-form" onSubmit={handleAskAiForSwap}>
              <Field className="exercise-note-label" label="Ask Johnny for another swap">
                <textarea
                  id={`exercise-ai-swap-${exercise.id}`}
                  value={aiSwapPrompt}
                  onChange={event => setAiSwapPrompt(event.target.value)}
                  placeholder="Example: My shoulder is irritated, give me machine-based swaps."
                />
              </Field>
              <div className="exercise-panel-actions">
                <button type="submit" className="btn-secondary small" disabled={aiSwapLoading || !aiSwapPrompt.trim()}>
                  {aiSwapLoading ? 'Asking Johnny...' : 'Ask AI for swaps'}
                </button>
              </div>
              {aiSwapError ? <ErrorState className="workout-inline-state" message={aiSwapError} title="Johnny could not suggest swaps" /> : null}
              {saveMessage ? <p className="success-msg">{saveMessage}</p> : null}
              {aiSwapSuggestions.length ? (
                <div className="exercise-ai-swap-list">
                  {aiSwapSuggestions.map((suggestion, index) => {
                    const matchedExercise = suggestion.match

                    return (
                      <div key={`${exercise.id}-ai-swap-${index}`} className="exercise-ai-swap-row">
                        <div>
                            <div className="workout-swap-row-title">
                              <strong>{matchedExercise?.name || suggestion.name}</strong>
                              {matchedExercise && isUserOwnedExercise(matchedExercise) ? <span className="workout-swap-badge saved">Saved to your library</span> : null}
                            </div>
                          {matchedExercise && matchedExercise.name !== suggestion.name ? (
                            <p>AI suggested {suggestion.name}. Closest match: {matchedExercise.name}. {suggestion.reason}</p>
                          ) : (
                            <p>{suggestion.reason}</p>
                          )}
                        </div>
                        {matchedExercise ? (
                          <button
                            type="button"
                            className="btn-outline small"
                            onClick={() => handleSwap(matchedExercise)}
                            disabled={swappingId === matchedExercise.id}
                          >
                            {swappingId === matchedExercise.id ? 'Swapping...' : 'Swap in'}
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
              {aiSwapReply && !aiSwapSuggestions.length ? <div className="exercise-ai-swap-reply"><p>{aiSwapReply}</p></div> : null}
            </form>
                </>
              )
            })()}
          </section>
        ) : null}
      </div>

      <div className="set-editor">
        {(exercise.sets ?? []).map((set, index) => {
          const rowKey = String(set.id)
          const draft = setDrafts[rowKey] ?? {}
          const isCompleted = Boolean(set.completed)
          const isDirty = isSetDirty(set, draft)
          const syncStatusLabel = getSetSyncStatusLabel(set)

          return (
            <div key={set.id} className={`set-editor-row exercise-set-row ${isCompleted ? 'completed' : ''}`}>
              <div className="set-editor-head">
                <strong>Set {index + 1}</strong>
                <span className="exercise-set-head-status">
                  {syncStatusLabel ? <span className={`exercise-set-sync-badge ${set.sync_status}`}>{syncStatusLabel}</span> : null}
                  <span>{isCompleted ? 'Completed' : 'In progress'}</span>
                </span>
              </div>
              <div className="exercise-set-grid">
                <span className="exercise-set-number" aria-hidden="true">{index + 1}</span>
                <input
                  type="number"
                  step="2.5"
                  min="0"
                  inputMode="decimal"
                  aria-label={`Set ${index + 1} weight`}
                  placeholder="Weight"
                  value={draft.weight ?? ''}
                  onChange={event => handleSetDraftChange(rowKey, 'weight', event.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  max="30"
                  inputMode="numeric"
                  aria-label={`Set ${index + 1} reps`}
                  placeholder="Reps"
                  value={draft.reps ?? ''}
                  onChange={event => handleSetDraftChange(rowKey, 'reps', event.target.value)}
                />
                <button
                  type="button"
                  className={`exercise-set-complete ${isCompleted ? 'completed' : ''}`}
                  onClick={() => handleCommitSet(set)}
                  disabled={savingRowKey === rowKey || !draft.reps}
                  aria-label={isCompleted && !isDirty ? `Reopen set ${index + 1}` : `Complete set ${index + 1}`}
                >
                  {savingRowKey === rowKey ? '...' : isCompleted && !isDirty ? 'Reopen' : 'Complete'}
                </button>
              </div>
              <div className="exercise-set-row-footer">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.5"
                  inputMode="decimal"
                  aria-label={`Set ${index + 1} RIR`}
                  placeholder="RIR"
                  value={draft.rir ?? ''}
                  onChange={event => handleSetDraftChange(rowKey, 'rir', event.target.value)}
                />
                <button type="button" className="exercise-set-remove" onClick={() => handleDeleteSet(set.id)} disabled={deletingSetId === set.id}>
                  {deletingSetId === set.id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          )
        })}

        <div className="set-editor-row set-editor-row-new exercise-set-row draft-row">
          <div className="set-editor-head">
            <strong>Set {(exercise.sets?.length ?? 0) + 1}</strong>
            <span>Ready to log</span>
          </div>
          <div className="exercise-set-grid">
            <span className="exercise-set-number" aria-hidden="true">{(exercise.sets?.length ?? 0) + 1}</span>
            <input
              type="number"
              step="2.5"
              min="0"
              inputMode="decimal"
              aria-label="Next set weight"
              placeholder="Weight"
              value={setDrafts[nextRowKey]?.weight ?? ''}
              onChange={event => handleSetDraftChange(nextRowKey, 'weight', event.target.value)}
            />
            <input
              type="number"
              min="1"
              max="30"
              inputMode="numeric"
              aria-label="Next set reps"
              placeholder="Reps"
              value={setDrafts[nextRowKey]?.reps ?? ''}
              onChange={event => handleSetDraftChange(nextRowKey, 'reps', event.target.value)}
            />
            <button
              type="button"
              className="exercise-set-complete"
              onClick={handleCreateSet}
              disabled={savingRowKey === nextRowKey || !setDrafts[nextRowKey]?.reps}
              aria-label="Add set"
            >
              {savingRowKey === nextRowKey ? '...' : 'Add set'}
            </button>
          </div>
          <div className="exercise-set-row-footer">
            <input
              type="number"
              min="0"
              max="5"
              step="0.5"
              inputMode="decimal"
              aria-label="Next set RIR"
              placeholder="RIR"
              value={setDrafts[nextRowKey]?.rir ?? ''}
              onChange={event => handleSetDraftChange(nextRowKey, 'rir', event.target.value)}
            />
          </div>
        </div>

        <div className="set-quick-actions">
          <button type="button" className="btn-outline small" onClick={() => adjustNextSetWeight(2.5)}>+2.5</button>
          <button type="button" className="btn-outline small" onClick={() => adjustNextSetWeight(5)}>+5</button>
          <button type="button" className="btn-outline small" onClick={() => adjustNextSetWeight(-5)}>-5</button>
          <button type="button" className="btn-outline small" onClick={duplicateLastSetIntoDraft} disabled={!exercise.sets?.length}>Duplicate</button>
        </div>
      </div>

      <p className="rir-help">RIR means reps in reserve: how many reps you had left before failure.</p>

      {showCuesDrawer && coachingCues.length ? (
        <AppDrawer
          open
          onClose={() => setShowCuesDrawer(false)}
          overlayClassName="exercise-drawer-shell"
          className="exercise-drawer"
        >
            <div className="exercise-drawer-head">
              <div>
                <p className="exercise-drawer-eyebrow">Coaching</p>
                <h3 id={`exercise-cues-title-${exercise.id}`}>{exercise.exercise_name}</h3>
              </div>
              <button type="button" className="exercise-drawer-close" onClick={() => setShowCuesDrawer(false)}>
                Close
              </button>
            </div>

            <p className="exercise-drawer-subtitle">Use these cues during the set so you do not need to keep the overflow menu open.</p>

            <ul className="exercise-cues-list exercise-cues-drawer-list">
              {coachingCues.map((cue, index) => (
                <li key={`${exercise.id}-cue-${index}`}>{cue}</li>
              ))}
            </ul>
        </AppDrawer>
      ) : null}

      <ExerciseDemoImageLightbox
        open={showDemoImage}
        imageUrl={demoImageUrl}
        exerciseName={exercise?.exercise_name || 'Exercise'}
        onClose={() => setShowDemoImage(false)}
      />
    </div>
  )
}

function buildSetDrafts(exercise) {
  if (!exercise) return {}

  const drafts = {}
  for (const set of exercise.sets ?? []) {
    drafts[String(set.id)] = {
      weight: set.weight != null ? String(set.weight) : '',
      reps: set.reps != null ? String(set.reps) : '',
      rir: set.rir != null ? String(set.rir) : '',
    }
  }

  const carryWeight = exercise.sets?.length
    ? exercise.sets[exercise.sets.length - 1]?.weight
    : exercise.recommended_weight

  drafts[getNewRowKey(exercise)] = {
    weight: carryWeight != null ? String(carryWeight) : '',
    reps: '',
    rir: '',
  }

  return drafts
}

function getNewRowKey(exercise) {
  return `new-${exercise?.id ?? 'exercise'}`
}

function isSetDirty(set, draft) {
  return String(set.weight ?? '') !== String(draft.weight ?? '')
    || String(set.reps ?? '') !== String(draft.reps ?? '')
    || String(set.rir ?? '') !== String(draft.rir ?? '')
}

function getSetSyncStatusLabel(set) {
  const syncStatus = String(set?.sync_status || '').trim().toLowerCase()
  if (syncStatus === 'queued') return 'Queued locally'
  if (syncStatus === 'syncing') return 'Saving...'
  return ''
}

function parseCoachingCues(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

function formatShortDate(value) {
  if (!value) return 'Recent'
  return formatUsShortDate(value, 'Recent')
}

function formatHistoryEntry(entry) {
  const parts = []
  if (entry?.best_weight && entry?.best_reps) {
    parts.push(`${entry.best_weight} lbs x ${entry.best_reps}`)
  }
  if (entry?.best_volume) {
    parts.push(`${Math.round(entry.best_volume)} total volume`)
  }
  if (entry?.estimated_1rm) {
    parts.push(`e1RM ${Math.round(entry.estimated_1rm)}`)
  }
  return parts.join(' · ') || 'Logged session'
}

function formatLastSessionSummary(history) {
  if (!history?.length) return 'No prior work logged'
  return formatHistoryEntry(history[0])
}

function formatTargetSummary(exercise) {
  const weight = exercise?.recommended_weight ? `${formatTrainingWeight(exercise.recommended_weight, exercise?.equipment)} lbs` : 'Use feel'
  const reps = exercise?.planned_rep_min && exercise?.planned_rep_max
    ? `${exercise.planned_rep_min}-${exercise.planned_rep_max} reps`
    : 'Work reps'
  return `${weight} · ${reps}`
}

function formatTrainingWeight(value, equipment = '') {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return '0'

  const increment = equipment === 'dumbbell'
    ? 10
    : (numeric >= 100 ? 5 : 2.5)
  const rounded = Math.round(numeric / increment) * increment

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function buildExerciseDescription(exercise, coachingCues = []) {
  const movement = humanizeToken(exercise?.movement_pattern)
  const muscle = humanizeToken(exercise?.primary_muscle)
  const equipment = humanizeToken(exercise?.equipment)
  const targetSummary = exercise?.planned_sets && exercise?.planned_rep_min && exercise?.planned_rep_max
    ? `Aim for ${exercise.planned_sets} sets of ${exercise.planned_rep_min}-${exercise.planned_rep_max} reps.`
    : ''
  const cueSummary = coachingCues[0] ? ` First cue: ${coachingCues[0]}.` : ''

  if (movement && muscle) {
    return `A ${movement.toLowerCase()} movement aimed at ${muscle.toLowerCase()}. ${equipment ? `Set up with ${equipment.toLowerCase()} and keep the range smooth and repeatable.` : 'Keep the range smooth and repeatable.'} ${targetSummary}${cueSummary}`.trim()
  }

  if (muscle) {
    return `This exercise is here to train ${muscle.toLowerCase()} with clean reps and a stable setup. ${targetSummary}${cueSummary}`.trim()
  }

  return `This movement should feel controlled, repeatable, and easy to judge from set to set. ${targetSummary}${cueSummary}`.trim()
}

export default memo(ExerciseCard)
