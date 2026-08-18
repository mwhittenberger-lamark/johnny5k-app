import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { bodyApi } from '../../api/modules/body'
import { workoutApi } from '../../api/modules/workout'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import ErrorState from '../../components/ui/ErrorState'
import { formatUsFriendlyDate, formatUsShortDate } from '../../lib/dateFormat'

const ACTIVITY_LOG_LIMIT = 24

export default function ActivityLogScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dismissedActionNoticeKey, setDismissedActionNoticeKey] = useState('')
  const johnnyActionNotice = location.state?.johnnyActionNotice
  const actionNoticeKey = String(johnnyActionNotice || '')

  useEffect(() => {
    const notice = location.state?.johnnyActionNotice
    if (!notice) {
      return undefined
    }

    const nextState = { ...(location.state || {}) }
    delete nextState.johnnyActionNotice
    navigate(location.pathname, { replace: true, state: Object.keys(nextState).length ? nextState : null })
    return undefined
  }, [location.pathname, location.state, location.state?.johnnyActionNotice, navigate])

  useEffect(() => {
    let active = true

    async function loadActivityLog() {
      setLoading(true)
      setError('')

      try {
        const [workoutSummaries, cardioLogs] = await Promise.all([
          workoutApi.getHistory(365, ACTIVITY_LOG_LIMIT),
          bodyApi.getCardio(ACTIVITY_LOG_LIMIT),
        ])

        const workoutEntries = await Promise.all(
          (Array.isArray(workoutSummaries) ? workoutSummaries : []).map(async summary => {
            try {
              const detail = await workoutApi.get(summary.id)
              return buildWorkoutEntry(summary, detail)
            } catch {
              return buildWorkoutEntry(summary, null)
            }
          }),
        )

        const cardioEntries = (Array.isArray(cardioLogs) ? cardioLogs : []).map(buildCardioEntry)
        const combinedEntries = [...workoutEntries, ...cardioEntries].sort(compareActivityEntries)

        if (active) {
          setEntries(combinedEntries)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError?.message || 'Could not load the activity log right now.')
          setEntries([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadActivityLog()

    return () => {
      active = false
    }
  }, [])

  const groupedEntries = useMemo(() => {
    const groups = []

    entries.forEach(entry => {
      const group = groups[groups.length - 1]
      if (group && group.dateKey === entry.dateKey) {
        group.entries.push(entry)
        return
      }

      groups.push({
        dateKey: entry.dateKey,
        label: formatUsFriendlyDate(entry.dateKey, entry.dateKey),
        entries: [entry],
      })
    })

    return groups
  }, [entries])

  const workoutCount = entries.filter(entry => entry.type === 'workout').length
  const cardioCount = entries.filter(entry => entry.type === 'cardio').length
  const totalMinutes = entries.reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0)

  return (
    <div className="screen activity-log-screen activity-observatory">
      <div className="activity-observatory-ambient" aria-hidden="true" />

      <header className="activity-observatory-header">
        <div className="activity-observatory-title">
          <button type="button" className="activity-observatory-back" onClick={() => navigate('/dashboard')}>
            <span aria-hidden="true">←</span>
            Back to Johnny
          </button>
          <span className="activity-observatory-kicker">Training telemetry</span>
          <h1>Activity Log</h1>
          <p>Every completed lift and conditioning session, ordered into one training record.</p>
        </div>
        <div className="activity-observatory-actions">
          <button className="activity-observatory-action primary" type="button" onClick={() => navigate('/body', { state: { focusTab: 'diary' } })}>
            Progress diary
          </button>
        </div>

        <div className="activity-observatory-vitals" aria-label="Activity summary">
          <div><span>Total entries</span><strong>{entries.length || '—'}</strong></div>
          <div><span>Workouts</span><strong>{workoutCount || '—'}</strong></div>
          <div><span>Cardio</span><strong>{cardioCount || '—'}</strong></div>
          <div><span>Recorded time</span><strong>{totalMinutes ? formatDurationMinutes(totalMinutes) : '—'}</strong></div>
        </div>
      </header>

      <main className="activity-observatory-scroll">
        <div className="activity-observatory-ledger-head">
          <div>
            <span className="activity-observatory-kicker">Session ledger</span>
            <h2>Recent training record</h2>
          </div>
          <span>{groupedEntries.length} recorded days · newest first</span>
        </div>

      {johnnyActionNotice && dismissedActionNoticeKey !== actionNoticeKey ? (
        <div className="activity-observatory-notice" role="status">
          <div>
            <strong>Johnny opened this screen.</strong>
            <p>{johnnyActionNotice}</p>
          </div>
          <button type="button" onClick={() => setDismissedActionNoticeKey(actionNoticeKey)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {loading ? (
        <section className="activity-observatory-state" role="status">
          <AppLoadingScreen
            eyebrow="Activity"
            title="Refreshing your timeline"
            message="Johnny is pulling the latest workout and cardio details without dropping the layout."
            compact
            variant="list"
            copyStyle="inline"
          />
        </section>
      ) : null}

      {!loading && error ? (
        <section className="activity-observatory-state error">
          <ErrorState className="activity-inline-error" message={error} title="Could not load activity log" />
        </section>
      ) : null}

      {!loading && !error && !entries.length ? (
        <section className="activity-observatory-state empty">
          <span>00</span>
          <div><h2>Your training ledger is waiting</h2><p>Complete a workout or log cardio and the session will appear here automatically.</p></div>
        </section>
      ) : null}

      {!loading && !error && entries.length ? (
        <section className="activity-log-timeline" aria-label="Activity timeline">
          {groupedEntries.map((group, groupIndex) => (
            <section key={group.dateKey} className="activity-log-day-card">
              <header className="activity-log-day-marker">
                <span>{String(groupIndex + 1).padStart(2, '0')}</span>
                <div><h3>{group.label}</h3><p>{group.entries.length} {group.entries.length === 1 ? 'session' : 'sessions'}</p></div>
              </header>
              <div className="activity-log-entry-list">
                {group.entries.map((entry, entryIndex) => (
                  <details key={entry.key} className={`activity-log-entry-card ${entry.type}`} open={groupIndex === 0 && entryIndex === 0}>
                    <summary className="activity-log-entry-header">
                  <div>
                    <span className="activity-log-entry-type">{entry.type === 'workout' ? 'Workout' : 'Cardio'}</span>
                    <h4>{entry.title}</h4>
                  </div>
                  <div className="activity-log-entry-summary">
                    <strong>{entry.durationLabel}</strong>
                    <span>{entry.summary}</span>
                  </div>
                  <span className="activity-log-entry-toggle" aria-hidden="true" />
                </summary>

                <div className="activity-log-entry-body">
                {entry.type === 'workout' ? (
                  <>
                    <p className="activity-log-entry-meta">
                      {entry.exerciseCountLabel}
                      {entry.completedSetLabel ? ` • ${entry.completedSetLabel}` : ''}
                    </p>
                    {entry.exercises.length ? (
                      <div className="activity-log-exercise-list">
                        {entry.exercises.map(exercise => (
                          <div key={exercise.key} className="activity-log-exercise-row">
                            <div className="activity-log-exercise-head">
                              <strong>{exercise.name}</strong>
                              {exercise.slotType ? <span>{exercise.slotType}</span> : null}
                            </div>
                            <p>{exercise.setSummary || 'No logged working sets saved for this exercise.'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="activity-log-entry-meta">Exercise details are not available for this workout yet.</p>
                    )}
                  </>
                ) : (
                  <div className="activity-log-cardio-meta">
                    <p>{entry.intensityLabel}{entry.distanceLabel ? ` • ${entry.distanceLabel}` : ''}{entry.caloriesLabel ? ` • ${entry.caloriesLabel}` : ''}</p>
                    {entry.notes ? <p>{entry.notes}</p> : null}
                  </div>
                )}
                </div>
              </details>
                ))}
              </div>
            </section>
          ))}
        </section>
      ) : null}
      </main>
    </div>
  )
}

function buildWorkoutEntry(summary, detail) {
  const exercises = Array.isArray(detail?.exercises) ? detail.exercises.map((exercise, index) => ({
    key: `${summary.id}-${exercise.id || index}`,
    name: exercise.exercise_name || 'Exercise',
    slotType: formatSlotType(exercise.slot_type),
    setSummary: buildSetSummary(exercise),
  })) : []

  const sessionDate = summary?.session_date || detail?.session?.session_date || ''
  const dayType = summary?.actual_day_type || summary?.planned_day_type || detail?.session?.actual_day_type || detail?.session?.planned_day_type || 'workout'
  const durationMinutes = Number(summary?.duration_minutes ?? detail?.session?.duration_minutes ?? 0)
  const completedAt = summary?.completed_at || detail?.session?.completed_at || ''
  const exerciseCount = Number(summary?.exercise_count || exercises.length || 0)
  const completedSets = Number(summary?.completed_sets || 0)

  return {
    key: `workout-${summary?.id}`,
    type: 'workout',
    title: `${formatDayType(dayType)} day`,
    summary: completedAt ? `Finished ${formatSessionTime(completedAt)}` : `Logged ${formatUsShortDate(sessionDate, sessionDate)}`,
    durationLabel: formatDurationMinutes(durationMinutes),
    durationMinutes,
    exerciseCountLabel: `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`,
    completedSetLabel: completedSets ? `${completedSets} completed sets` : '',
    dateKey: sessionDate,
    sortValue: completedAt || sessionDate,
    exercises,
  }
}

function buildCardioEntry(entry) {
  const sessionDate = entry?.cardio_date || ''
  const durationMinutes = Number(entry?.duration_minutes || 0)

  return {
    key: `cardio-${entry?.id}`,
    type: 'cardio',
    title: formatCardioType(entry?.cardio_type),
    summary: `Logged ${formatUsShortDate(sessionDate, sessionDate)}`,
    durationLabel: formatDurationMinutes(durationMinutes),
    durationMinutes,
    intensityLabel: `Intensity: ${formatDayType(entry?.intensity || 'moderate')}`,
    distanceLabel: entry?.distance ? `${trimNumber(entry.distance)} mi` : '',
    caloriesLabel: entry?.estimated_calories ? `${Number(entry.estimated_calories).toLocaleString()} cal` : '',
    notes: entry?.notes || '',
    dateKey: sessionDate,
    sortValue: sessionDate,
  }
}

function buildSetSummary(exercise) {
  const savedSets = (Array.isArray(exercise?.sets) ? exercise.sets : [])
    .filter(set => Number(set?.completed || 0) === 1 || Number(set?.reps || 0) > 0 || Number(set?.weight || 0) > 0)
    .map(set => formatSetEntry(set, exercise?.equipment))

  return savedSets.join(' • ')
}

function formatSetEntry(set, equipment) {
  const parts = [`Set ${Number(set?.set_number || 0) || 1}`]
  const weightLabel = formatWeightValue(set?.weight, equipment)
  const repsValue = Number(set?.reps || 0)

  if (weightLabel) {
    parts.push(weightLabel)
  }

  if (repsValue > 0) {
    parts.push(`${repsValue} reps`)
  }

  if (!weightLabel && repsValue <= 0) {
    parts.push(Number(set?.completed || 0) === 1 ? 'completed' : 'logged')
  }

  return parts.join(' ')
}

function formatWeightValue(value, equipment) {
  const weight = Number(value || 0)
  if (weight > 0) {
    return `${trimNumber(weight)} lb`
  }

  if (String(equipment || '').toLowerCase() === 'bodyweight') {
    return 'bodyweight'
  }

  return ''
}

function formatDurationMinutes(value) {
  const minutes = Number(value || 0)
  if (!minutes) {
    return '—'
  }

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (!remainingMinutes) {
      return `${hours}h`
    }
    return `${hours}h ${remainingMinutes}m`
  }

  return `${minutes} min`
}

function formatSessionTime(value) {
  const parsed = parseUtcSqlDateTime(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

function formatDayType(value) {
  if (!value) return 'Workout'
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

function formatSlotType(value) {
  if (!value) return ''
  return formatDayType(value)
}

function formatCardioType(value) {
  if (!value) return 'Cardio'
  return formatDayType(value)
}

function trimNumber(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return ''
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1).replace(/\.0$/, '')
}

function compareActivityEntries(left, right) {
  const rightDate = getSortTimestamp(right)
  const leftDate = getSortTimestamp(left)

  if (rightDate !== leftDate) {
    return rightDate - leftDate
  }

  return String(right.key).localeCompare(String(left.key))
}

function getSortTimestamp(entry) {
  const rawValue = String(entry?.sortValue || entry?.dateKey || '').trim()
  if (!rawValue) return 0

  const parsed = rawValue.includes('T') || rawValue.includes(' ')
    ? parseUtcSqlDateTime(rawValue)
    : new Date(`${rawValue}T12:00:00`)

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function parseUtcSqlDateTime(value) {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return new Date('')
  }

  if (/z$/i.test(rawValue) || /[+-]\d{2}:?\d{2}$/.test(rawValue)) {
    return new Date(rawValue)
  }

  return new Date(`${rawValue.replace(' ', 'T')}Z`)
}
