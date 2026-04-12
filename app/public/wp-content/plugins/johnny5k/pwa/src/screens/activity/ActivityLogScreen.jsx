import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { bodyApi } from '../../api/modules/body'
import { workoutApi } from '../../api/modules/workout'
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

  return (
    <div className="screen activity-log-screen">
      <header className="screen-header body-screen-header">
        <div>
          <h1>Activity Log</h1>
          <p className="body-screen-subtitle">See completed lifts and cardio sessions with the details that were actually logged.</p>
        </div>
        <div className="activity-log-header-actions">
          <button className="btn-secondary" type="button" onClick={() => navigate('/body')}>
            Back to Progress
          </button>
        </div>
      </header>

      <section className="body-summary-grid">
        <SummaryCard label="Entries" value={entries.length || '—'} meta={entries.length ? 'Workouts and cardio sessions shown newest first' : 'No activity entries yet'} accent="orange" />
        <SummaryCard label="Workouts" value={entries.filter(entry => entry.type === 'workout').length || '—'} meta="Completed lifting sessions in your log" accent="teal" />
        <SummaryCard label="Cardio" value={entries.filter(entry => entry.type === 'cardio').length || '—'} meta="Conditioning sessions mixed into the same feed" accent="pink" />
      </section>

      {johnnyActionNotice && dismissedActionNoticeKey !== actionNoticeKey ? (
        <div className="dash-card settings-warning dashboard-notice" role="status">
          <div>
            <strong>Johnny opened this screen.</strong>
            <p>{johnnyActionNotice}</p>
          </div>
          <button className="btn-outline small" type="button" onClick={() => setDismissedActionNoticeKey(actionNoticeKey)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {loading ? (
        <section className="dash-card">
          <p>Loading activity log...</p>
        </section>
      ) : null}

      {!loading && error ? (
        <section className="dash-card">
          <ErrorState className="activity-inline-error" message={error} title="Could not load activity log" />
        </section>
      ) : null}

      {!loading && !error && !entries.length ? (
        <section className="dash-card">
          <p className="body-recovery-note">No completed workouts or cardio sessions are logged yet.</p>
        </section>
      ) : null}

      {!loading && !error ? groupedEntries.map(group => (
        <section key={group.dateKey} className="dash-card activity-log-day-card">
          <div className="body-card-header">
            <h3>{group.label}</h3>
            <p>{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'} logged</p>
          </div>
          <div className="activity-log-entry-list">
            {group.entries.map(entry => (
              <article key={entry.key} className={`activity-log-entry-card ${entry.type}`}>
                <div className="activity-log-entry-header">
                  <div>
                    <span className={`dashboard-chip ${entry.type === 'workout' ? 'workout' : 'coach'}`}>{entry.type === 'workout' ? 'Workout' : 'Cardio'}</span>
                    <h4>{entry.title}</h4>
                  </div>
                  <div className="activity-log-entry-summary">
                    <strong>{entry.durationLabel}</strong>
                    <span>{entry.summary}</span>
                  </div>
                </div>

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
              </article>
            ))}
          </div>
        </section>
      )) : null}
    </div>
  )
}

function SummaryCard({ label, value, suffix = '', meta, accent = 'orange' }) {
  return (
    <article className={`dash-card dashboard-stat-card activity-log-stat-card ${accent}`}>
      <p>{label}</p>
      <h3>{value}{suffix}</h3>
      <span>{meta}</span>
    </article>
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
