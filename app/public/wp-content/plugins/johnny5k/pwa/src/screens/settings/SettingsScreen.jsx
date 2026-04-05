import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onboardingApi } from '../../api/client'
import { useDashboardStore } from '../../store/dashboardStore'
import { buildHeightCm, formatMissingFields, normalizeTargets, settingsFormFromState } from '../../lib/onboarding'

export default function SettingsScreen() {
  const navigate = useNavigate()
  const invalidate = useDashboardStore(s => s.invalidate)
  const loadSnapshot = useDashboardStore(s => s.loadSnapshot)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(settingsFormFromState())
  const [targets, setTargets] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [missingFields, setMissingFields] = useState([])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  useEffect(() => {
    let active = true

    onboardingApi.getState()
      .then(data => {
        if (!active) return
        setForm(settingsFormFromState(data.profile, data.prefs, data.goal))
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
    </div>
  )
}