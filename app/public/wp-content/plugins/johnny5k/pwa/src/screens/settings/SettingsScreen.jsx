import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { aiApi } from '../../api/modules/ai'
import { analyticsApi } from '../../api/modules/analytics'
import { bodyApi } from '../../api/modules/body'
import { ironquestApi } from '../../api/modules/ironquest'
import { onboardingApi } from '../../api/modules/onboarding'
import { pushApi } from '../../api/modules/push'
import AppLoadingScreen from '../../components/ui/AppLoadingScreen'
import ClearableInput from '../../components/ui/ClearableInput'
import ErrorState from '../../components/ui/ErrorState'
import Field from '../../components/ui/Field'
import SupportIconButton from '../../components/ui/SupportIconButton'
import { getAccessibleScrollBehavior } from '../../lib/accessibility'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import { speakNativeJohnnyAnnouncement } from '../../lib/nativeAudioSpeech'
import { decodeVapidPublicKey, ensurePushRegistration, getCurrentPushSubscription, getNotificationPermission, getPushSupportState, requestNotificationPermission, serializeSubscription } from '../../lib/pushNotifications'
import { useDashboardStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import { formatLiveWorkoutNativeAudioModeLabel, formatOpenAiVoiceLabel, getDefaultLiveWorkoutVoicePrefs, LIVE_WORKOUT_NATIVE_AUDIO_MODE_OPTIONS, LIVE_WORKOUT_VOICE_RATE_OPTIONS, OPENAI_TTS_VOICE_OPTIONS, readLiveWorkoutVoicePrefs, writeLiveWorkoutVoicePrefs } from '../../lib/liveWorkoutVoice'
import { applyBrand } from '../../brands/registry'
import { buildHeightCm, buildPushPromptSnoozedUntil, formatPhoneInput, formatReminderHour, formatMissingFields, getTimezoneRegion, getTimezoneRegions, getTimezonesForRegion, isPushPromptSnoozed, normalizePhoneNumber, normalizePushPromptStatus, normalizeTargets, PUSH_PROMPT_SNOOZE_DAYS, reminderHourOptions, settingsFormFromState } from '../../lib/onboarding'
import { DAY_TYPE_OPTIONS } from '../../lib/trainingDayTypes'
import { openSupportGuide } from '../../lib/supportHelp'
import { confirmGlobalAction } from '../../lib/uiFeedback'

const TIMEZONE_REGIONS = getTimezoneRegions()
const REMINDER_HOUR_OPTIONS = reminderHourOptions()
const PROFILE_ACCORDION_STORAGE_KEY_PREFIX = 'johnny5k.profile.accordions.v1'
const PROFILE_ACCORDION_DEFAULTS = {
  overview: true,
  personal: true,
  targets: true,
  notifications: false,
  liveCoaching: false,
  johnny: false,
  images: false,
  trainingApp: false,
}
const SCROLL_BEHAVIOR = getAccessibleScrollBehavior()

function withoutRetiredColorScheme(preferenceMeta) {
  const nextPreferenceMeta = { ...(preferenceMeta ?? {}) }
  delete nextPreferenceMeta.color_scheme
  return nextPreferenceMeta
}

export default function SettingsScreen() {
  const initialPushSupport = getPushSupportState()
  const location = useLocation()
  const navigate = useNavigate()
  const invalidate = useDashboardStore(s => s.invalidate)
  const loadSnapshot = useDashboardStore(s => s.loadSnapshot)
  const snapshot = useDashboardStore(s => s.snapshot)
  const authEmail = useAuthStore(s => s.email)
  const setAuth = useAuthStore(s => s.setAuth)
  const setExperienceMode = useAuthStore(s => s.setExperienceMode)
  const setNotificationPrefs = useAuthStore(s => s.setNotificationPrefs)
  const setPreferenceMeta = useAuthStore(s => s.setPreferenceMeta)
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
  const [johnnyError, setJohnnyError] = useState('')
  const [johnnyMessage, setJohnnyMessage] = useState('')
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
  const [showPushRefusalChoice, setShowPushRefusalChoice] = useState(false)
  const [accordionSections, setAccordionSections] = useState(() => readStoredProfileAccordionSections(buildProfileAccordionStorageKey(authEmail)))
  const [liveVoicePrefs, setLiveVoicePrefs] = useState(() => readLiveWorkoutVoicePrefs())
  const [voicePreviewBusy, setVoicePreviewBusy] = useState(false)
  const [voicePreviewError, setVoicePreviewError] = useState('')
  const [headshot, setHeadshot] = useState({ configured: false })
  const [headshotSrc, setHeadshotSrc] = useState('')
  const [headshotUploading, setHeadshotUploading] = useState(false)
  const [headshotError, setHeadshotError] = useState('')
  const [headshotMessage, setHeadshotMessage] = useState('')
  const [ironQuest, setIronQuest] = useState(null)
  const [ironQuestLoading, setIronQuestLoading] = useState(true)
  const [ironQuestError, setIronQuestError] = useState('')
  const [ironQuestSubmitting, setIronQuestSubmitting] = useState(false)
  const [ironQuestResetting, setIronQuestResetting] = useState(false)
  const pushPanelRef = useRef(null)
  const pushEnableButtonRef = useRef(null)
  const accordionStorageKey = useMemo(() => buildProfileAccordionStorageKey(authEmail), [authEmail])
  const speechPlaybackSupported = typeof window !== 'undefined' && typeof window.Audio !== 'undefined'

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function updatePhone(value) {
    update('phone', formatPhoneInput(value))
  }

  function updatePersonality(key, value) {
    update('preference_meta', { ...form.preference_meta, [key]: value })
  }

  function updateSchedule(day, dayType) {
    setForm(current => ({
      ...current,
      weekly_schedule: (current.weekly_schedule ?? []).map(entry => entry.day === day ? { ...entry, day_type: dayType } : entry),
    }))
  }

  function toggleAccordionSection(sectionKey) {
    setAccordionSections(current => ({
      ...writeStoredProfileAccordionSections(accordionStorageKey, {
        ...current,
        [sectionKey]: !current[sectionKey],
      }),
    }))
  }

  useEffect(() => {
    setAccordionSections(readStoredProfileAccordionSections(accordionStorageKey))
  }, [accordionStorageKey])

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
        setPreferenceMeta(data?.prefs?.exercise_preferences_json ?? {})
        setNotificationPrefs({
          pushPromptStatus: normalizePushPromptStatus(nextForm.push_prompt_status),
        })
        setHeadshot(data?.headshot ?? { configured: false })
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
  }, [setNotificationPrefs, setPreferenceMeta])

  useEffect(() => {
    let active = true

    ironquestApi.profile()
      .then(data => {
        if (!active) return
        setIronQuest(data)
        setIronQuestError('')
        applyBrand(data?.profile?.enabled ? 'nat20' : 'johnny5k')
        setExperienceMode('standard')
      })
      .catch(err => {
        if (!active) return
        setIronQuestError(err?.message || 'Could not load Nat20 Fitness.')
      })
      .finally(() => {
        if (active) setIronQuestLoading(false)
      })

    return () => { active = false }
  }, [setExperienceMode])

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

    aiApi.getMemory()
      .then(data => {
        if (!active) return
        const bullets = Array.isArray(data.durable_memory?.bullets) ? data.durable_memory.bullets : []
        setJohnnyMemory(bullets)
        setJohnnyMemoryDraft(bullets.length ? bullets : [''])
      })
      .catch(err => {
        if (active) setJohnnyError(err.message)
      })

    return () => { active = false }
  }, [setNotificationPrefs])

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
          pushApi.subscribe(serializedSubscription).catch(error => {
            reportClientDiagnostic({
              source: 'settings_push_subscription_refresh',
              message: 'Push subscription refresh failed while loading settings.',
              error,
              context: {
                section: 'push_notifications',
              },
            })
          })
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
        setNotificationPrefs({
          pushSupported: support.supported,
          pushConfigured: Boolean(config?.enabled && config?.configured),
          pushSubscribed: Boolean(subscription),
          ...(subscription ? { pushPromptStatus: 'accepted' } : {}),
        })
      })
      .catch(err => {
        if (active) setPushError(err.message)
      })

    return () => { active = false }
  }, [setNotificationPrefs])

  useEffect(() => {
    loadSnapshot()
    bodyApi.getWeight(7)
      .then(rows => setWeeklyWeights(Array.isArray(rows) ? rows.slice(0, 7).reverse() : []))
      .catch(error => {
        reportClientDiagnostic({
          source: 'settings_weekly_weights_load',
          message: 'Weekly weight history failed to load in settings.',
          error,
          context: {
            screen: 'settings',
          },
        })
      })
  }, [loadSnapshot])

  useEffect(() => {
    if (location.state?.focusSection !== 'pushNotifications') {
      return
    }

    setShowPushRefusalChoice(Boolean(location.state?.revealPushRefusal))
    if (!accordionSections.notifications) {
      setAccordionSections(current => {
        if (current.notifications) {
          return current
        }

        return {
          ...writeStoredProfileAccordionSections(accordionStorageKey, {
            ...current,
            notifications: true,
          }),
        }
      })
      return
    }

    const nextState = { ...(location.state ?? {}) }
    delete nextState.focusSection
    delete nextState.revealPushRefusal
    delete nextState.johnnyActionNotice

    let frameOne = 0
    let frameTwo = 0

    frameOne = requestAnimationFrame(() => {
      frameTwo = requestAnimationFrame(() => {
        pushPanelRef.current?.scrollIntoView({ behavior: SCROLL_BEHAVIOR, block: 'start' })
        pushEnableButtonRef.current?.focus()
        navigate(location.pathname, {
          replace: true,
          state: Object.keys(nextState).length ? nextState : null,
        })
      })
    })

    return () => {
      if (frameOne) cancelAnimationFrame(frameOne)
      if (frameTwo) cancelAnimationFrame(frameTwo)
    }
  }, [accordionSections.notifications, accordionStorageKey, location.pathname, location.state, navigate])

  function updateLiveVoicePref(field, value) {
    setLiveVoicePrefs(current => ({
      ...current,
      ...(field === 'autoSpeak'
        ? { liveModeVoiceMode: value ? (current.liveModeVoiceMode === 'mute' ? 'premium' : current.liveModeVoiceMode) : 'mute' }
        : null),
      [field]: value,
    }))
  }

  async function previewLiveVoice() {
    if (!speechPlaybackSupported) return
    if (voicePreviewBusy) return

    setVoicePreviewError('')
    setVoicePreviewBusy(true)
    try {
      const previewText = 'Live workout check. Keep the next set sharp and stay inside the rest window.'
      const nativeResult = await speakNativeJohnnyAnnouncement({
        text: previewText,
        utteranceId: 'settings-live-voice-preview',
        voicePrefs: liveVoicePrefs,
      })
      if (nativeResult.started) {
        return
      }

      const audioBlob = await aiApi.speech(previewText, {
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

  async function persist() {
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
        rest_between_sets_min_seconds: normalizePositiveInt(form.rest_between_sets_min_seconds, 30),
        rest_between_sets_max_seconds: normalizeRangeMax(form.rest_between_sets_max_seconds, form.rest_between_sets_min_seconds, 60),
        rest_between_exercises_min_seconds: normalizePositiveInt(form.rest_between_exercises_min_seconds, 60),
        rest_between_exercises_max_seconds: normalizeRangeMax(form.rest_between_exercises_max_seconds, form.rest_between_exercises_min_seconds, 120),
        phone: normalizePhoneNumber(form.phone),
      })

      await onboardingApi.savePrefs({
        target_steps: form.target_steps,
        target_sleep_hours: form.target_sleep_hours,
        notifications_enabled: form.notifications_enabled,
        exercise_preferences_json: {
          ...withoutRetiredColorScheme(form.preference_meta),
          add_exercise_calories_to_target: form.add_exercise_calories_to_target,
          workout_reminder_enabled: form.workout_reminder_enabled,
          workout_reminder_hour: Number(form.workout_reminder_hour),
          meal_reminder_enabled: form.meal_reminder_enabled,
          meal_reminder_hour: Number(form.meal_reminder_hour),
          sleep_reminder_enabled: form.sleep_reminder_enabled,
          sleep_reminder_hour: Number(form.sleep_reminder_hour),
          weekly_summary_enabled: form.weekly_summary_enabled,
          weekly_summary_hour: Number(form.weekly_summary_hour),
          push_prompt_status: normalizePushPromptStatus(form.push_prompt_status),
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

      const data = await onboardingApi.recalculate()
      const nextTargets = normalizeTargets(data)
      setTargets(nextTargets)
      setMessage('Profile saved and daily targets recalculated.')
      navigate('/dashboard', { state: { targetsUpdated: nextTargets } })

      const state = await onboardingApi.getState()
      const nextPreferenceMeta = state?.prefs?.exercise_preferences_json ?? {}
      setPreferenceMeta(nextPreferenceMeta)
      setForm(current => ({
        ...current,
        preference_meta: nextPreferenceMeta,
      }))
      setMissingFields(formatMissingFields(state.missing_profile_fields))
      setHeadshot(state?.headshot ?? { configured: false })
      invalidate()
      await loadSnapshot(true)
      if (nextEnabled) navigate('/nat20/setup')
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

  async function restartOnboarding() {
    if (saving) return
    const confirmed = await confirmGlobalAction({
      title: 'Restart onboarding?',
      message: 'Your saved profile data will stay in place, but you will be sent back through the setup flow.',
      confirmLabel: 'Restart onboarding',
    })
    if (!confirmed) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      await onboardingApi.restart()
      setAuth({ onboarding_complete: false })
      openDrawer()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function handleToggleIronQuestMode(nextEnabled) {
    if (ironQuestSubmitting || ironQuestResetting) return

    setIronQuestSubmitting(true)
    setIronQuestError('')

    try {
      const data = nextEnabled
        ? await ironquestApi.enable()
        : await ironquestApi.disable()
      applyBrand(nextEnabled ? 'nat20' : 'johnny5k')
      setExperienceMode('standard')

      setIronQuest(current => ({
        ...(current || {}),
        entitlement: current?.entitlement || { has_access: true },
        profile: data?.profile ?? current?.profile ?? {},
      }))
      invalidate()
      await loadSnapshot(true)
    } catch (err) {
      setIronQuestError(err?.message || 'Could not update Nat20 Fitness.')
    } finally {
      setIronQuestSubmitting(false)
    }
  }

  async function handleRestartIronQuestOnboarding() {
    if (ironQuestSubmitting || ironQuestResetting) return

    const confirmed = await confirmGlobalAction({
      title: 'Reset your Nat20 character?',
      message: 'This clears your Nat20 character class, motivation, and starter portrait and turns Nat20 off. Quest progression like XP, gold, and unlocked regions stays intact.',
      confirmLabel: 'Reset Nat20 character',
      tone: 'danger',
    })
    if (!confirmed) return

    setIronQuestResetting(true)
    setIronQuestError('')

    try {
      const data = await ironquestApi.restartOnboarding()
      applyBrand('johnny5k')
      setExperienceMode('standard')
      setIronQuest(current => ({
        ...(current || {}),
        entitlement: current?.entitlement || { has_access: true },
        profile: data?.profile ?? current?.profile ?? {},
      }))
      invalidate()
      await loadSnapshot(true)
    } catch (err) {
      setIronQuestError(err?.message || 'Could not restart Nat20 Fitness setup.')
    } finally {
      setIronQuestResetting(false)
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
      setJohnnyMessage('Johnny memory updated.')
    } catch (err) {
      setJohnnyError(err.message)
    } finally {
      setSavingJohnnyMemory(false)
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
      await savePushPreferenceMetaPatch({
        push_enabled: true,
        push_prompt_status: 'accepted',
        push_prompt_snoozed_until: '',
      }, {
        push_enabled: true,
        push_prompt_status: 'accepted',
      })
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
      setNotificationPrefs({
        pushPromptStatus: 'accepted',
        pushSubscribed: true,
      })
      setShowPushRefusalChoice(false)
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
      await savePushPreferenceMetaPatch({
        push_prompt_status: 'pending',
      }, {
        push_prompt_status: 'pending',
      })
      setPushStatus(current => ({
        ...current,
        permission: getNotificationPermission(),
        subscribed: false,
        activeCount: Number(subscriptionsResponse?.active_count ?? 0),
      }))
      setNotificationPrefs({
        pushPromptStatus: 'pending',
        pushSubscribed: false,
      })
      setPushMessage('Browser notifications disabled on this device.')
    } catch (err) {
      setPushError(err.message || 'Could not disable browser notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  async function handleRefusePush() {
    if (pushBusy) return

    setPushBusy(true)
    setPushError('')
    setPushMessage('')

    try {
      const subscription = await getCurrentPushSubscription().catch(() => null)
      if (subscription) {
        const payload = serializeSubscription(subscription)
        if (payload?.endpoint) {
          await pushApi.unsubscribe({ endpoint: payload.endpoint }).catch(error => {
            reportClientDiagnostic({
              source: 'settings_push_refusal_unsubscribe_remote',
              message: 'Remote push unsubscribe failed while refusing push notifications.',
              error,
              context: {
                section: 'push_notifications',
                endpoint: payload.endpoint,
              },
            })
          })
        }
        await subscription.unsubscribe().catch(error => {
          reportClientDiagnostic({
            source: 'settings_push_refusal_unsubscribe_local',
            message: 'Browser push unsubscribe failed while refusing push notifications.',
            error,
            context: {
              section: 'push_notifications',
            },
          })
        })
      }

      await savePushPreferenceMetaPatch({
        push_enabled: false,
        push_prompt_status: 'refused',
      }, {
        notifications_enabled: true,
        push_enabled: false,
        push_prompt_status: 'refused',
      })

      const subscriptionsResponse = await pushApi.subscriptions().catch(() => ({ active_count: 0 }))
      setPushStatus(current => ({
        ...current,
        permission: getNotificationPermission(),
        subscribed: false,
        activeCount: Number(subscriptionsResponse?.active_count ?? 0),
      }))
      setNotificationPrefs({
        pushPromptStatus: 'refused',
        pushSubscribed: false,
      })
      setPushMessage('Push notifications refused. Johnny will use SMS when available, then fall back to the drawer if SMS is also off.')
      setShowPushRefusalChoice(false)
    } catch (err) {
      setPushError(err.message || 'Could not switch push reminders to SMS only.')
    } finally {
      setPushBusy(false)
    }
  }

  async function handleSnoozePushPrompt() {
    if (pushBusy || pushStatus.subscribed) return

    setPushBusy(true)
    setPushError('')
    setPushMessage('')

    try {
      await savePushPreferenceMetaPatch({
        push_prompt_snoozed_until: buildPushPromptSnoozedUntil(),
      })
      setShowPushRefusalChoice(false)
      setPushMessage(`Push prompts hidden for ${PUSH_PROMPT_SNOOZE_DAYS} days. Johnny will ask again later if push is still off.`)
    } catch (err) {
      setPushError(err.message || 'Could not hide push prompts right now.')
    } finally {
      setPushBusy(false)
    }
  }

  async function savePushPreferenceMetaPatch(preferencePatch, formPatch = {}) {
    const nextPreferenceMeta = {
      ...(form.preference_meta ?? {}),
      ...(preferencePatch ?? {}),
    }
    const nextPushPromptStatus = Object.prototype.hasOwnProperty.call(preferencePatch ?? {}, 'push_prompt_status')
      ? normalizePushPromptStatus(preferencePatch.push_prompt_status)
      : form.push_prompt_status

    await onboardingApi.savePrefs({
      notifications_enabled: Object.prototype.hasOwnProperty.call(formPatch, 'notifications_enabled')
        ? formPatch.notifications_enabled
        : form.notifications_enabled,
      exercise_preferences_json: nextPreferenceMeta,
    })

    setForm(current => ({
      ...current,
      ...formPatch,
      push_prompt_status: nextPushPromptStatus,
      preference_meta: nextPreferenceMeta,
    }))
    setPreferenceMeta(nextPreferenceMeta)

    setNotificationPrefs({
      pushPromptStatus: nextPushPromptStatus,
    })
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
  function handleOpenSettingsSupport() {
    openSupportGuide(openDrawer, {
      screen: 'settings',
      surface: 'settings_profile',
      guideId: 'update-profile',
      prompt: 'Show me where to update my profile, defaults, reminders, or Johnny settings and walk me to the right section.',
    })
  }

  if (loading) {
    return (
      <AppLoadingScreen
        eyebrow="Profile"
        title="Loading your settings"
        message="Johnny is pulling your profile, reminders, targets, and coaching defaults so the sections open fully populated."
        variant="panel"
      />
    )
  }

  return (
    <div className="screen settings-screen johnny-profile-screen">
      <header className="screen-header support-icon-anchor johnny-profile-header">
        <SupportIconButton label="Get help with profile settings" onClick={handleOpenSettingsSupport} />
        <div className="johnny-profile-header-main">
          <div className="johnny-profile-monogram" aria-hidden="true">{buildProfileInitials(form.first_name, form.last_name)}</div>
          <div className="johnny-profile-header-copy">
            <span>Johnny profile</span>
            <h1>{form.first_name ? `${form.first_name}’s profile` : 'Your profile'}</h1>
            <p>Identity, trajectory, and the daily signals Johnny uses to coach you.</p>
          </div>
        </div>
        <div className="johnny-profile-status" aria-label="Profile status">
          <span><i /> Profile active</span>
          <strong>{buildProfileGoalHeadline(form.current_goal, form.goal_rate)}</strong>
        </div>
      </header>

      <div className="settings-accordion-stack">
        <SettingsAccordionSection
          sectionKey="overview"
          eyebrow="At a glance"
          title="Overview"
          description="Goal snapshot and current targets."
          itemCountLabel="1 card"
          open={accordionSections.overview}
          onToggle={toggleAccordionSection}
        >
          <section className="dash-card settings-identity-card">
            <div className="settings-identity-main">
              <div className="settings-identity-copy">
                <span className="dashboard-chip ai">Identity</span>
                <h2>{buildProfileGoalHeadline(form.current_goal, form.goal_rate)}</h2>
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
            </div>
          </section>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          sectionKey="personal"
          eyebrow="Profile"
          title="Personal Info"
          description="Identity, body stats, and the goal inputs Johnny uses as your baseline."
          itemCountLabel="2 cards"
          open={accordionSections.personal}
          onToggle={toggleAccordionSection}
        >
          <section className="settings-section dash-card">
            <h3>About You</h3>
            <div className="settings-grid">
              <Field className="settings-field" label="First Name"><ClearableInput value={form.first_name} onChange={e => update('first_name', e.target.value)} /></Field>
              <Field className="settings-field" label="Last Name"><ClearableInput value={form.last_name} onChange={e => update('last_name', e.target.value)} /></Field>
              <Field className="settings-field" label="Date of Birth"><input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} /></Field>
              <Field className="settings-field" label="Sex">
                <select value={form.sex} onChange={e => update('sex', e.target.value)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field className="settings-field" label="Height (ft)"><input type="number" min="4" max="7" value={form.height_ft} onChange={e => update('height_ft', e.target.value)} /></Field>
              <Field className="settings-field" label="Height (in)"><input type="number" min="0" max="11" value={form.height_in_part} onChange={e => update('height_in_part', e.target.value)} /></Field>
              <Field className="settings-field settings-field-span-2" hint="Pick a region first, then your saved timezone." label="Timezone">
                <div className="timezone-picker">
                  <Field className="settings-subfield" compact label="Region">
                    <select value={timezoneRegion} onChange={e => {
                      const nextRegion = e.target.value
                      const nextZones = getTimezonesForRegion(nextRegion)
                      setTimezoneRegion(nextRegion)
                      update('timezone', nextZones.includes(form.timezone) ? form.timezone : nextZones[0] || form.timezone)
                    }}>
                      {TIMEZONE_REGIONS.map(region => <option key={region} value={region}>{region}</option>)}
                    </select>
                  </Field>
                  <Field className="settings-subfield" compact label="Timezone">
                    <select value={form.timezone} onChange={e => update('timezone', e.target.value)}>
                      {regionTimezones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                    </select>
                  </Field>
                </div>
              </Field>
            </div>
          </section>

          <section className="settings-section dash-card">
            <h3>Body & Goal</h3>
            <div className="settings-grid">
              <Field className="settings-field" label="Current Weight"><div className="settings-input-suffix"><input type="number" min="80" max="600" step="0.1" value={form.starting_weight_lb} onChange={e => update('starting_weight_lb', e.target.value)} /><span>lbs</span></div></Field>
              <Field className="settings-field" label="Goal">
                <select value={form.current_goal} onChange={e => update('current_goal', e.target.value)}>
                  <option value="cut">Cut</option>
                  <option value="gain">Gain</option>
                  <option value="recomp">Recomp</option>
                  <option value="maintain">Maintain</option>
                </select>
              </Field>
              <Field className="settings-field" label="Goal Pace">
                <select value={form.goal_rate} onChange={e => update('goal_rate', e.target.value)}>
                  <option value="slow">Slow</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </Field>
              <Field className="settings-field" label="Activity Level">
                <select value={form.activity_level} onChange={e => update('activity_level', e.target.value)}>
                  <option value="sedentary">Sedentary</option>
                  <option value="light">Light</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">Active</option>
                  <option value="athlete">Athlete</option>
                </select>
              </Field>
            </div>
          </section>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          sectionKey="targets"
          eyebrow="Daily goals"
          title="Targets"
          description="Step, sleep, and macro targets, plus the calorie logic Johnny uses each day."
          itemCountLabel="2 cards"
          open={accordionSections.targets}
          onToggle={toggleAccordionSection}
        >
          <section className="settings-section dash-card">
            <h3>Daily Targets</h3>
            <div className="settings-grid">
              <Field className="settings-field" label="Steps"><input type="number" min="1000" max="30000" step="1" value={form.target_steps} onChange={e => update('target_steps', Number(e.target.value))} /></Field>
              <Field className="settings-field" label="Sleep (hours)"><input type="number" min="4" max="12" step="0.5" value={form.target_sleep_hours} onChange={e => update('target_sleep_hours', Number(e.target.value))} /></Field>
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
        </SettingsAccordionSection>

        <SettingsAccordionSection
          sectionKey="notifications"
          eyebrow="Reach me"
          title="Notifications & Reminders"
          description="Browser notifications and reminder schedules for how Johnny reaches you."
          itemCountLabel="2 cards"
          open={accordionSections.notifications}
          onToggle={toggleAccordionSection}
        >
          <section className="settings-section dash-card settings-reminders-panel">
            <div ref={pushPanelRef} className="settings-push-anchor" aria-hidden="true" />
            <div className="switch-copy">
              <span className="settings-field-label">Browser notifications</span>
              <span className="settings-field-hint">Enable push on this device if you want Johnny to reach you faster than SMS or the drawer.</span>
            </div>
            <div className="settings-ai-actions">
              {pushStatus.supported && pushStatus.subscribed ? (
                <button type="button" className="btn-outline small" onClick={handleDisablePush} disabled={pushBusy}>
                  {pushBusy ? 'Updating…' : 'Disable on this device'}
                </button>
              ) : (
                <button
                  ref={pushEnableButtonRef}
                  type="button"
                  className="btn-secondary small"
                  onClick={handleEnablePush}
                  disabled={pushBusy || !pushStatus.supported || !pushStatus.enabled || !pushStatus.configured}
                >
                  {pushBusy ? 'Updating…' : 'Enable browser notifications'}
                </button>
              )}
              {!pushStatus.subscribed ? (
                <button type="button" className="btn-outline small" onClick={handleSnoozePushPrompt} disabled={pushBusy}>
                  {pushBusy ? 'Updating…' : `Hide ${PUSH_PROMPT_SNOOZE_DAYS} days`}
                </button>
              ) : null}
            </div>
            <p className="settings-field-hint">
              {pushStatus.supported
                ? (pushStatus.subscribed ? 'Enabled on this device.' : `Permission: ${pushStatus.permission}.`)
                : pushStatus.supportReason}
            </p>
            {!pushStatus.subscribed && isPushPromptSnoozed(form.preference_meta) ? (
              <p className="settings-field-hint">
                Push prompts are hidden until {new Date(form.preference_meta.push_prompt_snoozed_until).toLocaleDateString()} unless you enable push sooner.
              </p>
            ) : null}
            <p className="settings-field-hint">
              {pushStatus.enabled && pushStatus.configured
                ? `${pushStatus.activeCount} active notification device${pushStatus.activeCount === 1 ? '' : 's'} on your account.`
                : 'Johnny push is not configured yet by the admin.'}
            </p>
            {showPushRefusalChoice && !pushStatus.subscribed ? (
              <div className="settings-push-refusal">
                <p>If you do not want push on this device, Johnny can switch these reminders to SMS only instead.</p>
                <button type="button" className="btn-outline small" onClick={handleRefusePush} disabled={pushBusy}>
                  {pushBusy ? 'Updating…' : 'Refuse push and use SMS only'}
                </button>
              </div>
            ) : null}
            {pushError ? <ErrorState className="settings-inline-error" message={pushError} title="Could not update push settings" /> : null}
            {pushMessage ? <p className="success-message">{pushMessage}</p> : null}
          </section>

          <section className="settings-section dash-card">
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
                      <strong>Meal logging nudges</strong>
                      <p>Johnny checks breakfast at 10am, lunch at 2pm, and dinner at 7pm in your saved timezone.</p>
                    </div>
                    <label className="switch-control switch-control-compact">
                      <input className="switch-input" type="checkbox" checked={form.meal_reminder_enabled} onChange={e => update('meal_reminder_enabled', e.target.checked)} />
                      <span className="switch-track" aria-hidden="true" />
                    </label>
                  </div>
                  <p className="settings-field-hint">Push fires first. If you refuse push, Johnny switches these nudges to SMS. If both are off, only the latest nudge waits in the drawer for next open.</p>
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
            </section>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          sectionKey="johnny"
          eyebrow="Johnny"
          title="Johnny"
          description="Personality, coaching memory, and advanced proactive delivery controls."
          itemCountLabel="4 cards"
          open={accordionSections.johnny}
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
                    <ClearableInput
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
              {johnnyError ? <ErrorState className="settings-inline-error" message={johnnyError} title="Could not save Johnny memory" /> : null}
              {johnnyMessage ? <p className="success-message">{johnnyMessage}</p> : null}
              {!johnnyError && johnnyMemory.length > 0 ? <p className="settings-ai-note">Saved {johnnyMemory.length} long-term coaching notes.</p> : null}
            </div>

          </section>

          <section className="settings-section dash-card settings-ai-card settings-personality-panel">
            <div className="settings-ai-head">
              <div>
                <span className="dashboard-chip ai">Johnny's voice</span>
                <h3>Personality</h3>
              </div>
            </div>
            <p className="settings-subtitle">Tune how Johnny talks to you. These carry across chat and texts, not just this screen.</p>
            <div className="settings-grid">
              <Field className="settings-field" label="Your age range">
                <select value={form.preference_meta?.personality_age_range || ''} onChange={e => updatePersonality('personality_age_range', e.target.value)}>
                  <option value="">Let Johnny decide</option>
                  <option value="early_20s">Early 20s</option>
                  <option value="late_20s">Late 20s</option>
                  <option value="30s">30s</option>
                  <option value="40s">40s</option>
                  <option value="50s">50s</option>
                </select>
              </Field>
              <Field className="settings-field" label="Coaching intensity">
                <select value={form.preference_meta?.personality_aggressiveness || ''} onChange={e => updatePersonality('personality_aggressiveness', e.target.value)}>
                  <option value="">Balanced (default)</option>
                  <option value="gentle">Gentle</option>
                  <option value="balanced">Balanced</option>
                  <option value="intense">Intense</option>
                  <option value="drill_sergeant">Drill sergeant</option>
                </select>
              </Field>
              <Field className="settings-field" label="Humor">
                <select value={form.preference_meta?.personality_humor_level || ''} onChange={e => updatePersonality('personality_humor_level', e.target.value)}>
                  <option value="">Balanced (default)</option>
                  <option value="serious">Serious</option>
                  <option value="light">Light</option>
                  <option value="playful">Playful</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="settings-section dash-card settings-reminders-panel">
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
          </section>

          <section className="settings-section dash-card settings-reminders-panel">
            <div className="switch-copy">
              <span className="settings-field-label">Push diagnostics</span>
              <span className="settings-field-hint">This is the current delivery state Johnny sees for your account.</span>
            </div>
            <div className="settings-diagnostics-grid">
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
          </section>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          sectionKey="images"
          eyebrow="Photos"
          title="Photo"
          description="Upload the headshot Johnny uses as a private likeness reference."
          itemCountLabel="1 workspace"
          open={accordionSections.images}
          onToggle={toggleAccordionSection}
        >
          <section className="settings-section dash-card settings-headshot-section">
            <div className="settings-headshot-head">
              <div>
                <h3>Your Headshot</h3>
                <p className="settings-subtitle">Upload a clear face photo. Johnny can use it as a private likeness reference when you explicitly ask him to create a realistic image of you.</p>
              </div>
              <div className="settings-headshot-actions">
                <label className="btn-secondary settings-upload-trigger">
                  <input type="file" accept="image/*" onChange={handleHeadshotUpload} disabled={headshotUploading} />
                  {headshotUploading ? 'Uploading…' : headshot?.configured ? 'Replace Headshot' : 'Upload Headshot'}
                </label>
                {headshot?.configured ? (
                  <button type="button" className="btn-outline small" onClick={handleHeadshotDelete} disabled={headshotUploading}>
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
                {headshotError ? <ErrorState className="settings-inline-error" message={headshotError} title="Could not update your headshot" /> : null}
                {headshotMessage ? <p className="success-message">{headshotMessage}</p> : null}
              </div>
            </div>
          </section>
        </SettingsAccordionSection>

        <SettingsAccordionSection
          sectionKey="trainingApp"
          eyebrow="Training and app"
          title="Training & App"
          description="Color palette, weekly split order, and quick access to your exercise library."
          itemCountLabel="4 cards"
          open={accordionSections.trainingApp}
          onToggle={toggleAccordionSection}
        >
          <section className="settings-section dash-card">
            <h3>Nat20 Fitness</h3>
            <p className="settings-subtitle">Activate the fantasy fitness experience while keeping the same account, health data, and training history.</p>
            {ironQuestLoading ? (
              <p className="settings-subtitle">Loading Nat20 Fitness…</p>
            ) : ironQuest?.entitlement && !ironQuest.entitlement.has_access ? (
              <p className="settings-subtitle">Nat20 Fitness is not available for this account yet.</p>
            ) : (
              <>
                <div className="onboarding-review-list">
                  <div className="onboarding-review-row"><span>Current experience</span><strong>{ironQuest?.profile?.enabled ? 'Nat20 Fitness' : 'Johnny5k'}</strong></div>
                  <div className="onboarding-review-row"><span>Character</span><strong>{ironQuest?.profile?.class_slug && ironQuest?.profile?.motivation_slug ? 'Ready to adventure' : 'Needs setup'}</strong></div>
                </div>
                <div className="settings-actions">
                  {ironQuest?.profile?.enabled ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleToggleIronQuestMode(false)}
                      disabled={ironQuestSubmitting || ironQuestResetting}
                    >
                      {ironQuestSubmitting ? 'Deactivating…' : 'Deactivate Nat20 Fitness'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleToggleIronQuestMode(true)}
                      disabled={ironQuestSubmitting || ironQuestResetting}
                    >
                      {ironQuestSubmitting ? 'Activating…' : 'Activate Nat20 Fitness'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => void handleRestartIronQuestOnboarding()}
                    disabled={ironQuestSubmitting || ironQuestResetting}
                  >
                    {ironQuestResetting ? 'Resetting…' : 'Reset Nat20 character'}
                  </button>
                </div>
                <p className="settings-subtitle">
                  {ironQuest?.profile?.enabled
                    ? 'Your Nat20 experience is active. The new interface will use your existing workout, nutrition, and progress data.'
                    : 'Activate Nat20 when you are ready to turn your fitness plan into an adventure.'}
                </p>
              </>
            )}
            {ironQuestError ? <ErrorState className="settings-inline-error" message={ironQuestError} title="Could not update Nat20 Fitness" /> : null}
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
        </SettingsAccordionSection>
      </div>

      <section className="settings-section dash-card settings-onboarding-section">
        <h3>Restart Onboarding</h3>
        <p className="settings-subtitle">Run through the guided setup again if you want to update your training background, equipment, food preferences, or recovery defaults step by step.</p>
        <div className="settings-actions settings-actions-single">
          <button className="btn-secondary" onClick={restartOnboarding} disabled={saving}>
            {saving ? 'Working…' : 'Restart Onboarding'}
          </button>
        </div>
      </section>

      <div className="settings-actions settings-actions-stack">
        <button className="btn-primary" onClick={() => persist()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
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

function buildProfileInitials(firstName, lastName) {
  const initials = [firstName, lastName].map(value => String(value || '').trim().charAt(0)).filter(Boolean).join('')
  return initials.toUpperCase() || 'J5'
}

function buildProfileAccordionStorageKey(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  return `${PROFILE_ACCORDION_STORAGE_KEY_PREFIX}.${normalizedEmail || 'guest'}`
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(900, Math.max(5, parsed))
}

function normalizeRangeMax(value, minValue, fallback) {
  const nextMin = normalizePositiveInt(minValue, fallback)
  const parsed = normalizePositiveInt(value, fallback)
  return Math.max(nextMin, parsed)
}

function formatExerciseRestMinutes(value) {
  const seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return 1
  const minutes = seconds / 60
  return Number.isInteger(minutes) ? minutes : minutes.toFixed(1)
}

function normalizeProfileAccordionSections(value) {
  const payload = value && typeof value === 'object' ? value : {}

  return Object.fromEntries(
    Object.keys(PROFILE_ACCORDION_DEFAULTS).map(sectionKey => [
      sectionKey,
      typeof payload[sectionKey] === 'boolean' ? payload[sectionKey] : PROFILE_ACCORDION_DEFAULTS[sectionKey],
    ])
  )
}

function readStoredProfileAccordionSections(storageKey) {
  if (typeof window === 'undefined' || !storageKey) {
    return { ...PROFILE_ACCORDION_DEFAULTS }
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey)
    if (!rawValue) {
      return { ...PROFILE_ACCORDION_DEFAULTS }
    }

    return normalizeProfileAccordionSections(JSON.parse(rawValue))
  } catch {
    return { ...PROFILE_ACCORDION_DEFAULTS }
  }
}

function writeStoredProfileAccordionSections(storageKey, value) {
  const normalizedValue = normalizeProfileAccordionSections(value)

  if (typeof window === 'undefined' || !storageKey) {
    return normalizedValue
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(normalizedValue))
  } catch {
    return normalizedValue
  }

  return normalizedValue
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

function formatWeightDelta(delta) {
  if (delta == null) return 'No trend yet'
  if (delta === 0) return 'Flat this week'
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} lbs`
}
