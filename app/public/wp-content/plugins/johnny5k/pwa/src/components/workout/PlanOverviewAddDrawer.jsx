import { useEffect, useMemo, useState } from 'react'
import { trainingApi } from '../../api/modules/training'
import AppDrawer from '../ui/AppDrawer'
import ClearableInput from '../ui/ClearableInput'
import ErrorState from '../ui/ErrorState'
import Field from '../ui/Field'
import { buildExerciseMeta, humanizeToken, isUserOwnedExercise } from './swapShared'

const SLOT_OPTIONS = [
  { value: 'accessory', label: 'Accessory' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'abs', label: 'Abs' },
  { value: 'challenge', label: 'Challenge' },
]

export default function PlanOverviewAddDrawer({
  isOpen,
  dayType,
  existingExerciseIds = [],
  onClose,
  onAdd,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [slotType, setSlotType] = useState('accessory')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState([])
  const [selectingExerciseId, setSelectingExerciseId] = useState(0)
  const existingExerciseIdSet = useMemo(
    () => new Set((Array.isArray(existingExerciseIds) ? existingExerciseIds : []).map(Number).filter(Boolean)),
    [existingExerciseIds],
  )

  useEffect(() => {
    if (!isOpen) return
    setSearchQuery('')
    setSlotType('accessory')
    setLoading(false)
    setError('')
    setResults([])
    setSelectingExerciseId(0)
  }, [isOpen])

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
    if (!isOpen) return undefined

    let active = true
    const query = searchQuery.trim()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')

      try {
        const rows = await trainingApi.getExercises({
          ...(query ? { q: query } : {}),
          limit: query ? 12 : 10,
          day_type: dayType || '',
          ...(slotType ? { slot_type: slotType } : {}),
        })
        if (!active) return

        setResults(
          (Array.isArray(rows) ? rows : []).filter(candidate => !existingExerciseIdSet.has(Number(candidate?.id || 0))),
        )
      } catch (nextError) {
        if (!active) return
        setError(nextError?.message || 'Could not search exercises right now.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }, query ? 220 : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [dayType, existingExerciseIdSet, isOpen, searchQuery, slotType])

  if (!isOpen) {
    return null
  }

  async function handleChoose(option) {
    setSelectingExerciseId(Number(option?.id || 0))
    try {
      await onAdd(option, { closeDrawer: true, waitForDrawerClose: true })
    } finally {
      setSelectingExerciseId(0)
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
          <h3 id="plan-overview-add-exercise">Add an exercise</h3>
        </div>
        <button type="button" className="exercise-drawer-close" onClick={onClose}>
          Close
        </button>
      </div>

      <p className="exercise-drawer-subtitle">
        Browse your library the same way you would for a swap, then add the movement straight into today&apos;s planned workout before you start.
      </p>

      <section className="workout-context-card workout-plan-drawer-section">
        <div className="dashboard-card-head">
          <span className="dashboard-chip subtle">Pick the slot</span>
          {dayType ? <span className="dashboard-chip subtle">{humanizeToken(dayType)}</span> : null}
        </div>
        <div className="workout-daytype-grid">
          {SLOT_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`daytype-pill${slotType === option.value ? ' active' : ''}`}
              onClick={() => setSlotType(option.value)}
            >
              <strong>{option.label}</strong>
              <small>Add a {option.label.toLowerCase()} movement</small>
            </button>
          ))}
        </div>
      </section>

      <section className="workout-context-card workout-plan-drawer-section">
        <div className="dashboard-card-head">
          <span className="dashboard-chip subtle">Exercise library</span>
        </div>
        <Field className="exercise-note-label" label="Search exercises">
          <ClearableInput
            id="plan-add-search"
            type="text"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search your exercise library"
          />
        </Field>
        {loading ? <p className="settings-subtitle">{searchQuery.trim() ? 'Searching the library...' : 'Loading suggested exercises...'}</p> : null}
        {error ? <ErrorState className="workout-inline-state" message={error} title="Could not search your library" /> : null}
        {results.length ? (
          <div className="workout-swap-list">
            {results.map(option => (
              <div key={option.id} className="workout-swap-row workout-swap-row-card">
                <div className="workout-swap-row-copy">
                  <div className="workout-swap-row-title">
                    <strong>{option.name}</strong>
                    {isUserOwnedExercise(option) ? <span className="workout-swap-badge saved">Saved to your library</span> : null}
                  </div>
                  <p className="workout-swap-row-meta">{buildExerciseMeta(option)}</p>
                </div>
                <button
                  type="button"
                  className="btn-outline small"
                  onClick={() => handleChoose(option)}
                  disabled={selectingExerciseId === Number(option.id)}
                >
                  {selectingExerciseId === Number(option.id) ? 'Adding...' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        ) : !loading && !error ? (
          <p className="settings-subtitle">
            {searchQuery.trim()
              ? 'No matching exercises are available for that search yet.'
              : 'No exercises are available for that slot right now.'}
          </p>
        ) : null}
      </section>
    </AppDrawer>
  )
}
