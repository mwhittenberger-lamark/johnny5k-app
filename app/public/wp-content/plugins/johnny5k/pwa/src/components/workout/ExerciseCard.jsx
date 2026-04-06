import { memo, useEffect, useState } from 'react'
import { aiApi, trainingApi } from '../../api/client'
import { formatUsShortDate } from '../../lib/dateFormat'

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

  const activeSetSignature = (exercise?.sets ?? []).map(set => `${set.id}:${set.weight}:${set.reps}:${set.rir ?? ''}:${set.completed}`).join('|')
  const coachingCues = parseCoachingCues(exercise?.coaching_cues_json)
  const nextRowKey = getNewRowKey(exercise)

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
  }, [exercise?.id, exercise?.notes, activeSetSignature])

  useEffect(() => {
    if (!showCuesDrawer) return undefined

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setShowCuesDrawer(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showCuesDrawer])

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
    const nextCompleted = dirty ? true : !Boolean(set.completed)
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

    const localOptions = (exercise.swap_options ?? []).map(option => option.name).join(', ')
    const coachingHint = coachingCues[0] ? ` Primary coaching cue: ${coachingCues[0]}.` : ''
    const message = `I am in a Johnny5k workout and want to swap out ${exercise.exercise_name}. Context: target ${formatTargetSummary(exercise)}, muscle focus ${exercise.primary_muscle || 'general'}, equipment ${exercise.equipment || 'mixed'}, movement pattern ${exercise.movement_pattern || 'unknown'}.${coachingHint} Available current swap suggestions: ${localOptions || 'none listed'}. User request: ${prompt}. Suggest 3 practical gym alternatives and respond using exactly 3 lines in this format only: Exercise Name | short reason. No numbering. No intro. No outro.`

    try {
      const data = await aiApi.chat(message, `workout-swap-${exercise.id}`)
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
        <div>
          <h2>{exercise.exercise_name}</h2>
          <div className="exercise-card-header-meta">
            <span className="exercise-card-tag">{exercise.primary_muscle} focus</span>
            <span className="dashboard-chip subtle">{exercise.planned_sets} x {exercise.planned_rep_min}-{exercise.planned_rep_max}</span>
          </div>
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

      {exercise.was_swapped && exercise.original_exercise_name ? (
        <p className="workout-swap-note">Swapped in for {exercise.original_exercise_name}.</p>
      ) : null}

      <div className="exercise-card-summary">
        <div className="exercise-card-summary-block">
          <span className="exercise-card-label">Last</span>
          <strong>{formatLastSessionSummary(exercise.recent_history)}</strong>
        </div>
        <div className="exercise-card-summary-block exercise-card-summary-target">
          <span className="exercise-card-label">Target</span>
          <strong>{formatTargetSummary(exercise)}</strong>
          <span className="exercise-card-target-note">{exercise.suggestion_note || 'Move well and progress patiently.'}</span>
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
            <p>{exercise.exercise_summary || buildExerciseDescription(exercise, coachingCues)}</p>
          </div>
          <div className="exercise-description-actions">
            <button type="button" className="btn-outline small" onClick={() => setShowSwapOptions(open => !open)}>
              {showSwapOptions ? 'Hide swaps' : 'Swap exercise'}
            </button>
            <button type="button" className="btn-secondary small exercise-demo-button" onClick={handleOpenDemo}>
              Search YouTube
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
            <span className="dashboard-chip subtle">Recent history</span>
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
            <div className="dashboard-card-head">
              <span className="dashboard-chip subtle">Swap options</span>
            </div>
            {swapError ? <p className="error">{swapError}</p> : null}
            {(exercise.swap_options ?? []).length ? (
              <div className="workout-swap-list">
                {exercise.swap_options.map(option => (
                  <div key={option.id} className="workout-swap-row">
                    <div>
                      <strong>{option.name}</strong>
                      <p>{option.swap_reason}</p>
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
              <label className="exercise-note-label" htmlFor={`exercise-ai-swap-${exercise.id}`}>Ask Johnny for another swap</label>
              <textarea
                id={`exercise-ai-swap-${exercise.id}`}
                value={aiSwapPrompt}
                onChange={event => setAiSwapPrompt(event.target.value)}
                placeholder="Example: My shoulder is irritated, give me machine-based swaps."
              />
              <div className="exercise-panel-actions">
                <button type="submit" className="btn-secondary small" disabled={aiSwapLoading || !aiSwapPrompt.trim()}>
                  {aiSwapLoading ? 'Asking Johnny...' : 'Ask AI for swaps'}
                </button>
              </div>
              {aiSwapError ? <p className="error">{aiSwapError}</p> : null}
              {aiSwapSuggestions.length ? (
                <div className="exercise-ai-swap-list">
                  {aiSwapSuggestions.map((suggestion, index) => {
                    const matchedExercise = suggestion.match

                    return (
                      <div key={`${exercise.id}-ai-swap-${index}`} className="exercise-ai-swap-row">
                        <div>
                          <strong>{matchedExercise?.name || suggestion.name}</strong>
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
                          <span className="exercise-ai-swap-missing">No direct match found</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : null}
              {aiSwapReply && !aiSwapSuggestions.length ? <div className="exercise-ai-swap-reply"><p>{aiSwapReply}</p></div> : null}
            </form>
          </section>
        ) : null}
      </div>

      <div className="set-editor">
        {(exercise.sets ?? []).map((set, index) => {
          const rowKey = String(set.id)
          const draft = setDrafts[rowKey] ?? {}
          const isCompleted = Boolean(set.completed)
          const isDirty = isSetDirty(set, draft)

          return (
            <div key={set.id} className={`set-editor-row exercise-set-row ${isCompleted ? 'completed' : ''}`}>
              <div className="set-editor-head">
                <strong>Set {index + 1}</strong>
                <span>{isCompleted ? 'Completed' : 'In progress'}</span>
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
        <div className="exercise-drawer-shell" role="dialog" aria-modal="true" aria-labelledby={`exercise-cues-title-${exercise.id}`}>
          <button type="button" className="exercise-drawer-backdrop" aria-label="Close coaching cues" onClick={() => setShowCuesDrawer(false)} />
          <aside className="exercise-drawer">
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
          </aside>
        </div>
      ) : null}
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

function humanizeToken(value) {
  if (!value) return ''
  return String(value).replace(/[_-]+/g, ' ').trim()
}

function parseAiSwapSuggestions(reply) {
  return String(reply || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
    .map(line => {
      const parts = line.split('|')
      if (parts.length >= 2) {
        return {
          name: parts[0].trim(),
          reason: parts.slice(1).join('|').trim(),
        }
      }

      const fallbackParts = line.split(/\s[-:]\s/)
      if (fallbackParts.length >= 2) {
        return {
          name: fallbackParts[0].trim(),
          reason: fallbackParts.slice(1).join(' - ').trim(),
        }
      }

      return {
        name: line.trim(),
        reason: 'Suggested by Johnny based on your prompt.',
      }
    })
    .filter(item => item.name)
    .slice(0, 3)
}

async function resolveAiSwapSuggestions(suggestions, exercise) {
  const swapOptions = (exercise.swap_options ?? []).map(option => ({
    id: option.id,
    name: option.name,
    primary_muscle: exercise.primary_muscle,
    equipment: exercise.equipment,
  }))

  return Promise.all(suggestions.map(async suggestion => {
    let searchResults = []

    try {
      searchResults = await trainingApi.getExercises({
        q: suggestion.name,
        limit: 8,
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

export default memo(ExerciseCard)