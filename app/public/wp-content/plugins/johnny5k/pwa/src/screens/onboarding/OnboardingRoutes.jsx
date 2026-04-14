import { startTransition, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { dashboardApi } from '../../api/modules/dashboard'
import { onboardingApi } from '../../api/modules/onboarding'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import ClearableInput from '../../components/ui/ClearableInput'
import ErrorState from '../../components/ui/ErrorState'
import { useAuthStore } from '../../store/authStore'
import {
  bodyFormFromState,
  buildHeightCm,
  equipmentFormFromState,
  foodFormFromState,
  formatReminderHour,
  formatMissingFields,
  getTimezoneRegion,
  getTimezoneRegions,
  getTimezonesForRegion,
  habitsFormFromState,
  injuriesFormFromState,
  normalizeTargets,
  parseCommaList,
  profileFormFromState,
  reminderHourOptions,
  trainingFormFromState,
} from '../../lib/onboarding'
import { DAY_TYPE_OPTIONS } from '../../lib/trainingDayTypes'

const WORKOUT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const BODY_AREAS = ['Shoulders', 'Knees', 'Back', 'Elbows', 'Hips', 'Neck']
const EQUIPMENT_OPTIONS = ['Full gym', 'Dumbbells', 'Machines', 'Home gym', 'Bodyweight only']
const TIMEZONE_REGIONS = getTimezoneRegions()
const REMINDER_HOUR_OPTIONS = reminderHourOptions()
const COMMON_EXERCISE_AVOIDS = [
  'Upright rows',
  'Overhead pressing',
  'Deep lunges',
  'Back squats',
  'Deadlifts',
  'Pull-ups',
  'Dips',
  'Running',
]
const ONBOARDING_STEPS = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'profile', label: 'Body basics' },
  { key: 'body', label: 'Goal' },
  { key: 'training', label: 'Training' },
  { key: 'injuries', label: 'Limits' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'food', label: 'Food' },
  { key: 'habits', label: 'Habits' },
  { key: 'photos', label: 'Photos' },
  { key: 'complete', label: 'Review' },
]
const ONBOARDING_STEP_INDEX = ONBOARDING_STEPS.reduce((map, step, index) => {
  map[step.key] = index
  return map
}, {})

function useLoadedOnboardingState() {
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    onboardingApi.getState()
      .then(data => {
        if (active) setState(data)
      })
      .catch(err => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [])

  return { loading, state, error, setState }
}

function StepLayout({ stepKey, title, subtitle, why, children }) {
  const location = useLocation()
  const fallbackKey = location.pathname.split('/').filter(Boolean).pop() || 'welcome'
  const resolvedStepKey = stepKey || fallbackKey
  const currentIndex = ONBOARDING_STEP_INDEX[resolvedStepKey] ?? 0
  const totalTransitions = Math.max(1, ONBOARDING_STEPS.length - 1)
  const percentComplete = Math.round((currentIndex / totalTransitions) * 100)

  return (
    <div className="onboarding-screen">
      <div className="dash-card onboarding-progress-card">
        <div className="onboarding-progress-top">
          <span>{percentComplete}% complete</span>
          <span>{ONBOARDING_STEPS[currentIndex]?.label || 'Setup'}</span>
        </div>
        <div className="onboarding-progress-track" aria-hidden="true">
          <span className="onboarding-progress-fill" style={{ width: `${percentComplete}%` }} />
        </div>
        <div className="onboarding-progress-steps" aria-hidden="true">
          {ONBOARDING_STEPS.map((step, index) => (
            <span key={step.key} className={`onboarding-progress-step ${index <= currentIndex ? 'active' : ''}`} />
          ))}
        </div>
      </div>
      <h2>{title}</h2>
      {subtitle ? <p className="settings-subtitle">{subtitle}</p> : null}
      {why ? (
        <div className="dash-card onboarding-why-card">
          <strong>Why we ask</strong>
          <p>{why}</p>
        </div>
      ) : null}
      {children}
    </div>
  )
}

function renderOnboardingLoading(title) {
  return (
    <AppLoadingScreen
      eyebrow="Onboarding"
      title={title}
      message="Johnny is pulling your saved answers and preparing the next setup cards so you are not staring at a blank step."
      compact
      variant="panel"
    />
  )
}

function StepUnlock({ text }) {
  if (!text) return null

  return (
    <div className="dash-card onboarding-unlock-card">
      <strong>What this unlocks</strong>
      <p>{text}</p>
    </div>
  )
}

function formatGoalLabel(value) {
  const text = String(value || '').trim()
  if (!text) return 'recomp'
  return text.replaceAll('_', ' ')
}

function formatExperienceLabel(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return 'new'
  if (normalized === 'advanced') return 'advanced'
  if (normalized === 'intermediate') return 'intermediate'
  return 'new'
}

function buildOnboardingHypeMessage(state, result) {
  const profile = state?.profile ?? {}
  const prefs = state?.prefs ?? {}
  const goalLabel = formatGoalLabel(profile.current_goal)
  const experienceLabel = formatExperienceLabel(profile.training_experience)
  const targetCalories = Number(result?.target_calories ?? 0)
  const targetProtein = Number(result?.target_protein_g ?? 0)
  const splitDays = Array.isArray(result?.week_split)
    ? result.week_split.filter(day => String(day?.day_type || '') !== 'rest').length
    : 0
  const preferredFoods = String(prefs?.food_preferences_json?.preferred_foods || '').trim()
  const mealHint = preferredFoods
    ? `I already pulled in your food style (${preferredFoods.slice(0, 80)}${preferredFoods.length > 80 ? '…' : ''}) so meals should feel like your real life.`
    : 'I will shape meals around what you actually stick to, not generic meal templates.'

  return `Huge win. You just completed setup and gave me what I need to coach you like a ${experienceLabel} lifter chasing ${goalLabel}. Starting now, expect a clear daily target (${targetCalories || 'custom'} calories, ${targetProtein || 'custom'}g protein), a ${splitDays || 'custom'}-day training split, and tighter daily guidance that adjusts off your actual logs. ${mealHint} You are officially locked in.`
}

function Welcome() {
  const navigate = useNavigate()

  return (
    <StepLayout
      stepKey="welcome"
      title="Welcome to Johnny5k"
      subtitle="We’ll set up your body data, training background, food preferences, and recovery defaults in a few quick steps."
      why="This setup gives Johnny enough context to build a first plan that fits your body, schedule, food preferences, and recovery needs."
    >
      <StepUnlock text="The next step builds the body and timing profile Johnny uses everywhere else in the app." />
      <button className="btn-primary" onClick={() => navigate('/onboarding/profile')}>Start setup</button>
    </StepLayout>
  )
}

function ProfileStep() {
  const navigate = useNavigate()
  const { loading, state, error: loadError } = useLoadedOnboardingState()
  const [form, setForm] = useState(profileFormFromState())
  const [error, setError] = useState('')
  const [timezoneRegion, setTimezoneRegion] = useState(getTimezoneRegion(form.timezone))

  useEffect(() => {
    if (state) {
      const nextForm = profileFormFromState(state.profile)
      startTransition(() => {
        setForm(nextForm)
        setTimezoneRegion(getTimezoneRegion(nextForm.timezone))
      })
    }
  }, [state])

  const regionTimezones = useMemo(() => getTimezonesForRegion(timezoneRegion), [timezoneRegion])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function next(event) {
    event.preventDefault()
    setError('')

    try {
      const { height_ft, height_in_part, ...rest } = form
      await onboardingApi.saveProfile({ ...rest, height_cm: buildHeightCm(height_ft, height_in_part) })
      navigate('/onboarding/body')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return renderOnboardingLoading('Loading body basics')

  return (
    <StepLayout
      stepKey="profile"
      title="Body basics"
      subtitle="Start with the details Johnny uses to estimate targets and schedule messages at the right time."
      why="Age, sex, height, and timezone all affect your calorie math, pacing, and when reminders should hit."
    >
      <form className="onboarding-step-form" onSubmit={next}>
        <div className="onboarding-form">
          <label>First name<ClearableInput value={form.first_name} onChange={e => update('first_name', e.target.value)} required /></label>
          <label>Last name<ClearableInput value={form.last_name} onChange={e => update('last_name', e.target.value)} /></label>
          <label>Date of birth<input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} required /></label>
          <label>Sex
            <select value={form.sex} onChange={e => update('sex', e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </label>
          <label>
            Height
            <div className="height-row">
              <label className="onboarding-subfield">Feet
                <div className="height-field">
                  <input type="number" min="4" max="7" value={form.height_ft} onChange={e => update('height_ft', e.target.value)} required />
                  <span className="height-unit">ft</span>
                </div>
              </label>
              <label className="onboarding-subfield">Inches
                <div className="height-field">
                  <input type="number" min="0" max="11" value={form.height_in_part} onChange={e => update('height_in_part', e.target.value)} />
                  <span className="height-unit">in</span>
                </div>
              </label>
            </div>
          </label>
          <label>Timezone
            <div className="timezone-picker">
              <label className="onboarding-subfield">Region
                <select value={timezoneRegion} onChange={e => {
                  const nextRegion = e.target.value
                  const nextZones = getTimezonesForRegion(nextRegion)
                  setTimezoneRegion(nextRegion)
                  update('timezone', nextZones.includes(form.timezone) ? form.timezone : nextZones[0] || form.timezone)
                }}>
                  {TIMEZONE_REGIONS.map(region => <option key={region} value={region}>{region}</option>)}
                </select>
              </label>
              <label className="onboarding-subfield">Timezone
                <select value={form.timezone} onChange={e => update('timezone', e.target.value)}>
                  {regionTimezones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </label>
            </div>
          </label>
          {(error || loadError) && <ErrorState className="onboarding-inline-error" message={error || loadError} title="Could not save this step" />}
          <StepUnlock text="Next, Johnny will set your goal direction and starting calorie math." />
          <button className="btn-primary" type="submit">Next</button>
        </div>
      </form>
    </StepLayout>
  )
}

function BodyStep() {
  const navigate = useNavigate()
  const { loading, state } = useLoadedOnboardingState()
  const [form, setForm] = useState(bodyFormFromState())
  const [error, setError] = useState('')

  useEffect(() => {
    if (state) {
      startTransition(() => {
        setForm(bodyFormFromState(state.profile))
      })
    }
  }, [state])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function next(event) {
    event.preventDefault()
    setError('')

    try {
      await onboardingApi.saveProfile(form)
      navigate('/onboarding/training')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return renderOnboardingLoading('Loading your goal setup')

  return (
    <StepLayout
      stepKey="body"
      title="Goal"
      subtitle="Set the outcome and pace Johnny should optimize for."
      why="Current weight, goal, and daily activity tell Johnny how aggressive your calorie target should be and how hard to push the plan."
    >
      <form className="onboarding-step-form" onSubmit={next}>
        <label>Current weight (lbs)<input type="number" min="80" max="600" step="0.1" value={form.starting_weight_lb} onChange={e => update('starting_weight_lb', e.target.value)} required /></label>
        <label>Goal
          <select value={form.current_goal} onChange={e => update('current_goal', e.target.value)}>
            <option value="cut">Lose fat</option>
            <option value="maintain">Maintain</option>
            <option value="gain">Gain muscle</option>
            <option value="recomp">Recomposition</option>
          </select>
        </label>
        <label>Target pace
          <select value={form.goal_rate} onChange={e => update('goal_rate', e.target.value)}>
            <option value="slow">Slow</option>
            <option value="moderate">Moderate</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </label>
        <label>Activity level
          <select value={form.activity_level} onChange={e => update('activity_level', e.target.value)}>
            <option value="sedentary">Sedentary</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="athlete">Athlete</option>
          </select>
        </label>
        {error && <ErrorState className="onboarding-inline-error" message={error} title="Could not save this step" />}
        <StepUnlock text="Next, Johnny will build a realistic training week around your schedule and experience." />
        <button className="btn-primary" type="submit">Next</button>
      </form>
    </StepLayout>
  )
}

function TrainingStep() {
  const navigate = useNavigate()
  const { loading, state } = useLoadedOnboardingState()
  const [form, setForm] = useState(trainingFormFromState())
  const [error, setError] = useState('')

  useEffect(() => {
    if (state) {
      startTransition(() => {
        setForm(trainingFormFromState(state.profile, state.prefs))
      })
    }
  }, [state])

  function updateSchedule(day, dayType) {
    setForm(current => ({
      ...current,
      weekly_schedule: current.weekly_schedule.map(entry => entry.day === day ? { ...entry, day_type: dayType } : entry),
      preferred_workout_days: current.weekly_schedule
        .map(entry => entry.day === day ? { ...entry, day_type: dayType } : entry)
        .filter(entry => entry.day_type !== 'rest')
        .map(entry => entry.day),
    }))
  }

  async function next(event) {
    event.preventDefault()
    setError('')

    try {
      const existingMeta = state?.prefs?.exercise_preferences_json ?? {}
      const scheduledDays = form.weekly_schedule.filter(entry => entry.day_type !== 'rest')

      if (!scheduledDays.length) {
        setError('Assign at least one training or cardio day before continuing.')
        return
      }

      await onboardingApi.saveProfile({
        training_experience: form.training_experience,
        available_time_default: form.available_time_default,
      })
      await onboardingApi.savePrefs({
        preferred_workout_days_json: form.weekly_schedule,
        exercise_preferences_json: {
          ...existingMeta,
          workout_confidence: form.workout_confidence,
        },
      })
      navigate('/onboarding/injuries')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return renderOnboardingLoading('Loading training background')

  return (
    <StepLayout
      stepKey="training"
      title="Training background"
      subtitle="Tell Johnny how much lifting experience you have and what a realistic training week looks like."
      why="This controls your starting split, time tier, and how ambitious Johnny should be with exercise selection and progression."
    >
      <form className="onboarding-step-form" onSubmit={next}>
        <label>Experience
          <select value={form.training_experience} onChange={e => setForm(current => ({ ...current, training_experience: e.target.value }))}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label>Typical session length
          <select value={form.available_time_default} onChange={e => setForm(current => ({ ...current, available_time_default: e.target.value }))}>
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="full">Full</option>
          </select>
        </label>
        <label>Confidence with lifting
          <select value={form.workout_confidence} onChange={e => setForm(current => ({ ...current, workout_confidence: e.target.value }))}>
            <option value="building">Still building confidence</option>
            <option value="comfortable">Comfortable</option>
            <option value="strong">Very comfortable</option>
          </select>
        </label>
        <div className="dash-card settings-section onboarding-split-card">
          <strong>Set your week</strong>
          <p className="settings-subtitle">Choose what each day should do. Use rest on days you want protected off-days.</p>
          <div className="onboarding-schedule-list">
            {WORKOUT_DAYS.map(day => {
              const scheduled = form.weekly_schedule.find(entry => entry.day === day) || { day, day_type: 'rest' }
              return (
                <label key={day} className="onboarding-schedule-row onboarding-schedule-field">
                  <span>{day}</span>
                  <select value={scheduled.day_type} onChange={e => updateSchedule(day, e.target.value)}>
                    {DAY_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              )
            })}
          </div>
        </div>
        {error && <ErrorState className="onboarding-inline-error" message={error} title="Could not save this step" />}
        <StepUnlock text="Next, Johnny will use your limits to work around problem movements before equipment gets layered in." />
        <button className="btn-primary" type="submit">Next</button>
      </form>
    </StepLayout>
  )
}

function InjuriesStep() {
  const navigate = useNavigate()
  const { loading, state } = useLoadedOnboardingState()
  const [form, setForm] = useState(injuriesFormFromState())
  const [customAvoid, setCustomAvoid] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (state) {
      startTransition(() => {
        setForm(injuriesFormFromState(state.prefs, state.health_flags))
      })
    }
  }, [state])

  const flagMap = useMemo(() => {
    const map = new Map()
    ;(form.flags || []).forEach(flag => {
      map.set(flag.body_area, flag)
    })
    return map
  }, [form.flags])
  const selectedAvoids = useMemo(() => parseCommaList(form.exercise_avoid), [form.exercise_avoid])

  function setAvoids(nextValues) {
    setForm(current => ({ ...current, exercise_avoid: nextValues.join(', ') }))
  }

  function addAvoidTerm(term) {
    const nextTerm = String(term ?? '').trim()
    if (!nextTerm) return
    if (selectedAvoids.some(item => item.toLowerCase() === nextTerm.toLowerCase())) {
      setCustomAvoid('')
      return
    }
    setAvoids([...selectedAvoids, nextTerm])
    setCustomAvoid('')
  }

  function removeAvoidTerm(term) {
    setAvoids(selectedAvoids.filter(item => item.toLowerCase() !== String(term).toLowerCase()))
  }

  function toggleAvoidTerm(term) {
    if (selectedAvoids.some(item => item.toLowerCase() === String(term).toLowerCase())) {
      removeAvoidTerm(term)
      return
    }
    addAvoidTerm(term)
  }

  function toggleFlag(area) {
    setForm(current => {
      const existing = current.flags.find(flag => flag.body_area === area)
      if (existing) {
        return {
          ...current,
          flags: current.flags.map(flag => flag.body_area === area ? { ...flag, active: Number(!flag.active) } : flag),
        }
      }

      return {
        ...current,
        flags: [...current.flags, { body_area: area, severity: 'medium', notes: '', active: 1 }],
      }
    })
  }

  function updateFlag(area, field, value) {
    setForm(current => ({
      ...current,
      flags: current.flags.map(flag => flag.body_area === area ? { ...flag, [field]: value } : flag),
    }))
  }

  async function next(event) {
    event.preventDefault()
    setError('')

    try {
      await onboardingApi.savePrefs({ exercise_avoid_json: parseCommaList(form.exercise_avoid) })
      await onboardingApi.saveHealthFlags({
        flags: form.flags.map(flag => ({
          id: flag.id,
          flag_type: 'injury',
          body_area: flag.body_area,
          severity: flag.severity,
          notes: flag.notes,
          active: flag.active,
        })),
      })
      navigate('/onboarding/equipment')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return renderOnboardingLoading('Loading limits and injuries')

  return (
    <StepLayout
      stepKey="injuries"
      title="Injuries and limits"
      subtitle="Flag movements and body areas Johnny should work around from day one."
      why="Johnny uses this to avoid suggesting exercises that are likely to aggravate a known issue and to steer recovery decisions more carefully."
    >
      <form className="onboarding-step-form" onSubmit={next}>
        <div className="dash-card settings-section">
          <strong>Exercises to avoid</strong>
          <p className="settings-subtitle">Pick common movement patterns or search and add your own. Johnny will use these later when suggesting exercises.</p>
          <div className="onboarding-chip-grid onboarding-chip-grid-compact">
            {COMMON_EXERCISE_AVOIDS.map(item => (
              <button
                key={item}
                type="button"
                className={`onboarding-chip ${selectedAvoids.some(value => value.toLowerCase() === item.toLowerCase()) ? 'active' : ''}`}
                onClick={() => toggleAvoidTerm(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="onboarding-inline-action">
            <ClearableInput
              list="onboarding-exercise-avoid-suggestions"
              value={customAvoid}
              onChange={e => setCustomAvoid(e.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addAvoidTerm(customAvoid)
                }
              }}
              placeholder="Search or add a custom movement"
            />
            <button type="button" className="btn-secondary" onClick={() => addAvoidTerm(customAvoid)}>Add</button>
          </div>
          <datalist id="onboarding-exercise-avoid-suggestions">
            {COMMON_EXERCISE_AVOIDS.map(item => <option key={item} value={item} />)}
          </datalist>
          {selectedAvoids.length ? (
            <div className="onboarding-token-list">
              {selectedAvoids.map(item => (
                <button key={item} type="button" className="onboarding-token" onClick={() => removeAvoidTerm(item)}>
                  <span>{item}</span>
                  <span className="onboarding-token-remove">Remove</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="onboarding-chip-grid">
          {BODY_AREAS.map(area => (
            <button key={area} type="button" className={`onboarding-chip ${flagMap.get(area)?.active ? 'active' : ''}`} onClick={() => toggleFlag(area)}>{area}</button>
          ))}
        </div>
        {form.flags.filter(flag => flag.active).map(flag => (
          <div key={flag.body_area} className="dash-card settings-section">
            <strong>{flag.body_area}</strong>
            <label>Severity
              <select value={flag.severity} onChange={e => updateFlag(flag.body_area, 'severity', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>Notes<ClearableInput value={flag.notes} onChange={e => updateFlag(flag.body_area, 'notes', e.target.value)} placeholder="What tends to flare it up?" /></label>
          </div>
        ))}
        {error && <ErrorState className="onboarding-inline-error" message={error} title="Could not save this step" />}
        <StepUnlock text="Next, Johnny will narrow the exercise pool to what you can actually do with your available equipment." />
        <button className="btn-primary" type="submit">Next</button>
      </form>
    </StepLayout>
  )
}

function EquipmentStep() {
  const navigate = useNavigate()
  const { loading, state } = useLoadedOnboardingState()
  const [form, setForm] = useState(equipmentFormFromState())
  const [error, setError] = useState('')

  useEffect(() => {
    if (state) {
      startTransition(() => {
        setForm(equipmentFormFromState(state.prefs))
      })
    }
  }, [state])

  function toggleEquipment(item) {
    setForm(current => ({
      ...current,
      equipment_available: (() => {
        const selected = Array.isArray(current.equipment_available) ? current.equipment_available : []
        const hasItem = selected.includes(item)

        if (hasItem) {
          return selected.filter(value => value !== item)
        }

        if (item === 'Full gym' || item === 'Bodyweight only') {
          return [item]
        }

        const withoutExclusive = selected.filter(value => value !== 'Full gym' && value !== 'Bodyweight only')
        return [...withoutExclusive, item]
      })(),
    }))
  }

  async function next(event) {
    event.preventDefault()
    setError('')

    try {
      await onboardingApi.savePrefs({ equipment_available_json: form.equipment_available })
      navigate('/onboarding/food')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return renderOnboardingLoading('Loading equipment choices')

  return (
    <StepLayout
      stepKey="equipment"
      title="Equipment"
      subtitle="Tell Johnny what you actually have access to."
      why="This lets Johnny keep the plan realistic instead of suggesting exercises that require equipment you do not have."
    >
      <form className="onboarding-step-form" onSubmit={next}>
        <div className="onboarding-chip-grid">
          {EQUIPMENT_OPTIONS.map(item => (
            <button key={item} type="button" className={`onboarding-chip ${form.equipment_available.includes(item) ? 'active' : ''}`} onClick={() => toggleEquipment(item)}>{item}</button>
          ))}
        </div>
        {error && <ErrorState className="onboarding-inline-error" message={error} title="Could not save this step" />}
        <StepUnlock text="Next, Johnny will shape meal suggestions around foods you actually like and already eat." />
        <button className="btn-primary" type="submit">Next</button>
      </form>
    </StepLayout>
  )
}

function FoodStep() {
  const navigate = useNavigate()
  const { loading, state } = useLoadedOnboardingState()
  const [form, setForm] = useState(foodFormFromState())
  const [error, setError] = useState('')

  useEffect(() => {
    if (state) {
      startTransition(() => {
        setForm(foodFormFromState(state.prefs))
      })
    }
  }, [state])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function next(event) {
    event.preventDefault()
    setError('')

    try {
      await onboardingApi.savePrefs({
        food_preferences_json: {
          preferred_foods: form.preferred_foods,
          meal_frequency: form.meal_frequency,
        },
        food_dislikes_json: parseCommaList(form.disliked_foods),
        common_breakfasts_json: {
          breakfasts: form.common_breakfasts,
          lunches: form.common_lunches,
        },
      })
      navigate('/onboarding/habits')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return renderOnboardingLoading('Loading food habits')

  return (
    <StepLayout
      stepKey="food"
      title="Food habits"
      subtitle="Give Johnny enough signal to make meal suggestions feel familiar instead of generic."
      why="Food preferences, dislikes, and common meals shape suggested meals, grocery ideas, and the nudges Johnny gives you later."
    >
      <form className="onboarding-step-form" onSubmit={next}>
        <label>Preferred foods<textarea value={form.preferred_foods} onChange={e => update('preferred_foods', e.target.value)} placeholder="Greek yogurt, eggs, chicken, rice" /></label>
        <label>Disliked foods<textarea value={form.disliked_foods} onChange={e => update('disliked_foods', e.target.value)} placeholder="Separate with commas" /></label>
        <label>Common breakfasts<textarea value={form.common_breakfasts} onChange={e => update('common_breakfasts', e.target.value)} placeholder="Protein oats, egg wrap" /></label>
        <label>Common lunches<textarea value={form.common_lunches} onChange={e => update('common_lunches', e.target.value)} placeholder="Chicken bowl, turkey sandwich" /></label>
        <label>Meal frequency
          <select value={form.meal_frequency} onChange={e => update('meal_frequency', e.target.value)}>
            <option value="2">2 meals</option>
            <option value="3">3 meals</option>
            <option value="4">4 meals</option>
            <option value="5+">5 or more</option>
          </select>
        </label>
        {error && <ErrorState className="onboarding-inline-error" message={error} title="Could not save this step" />}
        <StepUnlock text="Next, Johnny will lock in your recovery defaults and notification preferences." />
        <button className="btn-primary" type="submit">Next</button>
      </form>
    </StepLayout>
  )
}

function HabitsStep() {
  const navigate = useNavigate()
  const { loading, state } = useLoadedOnboardingState()
  const [form, setForm] = useState(habitsFormFromState())
  const [error, setError] = useState('')

  useEffect(() => {
    if (state) {
      startTransition(() => {
        setForm(habitsFormFromState(state.profile, state.prefs, state.goal))
      })
    }
  }, [state])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function next(event) {
    event.preventDefault()
    setError('')

    try {
      const existingMeta = state?.prefs?.exercise_preferences_json ?? {}
      await onboardingApi.savePrefs({
        target_steps: Number(form.target_steps),
        target_sleep_hours: Number(form.target_sleep_hours),
        notifications_enabled: form.notifications_enabled,
        phone: form.phone,
        exercise_preferences_json: {
          ...existingMeta,
          cardio_frequency: form.cardio_frequency,
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
      navigate('/onboarding/photos')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return renderOnboardingLoading('Loading baseline habits')

  return (
    <StepLayout
      stepKey="habits"
      title="Baseline habits"
      subtitle="Set the recovery and notification defaults Johnny should use to coach you."
      why="Steps, sleep, cardio frequency, and reminder preferences help Johnny set better baselines and decide when to prompt you."
    >
      <form className="onboarding-step-form" onSubmit={next}>
        <label>Average steps<input type="number" min="1000" max="30000" step="1" value={form.target_steps} onChange={e => update('target_steps', e.target.value)} /></label>
        <label>Average sleep<input type="number" min="4" max="12" step="0.5" value={form.target_sleep_hours} onChange={e => update('target_sleep_hours', e.target.value)} /></label>
        <label>Cardio frequency
          <select value={form.cardio_frequency} onChange={e => update('cardio_frequency', e.target.value)}>
            <option value="rarely">Rarely</option>
            <option value="1-2x">1–2x per week</option>
            <option value="3-4x">3–4x per week</option>
            <option value="5+x">5x or more</option>
          </select>
        </label>
        <label className="toggle-row onboarding-toggle-field">
          <span>SMS reminders</span>
          <input type="checkbox" checked={form.notifications_enabled} onChange={e => update('notifications_enabled', e.target.checked)} />
        </label>
        {form.notifications_enabled ? <label>Phone<ClearableInput type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+15551234567" /></label> : null}
        {form.notifications_enabled ? (
          <div className="settings-grid settings-grid-compact">
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
        {form.notifications_enabled ? <p className="settings-subtitle">Times are sent in your local timezone. Current summary time: {formatReminderHour(form.weekly_summary_hour)} on Mondays.</p> : null}
        {error && <ErrorState className="onboarding-inline-error" message={error} title="Could not save this step" />}
        <StepUnlock text="Next, you can add optional photos so Johnny has a cleaner visual baseline for future check-ins." />
        <button className="btn-primary" type="submit">Next</button>
      </form>
    </StepLayout>
  )
}

function PhotosStep() {
  const navigate = useNavigate()
  const { loading, state } = useLoadedOnboardingState()
  const [frontFile, setFrontFile] = useState(null)
  const [sideFile, setSideFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function uploadSingle(file, angle) {
    if (!file) return
    const form = new FormData()
    form.append('photo', file)
    form.append('angle', angle)
    await dashboardApi.photoUpload(form)
  }

  async function next(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      await uploadSingle(frontFile, 'front')
      await uploadSingle(sideFile, 'side')
      navigate('/onboarding/complete')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return renderOnboardingLoading('Loading progress photo setup')

  return (
    <StepLayout
      stepKey="photos"
      title="Optional progress photos"
      subtitle="You can skip this, but it gives Johnny a cleaner visual baseline."
      why="Photos make future body-composition check-ins more useful because Johnny can compare against the same starting reference."
    >
      <form className="onboarding-step-form" onSubmit={next}>
        <label>Front photo<input type="file" accept="image/*" capture="environment" onChange={e => setFrontFile(e.target.files?.[0] || null)} /></label>
        <label>Side photo<input type="file" accept="image/*" capture="environment" onChange={e => setSideFile(e.target.files?.[0] || null)} /></label>
        {(state?.progress_photos?.length ?? 0) > 0 ? <p className="success-message">{state.progress_photos.length} progress photo(s) already on file.</p> : null}
        {error && <ErrorState className="onboarding-inline-error" message={error} title="Could not save this step" />}
        <StepUnlock text="Next, Johnny will show you the exact plan, split, and preferences he is about to use." />
        <div className="settings-actions">
          <button className="btn-secondary" type="button" onClick={() => navigate('/onboarding/complete')}>Skip for now</button>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Uploading…' : 'Continue'}</button>
        </div>
      </form>
    </StepLayout>
  )
}

function CompleteStep() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(store => store.setAuth)
  const { loading, state } = useLoadedOnboardingState()
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function finish() {
    setSubmitting(true)
    setError('')

    try {
      const data = await onboardingApi.complete()
      setResult(data)
      setAuth({ onboarding_complete: true })
    } catch (err) {
      const missing = formatMissingFields(err?.data?.missing_profile_fields)
      setError(missing.length ? `Complete these fields before finishing: ${missing.join(', ')}.` : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return renderOnboardingLoading('Loading your review step')

  if (result) {
    const targets = normalizeTargets(result)
    const hypeMessage = buildOnboardingHypeMessage(state, result)

    return (
      <StepLayout
        stepKey="complete"
        title="Start your plan"
        subtitle="Your targets and first-week split are ready."
        why="This is the personalized starting point Johnny built from the information you just gave him."
      >
        <div className="dash-card settings-section">
          <h3>Johnny&apos;s message</h3>
          <p>{hypeMessage}</p>
        </div>
        <div className="dash-card target-preview-card">
          <div className="target-preview-row"><span>Calories</span><strong>{targets.target_calories}</strong></div>
          <div className="target-preview-row"><span>Protein</span><strong>{targets.target_protein_g}g</strong></div>
          <div className="target-preview-row"><span>Carbs</span><strong>{targets.target_carbs_g}g</strong></div>
          <div className="target-preview-row"><span>Fat</span><strong>{targets.target_fat_g}g</strong></div>
        </div>
        <div className="dash-card settings-section">
          <h3>First week split</h3>
          {(result.week_split ?? []).map(day => <p key={`${day.day_order}-${day.day_type}`}>{day.day_order}. {String(day.day_type).replaceAll('_', ' ')} ({day.time_tier})</p>)}
        </div>
        <div className="dash-card settings-section">
          <h3>Suggested meals</h3>
          {(result.suggested_meals ?? []).map(meal => (
            <div key={meal.name} className="dashboard-streak-row">
              <span>{meal.name}</span>
              <span>{meal.description}</span>
            </div>
          ))}
        </div>
        <div className="dash-card settings-section">
          <h3>Coach note</h3>
          <p>{result.coach_message}</p>
        </div>
        <StepUnlock text="From here, Johnny will use this setup to drive your dashboard, workout suggestions, nutrition guidance, and reminders." />
        <button className="btn-primary" onClick={() => navigate('/dashboard')}>Open dashboard</button>
      </StepLayout>
    )
  }

  const commonMeals = state?.prefs?.common_breakfasts_json ?? {}
  const preferredSchedule = Array.isArray(state?.prefs?.preferred_workout_days_json) ? state.prefs.preferred_workout_days_json.filter(entry => entry?.day_type !== 'rest') : []
  const avoidedExercises = Array.isArray(state?.prefs?.exercise_avoid_json) ? state.prefs.exercise_avoid_json : []
  const equipment = Array.isArray(state?.prefs?.equipment_available_json) ? state.prefs.equipment_available_json : []
  const foodPrefs = state?.prefs?.food_preferences_json ?? {}

  return (
    <StepLayout
      stepKey="complete"
      title="Summary"
      subtitle="We’ll calculate your starting targets, generate your first split, and use your preferences to personalize the app."
      why="This final step turns your onboarding answers into a real plan, starting calories, and the first set of meal suggestions."
    >
      <div className="onboarding-review-grid">
        <div className="dash-card settings-section onboarding-review-card">
          <div className="onboarding-review-head">
            <h3>Body and goal</h3>
            <button type="button" className="btn-secondary small" onClick={() => navigate('/onboarding/body')}>Edit</button>
          </div>
          <div className="onboarding-review-list">
            <div className="onboarding-review-row"><span>Goal</span><strong>{state?.profile?.current_goal || 'recomp'}</strong></div>
            <div className="onboarding-review-row"><span>Pace</span><strong>{state?.profile?.goal_rate || 'moderate'}</strong></div>
            <div className="onboarding-review-row"><span>Weight</span><strong>{state?.profile?.starting_weight_lb || 'Not set'}</strong></div>
          </div>
        </div>
        <div className="dash-card settings-section onboarding-review-card">
          <div className="onboarding-review-head">
            <h3>Training setup</h3>
            <button type="button" className="btn-secondary small" onClick={() => navigate('/onboarding/training')}>Edit</button>
          </div>
          <div className="onboarding-review-list">
            <div className="onboarding-review-row"><span>Experience</span><strong>{state?.profile?.training_experience || 'beginner'}</strong></div>
            <div className="onboarding-review-row"><span>Session length</span><strong>{state?.profile?.available_time_default || 'medium'}</strong></div>
            <div className="onboarding-review-row"><span>Week</span><strong>{preferredSchedule.length ? preferredSchedule.map(entry => `${entry.day} ${String(entry.day_type).replaceAll('_', ' ')}`).join(', ') : 'Not set'}</strong></div>
          </div>
        </div>
        <div className="dash-card settings-section onboarding-review-card">
          <div className="onboarding-review-head">
            <h3>Limits and gear</h3>
            <div className="onboarding-review-actions">
              <button type="button" className="btn-secondary small" onClick={() => navigate('/onboarding/injuries')}>Edit limits</button>
              <button type="button" className="btn-secondary small" onClick={() => navigate('/onboarding/equipment')}>Edit gear</button>
            </div>
          </div>
          <div className="onboarding-review-list">
            <div className="onboarding-review-row"><span>Avoided exercises</span><strong>{avoidedExercises.length ? avoidedExercises.join(', ') : 'None added'}</strong></div>
            <div className="onboarding-review-row"><span>Body areas flagged</span><strong>{(state?.health_flags ?? []).filter(flag => flag?.active).map(flag => flag.body_area).join(', ') || 'None flagged'}</strong></div>
            <div className="onboarding-review-row"><span>Equipment</span><strong>{equipment.length ? equipment.join(', ') : 'No equipment added yet'}</strong></div>
          </div>
        </div>
        <div className="dash-card settings-section onboarding-review-card">
          <div className="onboarding-review-head">
            <h3>Food style</h3>
            <div className="onboarding-review-actions">
              <button type="button" className="btn-secondary small" onClick={() => navigate('/onboarding/food')}>Edit food</button>
              <button type="button" className="btn-secondary small" onClick={() => navigate('/onboarding/habits')}>Edit habits</button>
            </div>
          </div>
          <div className="onboarding-review-list">
            <div className="onboarding-review-row"><span>Preferred foods</span><strong>{foodPrefs.preferred_foods || 'Not added yet'}</strong></div>
            <div className="onboarding-review-row"><span>Meal frequency</span><strong>{foodPrefs.meal_frequency || '3'}</strong></div>
            <div className="onboarding-review-row"><span>Common meals</span><strong>{commonMeals.breakfasts || commonMeals.lunches || 'Not added yet'}</strong></div>
          </div>
        </div>
      </div>
      {error && <ErrorState className="onboarding-inline-error" message={error} title="Could not finish onboarding" />}
      <StepUnlock text="If this looks like your real week, Johnny will now turn it into your first calorie target, split, and meal suggestions." />
      <button className="btn-primary" onClick={finish} disabled={submitting}>{submitting ? 'Building your plan…' : 'Start My Plan'}</button>
    </StepLayout>
  )
}

export default function OnboardingRoutes() {
  return (
    <Routes>
      <Route path="welcome" element={<Welcome />} />
      <Route path="profile" element={<ProfileStep />} />
      <Route path="body" element={<BodyStep />} />
      <Route path="training" element={<TrainingStep />} />
      <Route path="injuries" element={<InjuriesStep />} />
      <Route path="equipment" element={<EquipmentStep />} />
      <Route path="food" element={<FoodStep />} />
      <Route path="habits" element={<HabitsStep />} />
      <Route path="photos" element={<PhotosStep />} />
      <Route path="complete" element={<CompleteStep />} />
      <Route path="goals" element={<Navigate to="/onboarding/habits" replace />} />
      <Route path="notifications" element={<Navigate to="/onboarding/habits" replace />} />
      <Route path="*" element={<Navigate to="/onboarding/welcome" replace />} />
    </Routes>
  )
}
