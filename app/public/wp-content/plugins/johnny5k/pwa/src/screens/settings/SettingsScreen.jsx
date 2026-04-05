import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onboardingApi } from '../../api/client'
import { useDashboardStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { buildHeightCm, formatReminderHour, formatMissingFields, getTimezoneRegion, getTimezoneRegions, getTimezonesForRegion, normalizeTargets, reminderHourOptions, settingsFormFromState } from '../../lib/onboarding'

const DAY_TYPE_OPTIONS = [
  ['push', 'Push'],
  ['pull', 'Pull'],
  ['legs', 'Legs'],
  ['arms_shoulders', 'Bonus arms + shoulders'],
  ['cardio', 'Cardio'],
  ['rest', 'Rest'],
]
const TIMEZONE_REGIONS = getTimezoneRegions()
const REMINDER_HOUR_OPTIONS = reminderHourOptions()

export default function SettingsScreen() {
  const navigate = useNavigate()
  const invalidate = useDashboardStore(s => s.invalidate)
  const loadSnapshot = useDashboardStore(s => s.loadSnapshot)
  const setAuth = useAuthStore(s => s.setAuth)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(settingsFormFromState())
  const [targets, setTargets] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [missingFields, setMissingFields] = useState([])
  const [timezoneRegion, setTimezoneRegion] = useState(getTimezoneRegion(form.timezone))

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function updateSchedule(day, dayType) {
    setForm(current => ({
      ...current,
      weekly_schedule: (current.weekly_schedule ?? []).map(entry => entry.day === day ? { ...entry, day_type: dayType } : entry),
    }))
  }

  useEffect(() => {
    let active = true

    onboardingApi.getState()
      .then(data => {
        if (!active) return
        const nextForm = settingsFormFromState(data.profile, data.prefs, data.goal)
        setForm(nextForm)
        setTimezoneRegion(getTimezoneRegion(nextForm.timezone))
        setTargets(normalizeTargets(data.goal))
        setMissingFields(formatMissingFields(data.missing_profile_fields))
      })
      .catch(err => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [])

  async function persist({ recalculate = false }) {
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const height_cm = buildHeightCm(form.height_ft, form.height_in_part)

      await onboardingApi.saveProfile({
        first_name: form.first_name,
        last_name: form.last_name,
        date_of_birth: form.date_of_birth,
        sex: form.sex,
        timezone: form.timezone,
        height_cm,
        starting_weight_lb: form.starting_weight_lb,
        current_goal: form.current_goal,
        goal_rate: form.goal_rate,
        activity_level: form.activity_level,
        phone: form.phone,
      })

      await onboardingApi.savePrefs({
        target_steps: form.target_steps,
        target_sleep_hours: form.target_sleep_hours,
        notifications_enabled: form.notifications_enabled,
        exercise_preferences_json: {
          ...(form.preference_meta ?? {}),
          workout_reminder_enabled: form.workout_reminder_enabled,
          workout_reminder_hour: Number(form.workout_reminder_hour),
          meal_reminder_enabled: form.meal_reminder_enabled,
          meal_reminder_hour: Number(form.meal_reminder_hour),
          sleep_reminder_enabled: form.sleep_reminder_enabled,
          sleep_reminder_hour: Number(form.sleep_reminder_hour),
          weekly_summary_enabled: form.weekly_summary_enabled,
          weekly_summary_hour: Number(form.weekly_summary_hour),
        },
      })

      await onboardingApi.updateTrainingSchedule({
        preferred_workout_days_json: form.weekly_schedule,
      })

      if (recalculate) {
        const data = await onboardingApi.recalculate()
        const nextTargets = normalizeTargets(data)
        setTargets(nextTargets)
        setMessage('Profile saved and daily targets recalculated.')
        navigate('/dashboard', { state: { targetsUpdated: nextTargets } })
      } else {
        setMessage('Profile saved.')
      }

      const state = await onboardingApi.getState()
      setMissingFields(formatMissingFields(state.missing_profile_fields))
      invalidate()
      await loadSnapshot(true)
    } catch (err) {
      const missing = formatMissingFields(err?.data?.missing_profile_fields)
      if (missing.length) {
        setMissingFields(missing)
        setError(`Missing required fields for target calculation: ${missing.join(', ')}.`)
      } else {
        setError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  async function restartOnboarding() {
    if (saving) return
    const confirmed = window.confirm('Restart onboarding? Your saved profile data will stay in place, but you will be sent back through the setup flow.')
    if (!confirmed) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      await onboardingApi.restart()
      setAuth({ onboarding_complete: false })
      navigate('/onboarding/welcome', { replace: true })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const regionTimezones = useMemo(() => getTimezonesForRegion(timezoneRegion), [timezoneRegion])

  if (loading) return <div className="screen-loading">Loading…</div>

  return (
    <div className="screen settings-screen">
      <header className="screen-header">
        <div>
          <h1>Profile</h1>
          <p className="settings-subtitle">Update your body data, preferences, and daily targets.</p>
        </div>
      </header>

      {missingFields.length > 0 && (
        <div className="dash-card settings-warning">
          <strong>Missing for calorie targets:</strong> {missingFields.join(', ')}.
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      <section className="settings-section dash-card">
        <h3>About You</h3>
        <div className="settings-grid">
          <label>First Name<input value={form.first_name} onChange={e => update('first_name', e.target.value)} /></label>
          <label>Last Name<input value={form.last_name} onChange={e => update('last_name', e.target.value)} /></label>
          <label>Date of Birth<input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} /></label>
          <label>Sex
            <select value={form.sex} onChange={e => update('sex', e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Height (ft)<input type="number" min="4" max="7" value={form.height_ft} onChange={e => update('height_ft', e.target.value)} /></label>
          <label>Height (in)<input type="number" min="0" max="11" value={form.height_in_part} onChange={e => update('height_in_part', e.target.value)} /></label>
          <label>Timezone
            <div className="timezone-picker">
              <select value={timezoneRegion} onChange={e => {
                const nextRegion = e.target.value
                const nextZones = getTimezonesForRegion(nextRegion)
                setTimezoneRegion(nextRegion)
                update('timezone', nextZones.includes(form.timezone) ? form.timezone : nextZones[0] || form.timezone)
              }}>
                {TIMEZONE_REGIONS.map(region => <option key={region} value={region}>{region}</option>)}
              </select>
              <select value={form.timezone} onChange={e => update('timezone', e.target.value)}>
                {regionTimezones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
              </select>
            </div>
          </label>
        </div>
      </section>

      <section className="settings-section dash-card">
        <h3>Body & Goal</h3>
        <div className="settings-grid">
          <label>Current Weight (lbs)<input type="number" min="80" max="600" step="0.1" value={form.starting_weight_lb} onChange={e => update('starting_weight_lb', e.target.value)} /></label>
          <label>Goal
            <select value={form.current_goal} onChange={e => update('current_goal', e.target.value)}>
              <option value="cut">Cut</option>
              <option value="gain">Gain</option>
              <option value="recomp">Recomp</option>
              <option value="maintain">Maintain</option>
            </select>
          </label>
          <label>Goal Pace
            <select value={form.goal_rate} onChange={e => update('goal_rate', e.target.value)}>
              <option value="slow">Slow</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>
          <label>Activity Level
            <select value={form.activity_level} onChange={e => update('activity_level', e.target.value)}>
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="high">Active</option>
              <option value="athlete">Athlete</option>
            </select>
          </label>
        </div>
      </section>

      <section className="settings-section dash-card">
        <h3>Daily Targets</h3>
        <div className="settings-grid">
          <label>Steps<input type="number" min="1000" max="30000" step="1" value={form.target_steps} onChange={e => update('target_steps', Number(e.target.value))} /></label>
          <label>Sleep (hours)<input type="number" min="4" max="12" step="0.5" value={form.target_sleep_hours} onChange={e => update('target_sleep_hours', Number(e.target.value))} /></label>
          <label className="toggle-label">
            <span>SMS reminders</span>
            <input type="checkbox" checked={form.notifications_enabled} onChange={e => update('notifications_enabled', e.target.checked)} />
          </label>
          <label>Phone<input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+15551234567" /></label>
        </div>
        {form.notifications_enabled ? (
          <div className="settings-grid settings-grid-compact reminder-grid">
            <div className="reminder-setting-card">
              <label className="toggle-row">
                <span>Workout reminder</span>
                <input type="checkbox" checked={form.workout_reminder_enabled} onChange={e => update('workout_reminder_enabled', e.target.checked)} />
              </label>
              {form.workout_reminder_enabled ? (
                <label>Time
                  <select value={form.workout_reminder_hour} onChange={e => update('workout_reminder_hour', Number(e.target.value))}>
                    {REMINDER_HOUR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="reminder-setting-card">
              <label className="toggle-row">
                <span>Meal reminder</span>
                <input type="checkbox" checked={form.meal_reminder_enabled} onChange={e => update('meal_reminder_enabled', e.target.checked)} />
              </label>
              {form.meal_reminder_enabled ? (
                <label>Time
                  <select value={form.meal_reminder_hour} onChange={e => update('meal_reminder_hour', Number(e.target.value))}>
                    {REMINDER_HOUR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="reminder-setting-card">
              <label className="toggle-row">
                <span>Sleep reminder</span>
                <input type="checkbox" checked={form.sleep_reminder_enabled} onChange={e => update('sleep_reminder_enabled', e.target.checked)} />
              </label>
              {form.sleep_reminder_enabled ? (
                <label>Time
                  <select value={form.sleep_reminder_hour} onChange={e => update('sleep_reminder_hour', Number(e.target.value))}>
                    {REMINDER_HOUR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="reminder-setting-card">
              <label className="toggle-row">
                <span>Weekly summary</span>
                <input type="checkbox" checked={form.weekly_summary_enabled} onChange={e => update('weekly_summary_enabled', e.target.checked)} />
              </label>
              {form.weekly_summary_enabled ? (
                <label>Time
                  <select value={form.weekly_summary_hour} onChange={e => update('weekly_summary_hour', Number(e.target.value))}>
                    {REMINDER_HOUR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
          </div>
        ) : null}
        {form.notifications_enabled ? <p className="settings-subtitle">All reminder times use your saved timezone. Weekly summary sends Mondays at {formatReminderHour(form.weekly_summary_hour)}.</p> : null}
      </section>

      <section className="settings-section dash-card">
        <h3>Weekly Split</h3>
        <p className="settings-subtitle">Change which days are push, pull, legs, bonus, cardio, or full rest. Saving here also refreshes the active plan order.</p>
        <div className="onboarding-schedule-list">
          {(form.weekly_schedule ?? []).map(entry => (
            <div key={entry.day} className="onboarding-schedule-row">
              <span>{entry.day}</span>
              <select value={entry.day_type} onChange={e => updateSchedule(entry.day, e.target.value)}>
                {DAY_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section dash-card target-preview-card">
        <h3>Current Targets</h3>
        <div className="target-preview-row">
          <span>Calories</span>
          <strong>{targets?.target_calories ?? '—'}</strong>
        </div>
        <div className="target-preview-row">
          <span>Protein</span>
          <strong>{targets?.target_protein_g ?? '—'}g</strong>
        </div>
        <div className="target-preview-row">
          <span>Carbs</span>
          <strong>{targets?.target_carbs_g ?? '—'}g</strong>
        </div>
        <div className="target-preview-row">
          <span>Fat</span>
          <strong>{targets?.target_fat_g ?? '—'}g</strong>
        </div>
      </section>

      <div className="settings-actions">
        <button className="btn-secondary" onClick={() => persist({ recalculate: false })} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button className="btn-primary" onClick={() => persist({ recalculate: true })} disabled={saving}>
          {saving ? 'Saving…' : 'Save + Recalculate Targets'}
        </button>
      </div>

      <section className="settings-section dash-card">
        <h3>Onboarding</h3>
        <p className="settings-subtitle">Run through the guided setup again if you want to update your training background, equipment, food preferences, or recovery defaults step by step.</p>
        <div className="settings-actions">
          <button className="btn-secondary" onClick={restartOnboarding} disabled={saving}>
            {saving ? 'Working…' : 'Restart Onboarding'}
          </button>
        </div>
      </section>
    </div>
  )
}