import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi } from '../../api/modules/ai'
import { analyticsApi } from '../../api/modules/analytics'
import { bodyApi } from '../../api/modules/body'
import { onboardingApi } from '../../api/modules/onboarding'
import { pushApi } from '../../api/modules/push'
import { decodeVapidPublicKey, ensurePushRegistration, getCurrentPushSubscription, getNotificationPermission, getPushSupportState, requestNotificationPermission, serializeSubscription } from '../../lib/pushNotifications'
import { useDashboardStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import { formatOpenAiVoiceLabel, getDefaultLiveWorkoutVoicePrefs, LIVE_WORKOUT_VOICE_RATE_OPTIONS, OPENAI_TTS_VOICE_OPTIONS, readLiveWorkoutVoicePrefs, writeLiveWorkoutVoicePrefs } from '../../lib/liveWorkoutVoice'
import { buildHeightCm, formatPhoneInput, formatReminderHour, formatMissingFields, getTimezoneRegion, getTimezoneRegions, getTimezonesForRegion, normalizePhoneNumber, normalizeTargets, reminderHourOptions, settingsFormFromState } from '../../lib/onboarding'
import { formatUsShortDate } from '../../lib/dateFormat'
import { applyColorScheme, getColorSchemeOptions, normalizeColorScheme, setAvailableColorSchemes } from '../../lib/theme'

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
const GOAL_CALORIE_DELTAS = {
  cut: { slow: -500, moderate: -750, aggressive: -1000 },
  maintain: { slow: 0, moderate: 0, aggressive: 0 },
  gain: { slow: 250, moderate: 400, aggressive: 500 },
  recomp: { slow: -250, moderate: -250, aggressive: -250 },
}
const PROFILE_ACCORDION_DEFAULTS = {
  overview: true,
  profile: true,
  defaults: false,
  voice: false,
  coaching: false,
  setup: false,
}

export default function SettingsScreen() {
  const initialPushSupport = getPushSupportState()
  const navigate = useNavigate()
  const invalidate = useDashboardStore(s => s.invalidate)
  const loadSnapshot = useDashboardStore(s => s.loadSnapshot)
  const snapshot = useDashboardStore(s => s.snapshot)
  const setAuth = useAuthStore(s => s.setAuth)
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(settingsFormFromState())
  const [targets, setTargets] = useState(null)
  const [, setError] = useState('')
  const [, setMessage] = useState('')
  const [, setMissingFields] = useState([])
  const [timezoneRegion, setTimezoneRegion] = useState(getTimezoneRegion(form.timezone))
  const [weeklyWeights, setWeeklyWeights] = useState([])
  const [johnnyMemory, setJohnnyMemory] = useState([])
  const [johnnyMemoryDraft, setJohnnyMemoryDraft] = useState([])
  const [savingJohnnyMemory, setSavingJohnnyMemory] = useState(false)
  const [johnnyOverview, setJohnnyOverview] = useState(null)
  const [johnnyError, setJohnnyError] = useState('')
  const [johnnyMessage, setJohnnyMessage] = useState('')
  const [colorSchemeOptions, setColorSchemeOptions] = useState(getColorSchemeOptions())
  const [smsReminders, setSmsReminders] = useState({ timezone: '', scheduled: [], history: [] })
  const [smsReminderLoading, setSmsReminderLoading] = useState(true)
  const [smsReminderError, setSmsReminderError] = useState('')
  const [smsReminderMessage, setSmsReminderMessage] = useState('')
  const [pushStatus, setPushStatus] = useState({
    supported: initialPushSupport.supported,
    supportReason: initialPushSupport.reason,
    permission: getNotificationPermission(),
    configured: false,
    enabled: false,
    vapidPublicKey: '',
    activeCount: 0,
    subscribed: false,
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    serviceWorkerRegistered: false,
  })
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const [pushMessage, setPushMessage] = useState('')
  const [cancelingReminderId, setCancelingReminderId] = useState('')
  const [accordionSections, setAccordionSections] = useState(PROFILE_ACCORDION_DEFAULTS)
  const [liveVoicePrefs, setLiveVoicePrefs] = useState(() => readLiveWorkoutVoicePrefs())
  const [voicePreviewBusy, setVoicePreviewBusy] = useState(false)
  const [voicePreviewError, setVoicePreviewError] = useState('')
  const [headshot, setHeadshot] = useState({ configured: false })
  const [headshotSrc, setHeadshotSrc] = useState('')
  const [headshotUploading, setHeadshotUploading] = useState(false)
  const [headshotError, setHeadshotError] = useState('')
  const [headshotMessage, setHeadshotMessage] = useState('')
  const [generatedImages, setGeneratedImages] = useState([])
  const [generatedImageSrcs, setGeneratedImageSrcs] = useState({})
  const [generatedImageActionBusyId, setGeneratedImageActionBusyId] = useState('')
  const [generatingImages, setGeneratingImages] = useState(false)
  const [generationCount, setGenerationCount] = useState(2)
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [generationError, setGenerationError] = useState('')
  const [generationMessage, setGenerationMessage] = useState('')
  const [zoomedImageId, setZoomedImageId] = useState('')
  const [zoomScale, setZoomScale] = useState(1)
  const speechPlaybackSupported = typeof window !== 'undefined' && typeof window.Audio !== 'undefined'

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

  function toggleAccordionSection(sectionKey) {
    setAccordionSections(current => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }))
  }

  useEffect(() => {
    let active = true

    onboardingApi.getState()
      .then(data => {
        if (!active) return
        const nextColorSchemes = setAvailableColorSchemes(data?.color_schemes)
        setColorSchemeOptions(nextColorSchemes)
        const nextForm = settingsFormFromState(data.profile, data.prefs, data.goal)
        setForm({
          ...nextForm,
          color_scheme: normalizeColorScheme(nextForm.color_scheme),
          phone: formatPhoneInput(nextForm.phone),
        })
        setHeadshot(data?.headshot ?? { configured: false })
        setGeneratedImages(Array.isArray(data?.generated_images) ? data.generated_images : [])
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
    applyColorScheme(form.color_scheme)
  }, [form.color_scheme])

  useEffect(() => {
    writeLiveWorkoutVoicePrefs(liveVoicePrefs)
  }, [liveVoicePrefs])

  useEffect(() => {
    let active = true
    let objectUrl = ''

    if (!headshot?.configured) {
      setHeadshotSrc('')
      return () => {}
    }

    onboardingApi.headshotBlob()
      .then(blob => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setHeadshotSrc(objectUrl)
      })
      .catch(err => {
        if (!active) return
        setHeadshotSrc('')
        setHeadshotError(err.message)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [headshot])

  useEffect(() => {
    let active = true
    const createdUrls = []

    if (!Array.isArray(generatedImages) || generatedImages.length === 0) {
      setGeneratedImageSrcs({})
      return () => {}
    }

    Promise.all(generatedImages.map(async image => {
      const blob = await onboardingApi.generatedImageBlob(image.id)
      const url = URL.createObjectURL(blob)
      createdUrls.push(url)
      return [image.id, url]
    }))
      .then(entries => {
        if (!active) return
        setGeneratedImageSrcs(Object.fromEntries(entries))
      })
      .catch(err => {
        if (active) setGenerationError(err.message)
      })

    return () => {
      active = false
      createdUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [generatedImages])

  useEffect(() => {
    let active = true

    aiApi.getMemory()
      .then(data => {
        if (!active) return
        const bullets = Array.isArray(data.durable_memory?.bullets) ? data.durable_memory.bullets : []
        setJohnnyMemory(bullets)
        setJohnnyMemoryDraft(bullets.length ? bullets : [''])
        setJohnnyOverview(data.follow_up_overview ?? null)
      })
      .catch(err => {
        if (active) setJohnnyError(err.message)
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true

    onboardingApi.getSmsReminders()
      .then(data => {
        if (!active) return
        setSmsReminders({
          timezone: data?.timezone ?? '',
          scheduled: Array.isArray(data?.scheduled) ? data.scheduled : [],
          history: Array.isArray(data?.history) ? data.history : [],
        })
        setSmsReminderError('')
      })
      .catch(err => {
        if (active) setSmsReminderError(err.message)
      })
      .finally(() => {
        if (active) setSmsReminderLoading(false)
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const support = getPushSupportState()

    Promise.all([
      pushApi.config().catch(() => ({ push: { enabled: false, configured: false, vapid_public_key: '' } })),
      support.supported ? getCurrentPushSubscription().catch(() => null) : Promise.resolve(null),
      pushApi.subscriptions().catch(() => ({ active_count: 0 })),
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker.getRegistration().catch(() => null) : Promise.resolve(null),
    ])
      .then(([configResponse, subscription, subscriptionsResponse, registration]) => {
        if (!active) return
        const config = configResponse?.push ?? {}
        const serializedSubscription = serializeSubscription(subscription)
        if (serializedSubscription?.endpoint) {
          pushApi.subscribe(serializedSubscription).catch(() => {})
        }
        setPushStatus(current => ({
          ...current,
          supported: support.supported,
          supportReason: support.reason,
          permission: getNotificationPermission(),
          configured: Boolean(config?.configured),
          enabled: Boolean(config?.enabled),
          vapidPublicKey: config?.vapid_public_key ?? '',
          activeCount: Number(subscriptionsResponse?.active_count ?? 0),
          subscribed: Boolean(subscription),
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          serviceWorkerRegistered: Boolean(registration),
        }))
      })
      .catch(err => {
        if (active) setPushError(err.message)
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    loadSnapshot()
    bodyApi.getWeight(7)
      .then(rows => setWeeklyWeights(Array.isArray(rows) ? rows.slice(0, 7).reverse() : []))
      .catch(() => {})
  }, [loadSnapshot])

  function updateLiveVoicePref(field, value) {
    setLiveVoicePrefs(current => ({
      ...current,
      [field]: value,
    }))
  }

  async function previewLiveVoice() {
    if (!speechPlaybackSupported) return
    if (voicePreviewBusy) return

    setVoicePreviewError('')
    setVoicePreviewBusy(true)
    try {
      const audioBlob = await aiApi.speech('Live workout check. Keep the next set sharp and stay inside the rest window.', {
        voice: liveVoicePrefs.openAiVoice,
        speed: liveVoicePrefs.rate,
        format: 'mp3',
      })
      const objectUrl = window.URL.createObjectURL(audioBlob)
      const audio = new window.Audio(objectUrl)
      audio.onended = () => window.URL.revokeObjectURL(objectUrl)
      audio.onerror = () => window.URL.revokeObjectURL(objectUrl)
      await audio.play()
    } catch (err) {
      setVoicePreviewError(err?.message || 'Could not play OpenAI voice sample.')
    } finally {
      setVoicePreviewBusy(false)
    }
  }

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
          color_scheme: form.color_scheme,
          add_exercise_calories_to_target: form.add_exercise_calories_to_target,
          workout_reminder_enabled: form.workout_reminder_enabled,
          workout_reminder_hour: Number(form.workout_reminder_hour),
          meal_reminder_enabled: form.meal_reminder_enabled,
          meal_reminder_hour: Number(form.meal_reminder_hour),
          sleep_reminder_enabled: form.sleep_reminder_enabled,
          sleep_reminder_hour: Number(form.sleep_reminder_hour),
          weekly_summary_enabled: form.weekly_summary_enabled,
          weekly_summary_hour: Number(form.weekly_summary_hour),
          push_enabled: form.push_enabled,
          push_absence_nudges: form.push_absence_nudges,
          push_milestones: form.push_milestones,
          push_winback: form.push_winback,
          push_accountability: form.push_accountability,
          push_quiet_hours_start: Number(form.push_quiet_hours_start),
          push_quiet_hours_end: Number(form.push_quiet_hours_end),
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
      setHeadshot(state?.headshot ?? { configured: false })
      setGeneratedImages(Array.isArray(state?.generated_images) ? state.generated_images : [])
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

  async function handleHeadshotUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const formData = new FormData()
    formData.append('headshot', file)

    setHeadshotUploading(true)
    setHeadshotError('')
    setHeadshotMessage('')

    try {
      const data = await onboardingApi.uploadHeadshot(formData)
      setHeadshot(data?.headshot ?? { configured: true })
      setHeadshotMessage('Headshot uploaded.')
    } catch (err) {
      setHeadshotError(err.message)
    } finally {
      setHeadshotUploading(false)
    }
  }

  async function handleHeadshotDelete() {
    setHeadshotUploading(true)
    setHeadshotError('')
    setHeadshotMessage('')

    try {
      await onboardingApi.deleteHeadshot()
      setHeadshot({ configured: false })
      setHeadshotMessage('Headshot removed.')
    } catch (err) {
      setHeadshotError(err.message)
    } finally {
      setHeadshotUploading(false)
    }
  }

  async function handleGenerateImages() {
    if (!headshot?.configured) return
    setGeneratingImages(true)
    setGenerationError('')
    setGenerationMessage('')

    try {
      const data = await onboardingApi.generateImages({
        prompt: generationPrompt.trim(),
        count: generationCount,
      })
      const nextImages = Array.isArray(data?.generated_images) ? data.generated_images : []
      setGeneratedImages(nextImages)
      setGenerationMessage(`Generated ${generationCount} personalized image${generationCount === 1 ? '' : 's'}.`)
    } catch (err) {
      setGenerationError(err.message)
    } finally {
      setGeneratingImages(false)
    }
  }

  async function handleToggleGeneratedImageFavorite(imageId, favorited) {
    if (!imageId || generatedImageActionBusyId) return
    setGeneratedImageActionBusyId(imageId)
    setGenerationError('')
    setGenerationMessage('')

    try {
      const data = await onboardingApi.updateGeneratedImage(imageId, { favorited: !favorited })
      const nextImages = Array.isArray(data?.generated_images) ? data.generated_images : []
      setGeneratedImages(nextImages)
      setGenerationMessage(!favorited ? 'Added to Live Workout rotation.' : 'Removed from Live Workout rotation.')
    } catch (err) {
      setGenerationError(err.message)
    } finally {
      setGeneratedImageActionBusyId('')
    }
  }

  async function handleDeleteGeneratedImage(imageId) {
    if (!imageId || generatedImageActionBusyId) return
    const confirmed = window.confirm('Delete this generated image?')
    if (!confirmed) return

    setGeneratedImageActionBusyId(imageId)
    setGenerationError('')
    setGenerationMessage('')

    try {
      const data = await onboardingApi.deleteGeneratedImage(imageId)
      const nextImages = Array.isArray(data?.generated_images) ? data.generated_images : []
      setGeneratedImages(nextImages)
      setGenerationMessage('Generated image deleted.')
      if (zoomedImageId === imageId) {
        setZoomedImageId('')
        setZoomScale(1)
      }
    } catch (err) {
      setGenerationError(err.message)
    } finally {
      setGeneratedImageActionBusyId('')
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

  async function saveJohnnyMemory() {
    if (savingJohnnyMemory) return

    setSavingJohnnyMemory(true)
    setJohnnyError('')
    setJohnnyMessage('')

    try {
      const bullets = johnnyMemoryDraft.map(item => item.trim()).filter(Boolean)
      const data = await aiApi.updateMemory(bullets)
      const nextBullets = Array.isArray(data.durable_memory?.bullets) ? data.durable_memory.bullets : bullets
      setJohnnyMemory(nextBullets)
      setJohnnyMemoryDraft(nextBullets.length ? nextBullets : [''])
      setJohnnyOverview(data.follow_up_overview ?? johnnyOverview)
      setJohnnyMessage('Johnny memory updated.')
    } catch (err) {
      setJohnnyError(err.message)
    } finally {
      setSavingJohnnyMemory(false)
    }
  }

  async function cancelSmsReminder(reminderId) {
    if (!reminderId || cancelingReminderId) return

    const confirmed = window.confirm('Cancel this scheduled SMS reminder?')
    if (!confirmed) return

    setCancelingReminderId(reminderId)
    setSmsReminderError('')
    setSmsReminderMessage('')

    try {
      const data = await onboardingApi.cancelSmsReminder(reminderId)
      const canceledReminder = data?.reminder ?? null

      setSmsReminders(current => {
        const nextScheduled = Array.isArray(current.scheduled)
          ? current.scheduled.filter(item => item.id !== reminderId)
          : []
        const nextHistory = canceledReminder
          ? [canceledReminder, ...(Array.isArray(current.history) ? current.history : []).filter(item => item.id !== reminderId)].slice(0, 8)
          : (Array.isArray(current.history) ? current.history : [])

        return {
          ...current,
          scheduled: nextScheduled,
          history: nextHistory,
        }
      })
      setSmsReminderMessage('Scheduled SMS reminder canceled.')
    } catch (err) {
      setSmsReminderError(err.message)
    } finally {
      setCancelingReminderId('')
    }
  }

  async function handleEnablePush() {
    if (!pushStatus.supported) {
      setPushError(pushStatus.supportReason || 'Browser notifications are not supported on this device.')
      return
    }

    if (!pushStatus.configured || !pushStatus.vapidPublicKey) {
      setPushError('Push notifications are not configured yet.')
      return
    }

    setPushBusy(true)
    setPushError('')
    setPushMessage('')

    try {
      const permission = await requestNotificationPermission()
      if (permission !== 'granted') {
        setPushStatus(current => ({ ...current, permission, subscribed: false }))
        throw new Error('Notifications permission was not granted.')
      }

      const registration = await ensurePushRegistration()
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidPublicKey(pushStatus.vapidPublicKey),
      })

      const payload = serializeSubscription(subscription)
      if (!payload) {
        throw new Error('Could not read the browser push subscription.')
      }

      await pushApi.subscribe(payload)
      analyticsApi.event('push_subscription_enabled', {
        screen: 'settings',
        context: 'push_preferences',
        metadata: {
          permission,
        },
      }).catch(() => {})

      const subscriptionsResponse = await pushApi.subscriptions().catch(() => ({ active_count: 1 }))
      setPushStatus(current => ({
        ...current,
        permission,
        subscribed: true,
        activeCount: Number(subscriptionsResponse?.active_count ?? 1),
        serviceWorkerRegistered: true,
      }))
      setPushMessage('Browser notifications enabled on this device.')
    } catch (err) {
      setPushError(err.message || 'Could not enable browser notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  async function handleDisablePush() {
    setPushBusy(true)
    setPushError('')
    setPushMessage('')

    try {
      const subscription = await getCurrentPushSubscription()
      if (subscription) {
        const payload = serializeSubscription(subscription)
        if (payload?.endpoint) {
          await pushApi.unsubscribe({ endpoint: payload.endpoint })
        }
        await subscription.unsubscribe()
        analyticsApi.event('push_subscription_disabled', {
          screen: 'settings',
          context: 'push_preferences',
          metadata: {
            endpoint: payload?.endpoint || '',
          },
        }).catch(() => {})
      }

      const subscriptionsResponse = await pushApi.subscriptions().catch(() => ({ active_count: 0 }))
      setPushStatus(current => ({
        ...current,
        permission: getNotificationPermission(),
        subscribed: false,
        activeCount: Number(subscriptionsResponse?.active_count ?? 0),
      }))
      setPushMessage('Browser notifications disabled on this device.')
    } catch (err) {
      setPushError(err.message || 'Could not disable browser notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  const regionTimezones = useMemo(() => getTimezonesForRegion(timezoneRegion), [timezoneRegion])
  const deliveryDiagnostics = snapshot?.delivery_diagnostics ?? null
  const pendingFollowUps = Array.isArray(snapshot?.pending_follow_ups) ? snapshot.pending_follow_ups : []
  const latestWeight = Number(snapshot?.latest_weight?.weight_lb ?? weeklyWeights[weeklyWeights.length - 1]?.weight_lb ?? form.starting_weight_lb ?? 0) || null
  const weeklyWeightDelta = useMemo(() => {
    if (weeklyWeights.length < 2) return null
    const first = Number(weeklyWeights[0]?.weight_lb ?? 0)
    const last = Number(weeklyWeights[weeklyWeights.length - 1]?.weight_lb ?? 0)
    if (!first || !last) return null
    return Math.round((last - first) * 10) / 10
  }, [weeklyWeights])
  const thirtyDayPrediction = useMemo(() => buildThirtyDayPrediction({
    latestWeight,
    targetCalories: targets?.target_calories,
    loggedCalories: snapshot?.nutrition_totals?.calories,
    goal: form.current_goal,
    pace: form.goal_rate,
    timezone: form.timezone,
  }), [form.current_goal, form.goal_rate, form.timezone, latestWeight, snapshot?.nutrition_totals?.calories, targets?.target_calories])
  const zoomedImage = generatedImages.find(image => image.id === zoomedImageId) || null
  const favoritedImageCount = generatedImages.filter(image => image?.favorited).length

  if (loading) return <div className="screen-loading">Loading…</div>

  return (
    <div className="screen settings-screen">
      <header className="screen-header">
        <div>
          <h1>Profile</h1>
          <p className="settings-subtitle">Update your identity, trajectory, and daily defaults.</p>
        </div>
      </header>

      <div className="settings-accordion-stack">
        <SettingsAccordionSection
          sectionKey="overview"
          eyebrow="At a glance"
          title="Overview"
          description="Goal snapshot, weekly weight trend, and the 30-day pace projection."
          itemCountLabel="2 cards"
          open={accordionSections.overview}
          onToggle={toggleAccordionSection}
        >
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

          <section className="dash-card settings-prediction-card">
            <div className="settings-prediction-head">
              <div>
                <span className="dashboard-chip awards">30-day prediction</span>
                <h3>If every day looked like today</h3>
              </div>
              <button type="button" className="btn-outline small" onClick={() => navigate('/nutrition')}>
                Open nutrition
              </button>
            </div>
            {thirtyDayPrediction ? (
              <>
                <p className="settings-prediction-summary">{thirtyDayPrediction.summary}</p>
                <div className="settings-prediction-stats">
                  <div className="settings-prediction-stat">
                    <span>Projected weight</span>
                    <strong>{thirtyDayPrediction.projectedWeightLabel}</strong>
                  </div>
                  <div className="settings-prediction-stat">
                    <span>30-day change</span>
                    <strong>{thirtyDayPrediction.changeLabel}</strong>
                  </div>
                  <div className="settings-prediction-stat">
                    <span>Daily pace</span>
                    <strong>{thirtyDayPrediction.dailyDeltaLabel}</strong>
                  </div>
                </div>
                <p className="settings-subtitle">{thirtyDayPrediction.note}</p>
              </>
            ) : (
              <p className="settings-subtitle">Log at least one meal today to unlock a 30-day pace projection. This card uses today&apos;s calorie pace against your current maintenance estimate.</p>
            )}
          </section>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          sectionKey="profile"
          eyebrow="Core inputs"
          title="Profile Basics"
          description="Identity, body stats, goal direction, plus headshot and AI image generation controls."
          itemCountLabel="3 sections + image generation"
          open={accordionSections.profile}
          onToggle={toggleAccordionSection}
        >
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

          <section className="settings-section dash-card settings-headshot-section">
            <div className="settings-headshot-head">
              <div>
                <h3>Your Headshot + Johnny Image Generation</h3>
                <p className="settings-subtitle">Upload a clear face photo. Gemini uses this together with your recent progress photos and Johnny&apos;s reference image to generate square scenes of you and Johnny together.</p>
              </div>
              <div className="settings-headshot-actions">
                <label className="btn-secondary settings-upload-trigger">
                  <input type="file" accept="image/*" onChange={handleHeadshotUpload} disabled={headshotUploading || generatingImages} />
                  {headshotUploading ? 'Uploading…' : headshot?.configured ? 'Replace Headshot' : 'Upload Headshot'}
                </label>
                {headshot?.configured ? (
                  <button type="button" className="btn-outline small" onClick={handleHeadshotDelete} disabled={headshotUploading || generatingImages}>
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            <div className="settings-headshot-layout">
              <div className="settings-headshot-preview-shell">
                {headshotSrc ? (
                  <img src={headshotSrc} alt="Uploaded headshot" className="settings-headshot-preview" />
                ) : (
                  <div className="settings-headshot-empty">No headshot uploaded yet.</div>
                )}
              </div>

              <div className="settings-headshot-controls">
                <label className="settings-field settings-field-span-2">
                  <span className="settings-field-label">Extra image direction</span>
                  <textarea
                    rows="4"
                    value={generationPrompt}
                    onChange={event => setGenerationPrompt(event.target.value)}
                    placeholder="Optional: add scene direction like rainy marathon training, heavy barbell work, or bright early-morning track energy."
                  />
                </label>
                <div className="settings-inline-panel settings-field-span-2">
                  <strong>Generate Johnny scenes</strong>
                  <p className="settings-subtitle">Pick 1 or 2 images per run. Hearts add images into Live Workout coach rotation.</p>
                  <div className="settings-grid settings-grid-compact">
                    <label className="settings-field">
                      <span className="settings-field-label">How many to generate</span>
                      <select value={generationCount} onChange={event => setGenerationCount(Number(event.target.value))} disabled={generatingImages}>
                        <option value={1}>1 image</option>
                        <option value={2}>2 images</option>
                      </select>
                    </label>
                  </div>
                  <div className="settings-ai-actions">
                    <button type="button" className="btn-primary small" onClick={handleGenerateImages} disabled={!headshot?.configured || generatingImages || headshotUploading}>
                      {generatingImages ? 'Generating…' : `Generate ${generationCount} Image${generationCount === 1 ? '' : 's'}`}
                    </button>
                  </div>
                </div>
                {headshotError ? <p className="error">{headshotError}</p> : null}
                {headshotMessage ? <p className="success-message">{headshotMessage}</p> : null}
                {generationError ? <p className="error">{generationError}</p> : null}
                {generationMessage ? <p className="success-message">{generationMessage}</p> : null}
              </div>
            </div>

            <div className="settings-generated-gallery">
              <div className="settings-generated-gallery-head">
                <strong>Generated Images</strong>
                <span>{generatedImages.length} total • {favoritedImageCount} in live rotation</span>
              </div>
              {generatedImages.length > 0 ? (
                <div className="settings-generated-grid">
                  {generatedImages.map(image => (
                    <article key={image.id} className="settings-generated-card">
                      {generatedImageSrcs[image.id] ? (
                        <button type="button" className="settings-generated-image-trigger" onClick={() => { setZoomedImageId(image.id); setZoomScale(1) }}>
                          <img src={generatedImageSrcs[image.id]} alt={image.scenario || 'Generated workout scene'} />
                        </button>
                      ) : <div className="settings-generated-loading">Loading…</div>}
                      <div className="settings-generated-copy">
                        <strong>{image.scenario || 'Generated scene'}</strong>
                        <span>{image.created_at ? formatUsShortDate(image.created_at, image.created_at) : 'Just now'}</span>
                      </div>
                      <div className="settings-ai-actions settings-generated-card-actions">
                        <button
                          type="button"
                          className={`btn-outline small ${image.favorited ? 'active-toggle' : ''}`}
                          onClick={() => handleToggleGeneratedImageFavorite(image.id, Boolean(image.favorited))}
                          disabled={generatedImageActionBusyId === image.id}
                        >
                          {image.favorited ? '♥ Hearted' : '♡ Heart'}
                        </button>
                        {generatedImageSrcs[image.id] ? (
                          <a className="btn-secondary small" href={generatedImageSrcs[image.id]} download={`johnny-scene-${image.id}.png`}>
                            Download
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="btn-danger small"
                          onClick={() => handleDeleteGeneratedImage(image.id)}
                          disabled={generatedImageActionBusyId === image.id}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="settings-subtitle">Generated images will appear here after your first run.</p>
              )}
            </div>
          </section>

        </SettingsAccordionSection>

        <SettingsAccordionSection
          sectionKey="defaults"
          eyebrow="Daily defaults"
          title="Targets & Reminders"
          description="Steps, sleep, SMS reminders, and the live target preview for your current setup."
          itemCountLabel="3 sections"
          open={accordionSections.defaults}
          onToggle={toggleAccordionSection}
        >
          <section className="settings-section dash-card">
            <h3>Daily Targets</h3>
            <div className="settings-grid">
              <label className="settings-field"><span className="settings-field-label">Steps</span><input type="number" min="1000" max="30000" step="1" value={form.target_steps} onChange={e => update('target_steps', Number(e.target.value))} /></label>
              <label className="settings-field"><span className="settings-field-label">Sleep (hours)</span><input type="number" min="4" max="12" step="0.5" value={form.target_sleep_hours} onChange={e => update('target_sleep_hours', Number(e.target.value))} /></label>
              <div className="settings-inline-panel settings-field-span-2">
                <label className="switch-field">
                  <span className="switch-copy">
                    <span className="settings-field-label">Add burned workout calories back</span>
                    <span className="settings-field-hint">Increase today&apos;s calorie target by logged cardio and completed workout burn.</span>
                  </span>
                  <span className="switch-control">
                    <input className="switch-input" type="checkbox" checked={form.add_exercise_calories_to_target} onChange={e => update('add_exercise_calories_to_target', e.target.checked)} />
                    <span className="switch-track" aria-hidden="true" />
                  </span>
                </label>
              </div>
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
              <div className="settings-inline-panel settings-field-span-2 settings-reminders-panel">
                <div className="switch-copy">
                  <span className="settings-field-label">Browser notifications</span>
                  <span className="settings-field-hint">Control whether Johnny can use push for absence nudges, milestones, winback, and accountability check-ins.</span>
                </div>
                <div className="settings-ai-actions">
                  {pushStatus.supported && pushStatus.subscribed ? (
                    <button type="button" className="btn-outline small" onClick={handleDisablePush} disabled={pushBusy}>
                      {pushBusy ? 'Updating…' : 'Disable on this device'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary small"
                      onClick={handleEnablePush}
                      disabled={pushBusy || !pushStatus.supported || !pushStatus.enabled || !pushStatus.configured}
                    >
                      {pushBusy ? 'Updating…' : 'Enable browser notifications'}
                    </button>
                  )}
                </div>
                <p className="settings-field-hint">
                  {pushStatus.supported
                    ? (pushStatus.subscribed ? 'Enabled on this device.' : `Permission: ${pushStatus.permission}.`)
                    : pushStatus.supportReason}
                </p>
                <p className="settings-field-hint">
                  {pushStatus.enabled && pushStatus.configured
                    ? `${pushStatus.activeCount} active notification device${pushStatus.activeCount === 1 ? '' : 's'} on your account.`
                    : 'Johnny push is not configured yet by the admin.'}
                </p>
                {pushError ? <p className="error">{pushError}</p> : null}
                {pushMessage ? <p className="success-message">{pushMessage}</p> : null}
              </div>
              <div className="settings-inline-panel settings-field-span-2 settings-reminders-panel">
                <div className="switch-copy">
                  <span className="settings-field-label">Push delivery preferences</span>
                  <span className="settings-field-hint">These rules decide when Johnny is allowed to reach out proactively.</span>
                </div>
                <div className="settings-grid settings-grid-compact">
                  <label className="switch-field">
                    <span className="switch-copy">
                      <span className="settings-field-label">Allow push nudges</span>
                      <span className="settings-field-hint">Master switch for coach push delivery.</span>
                    </span>
                    <span className="switch-control">
                      <input className="switch-input" type="checkbox" checked={form.push_enabled} onChange={e => update('push_enabled', e.target.checked)} />
                      <span className="switch-track" aria-hidden="true" />
                    </span>
                  </label>
                  <label className="switch-field">
                    <span className="switch-copy">
                      <span className="settings-field-label">Usual training day nudges</span>
                      <span className="settings-field-hint">“You usually train on Mondays” type reminders.</span>
                    </span>
                    <span className="switch-control">
                      <input className="switch-input" type="checkbox" checked={form.push_absence_nudges} onChange={e => update('push_absence_nudges', e.target.checked)} />
                      <span className="switch-track" aria-hidden="true" />
                    </span>
                  </label>
                  <label className="switch-field">
                    <span className="switch-copy">
                      <span className="settings-field-label">Milestone pushes</span>
                      <span className="settings-field-hint">Recognition when momentum or streaks are real.</span>
                    </span>
                    <span className="switch-control">
                      <input className="switch-input" type="checkbox" checked={form.push_milestones} onChange={e => update('push_milestones', e.target.checked)} />
                      <span className="switch-track" aria-hidden="true" />
                    </span>
                  </label>
                  <label className="switch-field">
                    <span className="switch-copy">
                      <span className="settings-field-label">Winback pushes</span>
                      <span className="settings-field-hint">Reset prompts after missed sessions.</span>
                    </span>
                    <span className="switch-control">
                      <input className="switch-input" type="checkbox" checked={form.push_winback} onChange={e => update('push_winback', e.target.checked)} />
                      <span className="switch-track" aria-hidden="true" />
                    </span>
                  </label>
                  <label className="switch-field settings-field-span-2">
                    <span className="switch-copy">
                      <span className="settings-field-label">Accountability pushes</span>
                      <span className="settings-field-hint">Balance and drift prompts when your week gets lopsided.</span>
                    </span>
                    <span className="switch-control">
                      <input className="switch-input" type="checkbox" checked={form.push_accountability} onChange={e => update('push_accountability', e.target.checked)} />
                      <span className="switch-track" aria-hidden="true" />
                    </span>
                  </label>
                  <label className="settings-subfield">
                    <span>Quiet hours start</span>
                    <select value={form.push_quiet_hours_start} onChange={e => update('push_quiet_hours_start', Number(e.target.value))}>
                      {REMINDER_HOUR_OPTIONS.map(option => <option key={`push-start-${option.value}`} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="settings-subfield">
                    <span>Quiet hours end</span>
                    <select value={form.push_quiet_hours_end} onChange={e => update('push_quiet_hours_end', Number(e.target.value))}>
                      {REMINDER_HOUR_OPTIONS.map(option => <option key={`push-end-${option.value}`} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div className="settings-inline-panel settings-field-span-2 settings-reminders-panel">
                <div className="switch-copy">
                  <span className="settings-field-label">Push diagnostics</span>
                  <span className="settings-field-hint">This is the current delivery state Johnny sees for your account.</span>
                </div>
                <div className="settings-diagnostics-grid">
                  <div className="settings-diagnostics-card">
                    <strong>Local status</strong>
                    <span>Permission: {pushStatus.permission}</span>
                    <span>Supported: {pushStatus.supported ? 'yes' : 'no'}</span>
                    <span>Subscribed on this device: {pushStatus.subscribed ? 'yes' : 'no'}</span>
                    <span>Account devices: {pushStatus.activeCount}</span>
                    <span>Origin: {pushStatus.origin || '—'}</span>
                    <span>Service worker: {pushStatus.serviceWorkerRegistered ? 'registered' : 'missing'}</span>
                  </div>
                  <div className="settings-diagnostics-card">
                    <strong>Coach delivery</strong>
                    <span>Pending follow-ups: {deliveryDiagnostics?.follow_up_overview?.pending_count ?? 0}</span>
                    <span>Overdue: {deliveryDiagnostics?.follow_up_overview?.overdue_count ?? 0}</span>
                    <span>Dismissed last 14d: {deliveryDiagnostics?.counts?.dismissed_follow_ups_last_14d ?? 0}</span>
                    <span>Push last 24h: {deliveryDiagnostics?.counts?.sent_last_24h ?? 0}</span>
                  </div>
                  <div className="settings-diagnostics-card">
                    <strong>Timing</strong>
                    <span>Timezone: {deliveryDiagnostics?.local_time?.timezone || form.timezone}</span>
                    <span>Local now: {deliveryDiagnostics?.local_time?.now || '—'}</span>
                    <span>In quiet hours: {deliveryDiagnostics?.local_time?.in_quiet_hours ? 'yes' : 'no'}</span>
                    <span>Push configured: {deliveryDiagnostics?.push?.configured ? 'yes' : 'no'}</span>
                  </div>
                </div>
                {pendingFollowUps.length ? (
                  <div className="settings-diagnostics-list">
                    <strong>Current coach queue</strong>
                    {pendingFollowUps.slice(0, 3).map(followUp => (
                      <div key={followUp.id} className="settings-diagnostics-list-row">
                        <span>{followUp.reason || followUp.prompt}</span>
                        <small>{followUp.last_delivery_channel ? `${followUp.last_delivery_channel} • ` : ''}{followUp.status || 'pending'}</small>
                      </div>
                    ))}
                  </div>
                ) : null}
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
                <div className="settings-scheduled-reminders-card">
                  <div className="settings-scheduled-reminders-head">
                    <div>
                      <strong>Scheduled by Johnny</strong>
                      <p>One-off SMS reminders Johnny creates for you appear here. Cancel anything that has not fired yet.</p>
                    </div>
                    <button type="button" className="btn-outline small" onClick={() => openDrawer('Show me my scheduled SMS reminders and help me manage them.')}>Ask Johnny</button>
                  </div>

                  {smsReminderLoading ? <p className="settings-subtitle">Loading scheduled reminders…</p> : null}
                  {smsReminderError ? <p className="error">{smsReminderError}</p> : null}
                  {smsReminderMessage ? <p className="success-message">{smsReminderMessage}</p> : null}

                  {!smsReminderLoading && !smsReminderError ? (
                    <>
                      <div className="settings-reminder-collection">
                        <div className="settings-reminder-collection-head">
                          <strong>Upcoming</strong>
                          <span>{smsReminders.scheduled?.length ?? 0}</span>
                        </div>
                        {Array.isArray(smsReminders.scheduled) && smsReminders.scheduled.length > 0 ? (
                          <div className="settings-scheduled-reminder-list">
                            {smsReminders.scheduled.map(reminder => (
                              <div key={reminder.id} className="settings-scheduled-reminder-row">
                                <div className="settings-scheduled-reminder-copy">
                                  <strong>{formatReminderDateTime(reminder.send_at_local)}</strong>
                                  <p>{reminder.message}</p>
                                  <span>{smsReminders.timezone || reminder.timezone || form.timezone}</span>
                                </div>
                                <button
                                  type="button"
                                  className="btn-outline small"
                                  onClick={() => cancelSmsReminder(reminder.id)}
                                  disabled={cancelingReminderId === reminder.id}
                                >
                                  {cancelingReminderId === reminder.id ? 'Canceling…' : 'Cancel'}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="settings-subtitle">No one-off SMS reminders are queued right now.</p>
                        )}
                      </div>

                      <div className="settings-reminder-collection">
                        <div className="settings-reminder-collection-head">
                          <strong>Recent activity</strong>
                          <span>{smsReminders.history?.length ?? 0}</span>
                        </div>
                        {Array.isArray(smsReminders.history) && smsReminders.history.length > 0 ? (
                          <div className="settings-scheduled-reminder-list history">
                            {smsReminders.history.map(reminder => (
                              <div key={reminder.id} className="settings-scheduled-reminder-row history">
                                <div className="settings-scheduled-reminder-copy">
                                  <strong>{formatReminderDateTime(reminder.send_at_local)}</strong>
                                  <p>{reminder.message}</p>
                                  <span>{formatReminderHistoryMeta(reminder, smsReminders.timezone || reminder.timezone || form.timezone)}</span>
                                </div>
                                <span className={`settings-reminder-status ${reminder.status}`}>{formatReminderStatus(reminder.status)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="settings-subtitle">Sent, failed, or canceled reminder history will appear here.</p>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
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
        </SettingsAccordionSection>

        <SettingsAccordionSection
          sectionKey="voice"
          eyebrow="Live training"
          title="Spoken Voice"
          description="Device-specific voice playback controls for Johnny during Live Workout Mode."
          itemCountLabel="1 card"
          open={accordionSections.voice}
          onToggle={toggleAccordionSection}
        >
          <section className="settings-ai-grid">
            <div className="dash-card settings-ai-card">
              <div className="settings-ai-head">
                <div>
                  <span className="dashboard-chip coach">Live workout voice</span>
                  <h3>Johnny spoken coaching</h3>
                </div>
              </div>
              {!speechPlaybackSupported ? (
                <p className="settings-subtitle">This browser cannot play inline audio, so spoken live-workout coaching is unavailable here.</p>
              ) : (
                <>
                  <p className="settings-subtitle">These settings control OpenAI voice playback for Live Workout Mode on this device.</p>
                  <div className="settings-grid settings-grid-compact">
                    <div className="settings-inline-panel">
                      <label className="switch-field">
                        <span className="switch-copy">
                          <span className="settings-field-label">Auto-speak Johnny</span>
                          <span className="settings-field-hint">Speak each new live coaching reply automatically.</span>
                        </span>
                        <span className="switch-control">
                          <input className="switch-input" type="checkbox" checked={liveVoicePrefs.autoSpeak} onChange={event => updateLiveVoicePref('autoSpeak', event.target.checked)} />
                          <span className="switch-track" aria-hidden="true" />
                        </span>
                      </label>
                    </div>
                    <div className="settings-inline-panel">
                      <label className="switch-field">
                        <span className="switch-copy">
                          <span className="settings-field-label">Auto-speak drawer replies</span>
                          <span className="settings-field-hint">Read new Johnny Assistant drawer replies out loud automatically.</span>
                        </span>
                        <span className="switch-control">
                          <input className="switch-input" type="checkbox" checked={liveVoicePrefs.assistantAutoSpeak} onChange={event => updateLiveVoicePref('assistantAutoSpeak', event.target.checked)} />
                          <span className="switch-track" aria-hidden="true" />
                        </span>
                      </label>
                    </div>
                    <label className="settings-field settings-field-span-2">
                      <span className="settings-field-label">Voice</span>
                      <select value={liveVoicePrefs.openAiVoice} onChange={event => updateLiveVoicePref('openAiVoice', event.target.value)}>
                        {OPENAI_TTS_VOICE_OPTIONS.map(voice => (
                          <option key={voice} value={voice}>{formatOpenAiVoiceLabel(voice)}</option>
                        ))}
                      </select>
                      <span className="settings-field-hint">Voice is generated by OpenAI instead of browser-native speech synthesis.</span>
                    </label>
                    <label className="settings-field">
                      <span className="settings-field-label">Playback speed</span>
                      <select value={String(liveVoicePrefs.rate)} onChange={event => updateLiveVoicePref('rate', Number(event.target.value))}>
                        {LIVE_WORKOUT_VOICE_RATE_OPTIONS.map(rate => (
                          <option key={rate} value={rate}>{rate.toFixed(rate % 1 === 0 ? 0 : 2)}x</option>
                        ))}
                      </select>
                    </label>
                    <div className="settings-inline-panel settings-live-voice-preview-card">
                      <strong>Preview</strong>
                      <p className="settings-subtitle">Play a short sample with the current OpenAI voice and speed, or reset this device back to Johnny’s defaults.</p>
                      <div className="settings-ai-actions">
                        <button type="button" className="btn-outline small" onClick={previewLiveVoice} disabled={voicePreviewBusy}>{voicePreviewBusy ? 'Playing…' : 'Play sample'}</button>
                        <button type="button" className="btn-secondary small" onClick={() => setLiveVoicePrefs(getDefaultLiveWorkoutVoicePrefs())}>Reset defaults</button>
                      </div>
                      {voicePreviewError ? <p className="error">{voicePreviewError}</p> : null}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          sectionKey="coaching"
          eyebrow="Johnny"
          title="Coaching Memory"
          description="Long-term coaching notes, follow-through health, and the history Johnny uses to coach you."
          itemCountLabel="2 cards"
          open={accordionSections.coaching}
          onToggle={toggleAccordionSection}
        >
          <section className="settings-ai-grid">
            <div className="dash-card settings-ai-card">
              <div className="settings-ai-head">
                <div>
                  <span className="dashboard-chip ai">Johnny memory</span>
                  <h3>What Johnny should keep in mind</h3>
                </div>
                <button type="button" className="btn-outline small" onClick={() => openDrawer('Review my coaching memory and tell me what should change.')}>Ask Johnny</button>
              </div>
              <p className="settings-subtitle">Keep this to durable preferences, recurring obstacles, and how you like to be coached.</p>
              <div className="settings-ai-memory-list">
                {(johnnyMemoryDraft.length ? johnnyMemoryDraft : ['']).map((bullet, index) => (
                  <div key={`johnny-memory-${index}`} className="settings-ai-memory-row">
                    <input
                      type="text"
                      value={bullet}
                      onChange={event => setJohnnyMemoryDraft(current => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                      placeholder="Example: I do better with blunt accountability than vague encouragement"
                    />
                    <button
                      type="button"
                      className="btn-outline small"
                      onClick={() => setJohnnyMemoryDraft(current => current.filter((_, itemIndex) => itemIndex !== index))}
                      disabled={johnnyMemoryDraft.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="settings-ai-actions">
                <button type="button" className="btn-secondary small" onClick={() => setJohnnyMemoryDraft(current => [...current, ''])}>Add memory</button>
                <button type="button" className="btn-primary small" onClick={saveJohnnyMemory} disabled={savingJohnnyMemory}>{savingJohnnyMemory ? 'Saving…' : 'Save memory'}</button>
              </div>
              {johnnyError ? <p className="error">{johnnyError}</p> : null}
              {johnnyMessage ? <p className="success-message">{johnnyMessage}</p> : null}
              {!johnnyError && johnnyMemory.length > 0 ? <p className="settings-ai-note">Saved {johnnyMemory.length} long-term coaching notes.</p> : null}
            </div>

            <div className="dash-card settings-ai-card">
              <div className="settings-ai-head">
                <div>
                  <span className="dashboard-chip subtle">Johnny follow-through</span>
                  <h3>Coaching loop health</h3>
                </div>
                <button type="button" className="btn-outline small" onClick={() => openDrawer('Show me my current Johnny follow-ups and what I have been ignoring lately.')}>Open Johnny</button>
              </div>
              <p className="settings-subtitle">This gives Johnny a memory of what you finish, punt, or let slide.</p>
              <div className="settings-ai-stats">
                <div className="settings-ai-stat"><span>Pending</span><strong>{johnnyOverview?.pending_count ?? 0}</strong></div>
                <div className="settings-ai-stat"><span>Missed</span><strong>{johnnyOverview?.missed_count ?? 0}</strong></div>
                <div className="settings-ai-stat"><span>Overdue</span><strong>{johnnyOverview?.overdue_count ?? 0}</strong></div>
                <div className="settings-ai-stat"><span>Completed 14d</span><strong>{johnnyOverview?.completed_last_14_days ?? 0}</strong></div>
                <div className="settings-ai-stat"><span>Dismissed 14d</span><strong>{johnnyOverview?.dismissed_last_14_days ?? 0}</strong></div>
              </div>
              {johnnyOverview?.recent_summary ? <p className="settings-ai-note">Recent pattern: {johnnyOverview.recent_summary}.</p> : null}
              {Array.isArray(johnnyOverview?.missed_items) && johnnyOverview.missed_items.length > 0 ? (
                <div className="settings-ai-history-block">
                  <strong>Missed commitments</strong>
                  <ul className="settings-ai-history-list">
                    {johnnyOverview.missed_items.slice(0, 3).map(item => (
                      <li key={item.id}>{item.prompt}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {Array.isArray(johnnyOverview?.overdue_items) && johnnyOverview.overdue_items.length > 0 ? (
                <div className="settings-ai-history-block">
                  <strong>Overdue</strong>
                  <ul className="settings-ai-history-list">
                    {johnnyOverview.overdue_items.slice(0, 3).map(item => (
                      <li key={item.id}>{item.prompt}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {Array.isArray(johnnyOverview?.history) && johnnyOverview.history.length > 0 ? (
                <div className="settings-ai-history-block">
                  <strong>Recent outcomes</strong>
                  <ul className="settings-ai-history-list">
                    {johnnyOverview.history.slice(0, 5).map(item => (
                      <li key={`${item.id}-${item.changed_at}`}>
                        <span className={`settings-ai-history-state ${item.state}`}>{formatFollowUpState(item.state)}</span>
                        <span>{item.prompt}</span>
                        <small>{formatUsShortDate(item.changed_at, item.changed_at)}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="settings-subtitle">Johnny will start building a visible history here as you complete or dismiss follow-ups.</p>
              )}
            </div>
          </section>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          sectionKey="setup"
          eyebrow="Plan and app"
          title="Theme & Training Setup"
          description="Color palette, weekly split order, and onboarding tools if you want to redo the guided setup."
          itemCountLabel="3 sections"
          open={accordionSections.setup}
          onToggle={toggleAccordionSection}
        >
          <section className="settings-section dash-card">
            <h3>Color Scheme</h3>
            <p className="settings-subtitle">Pick the app palette you want to use everywhere. The current colors stay as the first option.</p>
            <div className="settings-theme-grid">
              {colorSchemeOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={`settings-theme-option${form.color_scheme === option.id ? ' active' : ''}`}
                  onClick={() => update('color_scheme', option.id)}
                >
                  <span className="settings-theme-swatches" aria-hidden="true">
                    <span style={{ background: option.colors.bg }} />
                    <span style={{ background: option.colors.accent }} />
                    <span style={{ background: option.colors.accent2 }} />
                    <span style={{ background: option.colors.accent3 }} />
                  </span>
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
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

          <section className="settings-section dash-card settings-onboarding-section">
            <h3>Exercise Library</h3>
            <p className="settings-subtitle">Open your personal exercise library to rename saved swap ideas, clean out old variations, or review what Johnny has learned about your preferences.</p>
            <div className="settings-actions settings-actions-single">
              <button className="btn-outline" type="button" onClick={() => navigate('/workout/library')}>
                Open My Exercise Library
              </button>
            </div>
          </section>

          <section className="settings-section dash-card settings-onboarding-section">
            <h3>Onboarding</h3>
            <p className="settings-subtitle">Run through the guided setup again if you want to update your training background, equipment, food preferences, or recovery defaults step by step.</p>
            <div className="settings-actions settings-actions-single">
              <button className="btn-secondary" onClick={restartOnboarding} disabled={saving}>
                {saving ? 'Working…' : 'Restart Onboarding'}
              </button>
            </div>
          </section>
        </SettingsAccordionSection>
      </div>

      {zoomedImage && generatedImageSrcs[zoomedImage.id] ? (
        <div className="settings-image-zoom-modal" role="dialog" aria-modal="true" aria-label="Generated image preview">
          <button type="button" className="settings-image-zoom-backdrop" onClick={() => setZoomedImageId('')} aria-label="Close preview" />
          <div className="settings-image-zoom-panel">
            <div className="settings-image-zoom-head">
              <strong>{zoomedImage.scenario || 'Generated scene'}</strong>
              <button type="button" className="btn-secondary small" onClick={() => setZoomedImageId('')}>Close</button>
            </div>
            <div className="settings-image-zoom-canvas">
              <img
                src={generatedImageSrcs[zoomedImage.id]}
                alt={zoomedImage.scenario || 'Generated workout scene'}
                style={{ transform: `scale(${zoomScale})` }}
              />
            </div>
            <label className="settings-field">
              <span className="settings-field-label">Zoom</span>
              <input type="range" min="1" max="2.5" step="0.1" value={zoomScale} onChange={event => setZoomScale(Number(event.target.value))} />
            </label>
          </div>
        </div>
      ) : null}

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
    </div>
  )
}

function SettingsAccordionSection({ sectionKey, eyebrow, title, description, itemCountLabel, open, onToggle, children }) {
  const panelId = `settings-accordion-panel-${sectionKey}`

  return (
    <section className={`settings-accordion-group${open ? ' open' : ''}`}>
      <button
        type="button"
        className="settings-accordion-trigger"
        onClick={() => onToggle(sectionKey)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className="settings-accordion-trigger-copy">
          {eyebrow ? <span className="settings-accordion-eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        <div className="settings-accordion-meta">
          {itemCountLabel ? <span className="settings-accordion-count">{itemCountLabel}</span> : null}
          <span className={`workout-accordion-icon ${open ? 'expanded' : ''}`} aria-hidden="true">
            <span className="workout-accordion-icon-bar horizontal" />
            <span className="workout-accordion-icon-bar vertical" />
          </span>
        </div>
        <p className="settings-accordion-description">{description}</p>
      </button>
      <div id={panelId} className={`workout-accordion-panel settings-accordion-panel ${open ? 'expanded' : ''}`}>
        <div className="workout-accordion-panel-inner settings-accordion-panel-inner">
          {children}
        </div>
      </div>
    </section>
  )
}

function formatFollowUpState(state) {
  switch (state) {
    case 'missed':
      return 'Missed'
    case 'completed':
      return 'Done'
    case 'dismissed':
      return 'Dismissed'
    case 'snoozed':
      return 'Snoozed'
    default:
      return 'Open'
  }
}

function formatReminderDateTime(value) {
  if (!value) return 'Scheduled time unavailable'

  const parsed = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return String(value)

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatReminderStatus(status) {
  switch (status) {
    case 'sent':
      return 'Sent'
    case 'queued':
      return 'Queued'
    case 'failed':
      return 'Failed'
    case 'canceled':
      return 'Canceled'
    default:
      return 'Scheduled'
  }
}

function formatReminderHistoryMeta(reminder, timezoneLabel) {
  const statusLabel = formatReminderStatus(reminder?.status).toLowerCase()

  if (reminder?.status === 'sent' && reminder?.sent_at) {
    return `${statusLabel} • ${formatUsShortDate(reminder.sent_at, reminder.sent_at)} • ${timezoneLabel}`
  }
  if (reminder?.status === 'canceled' && reminder?.canceled_at) {
    return `${statusLabel} • ${formatUsShortDate(reminder.canceled_at, reminder.canceled_at)} • ${timezoneLabel}`
  }

  return `${statusLabel} • ${timezoneLabel}`
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
  return `${weightLabel}. ${calories} with ${protein}.`
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

function buildThirtyDayPrediction({ latestWeight, targetCalories, loggedCalories, goal, pace, timezone }) {
  const currentWeight = Number(latestWeight ?? 0)
  const calorieTarget = Number(targetCalories ?? 0)
  const caloriesLogged = Number(loggedCalories ?? 0)

  if (!currentWeight || !calorieTarget || caloriesLogged <= 0) return null

  const goalDelta = GOAL_CALORIE_DELTAS[goal]?.[pace] ?? 0
  const maintenanceCalories = calorieTarget - goalDelta

  if (!maintenanceCalories) return null

  const elapsedDay = getElapsedDayFraction(timezone)
  const projectedIntake = Math.round(caloriesLogged / elapsedDay)
  const dailyDelta = Math.round(projectedIntake - maintenanceCalories)
  const projectedChange = roundToTenth((dailyDelta * 30) / 3500)
  const projectedWeight = roundToTenth(currentWeight + projectedChange)
  const direction = dailyDelta === 0 ? 'right at' : dailyDelta > 0 ? `${Math.abs(dailyDelta)} calories above` : `${Math.abs(dailyDelta)} calories below`

  return {
    projectedWeightLabel: `${projectedWeight.toFixed(1)} lbs`,
    changeLabel: `${projectedChange > 0 ? '+' : ''}${projectedChange.toFixed(1)} lbs`,
    dailyDeltaLabel: `${dailyDelta > 0 ? '+' : ''}${dailyDelta} cal/day`,
    summary: `At today’s current pace, you would land around ${projectedIntake.toLocaleString()} calories. That is ${direction} your estimated maintenance of ${maintenanceCalories.toLocaleString()}, which points to about ${projectedWeight.toFixed(1)} lbs in 30 days.`,
    note: `This is a directional estimate, not a promise. It extrapolates today’s logged intake pace in ${timezone || 'your local timezone'} against your current target setup.`,
  }
}

function getElapsedDayFraction(timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || undefined,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(new Date())
    const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
    const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0)
    return Math.min(1, Math.max(0.2, ((hour * 60) + minute) / 1440))
  } catch {
    const now = new Date()
    return Math.min(1, Math.max(0.2, ((now.getHours() * 60) + now.getMinutes()) / 1440))
  }
}

function roundToTenth(value) {
  return Math.round(Number(value ?? 0) * 10) / 10
}
