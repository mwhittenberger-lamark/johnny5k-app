import { useEffect, useState } from 'react'
import { trainingApi } from '../api/modules/training'
import { buildPersonalExerciseDraft, normalizeLibraryRows } from '../components/workout/swapShared'
import { confirmGlobalAction } from '../lib/uiFeedback'

export function usePersonalExerciseLibrarySwap({
  enabled,
  exercise,
  dayType = '',
  searchQuery = '',
}) {
  const [myExercises, setMyExercises] = useState([])
  const [loadingMyExercises, setLoadingMyExercises] = useState(false)
  const [myExercisesError, setMyExercisesError] = useState('')
  const [editingExerciseId, setEditingExerciseId] = useState(0)
  const [editDraft, setEditDraft] = useState(() => buildPersonalExerciseDraft())
  const [savingPersonalExerciseId, setSavingPersonalExerciseId] = useState(0)
  const [deletingPersonalExerciseId, setDeletingPersonalExerciseId] = useState(0)
  const [savedExerciseIds, setSavedExerciseIds] = useState([])

  useEffect(() => {
    if (!enabled) {
      setMyExercises([])
      setLoadingMyExercises(false)
      setMyExercisesError('')
      setEditingExerciseId(0)
      setEditDraft(buildPersonalExerciseDraft())
      setSavingPersonalExerciseId(0)
      setDeletingPersonalExerciseId(0)
      setSavedExerciseIds([])
      return
    }

    setMyExercises([])
    setLoadingMyExercises(false)
    setMyExercisesError('')
    setEditingExerciseId(0)
    setEditDraft(buildPersonalExerciseDraft())
    setSavingPersonalExerciseId(0)
    setDeletingPersonalExerciseId(0)
    setSavedExerciseIds([])
  }, [enabled, exercise?.id, exercise?.plan_exercise_id])

  useEffect(() => {
    if (!enabled || !exercise) return undefined

    let active = true
    const query = searchQuery.trim()
    const timer = window.setTimeout(async () => {
      setLoadingMyExercises(true)
      setMyExercisesError('')

      try {
        const params = {
          own_only: 1,
          ...(query.length >= 2 ? { q: query } : {}),
          limit: query.length >= 2 ? 12 : 8,
          ...(dayType ? { day_type: dayType } : {}),
          preferred_muscle: exercise.primary_muscle || '',
          preferred_equipment: exercise.equipment || '',
        }
        const rows = await trainingApi.getExercises(params)

        if (!active) return
        setMyExercises(normalizeLibraryRows(rows).filter(candidate => Number(candidate.id) !== Number(exercise.exercise_id)))
      } catch (error) {
        if (!active) return
        setMyExercisesError(error?.message || 'Could not load your saved exercises.')
      } finally {
        if (active) {
          setLoadingMyExercises(false)
        }
      }
    }, query.length >= 2 ? 220 : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [dayType, enabled, exercise, searchQuery])

  function handleEditPersonalExercise(option) {
    setEditingExerciseId(option.id)
    setEditDraft(buildPersonalExerciseDraft(option))
    setMyExercisesError('')
  }

  function handleEditDraftChange(key, value) {
    setEditDraft(current => ({
      ...current,
      [key]: value,
    }))
  }

  async function handleSavePersonalExercise(optionId) {
    if (!optionId || savingPersonalExerciseId) return

    setSavingPersonalExerciseId(optionId)
    setMyExercisesError('')

    try {
      await trainingApi.updatePersonalExercise(optionId, {
        name: editDraft.name,
        description: editDraft.description,
        primary_muscle: editDraft.primary_muscle,
        equipment: editDraft.equipment,
        difficulty: editDraft.difficulty,
        movement_pattern: editDraft.movement_pattern,
      })

      setMyExercises(current => current.map(option => (
        Number(option.id) === Number(optionId)
          ? {
              ...option,
              name: editDraft.name.trim(),
              description: editDraft.description.trim(),
              primary_muscle: editDraft.primary_muscle,
              equipment: editDraft.equipment,
              difficulty: editDraft.difficulty,
              movement_pattern: editDraft.movement_pattern,
            }
          : option
      )))
      setEditingExerciseId(0)
      return true
    } catch (error) {
      setMyExercisesError(error?.message || 'Could not update that exercise.')
      return false
    } finally {
      setSavingPersonalExerciseId(0)
    }
  }

  async function handleDeletePersonalExercise(optionId) {
    if (!optionId || deletingPersonalExerciseId) return false
    const confirmed = await confirmGlobalAction({
      title: 'Remove personal exercise?',
      message: 'Remove this personal exercise from your library? Any personal swap links that depend on it will be removed too.',
      confirmLabel: 'Remove exercise',
      tone: 'danger',
    })
    if (!confirmed) return false

    setDeletingPersonalExerciseId(optionId)
    setMyExercisesError('')

    try {
      await trainingApi.deletePersonalExercise(optionId)
      setMyExercises(current => current.filter(option => Number(option.id) !== Number(optionId)))
      setSavedExerciseIds(current => current.filter(id => Number(id) !== Number(optionId)))
      if (editingExerciseId === optionId) {
        setEditingExerciseId(0)
        setEditDraft(buildPersonalExerciseDraft())
      }
      return true
    } catch (error) {
      setMyExercisesError(error?.message || 'Could not remove that exercise.')
      return false
    } finally {
      setDeletingPersonalExerciseId(0)
    }
  }

  function prependSavedExercise(exerciseRow) {
    setSavedExerciseIds(current => Array.from(new Set([...current, Number(exerciseRow.id)])))
    setMyExercises(current => {
      const next = [exerciseRow, ...current]
      const deduped = []
      const seen = new Set()
      for (const row of next) {
        const rowId = Number(row?.id || 0)
        if (!rowId || seen.has(rowId)) continue
        seen.add(rowId)
        deduped.push(row)
      }
      return deduped
    })
  }

  return {
    myExercises,
    loadingMyExercises,
    myExercisesError,
    editingExerciseId,
    editDraft,
    savingPersonalExerciseId,
    deletingPersonalExerciseId,
    savedExerciseIds,
    setEditingExerciseId,
    handleEditPersonalExercise,
    handleEditDraftChange,
    handleSavePersonalExercise,
    handleDeletePersonalExercise,
    prependSavedExercise,
  }
}
