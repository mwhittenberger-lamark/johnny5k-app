import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bodyApi, onboardingApi } from '../../api/client'
import { useDashboardStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { buildHeightCm, formatPhoneInput, formatReminderHour, formatMissingFields, getTimezoneRegion, getTimezoneRegions, getTimezonesForRegion, normalizePhoneNumber, normalizeTargets, reminderHourOptions, settingsFormFromState } from '../../lib/onboarding'
import { formatUsShortDate } from '../../lib/dateFormat'

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
  const snapshot = useDashboardStore(s => s.snapshot)
  const setAuth = useAuthStore(s => s.setAuth)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(settingsFormFromState())
  const [targets, setTargets] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [missingFields, setMissingFields] = useState([])
  const [timezoneRegion, setTimezoneRegion] = useState(getTimezoneRegion(form.timezone))
  const [weeklyWeights, setWeeklyWeights] = useState([])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function updatePhone(value) {
    update('phone', formatPhoneInput(value))
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
        setForm({
          ...nextForm,
          phone: formatPhoneInput(nextForm.phone),
        })
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

  useEffect(() => {
    loadSnapshot()
    bodyApi.getWeight(7)
      .then(rows => setWeeklyWeights(Array.isArray(rows) ? rows.slice(0, 7).reverse() : []))
      .catch(() => {})
  }, [loadSnapshot])

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
        phone: normalizePhoneNumber(form.phone),
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
  const latestWeight = Number(snapshot?.latest_weight?.weight_lb ?? weeklyWeights[weeklyWeights.length - 1]?.weight_lb ?? form.starting_weight_lb ?? 0) || null
  const weeklyWeightDelta = useMemo(() => {
    if (weeklyWeights.length < 2) return null
    const first = Number(weeklyWeights[0]?.weight_lb ?? 0)
    const last = Number(weeklyWeights[weeklyWeights.length - 1]?.weight_lb ?? 0)
    if (!first || !last) return null
    return Math.round((last - first) * 10) / 10
  }, [weeklyWeights])

  if (loading) return <div className="screen-loading">Loading…</div>

  return (
    <div className="screen settings-screen">
      <header className="screen-header">
        <div>
          <h1>Profile</h1>
          <p className="settings-subtitle">Update your identity, trajectory, and daily defaults.</p>
        </div>
      </header>

      <section className="dash-card settings-identity-card">
        <div className="settings-identity-main">
          <div className="settings-identity-copy">
            <span className="dashboard-chip ai">Identity</span>
            <h2>{buildProfileGoalHeadline(form.current_goal, form.goal_rate)}</h2>
            <p>{buildProfileGoalSummary(form, latestWeight, targets)}</p>
            <div className="settings-identity-stats">
              <div className="settings-identity-stat">
                <span>Current weight</span>
                <strong>{latestWeight ? `${latestWeight} lbs` : '—'}</strong>
              </div>
              <div className="settings-identity-stat">
                <span>7-day trend</span>
                <strong>{formatWeightDelta(weeklyWeightDelta)}</strong>
              </div>
              <div className="settings-identity-stat">
                <span>Daily calories</span>
                <strong>{targets?.target_calories ?? '—'}</strong>
              </div>
              <div className="settings-identity-stat">
                <span>Protein target</span>
                <strong>{targets?.target_protein_g != null ? `${targets.target_protein_g}g` : '—'}</strong>
              </div>
            </div>
          </div>
          <div className="settings-trend-card">
            <div className="settings-trend-head">
              <strong>Weekly trend</strong>
              <button type="button" className="btn-outline small" onClick={() => navigate('/body', { state: { focusTab: 'weight' } })}>Open progress</button>
            </div>
            {weeklyWeights.length ? (
              <div className="settings-trend-bars" aria-label="Weekly weight trend">
                {buildProfileTrendBars(weeklyWeights).map(point => (
                  <div key={`${point.date}-${point.label}`} className="settings-trend-bar-group">
                    <span className="settings-trend-bar-value">{point.valueLabel}</span>
                    <div className="settings-trend-bar-track">
                      <span className="settings-trend-bar-fill" style={{ height: `${point.height}%` }} />
                    </div>
                    <span className="settings-trend-bar-label">{point.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="settings-subtitle">Log a few weigh-ins on Progress to see your weekly trajectory here.</p>
            )}
          </div>
        </div>
      </section>

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
          <label className="settings-field"><span className="settings-field-label">First Name</span><input value={form.first_name} onChange={e => update('first_name', e.target.value)} /></label>
          <label className="settings-field"><span className="settings-field-label">Last Name</span><input value={form.last_name} onChange={e => update('last_name', e.target.value)} /></label>
          <label className="settings-field"><span className="settings-field-label">Date of Birth</span><input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} /></label>
          <label className="settings-field"><span className="settings-field-label">Sex</span>
            <select value={form.sex} onChange={e => update('sex', e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="settings-field"><span className="settings-field-label">Height (ft)</span><input type="number" min="4" max="7" value={form.height_ft} onChange={e => update('height_ft', e.target.value)} /></label>
          <label className="settings-field"><span className="settings-field-label">Height (in)</span><input type="number" min="0" max="11" value={form.height_in_part} onChange={e => update('height_in_part', e.target.value)} /></label>
          <div className="settings-field settings-field-span-2">
            <div className="settings-field-head">
              <span className="settings-field-label">Timezone</span>
              <span className="settings-field-hint">Pick a region first, then your saved timezone.</span>
            </div>
            <div className="timezone-picker">
              <label className="settings-subfield">
                <span>Region</span>
                <select value={timezoneRegion} onChange={e => {
                  const nextRegion = e.target.value
                  const nextZones = getTimezonesForRegion(nextRegion)
                  setTimezoneRegion(nextRegion)
                  update('timezone', nextZones.includes(form.timezone) ? form.timezone : nextZones[0] || form.timezone)
                }}>
                  {TIMEZONE_REGIONS.map(region => <option key={region} value={region}>{region}</option>)}
                </select>
              </label>
              <label className="settings-subfield">
                <span>Timezone</span>
                <select value={form.timezone} onChange={e => update('timezone', e.target.value)}>
                  {regionTimezones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section dash-card">
        <h3>Body & Goal</h3>
        <div className="settings-grid">
          <label className="settings-field"><span className="settings-field-label">Current Weight</span><div className="settings-input-suffix"><input type="number" min="80" max="600" step="0.1" value={form.starting_weight_lb} onChange={e => update('starting_weight_lb', e.target.value)} /><span>lbs</span></div></label>
          <label className="settings-field"><span className="settings-field-label">Goal</span>
            <select value={form.current_goal} onChange={e => update('current_goal', e.target.value)}>
              <option value="cut">Cut</option>
              <option value="gain">Gain</option>
              <option value="recomp">Recomp</option>
              <option value="maintain">Maintain</option>
            </select>
          </label>
          <label className="settings-field"><span className="settings-field-label">Goal Pace</span>
            <select value={form.goal_rate} onChange={e => update('goal_rate', e.target.value)}>
              <option value="slow">Slow</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>
          <label className="settings-field"><span className="settings-field-label">Activity Level</span>
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
          <label className="settings-field"><span className="settings-field-label">Steps</span><input type="number" min="1000" max="30000" step="1" value={form.target_steps} onChange={e => update('target_steps', Number(e.target.value))} /></label>
          <label className="settings-field"><span className="settings-field-label">Sleep (hours)</span><input type="number" min="4" max="12" step="0.5" value={form.target_sleep_hours} onChange={e => update('target_sleep_hours', Number(e.target.value))} /></label>
          <div className="settings-inline-panel settings-field-span-2 settings-reminders-panel">
            <label className="switch-field">
              <span className="switch-copy">
                <span className="settings-field-label">SMS reminders</span>
                <span className="settings-field-hint">Enable text reminders and the weekly Monday summary.</span>
              </span>
              <span className="switch-control">
                <input className="switch-input" type="checkbox" checked={form.notifications_enabled} onChange={e => update('notifications_enabled', e.target.checked)} />
                <span className="switch-track" aria-hidden="true" />
              </span>
            </label>
            <label className="settings-field notification-phone-field">
              <span className="settings-field-label">Phone</span>
              <input type="tel" inputMode="tel" value={form.phone} onChange={e => updatePhone(e.target.value)} placeholder="(555) 123-4567" disabled={!form.notifications_enabled} />
              <span className="settings-field-hint">Only used for reminder texts.</span>
            </label>
          </div>
        </div>
        {form.notifications_enabled ? (
          <div className="settings-reminder-stack">
            <div className="settings-reminder-intro">
              <strong>Reminder schedule</strong>
              <p>All reminder times use your saved timezone. Weekly summary sends Mondays at {formatReminderHour(form.weekly_summary_hour)}.</p>
            </div>
            <div className="settings-grid settings-grid-compact reminder-grid">
              <div className="reminder-setting-card">
                <div className="reminder-card-head">
                  <div>
                    <strong>Workout reminder</strong>
                    <p>Keep your session start on a consistent clock.</p>
                  </div>
                  <label className="switch-control switch-control-compact">
                    <input className="switch-input" type="checkbox" checked={form.workout_reminder_enabled} onChange={e => update('workout_reminder_enabled', e.target.checked)} />
                    <span className="switch-track" aria-hidden="true" />
                  </label>
                </div>
                <label className="settings-subfield">
                  <span>Time</span>
                  <select value={form.workout_reminder_hour} onChange={e => update('workout_reminder_hour', Number(e.target.value))} disabled={!form.workout_reminder_enabled}>
                    {REMINDER_HOUR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="reminder-setting-card">
                <div className="reminder-card-head">
                  <div>
                    <strong>Meal reminder</strong>
                    <p>Set a default nudge for your midday meal window.</p>
                  </div>
                  <label className="switch-control switch-control-compact">
                    <input className="switch-input" type="checkbox" checked={form.meal_reminder_enabled} onChange={e => update('meal_reminder_enabled', e.target.checked)} />
                    <span className="switch-track" aria-hidden="true" />
                  </label>
                </div>
                <label className="settings-subfield">
                  <span>Time</span>
                  <select value={form.meal_reminder_hour} onChange={e => update('meal_reminder_hour', Number(e.target.value))} disabled={!form.meal_reminder_enabled}>
                    {REMINDER_HOUR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="reminder-setting-card">
                <div className="reminder-card-head">
                  <div>
                    <strong>Sleep reminder</strong>
                    <p>Get a prompt before your sleep target window starts.</p>
                  </div>
                  <label className="switch-control switch-control-compact">
                    <input className="switch-input" type="checkbox" checked={form.sleep_reminder_enabled} onChange={e => update('sleep_reminder_enabled', e.target.checked)} />
                    <span className="switch-track" aria-hidden="true" />
                  </label>
                </div>
                <label className="settings-subfield">
                  <span>Time</span>
                  <select value={form.sleep_reminder_hour} onChange={e => update('sleep_reminder_hour', Number(e.target.value))} disabled={!form.sleep_reminder_enabled}>
                    {REMINDER_HOUR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="reminder-setting-card">
                <div className="reminder-card-head">
                  <div>
                    <strong>Weekly summary</strong>
                    <p>Receive a Monday recap in your current timezone.</p>
                  </div>
                  <label className="switch-control switch-control-compact">
                    <input className="switch-input" type="checkbox" checked={form.weekly_summary_enabled} onChange={e => update('weekly_summary_enabled', e.target.checked)} />
                    <span className="switch-track" aria-hidden="true" />
                  </label>
                </div>
                <label className="settings-subfield">
                  <span>Time</span>
                  <select value={form.weekly_summary_hour} onChange={e => update('weekly_summary_hour', Number(e.target.value))} disabled={!form.weekly_summary_enabled}>
                    {REMINDER_HOUR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="settings-section dash-card">
        <h3>Weekly Split</h3>
        <p className="settings-subtitle">Change which days are push, pull, legs, bonus, cardio, or full rest. Saving here also refreshes the active plan order.</p>
        <div className="onboarding-schedule-list">
          {(form.weekly_schedule ?? []).map(entry => (
            <div key={entry.day} className="onboarding-schedule-row">
              <span className="weekly-split-day">{entry.day}</span>
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

      <div className="settings-actions settings-actions-stack">
        <button className="btn-secondary settings-save-button" onClick={() => persist({ recalculate: false })} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <div className="settings-primary-action-block">
          <button className="btn-primary" onClick={() => persist({ recalculate: true })} disabled={saving}>
            {saving ? 'Saving…' : 'Save + Recalculate Targets'}
          </button>
          <p className="settings-action-note">Use recalculation when your body stats or goal pace changed and you want new calorie targets immediately.</p>
        </div>
      </div>

      <section className="settings-section dash-card settings-onboarding-section">
        <h3>Onboarding</h3>
        <p className="settings-subtitle">Run through the guided setup again if you want to update your training background, equipment, food preferences, or recovery defaults step by step.</p>
        <div className="settings-actions settings-actions-single">
          <button className="btn-secondary" onClick={restartOnboarding} disabled={saving}>
            {saving ? 'Working…' : 'Restart Onboarding'}
          </button>
        </div>
      </section>
    </div>
  )
}

function buildProfileGoalHeadline(goal, pace) {
  const goalLabel = goal === 'cut'
    ? 'Cut phase'
    : goal === 'gain'
      ? 'Gain phase'
      : goal === 'maintain'
        ? 'Maintain phase'
        : 'Recomp phase'

  const paceLabel = pace ? `${String(pace).charAt(0).toUpperCase()}${String(pace).slice(1)} pace` : 'Steady pace'
  return `${goalLabel} · ${paceLabel}`
}

function buildProfileGoalSummary(form, latestWeight, targets) {
  const weightLabel = latestWeight ? `${latestWeight} lbs current weight` : 'Current weight still being established'
  const calories = targets?.target_calories ? `${targets.target_calories} daily calories` : 'daily calories pending'
  const protein = targets?.target_protein_g != null ? `${targets.target_protein_g}g protein target` : 'protein target pending'
  return `${weightLabel}. ${calories} with ${protein}. This page should feel like your direction of travel, not just a form.`
}

function formatWeightDelta(delta) {
  if (delta == null) return 'No trend yet'
  if (delta === 0) return 'Flat this week'
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} lbs`
}

function buildProfileTrendBars(weights) {
  const points = (Array.isArray(weights) ? weights : []).map(entry => ({
    date: entry.metric_date || entry.date || '',
    value: Number(entry.weight_lb ?? 0),
  })).filter(point => point.value > 0)

  if (!points.length) return []

  const values = points.map(point => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 0.5)

  return points.map(point => ({
    ...point,
    height: 24 + (((point.value - min) / range) * 76),
    label: formatUsShortDate(point.date, point.date).replace(/^\w+\s/, ''),
    valueLabel: point.value % 1 === 0 ? `${point.value}` : point.value.toFixed(1),
  }))
}