import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainingApi } from '../../api/modules/training'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import ClearableInput from '../../components/ui/ClearableInput'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Field from '../../components/ui/Field'
import { confirmGlobalAction } from '../../lib/uiFeedback'

const EMPTY_DRAFT = {
  name: '',
  description: '',
  primary_muscle: '',
  movement_pattern: '',
  equipment: '',
  difficulty: 'beginner',
}

export default function ExerciseLibraryScreen() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [exercises, setExercises] = useState([])
  const [editingExerciseId, setEditingExerciseId] = useState(0)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [savingExerciseId, setSavingExerciseId] = useState(0)
  const [deletingExerciseId, setDeletingExerciseId] = useState(0)
  const [selectedExerciseIds, setSelectedExerciseIds] = useState([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [mergeTargets, setMergeTargets] = useState({})
  const [mergingGroupKey, setMergingGroupKey] = useState('')
  const [mergeSummary, setMergeSummary] = useState(null)

  useEffect(() => {
    let active = true
    const trimmedQuery = query.trim()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')

      try {
        const rows = await trainingApi.getExercises({
          own_only: 1,
          q: trimmedQuery,
          limit: trimmedQuery ? 30 : 20,
        })

        if (!active) return
        setExercises(normalizeLibraryRows(rows))
      } catch (nextError) {
        if (!active) return
        setError(nextError?.message || 'Could not load your exercise library.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }, trimmedQuery ? 180 : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])

  const sortedExercises = useMemo(() => {
    const items = [...exercises]

    items.sort((left, right) => compareExercises(left, right, sortBy))

    return items
  }, [exercises, sortBy])

  const groupedExercises = useMemo(() => {
    const groups = new Map()

    for (const exercise of sortedExercises) {
      const key = humanizeToken(exercise.primary_muscle) || 'General'
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key).push(exercise)
    }

    return Array.from(groups.entries()).sort((left, right) => left[0].localeCompare(right[0]))
  }, [sortedExercises])

  const duplicateGroups = useMemo(() => {
    const groups = new Map()

    for (const exercise of sortedExercises) {
      const key = normalizeDuplicateKey(exercise?.name)
      if (!key) continue
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key).push(exercise)
    }

    return Array.from(groups.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => [key, [...items].sort((left, right) => compareNewest(left, right) || compareText(left?.name, right?.name))])
  }, [sortedExercises])

  const visibleExerciseIds = useMemo(
    () => sortedExercises.map(exercise => Number(exercise.id)).filter(Boolean),
    [sortedExercises],
  )

  const selectedVisibleCount = useMemo(
    () => visibleExerciseIds.filter(exerciseId => selectedExerciseIds.includes(exerciseId)).length,
    [selectedExerciseIds, visibleExerciseIds],
  )

  const allVisibleSelected = visibleExerciseIds.length > 0 && selectedVisibleCount === visibleExerciseIds.length

  useEffect(() => {
    const visibleSet = new Set(exercises.map(exercise => Number(exercise.id)).filter(Boolean))
    setSelectedExerciseIds(current => current.filter(exerciseId => visibleSet.has(Number(exerciseId))))
  }, [exercises])

  useEffect(() => {
    setMergeTargets(current => {
      const next = {}

      duplicateGroups.forEach(([groupKey, items]) => {
        const existingTarget = Number(current[groupKey] || 0)
        const itemIds = items.map(item => Number(item.id))
        next[groupKey] = itemIds.includes(existingTarget) ? existingTarget : itemIds[0]
      })

      return next
    })
  }, [duplicateGroups])

  function beginEdit(exercise) {
    setEditingExerciseId(exercise.id)
    setDraft(buildDraft(exercise))
    setError('')
    setMessage('')
    setMergeSummary(null)
  }

  function cancelEdit() {
    setEditingExerciseId(0)
    setDraft(EMPTY_DRAFT)
  }

  function updateDraft(key, value) {
    setDraft(current => ({
      ...current,
      [key]: value,
    }))
  }

  function toggleExerciseSelection(exerciseId) {
    const normalizedId = Number(exerciseId)
    if (!normalizedId || bulkDeleting) return

    setSelectedExerciseIds(current => (
      current.includes(normalizedId)
        ? current.filter(item => item !== normalizedId)
        : [...current, normalizedId]
    ))
  }

  function toggleSelectAllVisible() {
    if (!visibleExerciseIds.length || bulkDeleting) return

    setSelectedExerciseIds(current => {
      if (allVisibleSelected) {
        return current.filter(exerciseId => !visibleExerciseIds.includes(exerciseId))
      }

      const next = new Set(current)
      visibleExerciseIds.forEach(exerciseId => next.add(exerciseId))
      return Array.from(next)
    })
  }

  function clearSelection() {
    if (bulkDeleting) return
    setSelectedExerciseIds([])
  }

  function updateMergeTarget(groupKey, exerciseId) {
    setMergeTargets(current => ({
      ...current,
      [groupKey]: Number(exerciseId),
    }))
  }

  async function saveExercise(exerciseId) {
    if (!exerciseId || savingExerciseId) return

    setSavingExerciseId(exerciseId)
    setError('')
    setMessage('')
    setMergeSummary(null)

    try {
      await trainingApi.updatePersonalExercise(exerciseId, {
        name: draft.name,
        description: draft.description,
        primary_muscle: draft.primary_muscle,
        movement_pattern: draft.movement_pattern,
        equipment: draft.equipment,
        difficulty: draft.difficulty,
      })

      setExercises(current => current.map(exercise => (
        Number(exercise.id) === Number(exerciseId)
          ? {
              ...exercise,
              name: draft.name.trim(),
              description: draft.description.trim(),
              primary_muscle: draft.primary_muscle.trim(),
              movement_pattern: draft.movement_pattern.trim(),
              equipment: draft.equipment.trim(),
              difficulty: draft.difficulty,
            }
          : exercise
      )))
      setMessage('Your personal exercise was updated.')
      cancelEdit()
    } catch (nextError) {
      setError(nextError?.message || 'Could not update that exercise.')
    } finally {
      setSavingExerciseId(0)
    }
  }

  async function deleteExercise(exerciseId) {
    if (!exerciseId || deletingExerciseId || bulkDeleting) return
    const confirmed = await confirmGlobalAction({
      title: 'Remove personal exercise?',
      message: 'Remove this personal exercise from your library? Any personal swap links that depend on it will be removed too.',
      confirmLabel: 'Remove exercise',
      tone: 'danger',
    })
    if (!confirmed) return

    setDeletingExerciseId(exerciseId)
    setError('')
    setMessage('')
    setMergeSummary(null)

    try {
      await trainingApi.deletePersonalExercise(exerciseId)
      setExercises(current => current.filter(exercise => Number(exercise.id) !== Number(exerciseId)))
      setSelectedExerciseIds(current => current.filter(item => Number(item) !== Number(exerciseId)))
      if (editingExerciseId === exerciseId) {
        cancelEdit()
      }
      setMessage('That exercise was removed from your personal library.')
    } catch (nextError) {
      setError(nextError?.message || 'Could not remove that exercise.')
    } finally {
      setDeletingExerciseId(0)
    }
  }

  async function deleteSelectedExercises() {
    if (!selectedExerciseIds.length || bulkDeleting || deletingExerciseId || savingExerciseId) return

    const selectedSet = new Set(selectedExerciseIds.map(id => Number(id)).filter(Boolean))
    const selectedCount = selectedSet.size
    if (!selectedCount) return

    const confirmed = await confirmGlobalAction({
      title: `Remove ${selectedCount} personal exercise${selectedCount === 1 ? '' : 's'}?`,
      message: `Remove ${selectedCount} personal exercise${selectedCount === 1 ? '' : 's'} from your library? Any personal swap links that depend on them will be removed too.`,
      confirmLabel: 'Remove exercises',
      tone: 'danger',
    })
    if (!confirmed) return

    setBulkDeleting(true)
    setError('')
    setMessage('')
    setMergeSummary(null)

    try {
      const results = await Promise.allSettled(
        Array.from(selectedSet).map(exerciseId => trainingApi.deletePersonalExercise(exerciseId)),
      )

      const deletedIds = []
      const failedIds = []

      results.forEach((result, index) => {
        const exerciseId = Array.from(selectedSet)[index]
        if (result.status === 'fulfilled') {
          deletedIds.push(exerciseId)
        } else {
          failedIds.push(exerciseId)
        }
      })

      if (deletedIds.length) {
        const deletedSet = new Set(deletedIds)
        setExercises(current => current.filter(exercise => !deletedSet.has(Number(exercise.id))))
        setSelectedExerciseIds(current => current.filter(exerciseId => !deletedSet.has(Number(exerciseId))))
        if (editingExerciseId && deletedSet.has(Number(editingExerciseId))) {
          cancelEdit()
        }
      }

      if (failedIds.length) {
        setError(`Removed ${deletedIds.length} exercise${deletedIds.length === 1 ? '' : 's'}, but ${failedIds.length} could not be deleted.`)
      } else {
        setMessage(`Removed ${deletedIds.length} personal exercise${deletedIds.length === 1 ? '' : 's'} from your library.`)
      }
    } catch (nextError) {
      setError(nextError?.message || 'Could not remove the selected exercises.')
    } finally {
      setBulkDeleting(false)
    }
  }

  async function mergeDuplicateGroup(groupKey, items) {
    const keepExerciseId = Number(mergeTargets[groupKey] || 0)
    const removeExerciseIds = items
      .map(item => Number(item.id))
      .filter(exerciseId => exerciseId > 0 && exerciseId !== keepExerciseId)

    if (!keepExerciseId || !removeExerciseIds.length || mergingGroupKey || bulkDeleting || deletingExerciseId || savingExerciseId) return

    const keepExercise = items.find(item => Number(item.id) === keepExerciseId)
    const confirmed = await confirmGlobalAction({
      title: 'Merge duplicate exercises?',
      message: `Merge ${removeExerciseIds.length} duplicate exercise${removeExerciseIds.length === 1 ? '' : 's'} into ${keepExercise?.name || 'the selected exercise'}? This will move personal substitutions, training-plan references, and workout-session references to the kept exercise.`,
      confirmLabel: 'Merge duplicates',
    })
    if (!confirmed) return

    setMergingGroupKey(groupKey)
    setError('')
    setMessage('')
    setMergeSummary(null)

    try {
      const result = await trainingApi.mergePersonalExercises({
        keep_exercise_id: keepExerciseId,
        remove_exercise_ids: removeExerciseIds,
      })

      const removedSet = new Set(removeExerciseIds)
      setExercises(current => current.filter(exercise => !removedSet.has(Number(exercise.id))))
      setSelectedExerciseIds(current => current.filter(exerciseId => !removedSet.has(Number(exerciseId))))
      if (editingExerciseId && removedSet.has(Number(editingExerciseId))) {
        cancelEdit()
      }
      setMessage(`Merged ${removeExerciseIds.length} duplicate exercise${removeExerciseIds.length === 1 ? '' : 's'} into ${keepExercise?.name || 'the kept exercise'}.`)
      setMergeSummary(normalizeMergeSummary(result?.merge_summary))
    } catch (nextError) {
      setError(nextError?.message || 'Could not merge those duplicate exercises.')
    } finally {
      setMergingGroupKey('')
    }
  }

  if (loading && !exercises.length && !error) {
    return (
      <AppLoadingScreen
        eyebrow="Library"
        title="Loading your saved exercises"
        message="Johnny is pulling your personal exercise library and shaping the first cards so search feels immediate."
        compact
        variant="list"
      />
    )
  }

  return (
    <div className="screen workout-library-screen">
      <header className="screen-header workout-session-header">
        <div className="workout-session-header-main">
          <div className="workout-session-header-topline">
            <p className="dashboard-eyebrow">Library</p>
            <span className="dashboard-chip subtle">Personal exercises</span>
          </div>
          <h1>My exercise library</h1>
          <p className="settings-subtitle">Manage the exercises Johnny has saved for you. Edit the names and details you care about, or remove ones you do not want suggested again.</p>
        </div>
        <div className="workout-session-header-actions">
          <button type="button" className="btn-outline" onClick={() => navigate('/workout')}>Back to workout</button>
        </div>
      </header>

      <section className="dash-card workout-library-toolbar">
        <div className="dashboard-card-head">
          <span className="dashboard-chip workout">Search</span>
          <span className="dashboard-chip subtle">{exercises.length} loaded</span>
        </div>
        <div className="workout-library-toolbar-grid">
          <Field className="exercise-note-label workout-library-toolbar-field" label="Search your personal exercise library">
            <ClearableInput
              id="exercise-library-search"
              type="text"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search by exercise name or setup"
            />
          </Field>
          <Field className="exercise-note-label workout-library-toolbar-field" label="Sort by">
            <select id="exercise-library-sort" value={sortBy} onChange={event => setSortBy(event.target.value)}>
              <option value="newest">Newest saved</option>
              <option value="name">Name</option>
              <option value="muscle">Primary muscle</option>
              <option value="equipment">Equipment</option>
            </select>
          </Field>
        </div>
        {visibleExerciseIds.length ? (
          <div className="workout-library-bulk-bar">
            <div className="workout-library-bulk-copy">
              <span className="dashboard-chip subtle">{selectedVisibleCount} selected</span>
              <p>{allVisibleSelected ? 'All visible exercises are selected.' : 'Select individual exercises or grab everything in the current filtered view.'}</p>
            </div>
            <div className="workout-library-bulk-actions">
              <button type="button" className="btn-outline small" onClick={toggleSelectAllVisible} disabled={bulkDeleting}>
                {allVisibleSelected ? 'Clear visible' : 'Select all visible'}
              </button>
              <button type="button" className="btn-outline small" onClick={clearSelection} disabled={!selectedExerciseIds.length || bulkDeleting}>
                Clear selection
              </button>
              <button type="button" className="btn-outline small" onClick={deleteSelectedExercises} disabled={!selectedExerciseIds.length || bulkDeleting || Boolean(savingExerciseId) || Boolean(deletingExerciseId)}>
                {bulkDeleting ? 'Deleting selected...' : `Delete selected${selectedExerciseIds.length ? ` (${selectedExerciseIds.length})` : ''}`}
              </button>
            </div>
          </div>
        ) : null}
        {message ? <p className="success-msg">{message}</p> : null}
        {error ? <ErrorState message={error} title="Could not load your exercise library" /> : null}
      </section>

      {mergeSummary ? (
        <section className="dash-card workout-library-merge-summary">
          <div className="dashboard-card-head">
            <span className="dashboard-chip success">Merge summary</span>
            <span className="dashboard-chip subtle">Kept {mergeSummary.keepExercise?.name || 'selected exercise'}</span>
          </div>
          <p className="settings-subtitle">
            Retired {mergeSummary.removedExercises.length} duplicate exercise{mergeSummary.removedExercises.length === 1 ? '' : 's'} and moved {mergeSummary.substitutions.length} substitution{mergeSummary.substitutions.length === 1 ? '' : 's'} plus {mergeSummary.planRows.length} training-plan row{mergeSummary.planRows.length === 1 ? '' : 's'}.
          </p>

          {mergeSummary.removedExercises.length ? (
            <div className="workout-library-merge-block">
              <strong>Removed duplicates</strong>
              <div className="workout-library-merge-tags">
                {mergeSummary.removedExercises.map(exercise => (
                  <span key={exercise.id} className="workout-library-merge-tag">{exercise.name}</span>
                ))}
              </div>
            </div>
          ) : null}

          {mergeSummary.substitutions.length ? (
            <div className="workout-library-merge-block">
              <strong>Moved substitutions</strong>
              <div className="workout-library-merge-list">
                {mergeSummary.substitutions.map(item => (
                  <div key={item.id} className="workout-library-merge-row">
                    <span>{item.fromPair.exerciseName}{' -> '}{item.fromPair.substituteName}</span>
                    <span>{item.toPair.exerciseName}{' -> '}{item.toPair.substituteName}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {mergeSummary.planRows.length ? (
            <div className="workout-library-merge-block">
              <strong>Moved training plan rows</strong>
              <div className="workout-library-merge-list">
                {mergeSummary.planRows.map(item => (
                  <div key={item.id} className="workout-library-merge-row">
                    <span>{formatPlanRowLabel(item)}</span>
                    <span>{item.fromExercise.name}{' -> '}{item.toExercise.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && duplicateGroups.length ? (
        <section className="dash-card workout-library-duplicates-card">
          <div className="dashboard-card-head">
            <span className="dashboard-chip ai">Possible duplicates</span>
            <span className="dashboard-chip subtle">{duplicateGroups.length} group{duplicateGroups.length === 1 ? '' : 's'}</span>
          </div>
          <p className="settings-subtitle">Pick the exercise to keep in each duplicate set. Merge will move your personal substitutions, training-plan references, and workout-session references onto the kept exercise, then retire the extras.</p>
          <div className="workout-library-duplicate-groups">
            {duplicateGroups.map(([groupKey, items]) => {
              const keepExerciseId = Number(mergeTargets[groupKey] || 0)
              const removableCount = items.filter(item => Number(item.id) !== keepExerciseId).length
              const mergingThisGroup = mergingGroupKey === groupKey

              return (
                <div key={groupKey} className="workout-library-duplicate-group">
                  <div className="workout-library-duplicate-head">
                    <div>
                      <strong>{humanizeToken(groupKey)}</strong>
                      <p>{items.length} entries with the same normalized name</p>
                    </div>
                    <div className="workout-library-duplicate-actions">
                      <select value={keepExerciseId} onChange={event => updateMergeTarget(groupKey, event.target.value)} disabled={mergingThisGroup}>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>
                            Keep: {item.name}#{item.id}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="btn-outline small" onClick={() => mergeDuplicateGroup(groupKey, items)} disabled={mergingThisGroup || removableCount <= 0 || bulkDeleting || Boolean(deletingExerciseId) || Boolean(savingExerciseId)}>
                        {mergingThisGroup ? 'Merging...' : `Merge ${removableCount}`}
                      </button>
                    </div>
                  </div>
                  <div className="workout-library-duplicate-list">
                    {items.map(item => {
                      const isKeeper = Number(item.id) === keepExerciseId
                      return (
                        <div key={item.id} className={`workout-library-duplicate-pill${isKeeper ? ' keeper' : ''}`}>
                          <strong>{item.name}</strong>
                          <span>{buildExerciseMeta(item) || 'No extra details saved'}</span>
                          <small>{isKeeper ? 'Will keep this one' : `Will merge into #${keepExerciseId}`}</small>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="dash-card">
          <AppLoadingScreen
            eyebrow="Library"
            title="Refreshing your exercise list"
            message="Johnny is updating your matches and keeping the card layout warm while results come back."
            compact
            variant="list"
            copyStyle="inline"
          />
        </div>
      ) : null}
      {!loading && !groupedExercises.length ? (
        <EmptyState
          className="workout-library-empty-state"
          message="Save one from a workout swap suggestion and it will appear here."
          title="No personal exercises found yet"
        />
      ) : null}

      <div className="workout-library-groups">
        {groupedExercises.map(([groupName, items]) => (
          <section key={groupName} className="dash-card workout-library-group">
            <div className="dashboard-card-head">
              <span className="dashboard-chip coach">{groupName}</span>
              <span className="dashboard-chip subtle">{items.length} exercise{items.length === 1 ? '' : 's'}</span>
            </div>
            <div className="workout-swap-list workout-swap-list-personal">
              {items.map(exercise => {
                const isEditing = editingExerciseId === exercise.id
                const isSelected = selectedExerciseIds.includes(Number(exercise.id))
                const isBusy = bulkDeleting || savingExerciseId === exercise.id || deletingExerciseId === exercise.id

                return (
                  <div key={exercise.id} className={`workout-swap-row workout-swap-row-card${isSelected ? ' selected' : ''}`}>
                    <label className="workout-library-select-toggle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleExerciseSelection(exercise.id)}
                        disabled={bulkDeleting}
                        aria-label={`Select ${exercise.name}`}
                      />
                    </label>
                    <div className="workout-swap-row-copy">
                      <div className="workout-swap-row-title">
                        <strong>{exercise.name}</strong>
                        <span className="workout-swap-badge mine">My exercise</span>
                      </div>
                      <p>{exercise.description || 'Saved from one of your workout swap decisions.'}</p>
                      <p className="workout-swap-row-meta">{buildExerciseMeta(exercise)}</p>
                      {isEditing ? (
                        <div className="personal-exercise-editor">
                          <ClearableInput type="text" value={draft.name} onChange={event => updateDraft('name', event.target.value)} placeholder="Exercise name" />
                          <div className="personal-exercise-editor-grid">
                            <ClearableInput type="text" value={draft.primary_muscle} onChange={event => updateDraft('primary_muscle', event.target.value)} placeholder="Primary muscle" />
                            <ClearableInput type="text" value={draft.movement_pattern} onChange={event => updateDraft('movement_pattern', event.target.value)} placeholder="Movement pattern" />
                            <ClearableInput type="text" value={draft.equipment} onChange={event => updateDraft('equipment', event.target.value)} placeholder="Equipment" />
                            <select value={draft.difficulty} onChange={event => updateDraft('difficulty', event.target.value)}>
                              <option value="beginner">Beginner</option>
                              <option value="intermediate">Intermediate</option>
                              <option value="advanced">Advanced</option>
                            </select>
                          </div>
                          <textarea value={draft.description} onChange={event => updateDraft('description', event.target.value)} placeholder="Optional note for how this variation should be used." />
                        </div>
                      ) : null}
                    </div>
                    <div className="workout-swap-row-actions">
                      <button type="button" className="btn-outline small" onClick={() => isEditing ? cancelEdit() : beginEdit(exercise)} disabled={isBusy}>
                        {isEditing ? 'Cancel' : 'Edit'}
                      </button>
                      <button type="button" className="btn-outline small" onClick={() => isEditing ? saveExercise(exercise.id) : deleteExercise(exercise.id)} disabled={isBusy}>
                        {isEditing
                          ? (savingExerciseId === exercise.id ? 'Saving...' : 'Save')
                          : (deletingExerciseId === exercise.id ? 'Deleting...' : 'Delete')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function normalizeLibraryRows(rows) {
  return Array.isArray(rows)
    ? rows.map(row => ({
        ...row,
        owned_by_user: 1,
      }))
    : []
}

function buildDraft(exercise) {
  return {
    name: String(exercise?.name || '').trim(),
    description: String(exercise?.description || '').trim(),
    primary_muscle: String(exercise?.primary_muscle || '').trim(),
    movement_pattern: String(exercise?.movement_pattern || '').trim(),
    equipment: String(exercise?.equipment || '').trim(),
    difficulty: String(exercise?.difficulty || 'beginner').trim() || 'beginner',
  }
}

function buildExerciseMeta(exercise) {
  return [exercise?.primary_muscle, exercise?.equipment, exercise?.difficulty, exercise?.movement_pattern]
    .map(humanizeToken)
    .filter(Boolean)
    .join(' · ')
}

function humanizeToken(value) {
  if (!value) return ''
  return String(value).replace(/[_-]+/g, ' ').trim()
}

function normalizeDuplicateKey(value) {
  return humanizeToken(value).toLowerCase()
}

function normalizeMergeSummary(summary) {
  if (!summary || typeof summary !== 'object') return null

  return {
    keepExercise: summary.keep_exercise
      ? {
          id: Number(summary.keep_exercise.id || 0),
          name: String(summary.keep_exercise.name || '').trim(),
        }
      : null,
    removedExercises: Array.isArray(summary.removed_exercises)
      ? summary.removed_exercises.map(exercise => ({
          id: Number(exercise?.id || 0),
          name: String(exercise?.name || '').trim(),
        })).filter(exercise => exercise.id > 0)
      : [],
    substitutions: Array.isArray(summary.substitutions)
      ? summary.substitutions.map(item => ({
          id: Number(item?.id || 0),
          fromPair: {
            exerciseName: String(item?.from_pair?.exercise_name || '').trim(),
            substituteName: String(item?.from_pair?.substitute_name || '').trim(),
          },
          toPair: {
            exerciseName: String(item?.to_pair?.exercise_name || '').trim(),
            substituteName: String(item?.to_pair?.substitute_name || '').trim(),
          },
        })).filter(item => item.id > 0)
      : [],
    planRows: Array.isArray(summary.plan_rows)
      ? summary.plan_rows.map(item => ({
          id: Number(item?.id || 0),
          dayOrder: Number(item?.day_order || 0),
          dayType: String(item?.day_type || '').trim(),
          slotType: String(item?.slot_type || '').trim(),
          sortOrder: Number(item?.sort_order || 0),
          fromExercise: {
            id: Number(item?.from_exercise?.id || 0),
            name: String(item?.from_exercise?.name || '').trim(),
          },
          toExercise: {
            id: Number(item?.to_exercise?.id || 0),
            name: String(item?.to_exercise?.name || '').trim(),
          },
        })).filter(item => item.id > 0)
      : [],
  }
}

function formatPlanRowLabel(item) {
  const dayOrder = Number(item?.dayOrder || 0)
  const dayType = humanizeToken(item?.dayType || '')
  const slotType = humanizeToken(item?.slotType || '')
  const parts = []

  if (dayOrder > 0) parts.push(`Day ${dayOrder}`)
  if (dayType) parts.push(dayType)
  if (slotType) parts.push(slotType)
  if (Number(item?.sortOrder || 0) > 0) parts.push(`slot ${item.sortOrder}`)

  return parts.join(' · ')
}

function compareExercises(left, right, sortBy) {
  switch (sortBy) {
    case 'name':
      return compareText(left?.name, right?.name) || compareNewest(left, right)
    case 'muscle':
      return compareText(left?.primary_muscle, right?.primary_muscle) || compareText(left?.name, right?.name) || compareNewest(left, right)
    case 'equipment':
      return compareText(left?.equipment, right?.equipment) || compareText(left?.name, right?.name) || compareNewest(left, right)
    case 'newest':
    default:
      return compareNewest(left, right) || compareText(left?.name, right?.name)
  }
}

function compareNewest(left, right) {
  return Number(right?.id || 0) - Number(left?.id || 0)
}

function compareText(left, right) {
  return humanizeToken(left).localeCompare(humanizeToken(right), undefined, { sensitivity: 'base' })
}
