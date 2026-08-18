import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi } from '../../api/modules/ai'
import { bodyApi } from '../../api/modules/body'
import { dashboardApi } from '../../api/modules/dashboard'
import { onboardingApi } from '../../api/modules/onboarding'
import { workoutApi } from '../../api/modules/workout'
import { renderChatMessageBlocks } from '../../components/ai/chatMessageFormatter'
import RecipeGallery from '../../components/ai/RecipeGallery'
import GroceryGapCard from '../../components/ai/GroceryGapCard'
import DailyBriefingView from '../../components/checkin/DailyBriefingView'
import DailyCheckInModal from '../../components/checkin/DailyCheckInModal'
import JohnnyDailyCheckInModal from '../../components/checkin/JohnnyDailyCheckInModal'
import JohnnyNutritionLogModal from '../../components/checkin/JohnnyNutritionLogModal'
import JohnnyProfileModal from '../../components/checkin/JohnnyProfileModal'
import AppDialog from '../../components/ui/AppDialog'
import { getAppImageUrl } from '../../lib/appImages'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import { formatUsChartDate } from '../../lib/dateFormat'
import { createDailyCheckInAnswers } from '../../lib/dailyCheckIn'
import { useAuthStore } from '../../store/authStore'
import { useWorkoutStore } from '../../store/workoutStore'

const THREAD_KEY = 'main'
const DEFAULT_ACCENT_COLOR = 'default'
const ACCENT_PRESETS = {
  default: { label: 'Default', rgb: '79,195,224' },
  green: { label: 'Green', rgb: '95,217,160' },
  violet: { label: 'Violet', rgb: '155,127,224' },
  rose: { label: 'Rose', rgb: '226,127,158' },
  amber: { label: 'Amber', rgb: '227,150,64' },
}
function resolveAccentRgb(color) {
  return ACCENT_PRESETS[color]?.rgb || ACCENT_PRESETS[DEFAULT_ACCENT_COLOR].rgb
}
const COLOR_DANCE_STEP_MS = 420
const COLOR_DANCE_SEQUENCE = ['green', 'violet', 'rose', 'amber', 'green', 'violet', 'rose', 'amber', DEFAULT_ACCENT_COLOR]
const WORKOUT_ACTIVITY_PATTERN = /\b(workout|training|exercise|circuit|cardio|rest day)\b/i
const TRANSIENT_MOOD_RESET_MS = { celebrating: 2800, concerned: 2800, proud: 3600, surprised: 1400 }
const FIRE_MODE_ACTIVE_MS = 3800
const FIRE_MODE_EXIT_MS = 600
const FIRE_EMBERS = Array.from({ length: 14 }, (_, index) => ({
  left: 4 + (index * 92) / 13,
  delay: (index % 7) * 0.35,
  duration: 2.2 + (index % 5) * 0.3,
  drift: (index % 2 === 0 ? 1 : -1) * (10 + (index % 4) * 6),
}))
const CONFETTI_ACTIVE_MS = 1500
const CONFETTI_EXIT_MS = 500
const CONFETTI_COLORS = ['79,195,224', '95,217,160', '155,127,224', '226,127,158', '227,150,64', '232,203,76']
const CONFETTI_PIECES = Array.from({ length: 30 }, (_, index) => ({
  left: (index * 97) % 100,
  delay: (index % 10) * 0.09,
  duration: 1.3 + (index % 6) * 0.15,
  rotate: (index % 2 === 0 ? 1 : -1) * (180 + (index % 5) * 40),
  colorRgb: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  drift: (index % 2 === 0 ? 1 : -1) * (20 + (index % 7) * 8),
}))

export default function JohnnyHomeScreen() {
  const navigate = useNavigate()
  const email = useAuthStore(state => state.email)
  const appImages = useAuthStore(state => state.appImages)
  const customWorkoutDraft = useWorkoutStore(state => state.customWorkoutDraft)
  const workoutApproval = useWorkoutStore(state => state.workoutApproval)
  const session = useWorkoutStore(state => state.session)
  const bootstrapSession = useWorkoutStore(state => state.bootstrapSession)
  const clearCustomWorkoutDraft = useWorkoutStore(state => state.clearCustomWorkoutDraft)
  const takeRestDay = useWorkoutStore(state => state.takeRestDay)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialising, setInitialising] = useState(true)
  const [status, setStatus] = useState('')
  const [activityLabel, setActivityLabel] = useState('loading your conversation')
  const [brandMood, setBrandMood] = useState('ready')
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR)
  const [streaks, setStreaks] = useState(null)
  const [greetingTail] = useState(() => pickRandomPhrase(GREETING_TAIL_PHRASES))
  const [briefTail] = useState(() => pickRandomPhrase(BRIEF_TAIL_PHRASES))
  const colorDanceTimeoutsRef = useRef([])
  const [fireMode, setFireMode] = useState('idle')
  const fireModeTimeoutsRef = useRef([])
  const [confettiMode, setConfettiMode] = useState('idle')
  const confettiTimeoutsRef = useRef([])
  const [helpfulSuggestion, setHelpfulSuggestion] = useState(null)
  const [suggestionPhase, setSuggestionPhase] = useState('idle')
  const [dailyBrief, setDailyBrief] = useState(null)
  const [streakCount, setStreakCount] = useState(0)
  const [dailyCheckInOpen, setDailyCheckInOpen] = useState(false)
  const [dailyBriefingOpen, setDailyBriefingOpen] = useState(false)
  const [dailyCheckInAnswers, setDailyCheckInAnswers] = useState(() => createDailyCheckInAnswers())
  const [nutritionLogOpen, setNutritionLogOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [clearingChat, setClearingChat] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcribingVoice, setTranscribingVoice] = useState(false)
  const [primaryDockHeight, setPrimaryDockHeight] = useState(220)
  const feedRef = useRef(null)
  const primaryDockRef = useRef(null)
  const messageInputRef = useRef(null)
  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioChunksRef = useRef([])
  const hasPositionedInitialThreadRef = useRef(false)
  const suggestionRequestRef = useRef(false)
  const lastSuggestionCheckRef = useRef(Date.now())
  const suggestionSuppressedRef = useRef(true)

  const userName = useMemo(() => {
    const localPart = String(email || '').split('@')[0]
    return localPart ? localPart.split(/[._-]/)[0] : 'there'
  }, [email])

  const workout = useMemo(() => normalizeWorkout(customWorkoutDraft, session), [customWorkoutDraft, session])
  const headlineStreak = useMemo(() => pickHeadlineStreak(streaks), [streaks])
  const brandmarkImage = getAppImageUrl(appImages, 'brandmark')
  const workoutMessageIndex = useMemo(() => findLatestWorkoutMessageIndex(messages), [messages])
  const decisionMessageIndex = useMemo(() => findLatestDecisionMessageIndex(messages), [messages])
  const generatedImageMessageIndex = useMemo(() => findLatestGeneratedImageMessageIndex(messages), [messages])
  const cardioFormMessageIndex = useMemo(() => findLatestCardioFormMessageIndex(messages), [messages])
  const [workoutApproved, setWorkoutApproved] = useState(false)
  const [workoutLogged, setWorkoutLogged] = useState(false)
  const [queuedWorkoutDismissed, setQueuedWorkoutDismissed] = useState(false)
  const [clearingQueuedWorkout, setClearingQueuedWorkout] = useState(false)
  const hasActiveWorkout = Boolean(session?.session?.id)
  const isWorkoutApproved = Boolean(workout?.id) && !queuedWorkoutDismissed && (
    hasActiveWorkout ||
    workoutApproved || String(workoutApproval?.workout_id || '') === String(workout.id)
  )
  const hasVisibleWorkoutForApproval = Boolean(workout) && workoutMessageIndex >= 0 && !queuedWorkoutDismissed && !isWorkoutApproved
  const recorderSupported = typeof window !== 'undefined' && Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia)
  const voiceSupported = recorderSupported || (typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition))

  useEffect(() => { setQueuedWorkoutDismissed(false) }, [workout?.id])

  const statusMood = status
    ? (/could not|couldn't|failed|unavailable|unexpected|stopped|needs a refresh/i.test(status) ? 'concerned' : 'celebrating')
    : ''
  const isWorkoutFocusedActivity = WORKOUT_ACTIVITY_PATTERN.test(activityLabel)
  const displayedBrandMood = initialising || loading || transcribingVoice
    ? (isWorkoutFocusedActivity ? 'focused' : 'thinking')
    : statusMood || brandMood

  useEffect(() => {
    const resetDelay = TRANSIENT_MOOD_RESET_MS[brandMood]
    if (!resetDelay) return undefined
    const timeoutId = window.setTimeout(() => setBrandMood('ready'), resetDelay)
    return () => window.clearTimeout(timeoutId)
  }, [brandMood])

  useEffect(() => {
    if (!helpfulSuggestion) return undefined
    const dismissId = window.setTimeout(() => setSuggestionPhase('exiting'), 60000)
    const clearId = window.setTimeout(() => {
      setHelpfulSuggestion(null)
      setSuggestionPhase('idle')
    }, 60650)
    return () => {
      window.clearTimeout(dismissId)
      window.clearTimeout(clearId)
    }
  }, [helpfulSuggestion])

  const openDailyCheckIn = useCallback(() => { setActivityLabel('daily check-in open'); setDailyCheckInOpen(true) }, [])
  const openDailyBriefing = useCallback(() => { setActivityLabel('daily briefing open'); setDailyCheckInOpen(true) }, [])
  const startDailyBriefing = useCallback(() => { setDailyCheckInOpen(false); setDailyBriefingOpen(true) }, [])
  const closeDailyBriefing = useCallback(() => { setDailyBriefingOpen(false); setActivityLabel('ready') }, [])
  const closeDailyCheckIn = useCallback(() => { setDailyCheckInOpen(false); setActivityLabel('ready') }, [])
  const openNutritionLog = useCallback(() => { setActivityLabel('nutrition log open'); setNutritionLogOpen(true) }, [])
  const closeNutritionLog = useCallback(() => { setNutritionLogOpen(false); setActivityLabel('ready') }, [])
  const openProgressDiary = useCallback(() => {
    setActivityLabel('opening progress diary')
    navigate('/body', {
      state: {
        focusTab: 'diary',
        johnnyActionNotice: 'Johnny opened Progress Diary so you can review your daily log, trends, meals, and photos together.',
      },
    })
  }, [navigate])
  const openProfile = useCallback(() => { setActivityLabel('profile open'); setProfileOpen(true) }, [])
  const closeProfile = useCallback(() => { setProfileOpen(false); setActivityLabel('ready') }, [])

  suggestionSuppressedRef.current = initialising || loading || dailyCheckInOpen || nutritionLogOpen || profileOpen

  const evaluateProactiveSuggestion = useCallback(async () => {
    if (suggestionRequestRef.current || suggestionSuppressedRef.current || document.visibilityState !== 'visible') return
    suggestionRequestRef.current = true
    try {
      const data = await aiApi.proactiveSuggestion()
      const suggestion = data?.suggestion
      if (!suggestion?.title || !['chat', 'daily_checkin', 'nutrition', 'progress_diary', 'open_screen'].includes(suggestion?.action_type)) return
      if (suggestion.action_type === 'open_screen' && !getProactiveSuggestionDestination(suggestion.screen)) return
      if (suggestion.action_type === 'chat' && !String(suggestion.prompt || '').trim()) return
      setHelpfulSuggestion(suggestion)
      setSuggestionPhase('active')
      setBrandMood('celebrating')
    } catch {
      // Suggestions are optional and should never interrupt the main experience.
    } finally {
      suggestionRequestRef.current = false
    }
  }, [])

  useEffect(() => {
    if (initialising) return undefined
    lastSuggestionCheckRef.current = Date.now()
    const runIfDue = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastSuggestionCheckRef.current < 120000) return
      lastSuggestionCheckRef.current = Date.now()
      void evaluateProactiveSuggestion()
    }
    const intervalId = window.setInterval(runIfDue, 120000)
    document.addEventListener('visibilitychange', runIfDue)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', runIfDue)
    }
  }, [evaluateProactiveSuggestion, initialising])

  useLayoutEffect(() => {
    const dock = primaryDockRef.current
    if (!dock) return undefined
    const updateHeight = () => {
      const height = Math.ceil(dock.getBoundingClientRect().height)
      if (height > 0) setPrimaryDockHeight(height)
    }
    updateHeight()
    if (typeof ResizeObserver !== 'function') return undefined
    const observer = new ResizeObserver(updateHeight)
    observer.observe(dock)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => {
    recognitionRef.current?.stop?.()
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    mediaStreamRef.current?.getTracks?.().forEach(track => track.stop())
    colorDanceTimeoutsRef.current.forEach(id => window.clearTimeout(id))
    fireModeTimeoutsRef.current.forEach(id => window.clearTimeout(id))
    confettiTimeoutsRef.current.forEach(id => window.clearTimeout(id))
  }, [])

  const runColorDance = useCallback(() => {
    colorDanceTimeoutsRef.current.forEach(id => window.clearTimeout(id))
    colorDanceTimeoutsRef.current = COLOR_DANCE_SEQUENCE.map((color, index) => (
      window.setTimeout(() => setAccentColor(color), index * COLOR_DANCE_STEP_MS)
    ))
  }, [])

  const runFireMode = useCallback(() => {
    fireModeTimeoutsRef.current.forEach(id => window.clearTimeout(id))
    setFireMode('active')
    fireModeTimeoutsRef.current = [
      window.setTimeout(() => setFireMode('exiting'), FIRE_MODE_ACTIVE_MS),
      window.setTimeout(() => setFireMode('idle'), FIRE_MODE_ACTIVE_MS + FIRE_MODE_EXIT_MS),
    ]
  }, [])

  const runConfettiBurst = useCallback(() => {
    confettiTimeoutsRef.current.forEach(id => window.clearTimeout(id))
    setConfettiMode('active')
    confettiTimeoutsRef.current = [
      window.setTimeout(() => setConfettiMode('exiting'), CONFETTI_ACTIVE_MS),
      window.setTimeout(() => setConfettiMode('idle'), CONFETTI_ACTIVE_MS + CONFETTI_EXIT_MS),
    ]
  }, [])

  useEffect(() => {
    let active = true
    Promise.allSettled([aiApi.getThread(THREAD_KEY), bootstrapSession(), dashboardApi.snapshot(), aiApi.dailyBrief()]).then(([threadResult, , snapshotResult, briefResult]) => {
      if (!active) return
      if (threadResult.status === 'fulfilled') {
        setMessages(Array.isArray(threadResult.value?.messages) ? threadResult.value.messages : [])
      } else {
        setStatus('Earlier messages could not be loaded. You can still talk to Johnny.')
      }
      if (snapshotResult.status === 'fulfilled') {
        setWorkoutLogged(Boolean(snapshotResult.value?.training_status?.recorded))
        setStreaks(snapshotResult.value?.streaks || null)
      }
      if (briefResult.status === 'fulfilled') {
        setDailyBrief(briefResult.value)
        setWorkoutLogged(Boolean(briefResult.value?.training_status?.recorded))
      }
      setActivityLabel('ready')
      setInitialising(false)
    })
    return () => { active = false }
  }, [bootstrapSession])

  useEffect(() => {
    let active = true
    let midnightTimer

    const scheduleNextDayReset = () => {
      const now = new Date()
      const nextDay = new Date(now)
      nextDay.setHours(24, 0, 1, 0)
      midnightTimer = window.setTimeout(async () => {
        if (!active) return
        setWorkoutLogged(false)
        try {
          const snapshot = await dashboardApi.snapshot()
          if (active) setWorkoutLogged(Boolean(snapshot?.training_status?.recorded))
        } catch {
          // A new day should still reset locally when the refresh is unavailable.
        }
        if (active) scheduleNextDayReset()
      }, Math.max(1, nextDay.getTime() - now.getTime()))
    }

    scheduleNextDayReset()
    return () => {
      active = false
      window.clearTimeout(midnightTimer)
    }
  }, [])

  useLayoutEffect(() => {
    const feed = feedRef.current
    if (!feed || initialising) return
    const isInitialLoad = !hasPositionedInitialThreadRef.current
    const behavior = isInitialLoad ? 'auto' : 'smooth'
    const scrollToBottom = () => {
      if (typeof feed.scrollTo === 'function') {
        feed.scrollTo({ top: feed.scrollHeight, behavior })
      } else {
        feed.scrollTop = feed.scrollHeight
      }
    }
    scrollToBottom()
    hasPositionedInitialThreadRef.current = true
    if (!isInitialLoad) return undefined
    // Late-loading cards (generated images, GIFs) can grow the feed after this first scroll,
    // so re-settle at the bottom a few times while that content finishes laying out.
    const timeoutIds = [150, 400, 900].map(delay => window.setTimeout(scrollToBottom, delay))
    return () => timeoutIds.forEach(id => window.clearTimeout(id))
  }, [initialising, messages, loading, workout])

  const sendPrompt = useCallback(async (prompt) => {
    const message = String(prompt || '').trim()
    if (!message || loading) return

    setInput('')
    setStatus('')
    setMessages(current => [...current, { role: 'user', message_text: message }])
    setLoading(true)
    setActivityLabel(getJohnnyActivityForPrompt(message))

    try {
      const data = await aiApi.chat(message, THREAD_KEY, 'general', {
        context: { screen: 'johnny_home', pathname: '/dashboard' },
      })
      const actionResults = await hydrateGeneratedImageResults(data)
      const tools = collectToolNames(data)
	  setBrandMood(Array.isArray(data?.tool_errors) && data.tool_errors.length ? 'concerned' : 'celebrating')
	  const successfulWorkoutActions = actionResults
	    .filter(result => result?.ok !== false && !result?.error)
	    .map(result => String(result?.action || result?.tool_name || ''))
	  const ambientColorResult = [...actionResults].reverse().find(result => (
	    result?.ok !== false && !result?.error && String(result?.action || result?.tool_name || '') === 'set_ambient_color'
	  ))
	  const fireModeResult = actionResults.find(result => (
	    result?.ok !== false && !result?.error && String(result?.action || result?.tool_name || '') === 'activate_fire_mode'
	  ))
	  const confettiResult = actionResults.find(result => (
	    result?.ok !== false && !result?.error && String(result?.action || result?.tool_name || '') === 'trigger_confetti_burst'
	  ))
	  if (fireModeResult) runFireMode()
	  if (confettiResult) runConfettiBurst()
	  if (ambientColorResult?.color === 'dance') {
	    runColorDance()
	  } else if (ambientColorResult && ACCENT_PRESETS[ambientColorResult.color]) {
	    setAccentColor(ambientColorResult.color)
	  }
	  const gifShared = actionResults.some(result => (
	    result?.ok !== false && !result?.error && String(result?.action || result?.tool_name || '') === 'search_gif'
	  ))
	  if (fireModeResult || ambientColorResult?.color === 'dance') {
	    setBrandMood('proud')
	  } else if (gifShared) {
	    setBrandMood('surprised')
	  }
	  const cancelsWorkout = successfulWorkoutActions.includes('cancel_workout')
	  const refreshesWorkout = successfulWorkoutActions.some(action => ['create_custom_workout', 'modify_workout', 'load_saved_workout', 'save_workout_to_library', 'cancel_workout'].includes(action))
	  const resetsApproval = successfulWorkoutActions.some(action => ['create_custom_workout', 'modify_workout', 'load_saved_workout'].includes(action))
	  if (cancelsWorkout) {
	    setQueuedWorkoutDismissed(true)
	    setWorkoutApproved(false)
	  }
	  if (refreshesWorkout) {
	    await bootstrapSession().catch(() => setStatus('The workout was updated, but its preview needs a refresh.'))
	  }
	  if (resetsApproval) setWorkoutApproved(false)

      if (!cancelsWorkout && tools.some(tool => ['get_current_workout', 'modify_workout'].includes(tool)) && workout) {
        actionResults.push({ action: 'show_workout_plan' })
      }
	  const isWorkoutApprovalRail = result => (
	    String(result?.action || result?.tool_name || '') === 'present_choices'
	    && (Array.isArray(result?.choices) ? result.choices : []).some(choice => choice?.response === '__johnny_approve_workout__')
	  )
	  const shouldOfferApproval = !cancelsWorkout && !hasActiveWorkout && (
	    resetsApproval || (tools.includes('get_current_workout') && Boolean(workout) && !isWorkoutApproved)
	  )
	  if (!shouldOfferApproval) {
	    for (let index = actionResults.length - 1; index >= 0; index -= 1) {
	      if (isWorkoutApprovalRail(actionResults[index])) actionResults.splice(index, 1)
	    }
	  } else if (!actionResults.some(isWorkoutApprovalRail)) {
        actionResults.push(buildWorkoutApprovalRail())
      }
      if (tools.includes('clear_conversation')) {
        setMessages([])
        setWorkoutApproved(false)
        setStatus('Chat cleared.')
      } else {
        setMessages(current => [...current, {
          role: 'assistant',
          message_text: data?.reply || 'I handled that.',
          used_tools: data?.used_tools || [],
          action_results: actionResults,
		  tool_errors: data?.tool_errors || [],
        }])
      }

      if (isShoppingModeNavigationRequest(message)) {
        navigate('/shopping-list', { state: { johnnyActionNotice: 'Johnny opened shopping mode with your current grocery gap.' } })
        return
      }

      if (tools.includes('approve_workout')) setWorkoutApproved(true)
      window.dispatchEvent(new CustomEvent('johnny-assistant-action', {
        detail: { usedTools: tools, actionResults },
      }))
    } catch (error) {
      setBrandMood('concerned')
      setStatus(error?.message || 'Johnny could not respond. Try again.')
    } finally {
      setLoading(false)
      setActivityLabel('ready')
    }
  }, [bootstrapSession, hasActiveWorkout, isWorkoutApproved, loading, navigate, runColorDance, runConfettiBurst, runFireMode, workout])

  const planFromDailyBriefing = useCallback(({ answers, scheduleName }) => {
    setDailyBriefingOpen(false)
    setActivityLabel('planning today’s workout')
    void sendPrompt(`Help me plan today's workout. My check-in is: energy ${answers?.energy || 'not provided'}, body ${answers?.body || 'not provided'}, and stress/focus ${answers?.head || 'not provided'}. Today's schedule suggests ${scheduleName}. Propose the best workout for us to review together. Do not treat it as approved; show me the workout and ask for my approval before locking it in.`)
  }, [sendPrompt])

  const showCardioForm = useCallback((userMessage = 'Log cardio', defaults = {}) => {
    setInput('')
    setStatus('')
    setActivityLabel('cardio log ready')
    setMessages(current => [...current,
      { role: 'user', message_text: userMessage },
      {
        role: 'assistant',
        message_text: 'Absolutely. Add the basics below and I’ll put the cardio on today’s record.',
        action_results: [{ action: 'present_cardio_form', defaults }],
      },
    ])
  }, [])

  const handleDecision = useCallback(async (response) => {
    if (response === '__johnny_log_cardio__') {
      showCardioForm()
      return
    }
    if (response === '__johnny_log_rest__') {
      setInput('')
      setMessages(current => [...current, { role: 'user', message_text: 'Log today as a rest day.' }])
      setLoading(true)
      setActivityLabel('logging your rest day')
      setStatus('')
      try {
        await takeRestDay()
        setWorkoutLogged(true)
        setMessages(current => [...current, { role: 'assistant', message_text: 'Rest day logged. Recover well today—easy movement, protein, water, and sleep.' }])
      } catch (error) {
        setStatus(error?.message || 'The rest day could not be logged. Try again.')
      } finally {
        setLoading(false)
        setActivityLabel('ready')
      }
      return
    }
    if (response === '__johnny_review_workout__') {
      setMessages(current => [...current,
        { role: 'user', message_text: 'Show me today’s workout.' },
        { role: 'assistant', message_text: 'Here’s the workout ready for your review.', action_results: [{ action: 'show_workout_plan' }, buildWorkoutApprovalRail()] },
      ])
      return
    }
    if (response === '__johnny_approve_workout__') {
      void sendPrompt('I approve this workout. Lock it in for today.')
      return
    }
    void sendPrompt(response)
  }, [sendPrompt, showCardioForm, takeRestDay])

  const requestWorkoutChanges = useCallback(() => {
    setInput('I want to change this workout: ')
    window.requestAnimationFrame(() => messageInputRef.current?.focus())
  }, [])

  const startPlanningFlow = useCallback(async (userMessage = 'Plan today’s training.') => {
    if (loading) return
    setLoading(true)
    setActivityLabel('reading today\'s plan')
    setStatus('')
    setInput('')
    setMessages(current => [...current, { role: 'user', message_text: userMessage }])
    try {
      const snapshot = await dashboardApi.snapshot()
      const scheduledType = normalizeDayType(snapshot?.training_status?.scheduled_day_type || snapshot?.today_schedule?.day_type)
      const recorded = Boolean(snapshot?.training_status?.recorded)
      const scheduleLine = buildScheduleLine(scheduledType, recorded)
      setMessages(current => [...current, {
        role: 'assistant',
        message_text: scheduleLine,
        action_results: [buildDailyTrainingRail(Boolean(workout))],
      }])
    } catch (error) {
      setStatus(error?.message || 'Johnny could not read today’s schedule. Try again.')
    } finally {
      setLoading(false)
      setActivityLabel('ready')
    }
  }, [loading, workout])

  const handleCardioLogged = useCallback((entry) => {
    setWorkoutLogged(true)
    setActivityLabel('cardio logged')
    const label = formatCardioType(entry.cardio_type)
    setMessages(current => [...current, {
      role: 'assistant',
      message_text: `${entry.duration_minutes} minutes of ${entry.intensity} ${label.toLowerCase()} logged for today. Nice work.`,
    }])
  }, [])

  const updateWorkoutDraft = useCallback(async (nextExercises) => {
    if (!customWorkoutDraft?.id || nextExercises.length < 1) return false
    setStatus('')
    setActivityLabel('saving workout changes')
    try {
      await workoutApi.saveCustomDraft({ ...customWorkoutDraft, exercises: nextExercises })
      setWorkoutApproved(false)
      await bootstrapSession()
      return true
    } catch (error) {
      setStatus(error?.message || 'The workout change could not be saved. Try again.')
      return false
    } finally {
      setActivityLabel('ready')
    }
  }, [bootstrapSession, customWorkoutDraft])

  function handleSubmit(event) {
    event.preventDefault()
    stopVoiceCapture()
    void sendPrompt(input)
  }

  function stopVoiceCapture() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      return
    }
    recognitionRef.current?.stop?.()
    recognitionRef.current = null
    setListening(false)
  }

  async function startVoiceCapture() {
    if (recorderSupported) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const preferredType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => window.MediaRecorder.isTypeSupported?.(type)) || ''
        const recorder = preferredType ? new window.MediaRecorder(stream, { mimeType: preferredType }) : new window.MediaRecorder(stream)
        mediaStreamRef.current = stream
        mediaRecorderRef.current = recorder
        audioChunksRef.current = []
        recorder.ondataavailable = event => { if (event.data?.size) audioChunksRef.current.push(event.data) }
        recorder.onerror = () => {
          stream.getTracks().forEach(track => track.stop())
          mediaRecorderRef.current = null
          mediaStreamRef.current = null
          setListening(false)
          setStatus('Voice recording stopped unexpectedly. Try again or type your message.')
        }
        recorder.onstop = async () => {
          const mimeType = recorder.mimeType || preferredType || 'audio/webm'
          const blob = new Blob(audioChunksRef.current, { type: mimeType })
          stream.getTracks().forEach(track => track.stop())
          mediaRecorderRef.current = null
          mediaStreamRef.current = null
          audioChunksRef.current = []
          setListening(false)
          if (!blob.size) {
            setStatus('I did not capture any audio. Tap the microphone and try again.')
            return
          }
          setTranscribingVoice(true)
          setActivityLabel('transcribing your voice')
          setStatus('Turning your recording into text…')
          try {
            const result = await aiApi.transcribe(await blobToBase64(blob), mimeType)
            setInput(current => [current.trim(), String(result?.text || '').trim()].filter(Boolean).join(' '))
            setStatus('Voice note ready. Review it, then send.')
          } catch (error) {
            setStatus(error?.message || 'I could not transcribe that recording. Try again or type your message.')
          } finally {
            setTranscribingVoice(false)
            setActivityLabel('ready')
          }
        }
        setStatus('Recording… tap the microphone again when you’re done.')
        setListening(true)
        recorder.start()
        return
      } catch (error) {
        const blocked = error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
        setStatus(blocked ? 'Microphone access is blocked. Allow microphone access for this site and try again.' : 'The microphone could not start. Try again or type your message.')
        return
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setStatus('Voice capture is not supported in this browser. You can still type to Johnny.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = event => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += `${event.results[index][0]?.transcript || ''} `
      }
      setInput(transcript.trim())
    }
    recognition.onerror = event => {
      recognitionRef.current = null
      setListening(false)
      setStatus(event?.error === 'network'
        ? 'Browser voice recognition could not connect. Try again on a stable connection or type your message.'
        : event?.error ? `Voice capture stopped: ${event.error}.` : 'Voice capture stopped unexpectedly.')
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }
    setStatus('')
    setListening(true)
    recognition.start()
    recognitionRef.current = recognition
  }

  async function handleClearChat() {
    if (loading || clearingChat) return
    if (!window.confirm('Clear this conversation with Johnny? This cannot be undone.')) return

    setClearingChat(true)
    setActivityLabel('clearing conversation')
    setStatus('')
    try {
      await aiApi.clearThread(THREAD_KEY)
      setMessages([])
      setWorkoutApproved(false)
      setStatus('Chat cleared.')
    } catch (error) {
      setStatus(error?.message || 'The chat could not be cleared. Try again.')
    } finally {
      setClearingChat(false)
      setActivityLabel('ready')
    }
  }

  const handleClearQueuedWorkout = useCallback(async () => {
    if (clearingQueuedWorkout || !workout?.id || hasActiveWorkout) return
    setClearingQueuedWorkout(true)
    setActivityLabel('clearing queued workout')
    setStatus('')
    try {
      await clearCustomWorkoutDraft()
      setQueuedWorkoutDismissed(true)
      setWorkoutApproved(false)
      setStatus('Queued workout cleared. Start fresh whenever you’re ready.')
      setMessages(current => [...current, { role: 'assistant', message_text: 'That workout is cleared. Tell me what you want to do instead.' }])
    } catch (error) {
      setStatus(error?.message || 'The queued workout could not be cleared. Try again.')
    } finally {
      setClearingQueuedWorkout(false)
      setActivityLabel('ready')
    }
  }, [clearCustomWorkoutDraft, clearingQueuedWorkout, hasActiveWorkout, workout?.id])

  function handleHelpfulSuggestion() {
    if (!helpfulSuggestion) return
    const suggestion = helpfulSuggestion
    setHelpfulSuggestion(null)
    setSuggestionPhase('idle')

    if (suggestion.action_type === 'daily_checkin') {
      openDailyCheckIn()
    } else if (suggestion.action_type === 'nutrition') {
      openNutritionLog()
    } else if (suggestion.action_type === 'progress_diary') {
      openProgressDiary()
    } else if (suggestion.action_type === 'open_screen') {
      const destination = getProactiveSuggestionDestination(suggestion.screen)
      if (destination) navigate(destination.path, { state: destination.state })
    } else if (suggestion.prompt) {
      void sendPrompt(buildProactiveSuggestionPrompt(suggestion))
    }
  }

  const clearHelpfulSuggestion = useCallback(() => {
    setHelpfulSuggestion(null)
    setSuggestionPhase('idle')
  }, [])

  const primaryActionSlide = {
    title: helpfulSuggestion?.title || (hasVisibleWorkoutForApproval
      ? `Review ${workout.name} →`
      : isWorkoutApproved && workout
        ? `Activate ${workout.name} →`
        : workoutLogged
          ? 'Workout Logged ✓'
          : 'Plan Workout →'),
    subtitle: helpfulSuggestion?.subtitle || (hasVisibleWorkoutForApproval
      ? 'Approve or adjust the plan in Johnny’s message'
      : isWorkoutApproved && workout
        ? `${workout.exercises.length} exercises${workout.structure === 'circuit' ? ` · ${workout.rounds} rounds` : ''} · Hold to clear`
        : workoutLogged
          ? 'Plan another workout →'
          : 'Review today’s schedule with Johnny'),
    onClick: helpfulSuggestion
      ? handleHelpfulSuggestion
      : () => hasVisibleWorkoutForApproval
        ? document.querySelector('.workout-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        : isWorkoutApproved && workout
          ? navigate('/workout/live')
          : workoutLogged
            ? void startPlanningFlow('Plan another workout for today.')
            : void startPlanningFlow(),
    onLongPress: helpfulSuggestion ? undefined : (isWorkoutApproved && workout && !hasActiveWorkout ? handleClearQueuedWorkout : undefined),
    disabled: clearingQueuedWorkout,
    suggestionLabel: helpfulSuggestion?.label,
    onClear: helpfulSuggestion ? clearHelpfulSuggestion : undefined,
    clearLabel: 'Clear Johnny suggestion',
  }

  const navChips = [
    { key: 'checkin', label: 'Briefing', onClick: openDailyBriefing },
    { key: 'progress-log', label: 'Log Progress', onClick: openDailyCheckIn },
    { key: 'nutrition', label: 'Log Nutrition', onClick: openNutritionLog },
    { key: 'diary', label: 'Progress Diary', onClick: openProgressDiary },
    { key: 'profile', label: 'Profile', onClick: openProfile },
  ]

  return (
    <main className="johnny-prototype-stage">
      <div className="johnny-prototype-phone" style={{ '--johnny-primary-dock-height': `${primaryDockHeight}px`, '--johnny-accent-rgb': resolveAccentRgb(accentColor) }}>
        <AmbientField />
        <JohnnyFireOverlay phase={fireMode} />
        <JohnnyConfettiBurst phase={confettiMode} />

        <header className="plan-header">
          <div className={`brand-badge mood-${displayedBrandMood}`}>
            {brandmarkImage
              ? <img src={brandmarkImage} alt="Johnny5k" />
              : <span aria-hidden="true">J5K</span>}
          </div>
          <div className="johnny-brand-copy">
            <div className="brand-name">Johnny5k</div>
            <div className={`brand-status mood-${displayedBrandMood}${activityLabel === 'ready' ? '' : ' busy'}`} role="status" aria-live="polite">
              <span className="pulse-dot" /> Johnny · {activityLabel}
            </div>
          </div>
          {headlineStreak ? (
            <div className="johnny-streak-badge" title={`${headlineStreak.days}-day ${headlineStreak.label} streak`}>
              <span aria-hidden="true">🔥</span> {headlineStreak.days}
            </div>
          ) : null}
          <button type="button" className="johnny-clear-chat" onClick={() => { void handleClearChat() }} disabled={loading || clearingChat}>
            {clearingChat ? 'Clearing…' : 'Clear chat'}
          </button>
        </header>

        <section className="chat-feed" ref={feedRef} aria-live="polite" aria-busy={loading || initialising}>
          <ChatBubble role="ai">{getTimeGreeting(dailyBrief?.local_hour)}, {capitalize(userName)}. {dailyBrief?.first_interaction ? briefTail : greetingTail}</ChatBubble>
          {dailyBrief?.first_interaction && dailyBrief?.week_attendance?.length ? (
            <WeekAttendanceChart days={dailyBrief.week_attendance} />
          ) : null}
          {dailyBrief?.first_interaction ? (
            <JohnnyDailyBrief
              brief={dailyBrief}
              onStick={() => void startPlanningFlow(`Let's stick with today's scheduled ${formatDayType(dailyBrief?.training_status?.scheduled_day_type || 'workout')}.`)}
              onChange={() => void startPlanningFlow('I want to change today’s scheduled workout.')}
            />
          ) : null}
          {initialising ? <TypingBubble /> : null}
          {messages.map((message, index) => {
            const key = `${message.role}-${index}-${message.message_text?.slice(0, 18)}`
            return (
              <div className="johnny-message-group" key={key}>
                <ChatBubble role={message.role === 'user' ? 'user' : 'ai'}>{message.message_text}</ChatBubble>
                <JohnnyVisualizationList results={message.action_results} />
                <RecipeGallery actionResults={message.action_results} />
                <GroceryGapCard actionResults={message.action_results} onOpen={() => navigate('/shopping-list')} />
                <JohnnyGeneratedImageList results={message.action_results} latest={index === generatedImageMessageIndex} />
                <JohnnyGifList results={message.action_results} />
                {index === cardioFormMessageIndex ? <JohnnyCardioForm results={message.action_results} onLogged={handleCardioLogged} /> : null}
                {index === workoutMessageIndex && workout && !queuedWorkoutDismissed ? (
                  <WorkoutDraftCard
                    workout={workout}
                    approved={isWorkoutApproved}
                    disabled={loading}
                    onApprove={() => void handleDecision('__johnny_approve_workout__')}
                    onRequestChanges={requestWorkoutChanges}
                    onUpdate={updateWorkoutDraft}
                  />
                ) : null}
                {index === decisionMessageIndex && !(index === workoutMessageIndex && workout && !queuedWorkoutDismissed) ? <JohnnyDecisionRail results={message.action_results} disabled={loading} onReply={handleDecision} onNavigate={navigate} /> : null}
              </div>
            )
          })}
          {loading ? <TypingBubble /> : null}
          {status ? <div className="johnny-chat-status" role="status">{status}</div> : null}
        </section>

        <div className="johnny-primary-dock" ref={primaryDockRef}>
          <nav className="johnny-quick-nav" aria-label="Johnny actions">
            <PrimaryActionButton
              title={primaryActionSlide.title}
              subtitle={primaryActionSlide.subtitle}
              onClick={primaryActionSlide.onClick}
              onLongPress={primaryActionSlide.onLongPress}
              disabled={primaryActionSlide.disabled}
              suggestionLabel={primaryActionSlide.suggestionLabel}
              suggestionPhase={primaryActionSlide.suggestionLabel ? suggestionPhase : 'idle'}
              onClear={primaryActionSlide.onClear}
              clearLabel={primaryActionSlide.clearLabel}
            />
            <div className="quick-nav-chips">
              {navChips.map(chip => <QuickNavChip key={chip.key} label={chip.label} onClick={chip.onClick} />)}
            </div>
          </nav>

          <form className="input-bar" onSubmit={handleSubmit}>
            <button className={`mic-btn${listening ? ' listening' : ''}`} type="button" disabled={loading || transcribingVoice || !voiceSupported} onClick={listening ? stopVoiceCapture : startVoiceCapture} aria-label={listening ? 'Stop voice recording' : transcribingVoice ? 'Transcribing voice recording' : 'Start voice recording'} aria-pressed={listening} title={voiceSupported ? 'Talk to Johnny' : 'Voice recording is unavailable in this browser'}>🎙</button>
            <label className="sr-only" htmlFor="johnny-message">Message Johnny5k</label>
            <input ref={messageInputRef} id="johnny-message" className="chat-input" value={input} onChange={event => setInput(event.target.value)} placeholder={listening ? 'Recording…' : transcribingVoice ? 'Transcribing…' : 'Message Johnny5k…'} disabled={loading || transcribingVoice} />
            <button className="send-btn" type="submit" disabled={loading || !input.trim()} aria-label="Send message">➤</button>
          </form>
        </div>
        {dailyCheckInOpen && activityLabel === 'daily briefing open' ? (
          <DailyCheckInModal
            answers={dailyCheckInAnswers}
            onAnswer={(key, value) => setDailyCheckInAnswers(current => ({ ...current, [key]: value }))}
            onClose={closeDailyCheckIn}
            onStartBriefing={startDailyBriefing}
          />
        ) : null}
        {dailyCheckInOpen && activityLabel !== 'daily briefing open' ? <JohnnyDailyCheckInModal onClose={closeDailyCheckIn} /> : null}
        {dailyBriefingOpen ? <DailyBriefingView answers={dailyCheckInAnswers} onClose={closeDailyBriefing} onPlanWorkout={planFromDailyBriefing} /> : null}
        {nutritionLogOpen ? <JohnnyNutritionLogModal onClose={closeNutritionLog} /> : null}
        {profileOpen ? <JohnnyProfileModal onClose={closeProfile} /> : null}
      </div>
    </main>
  )
}

function ChatBubble({ role, children }) {
  const content = typeof children === 'string' ? renderChatMessageBlocks(children) : children
  return <div className={`bubble-row ${role}`}><div className={`bubble ${role}`}>{content}</div></div>
}

function getJohnnyActivityForPrompt(prompt) {
  const message = String(prompt || '').toLowerCase()
  if (/\b(clear|delete|erase|reset)\b/.test(message) && /\b(chat|conversation|thread)\b/.test(message)) return 'clearing conversation'
  if (WORKOUT_ACTIVITY_PATTERN.test(message)) return 'checking your training'
  if (/\b(weight|sleep|steps|nutrition|meal|food|water)\b/.test(message)) return 'checking your health data'
  return 'thinking'
}

function isShoppingModeNavigationRequest(value) {
  const message = String(value || '').toLowerCase()
  return /\b(open|activate|start|enter|launch|show|take me to|go to)\b/.test(message)
    && /\b(shopping mode|shopping list|grocery shopping)\b/.test(message)
}

function getProactiveSuggestionDestination(screen) {
  if (['steps', 'sleep', 'weight', 'workouts', 'cardio'].includes(screen)) {
    return {
      path: '/body',
      state: { focusTab: screen, johnnyActionNotice: `Johnny opened ${screen} because it matches this suggestion.` },
    }
  }

  const destinations = {
    nutrition: { path: '/nutrition', state: { johnnyActionNotice: 'Johnny opened Nutrition for this suggestion.' } },
    saved_meals: { path: '/nutrition', state: { focusSection: 'savedMeals', johnnyActionNotice: 'Johnny opened Saved Meals for a fast repeatable option.' } },
    recipes: { path: '/nutrition', state: { focusSection: 'recipes', johnnyActionNotice: 'Johnny opened Recipes for this meal suggestion.' } },
    grocery_gap: { path: '/nutrition', state: { focusSection: 'groceryGap', johnnyActionNotice: 'Johnny opened Grocery Gap to handle the missing ingredients.' } },
    pantry: { path: '/nutrition/pantry', state: { johnnyActionNotice: 'Johnny opened Pantry to work with what is already available.' } },
    workout: { path: '/workout', state: { johnnyActionNotice: 'Johnny opened Workout for the suggested training step.' } },
    body: { path: '/body', state: { johnnyActionNotice: 'Johnny opened Progress so you can review the data behind this suggestion.' } },
    activity_log: { path: '/activity-log', state: { johnnyActionNotice: 'Johnny opened Activity Log to review the relevant session history.' } },
    settings: { path: '/settings', state: { johnnyActionNotice: 'Johnny opened Profile & Settings for this suggestion.' } },
  }
  return destinations[screen] || null
}

function buildProactiveSuggestionPrompt(suggestion) {
  const prompt = String(suggestion?.prompt || '').trim()
  const presentationInstructions = {
    chart: 'Use my current logged data and include the most useful structured chart or visualization in your response.',
    link: 'Include a trustworthy, directly relevant source link. Search the web if current or specific information is needed.',
    meal_idea: 'Give me one specific meal idea matched to what remains in today’s calorie and protein targets.',
    story: 'Tell this as one concise, grounded inspirational story. Do not invent claims about an identifiable real person.',
    image: 'Create and share a personalized image of yourself, Johnny, that fits this moment. Use your official likeness reference and make it fun, encouraging, and grounded in my current progress.',
    text: 'Give me one concise, actionable response grounded in my current data.',
  }
  const instruction = presentationInstructions[suggestion?.presentation] || presentationInstructions.text
  return `${prompt} ${instruction}`.trim()
}

const GREETING_TAIL_PHRASES = [
  'What do you want to work on?',
  'What are we tackling today?',
  'Where do you want to start?',
  'What’s the move today?',
  'Ready when you are — what’s first?',
]
const BRIEF_TAIL_PHRASES = [
  'Here’s your brief for today.',
  'Here’s where things stand today.',
  'Here’s today’s rundown.',
  'Got your brief ready.',
]

function pickRandomPhrase(phrases) {
  return phrases[Math.floor(Math.random() * phrases.length)]
}

const STREAK_LABELS = { logging_days: 'meal logging', training_days: 'training', sleep_days: 'sleep', cardio_days: 'cardio' }

function pickHeadlineStreak(streaks) {
  if (!streaks || typeof streaks !== 'object') return null
  const entries = Object.entries(streaks)
    .map(([key, days]) => [key, Number(days) || 0])
    .filter(([, days]) => days >= 2)
  if (!entries.length) return null
  entries.sort((a, b) => b[1] - a[1])
  const [key, days] = entries[0]
  return { days, label: STREAK_LABELS[key] || key.replace(/_/g, ' ') }
}

function getTimeGreeting(hourValue) {
  const hour = Number(hourValue)
  if (!Number.isFinite(hour)) return 'Hello'
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function WeekAttendanceChart({ days }) {
  return (
    <div className="week-chart-wrap">
      <div className="section-label">This week</div>
      <div className="week-chart">
        {days.map(day => {
          const height = day.status === 'today' ? 48 : day.status === 'done' ? 34 : 14
          return (
            <div className="week-col" key={day.date}>
              <div className={`week-bar ${day.status === 'today' ? 'today' : day.status === 'done' ? 'done' : ''}`} style={{ height: `${height}px` }} />
              <div className="week-label">{day.weekday_label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function JohnnyDailyBrief({ brief, onStick, onChange }) {
  const trainingStatus = brief?.training_status || {}
  const scheduledType = normalizeDayType(trainingStatus.scheduled_day_type || brief?.today_schedule?.day_type) || 'workout'
  const workoutRecorded = Boolean(trainingStatus.recorded)
  const latestWeight = Number(brief?.latest_weight?.weight_lb)
  const calories = Number(brief?.yesterday?.calories)
  const sleepHours = Number(brief?.sleep?.hours_sleep)
  const metrics = [
    { label: 'Latest weight', value: latestWeight > 0 ? `${formatCompactNumber(latestWeight)} lb` : 'Not logged' },
    { label: 'Yesterday', value: calories > 0 ? `${Math.round(calories).toLocaleString()} cal` : 'No calories logged' },
    { label: 'Today', value: formatDayType(scheduledType) },
    { label: 'Last sleep', value: sleepHours > 0 ? `${formatCompactNumber(sleepHours)} hr` : 'Not logged' },
  ]

  return (
    <article className="johnny-daily-brief" aria-label="Today’s briefing">
      <header><span>Daily signal</span><strong>{workoutRecorded ? 'Training is already logged' : 'Your day at a glance'}</strong></header>
      <div className="johnny-daily-brief-grid">
        {metrics.map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}
      </div>
      {!workoutRecorded ? (
        <footer>
          <p>{formatDayType(scheduledType)} is scheduled today. Stick with it?</p>
          <div><button type="button" className="primary" onClick={onStick}>Stick with it</button><button type="button" onClick={onChange}>Change today</button></div>
        </footer>
      ) : null}
    </article>
  )
}

function formatCompactNumber(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1)
}

function TypingBubble() {
  return (
    <div className="bubble-row ai">
      <div className="bubble ai"><div className="typing-dots" aria-label="Johnny is typing"><span /><span /><span /></div></div>
    </div>
  )
}

function WorkoutDraftCard({ workout, approved, disabled, onApprove, onRequestChanges, onUpdate }) {
  const [savingIndex, setSavingIndex] = useState(-1)
  const [demoExercise, setDemoExercise] = useState(null)

  async function move(index, direction) {
    const target = index + direction
    if (target < 0 || target >= workout.exercises.length || savingIndex >= 0) return
    const next = [...workout.exercises]
    ;[next[index], next[target]] = [next[target], next[index]]
    setSavingIndex(index)
    await onUpdate(next.map(exercise => exercise.raw))
    setSavingIndex(-1)
  }

  async function remove(index) {
    if (workout.exercises.length <= 1 || savingIndex >= 0) return
    setSavingIndex(index)
    await onUpdate(workout.exercises.filter((_, exerciseIndex) => exerciseIndex !== index).map(exercise => exercise.raw))
    setSavingIndex(-1)
  }

  return (
    <div className="bubble-row ai">
      <div className="bubble ai card-bubble">
        <article className={`workout-card ${approved ? 'approved' : 'planning'}`}>
          <div className="wc-eyebrow">{approved ? 'Today\'s plan' : 'Planning · approval needed'}</div>
          <div className="wc-title">{workout.name}</div>
          <div className="wc-sub">{workout.exercises.length} exercises{workout.structure === 'circuit' ? ` · ${workout.rounds} rounds` : ''}</div>
          {!approved ? <p className="wc-planning-note">Draft changes appear here first. Approve this workout to make it today&apos;s active plan.</p> : null}
          {workout.exercises.map((exercise, index) => (
            <div className="wc-row" key={`${exercise.id || exercise.name}-${index}`}>
              <button
                type="button"
                className="wc-demo"
                onClick={() => setDemoExercise(exercise)}
                aria-label={`Watch ${exercise.name} demo`}
              >
                <span aria-hidden="true">▶</span> Demo
              </button>
              <div className="wc-info"><div className="wc-name">{index + 1}. {exercise.name}</div><div className="wc-meta">{exercise.detail}</div></div>
              <div className="wc-reorder" aria-label={`Adjust ${exercise.name}`}>
                <button type="button" className="wc-arrow" onClick={() => void move(index, -1)} disabled={index === 0 || savingIndex >= 0} aria-label={`Move ${exercise.name} up`}>▲</button>
                <button type="button" className="wc-arrow" onClick={() => void move(index, 1)} disabled={index === workout.exercises.length - 1 || savingIndex >= 0} aria-label={`Move ${exercise.name} down`}>▼</button>
              </div>
              <button type="button" className="wc-remove" onClick={() => void remove(index)} disabled={workout.exercises.length <= 1 || savingIndex >= 0} aria-label={`Remove ${exercise.name}`}>×</button>
            </div>
          ))}
          {!approved ? (
            <div className="wc-approval-actions" aria-label="Workout approval actions">
              <button type="button" className="wc-approve" onClick={onApprove} disabled={disabled || savingIndex >= 0}>Approve workout</button>
              <button type="button" className="wc-request-changes" onClick={onRequestChanges} disabled={disabled}>Ask for changes</button>
            </div>
          ) : null}
        </article>
		{demoExercise ? <ExerciseVideoDialog key={demoExercise.id || demoExercise.name} exercise={demoExercise} onClose={() => setDemoExercise(null)} /> : null}
      </div>
    </div>
  )
}

function ExerciseVideoDialog({ exercise, onClose }) {
  const savedSource = buildExerciseVideoSource(exercise)
	const exerciseName = exercise?.name || ''
	const savedVideoId = extractYouTubeVideoId(exercise?.raw?.demo_video_url || exercise?.raw?.youtube_url) || String(exercise?.raw?.demo_video_id || exercise?.raw?.youtube_video_id || '')
  const [demo, setDemo] = useState(() => ({ embedUrl: savedSource, videoId: savedVideoId, videoUrl: savedVideoId ? `https://www.youtube.com/watch?v=${savedVideoId}` : '', description: buildExerciseDemoFallback(exercise), title: `${exerciseName} technique tutorial` }))
  const [loading, setLoading] = useState(Boolean(exercise) && !savedSource)
  const [error, setError] = useState('')
	const iframeRef = useRef(null)

  useEffect(() => {
    let active = true
    if (savedSource) {
      return () => { active = false }
    }
    aiApi.exerciseDemo({ exercise_name: exercise.name, equipment: exercise.raw?.equipment || '', primary_muscle: exercise.raw?.primary_muscle || '' })
      .then(result => {
        if (!active) return
		const resolvedVideoId = String(result?.video_id || extractYouTubeVideoId(result?.video_url || result?.embed_url) || '')
        setDemo({ embedUrl: result?.embed_verified ? buildYouTubeEmbedUrl(resolvedVideoId) : '', videoId: resolvedVideoId, videoUrl: String(result?.video_url || `https://www.youtube.com/watch?v=${resolvedVideoId}`), description: String(result?.description || buildExerciseDemoFallback(exercise)), title: String(result?.video_title || `${exercise.name} technique tutorial`) })
      })
      .catch(lookupError => { if (active) setError(lookupError?.message || 'I could not verify a playable tutorial right now.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [exercise, savedSource])

	useEffect(() => {
	  function handlePlayerMessage(event) {
	    if (event.source !== iframeRef.current?.contentWindow || !String(event.origin || '').includes('youtube.com')) return
	    let payload = event.data
	    if (typeof payload === 'string') {
	      try { payload = JSON.parse(payload) } catch { return }
	    }
	    if (payload?.event !== 'onError') return
	    setError('That video cannot play inside Johnny. Open the YouTube results to choose another tutorial.')
	    setDemo(current => ({ ...current, embedUrl: '' }))
	  }
	  window.addEventListener('message', handlePlayerMessage)
	  return () => window.removeEventListener('message', handlePlayerMessage)
	}, [])

	const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} proper form tutorial`)}`

  return (
    <AppDialog
      ariaLabel={`${exercise.name} exercise demo`}
      className="johnny-exercise-video-dialog"
      onClose={onClose}
      open
      overlayClassName="johnny-exercise-video-overlay"
      size="lg"
    >
      <header><div><span>Exercise demo</span><strong>{exercise.name}</strong></div><button type="button" onClick={onClose} aria-label="Close exercise demo">×</button></header>
      <div className="johnny-exercise-video-frame">
		{loading ? <div className="johnny-exercise-demo-state">Johnny is finding a technique video…</div> : null}
		{!loading && demo.embedUrl ? <iframe ref={iframeRef} title={demo.title} src={demo.embedUrl} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'johnny-demo-player' }), 'https://www.youtube.com')} allowFullScreen /> : null}
		{!loading && !demo.embedUrl && demo.videoId ? <a className="johnny-exercise-video-preview" href={searchUrl} target="_blank" rel="noreferrer"><span><strong>Find a playable tutorial</strong><small>YouTube will show current results available for your account and region.</small></span></a> : null}
		{!loading && !demo.embedUrl && !demo.videoId ? <div className="johnny-exercise-demo-state"><span>{error}</span><a href={searchUrl} target="_blank" rel="noreferrer">Search YouTube</a></div> : null}
      </div>
	  <p>{demo.description}</p>
    </AppDialog>
  )
}

function buildExerciseVideoSource(exercise) {
  const raw = exercise?.raw || {}
  const savedId = String(raw.demo_video_id || raw.youtube_video_id || extractYouTubeVideoId(raw.demo_video_url || raw.youtube_url) || '').trim()
	if (savedId && raw.demo_embed_verified) return buildYouTubeEmbedUrl(savedId)
	return ''
}

function buildYouTubeEmbedUrl(videoId) {
	const normalizedId = String(videoId || '').trim()
	if (!/^[A-Za-z0-9_-]{11}$/.test(normalizedId)) return ''
	const origin = typeof window !== 'undefined' && window.location?.origin ? `&origin=${encodeURIComponent(window.location.origin)}` : ''
	return `https://www.youtube.com/embed/${encodeURIComponent(normalizedId)}?playsinline=1&rel=0&enablejsapi=1${origin}`
}

function buildExerciseDemoFallback(exercise) {
	const raw = exercise?.raw || {}
	const saved = String(raw.demo_description || raw.description || raw.notes || '').trim()
	if (saved) return saved
	return `I’ll show you the setup and the cleanest execution cue for ${exercise?.name || 'this exercise'}. Match the demonstrated range of motion before adding load or speed.`
}

function extractYouTubeVideoId(value) {
  const match = String(value || '').match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|watch\?v=))([A-Za-z0-9_-]{11})/i)
  return match?.[1] || ''
}

function JohnnyConfettiBurst({ phase }) {
  if (phase === 'idle') return null
  return (
    <div className={`johnny-confetti-overlay ${phase}`} aria-hidden="true">
      {CONFETTI_PIECES.map((piece, index) => (
        <span
          className="johnny-confetti-piece"
          key={index}
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            '--confetti-rgb': piece.colorRgb,
            '--confetti-rotate': `${piece.rotate}deg`,
            '--confetti-drift': `${piece.drift}px`,
          }}
        />
      ))}
    </div>
  )
}

function QuickNavChip({ label, onClick }) {
  return <button type="button" className="quick-nav-chip" onClick={onClick}>{label}</button>
}

function JohnnyFireOverlay({ phase }) {
  if (phase === 'idle') return null
  return (
    <div className={`johnny-fire-overlay ${phase}`} aria-hidden="true">
      <div className="johnny-fire-glow" />
      <div className="johnny-fire-flames">
        {Array.from({ length: 7 }, (_, index) => <span className="johnny-fire-flame" key={index} />)}
      </div>
      <div className="johnny-fire-embers">
        {FIRE_EMBERS.map((ember, index) => (
          <span
            className="johnny-fire-ember"
            key={index}
            style={{
              left: `${ember.left}%`,
              animationDelay: `${ember.delay}s`,
              animationDuration: `${ember.duration}s`,
              '--fire-ember-drift': `${ember.drift}px`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function AmbientField() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />
      <div className="ambient-glow glow-3" />
      <svg viewBox="0 0 400 100" preserveAspectRatio="none">
        <path className="pulse-path pulse-path-1" d="M0,50 L60,50 L80,20 L100,80 L120,50 L400,50" />
        <path className="pulse-path pulse-path-2" d="M0,70 L40,70 L60,40 L90,95 L130,70 L400,70" />
      </svg>
    </div>
  )
}

function PrimaryActionButton({ title, subtitle, onClick, onLongPress, onClear, clearLabel = 'Clear action', disabled = false, suggestionLabel = '', suggestionPhase = 'idle' }) {
  const timerRef = useRef(null)
  const consumedRef = useRef(false)
  const [pressing, setPressing] = useState(false)

  function cancelPress() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    setPressing(false)
  }

  function beginPress(event) {
    if (!onLongPress || disabled || (event.pointerType === 'mouse' && event.button !== 0)) return
    consumedRef.current = false
    setPressing(true)
    timerRef.current = window.setTimeout(() => {
      consumedRef.current = true
      setPressing(false)
      timerRef.current = null
      onLongPress()
    }, 650)
  }

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current) }, [])

  return <div className={`quick-nav-cta-wrap${onClear ? ' has-clear-action' : ''}`}><button
    type="button"
    className={`quick-nav-cta${pressing ? ' long-pressing' : ''}${suggestionLabel ? ` suggestion-${suggestionPhase}` : ''}`}
    onPointerDown={beginPress}
    onPointerUp={cancelPress}
    onPointerCancel={cancelPress}
    onPointerLeave={cancelPress}
    onClick={event => {
      if (consumedRef.current) {
        consumedRef.current = false
        event.preventDefault()
        return
      }
      onClick?.()
    }}
    disabled={disabled}
    aria-description={onLongPress ? 'Press and hold to clear this queued workout' : undefined}
  >{suggestionLabel ? <span className="quick-nav-cta-suggestion" aria-live="polite">{suggestionLabel}</span> : null}<span className="quick-nav-cta-title">{title}</span><span className="quick-nav-cta-sub">{subtitle}</span></button>{onClear ? <button type="button" className="quick-nav-cta-clear" onClick={onClear} aria-label={clearLabel}>Clear</button> : null}</div>
}

function JohnnyVisualizationList({ results }) {
  const visuals = (Array.isArray(results) ? results : []).map(normalizeVisualization).filter(Boolean)
  if (!visuals.length) return null
  return <>{visuals.map((visual, index) => <JohnnyVisualization visual={visual} key={`${visual.title}-${index}`} />)}</>
}

function JohnnyCardioForm({ results, onLogged }) {
  const result = [...(Array.isArray(results) ? results : [])].reverse()
    .find(item => String(item?.action || item?.tool_name || '') === 'present_cardio_form')
  const defaults = result?.defaults || {}
  const [form, setForm] = useState({
    cardio_type: defaults.cardio_type || 'walking',
    duration_minutes: defaults.duration_minutes || '',
    intensity: defaults.intensity || 'moderate',
    notes: defaults.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  if (!result) return null

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    const duration = Number(form.duration_minutes)
    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Enter how many minutes you did.')
      return
    }
    setSaving(true)
    setError('')
    const entry = {
      cardio_type: form.cardio_type,
      duration_minutes: duration,
      intensity: form.intensity,
      date: localDateString(),
      notes: form.notes.trim(),
    }
    try {
      await bodyApi.logCardio(entry)
      setSaved(true)
      onLogged(entry)
    } catch (saveError) {
      setError(saveError?.message || 'Cardio could not be saved. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={`johnny-cardio-form${saved ? ' saved' : ''}`} onSubmit={submit}>
      <header><span className="wc-eyebrow">Quick cardio log</span><strong>{saved ? 'Cardio saved' : 'What did you do?'}</strong></header>
      <div className="johnny-cardio-grid">
        <label className="wide"><span>Activity</span><select value={form.cardio_type} onChange={event => update('cardio_type', event.target.value)} disabled={saving || saved}>{CARDIO_TYPES.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <label><span>Minutes</span><input type="number" min="1" max="1440" inputMode="numeric" placeholder="30" value={form.duration_minutes} onChange={event => update('duration_minutes', event.target.value)} disabled={saving || saved} /></label>
        <label><span>Intensity</span><select value={form.intensity} onChange={event => update('intensity', event.target.value)} disabled={saving || saved}><option value="light">Light</option><option value="moderate">Moderate</option><option value="hard">Hard</option></select></label>
        <label className="wide"><span>Note <i>optional</i></span><input type="text" maxLength="240" placeholder="How it felt, distance, route…" value={form.notes} onChange={event => update('notes', event.target.value)} disabled={saving || saved} /></label>
      </div>
      {error ? <p className="johnny-cardio-error" role="alert">{error}</p> : null}
      <button className="johnny-cardio-save" type="submit" disabled={saving || saved}>{saved ? '✓ Logged' : saving ? 'Saving…' : 'Log Cardio'}</button>
    </form>
  )
}

function JohnnyGeneratedImageList({ results, latest = false }) {
  const images = (Array.isArray(results) ? results : []).map(normalizeGeneratedImage).filter(Boolean)
  if (!images.length) return null
  return <>{images.map((image, index) => <JohnnyGeneratedImage image={image} latest={latest && index === images.length - 1} key={image.image_id} />)}</>
}

function JohnnyGifList({ results }) {
  const gifs = (Array.isArray(results) ? results : []).map(normalizeGifResult).filter(Boolean)
  if (!gifs.length) return null
  return <>{gifs.map((gif, index) => <JohnnyGif gif={gif} key={`${gif.gif_url}-${index}`} />)}</>
}

function JohnnyGif({ gif }) {
  return (
    <figure className="johnny-gif-card">
      <img src={gif.gif_url} alt={gif.title} loading="lazy" />
      <figcaption>
        <span>via GIPHY</span>
        {gif.page_url ? <a href={gif.page_url} target="_blank" rel="noreferrer">View</a> : null}
      </figcaption>
    </figure>
  )
}

function normalizeGifResult(result) {
  if (!result || typeof result !== 'object') return null
  if (String(result.action || result.tool_name || '') !== 'search_gif') return null
  const gifUrl = String(result.gif_url || '').trim()
  if (!gifUrl) return null
  return {
    gif_url: gifUrl,
    page_url: String(result.page_url || '').trim(),
    title: String(result.title || result.query || 'GIF'),
  }
}

function JohnnyDecisionRail({ results, disabled, onReply, onNavigate }) {
  const rail = normalizeDecisionRail(results)
  const [consumed, setConsumed] = useState(false)
  if (!rail || consumed) return null

  function choose(choice) {
    if (disabled) return
    setConsumed(true)
    if (choice.type === 'navigate') {
      onNavigate(choice.route)
      return
    }
    void onReply(choice.response)
  }

  return (
    <section className={`johnny-decision-rail ${rail.style}`} aria-label={rail.prompt || 'Choose a response'}>
      {rail.prompt ? <p>{rail.prompt}</p> : null}
      <div>
        {rail.choices.map((choice, index) => (
          <button
            type="button"
            className={choice.emphasis === 'primary' ? 'primary' : ''}
            disabled={disabled}
            onClick={() => choose(choice)}
            key={`${choice.label}-${index}`}
          >
            <span>{choice.label}</span>
            {rail.style === 'actions' ? <i aria-hidden="true">{choice.type === 'navigate' ? '↗' : '→'}</i> : null}
          </button>
        ))}
      </div>
    </section>
  )
}

function JohnnyGeneratedImage({ image, latest = false }) {
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const cardRef = useRef(null)
  const imageUrl = onboardingApi.generatedImageUrl(image.image_id)
  const src = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}attempt=${loadAttempt}`

  function handleImageLoad() {
    if (!latest) return
    const frame = window.requestAnimationFrame(() => {
      if (typeof cardRef.current?.scrollIntoView === 'function') {
        cardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
      reportClientDiagnostic({
        source: 'johnny_generated_image_rendered',
        message: 'Johnny rendered the latest generated image in chat.',
        context: { image_id: image.image_id },
        toast: null,
      })
    })
    window.setTimeout(() => window.cancelAnimationFrame(frame), 1000)
  }

  async function handleImageError() {
    if (loadAttempt < 1) {
      try {
        await onboardingApi.refreshGeneratedImageUrl(image.image_id)
        setLoadAttempt(1)
        return
      } catch {
        // Report the final image error below.
      }
    }

    const loadError = new Error('Johnny generated the image, but the browser could not display the private image file.')
    setError(loadError.message)
    reportClientDiagnostic({
      source: 'johnny_generated_image_load',
      message: 'Johnny generated an image, but the chat could not display it.',
      error: loadError,
      context: { image_id: image.image_id, image_url: src.split('?')[0] },
      toast: null,
    })
  }

  return (
    <figure className="johnny-generated-image-card" ref={cardRef}>
      <div className="johnny-generated-image-frame">
        {src && !error ? <img src={src} alt={image.alt_text || image.title || 'Image generated by Johnny'} onLoad={handleImageLoad} onError={handleImageError} /> : null}
        {!src && !error ? <div className="johnny-generated-image-loading"><span /><p>Developing image…</p></div> : null}
        {error ? <div className="johnny-generated-image-error"><p>{error}</p><button type="button" onClick={() => { setError(''); setLoadAttempt(attempt => attempt + 1) }}>Try again</button></div> : null}
      </div>
      <figcaption><div><span className="wc-eyebrow">Generated by Johnny</span><strong>{image.title || 'Johnny image'}</strong></div>{src ? <a href={src} download={`johnny-${image.image_id}.png`}>Save</a> : null}</figcaption>
    </figure>
  )
}

function normalizeGeneratedImage(result) {
  if (!result || typeof result !== 'object') return null
  const action = String(result.action || result.tool_name || '').trim()
  if (action !== 'generate_image') return null

  const payload = result.image && typeof result.image === 'object'
    ? result.image
    : result.generated_image && typeof result.generated_image === 'object'
      ? result.generated_image
      : result
  const imageId = String(payload.image_id || payload.generated_image_id || payload.id || result.image_id || '').trim()
  if (!imageId) return null

  return {
    ...result,
    ...payload,
    image_id: imageId,
    title: payload.title || payload.scenario || result.title || 'Johnny image',
    alt_text: payload.alt_text || result.alt_text || payload.title || payload.scenario || 'Image generated by Johnny',
  }
}

async function hydrateGeneratedImageResults(data) {
  const results = Array.isArray(data?.action_results) ? [...data.action_results] : []
  const usedTools = collectToolNames(data)
  const imageFailed = (Array.isArray(data?.tool_errors) ? data.tool_errors : [])
    .some(error => String(error?.tool_name || '') === 'generate_image')
  if (imageFailed) return results
  if (!usedTools.includes('generate_image') || results.some(normalizeGeneratedImage)) return results

  try {
    const gallery = await onboardingApi.getGeneratedImages()
    const latest = Array.isArray(gallery?.generated_images) ? gallery.generated_images[0] : null
    if (latest?.id) {
      results.push({
        action: 'generate_image',
        tool_name: 'generate_image',
        image_id: latest.id,
        title: latest.scenario || 'Johnny image',
        alt_text: latest.alt_text || latest.scenario || 'Image generated by Johnny',
      })
    }
  } catch {
    // Keep Johnny's reply usable even if the gallery recovery request fails.
  }

  return results
}

function findLatestWorkoutMessageIndex(messages) {
  const workoutActions = new Set(['create_custom_workout', 'load_saved_workout', 'show_workout_plan'])
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const results = Array.isArray(messages[index]?.action_results) ? messages[index].action_results : []
    if (results.some(result => workoutActions.has(String(result?.action || result?.tool_name || '')))) return index
  }
  return -1
}

function findLatestCardioFormMessageIndex(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const results = Array.isArray(messages[index]?.action_results) ? messages[index].action_results : []
    if (results.some(result => String(result?.action || result?.tool_name || '') === 'present_cardio_form')) return index
  }
  return -1
}

function findLatestDecisionMessageIndex(messages) {
  const lastIndex = messages.length - 1
  if (lastIndex < 0 || messages[lastIndex]?.role === 'user') return -1
  const results = Array.isArray(messages[lastIndex]?.action_results) ? messages[lastIndex].action_results : []
  return results.some(result => String(result?.action || result?.tool_name || '') === 'present_choices') ? lastIndex : -1
}

function findLatestGeneratedImageMessageIndex(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const results = Array.isArray(messages[index]?.action_results) ? messages[index].action_results : []
    if (results.some(normalizeGeneratedImage)) return index
  }
  return -1
}

function normalizeDecisionRail(results) {
  const result = [...(Array.isArray(results) ? results : [])].reverse()
    .find(item => String(item?.action || item?.tool_name || '') === 'present_choices')
  if (!result) return null

  const choices = (Array.isArray(result.choices) ? result.choices : []).slice(0, 4).map(choice => ({
    label: String(choice?.label || '').trim(),
    type: choice?.type === 'navigate' ? 'navigate' : 'reply',
    response: String(choice?.response || '').trim(),
    route: String(choice?.route || '').trim(),
    emphasis: choice?.emphasis === 'primary' ? 'primary' : 'secondary',
  })).filter(choice => choice.label && (choice.type === 'navigate' ? choice.route.startsWith('/') : choice.response))
  if (choices.length < 2) return null

  return {
    prompt: String(result.prompt || '').trim(),
    style: result.style === 'actions' ? 'actions' : 'chips',
    choices,
  }
}

function JohnnyVisualization({ visual }) {
  return (
    <article className="johnny-visual-card">
      <header><h2>{visual.title}</h2>{visual.subtitle ? <p>{visual.subtitle}</p> : null}</header>
      {visual.type === 'line' ? <LineVisual visual={visual} /> : null}
      {visual.type === 'bar' ? <BarVisual visual={visual} /> : null}
      {visual.type === 'progress' ? <ProgressVisual visual={visual} /> : null}
      {visual.type === 'comparison' ? <ComparisonVisual visual={visual} /> : null}
      {visual.type === 'infographic' ? <InfographicVisual visual={visual} /> : null}
      {visual.sourceLabel ? <footer>Source: {visual.sourceLabel}</footer> : null}
    </article>
  )
}

function LineVisual({ visual }) {
  const numeric = visual.items.filter(item => Number.isFinite(item.value))
  if (!numeric.length) return <InfographicVisual visual={visual} />
  const values = numeric.map(item => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = numeric.map((item, index) => {
    const x = numeric.length === 1 ? 150 : 18 + (index / (numeric.length - 1)) * 264
    const y = 104 - ((item.value - min) / range) * 76
    return { ...item, x, y }
  })
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ')
  return (
    <div className="johnny-line-visual">
      <svg viewBox="0 0 300 130" role="img" aria-label={`${visual.title} line chart`}>
        <path className="johnny-chart-grid" d="M18 28H282 M18 66H282 M18 104H282" />
        <path className="johnny-chart-line" d={path} />
        {points.map(point => <g key={`${point.label}-${point.x}`}><circle cx={point.x} cy={point.y} r="4" /><text x={point.x} y={point.y - 9}>{formatValue(point.value, visual.unit)}</text></g>)}
      </svg>
      <div className="johnny-chart-labels">{points.map(point => <span key={point.label}>{point.label}</span>)}</div>
    </div>
  )
}

function BarVisual({ visual }) {
  const max = Math.max(1, ...visual.items.map(item => Math.abs(item.value || 0)))
  return <div className="johnny-bar-visual">{visual.items.map(item => <div className="johnny-bar-row" key={item.label}><span>{item.label}</span><i><b style={{ width: `${Math.max(2, Math.abs(item.value || 0) / max * 100)}%` }} /></i><strong>{formatValue(item.value, visual.unit)}</strong></div>)}</div>
}

function ProgressVisual({ visual }) {
  const item = visual.items[0]
  const target = visual.target || 100
  const percent = Math.max(0, Math.min(100, ((item?.value || 0) / target) * 100))
  return <div className="johnny-progress-visual"><div className="johnny-progress-ring" style={{ '--progress': `${percent * 3.6}deg` }}><strong>{formatValue(item?.value, visual.unit)}</strong><span>of {formatValue(target, visual.unit)}</span></div>{item?.detail ? <p>{item.detail}</p> : null}</div>
}

function ComparisonVisual({ visual }) {
  const max = Math.max(1, ...visual.items.flatMap(item => [Math.abs(item.value || 0), Math.abs(item.secondaryValue || 0)]))
  return <div className="johnny-comparison-visual">{visual.items.map(item => <div key={item.label}><span>{item.label}</span><div><i style={{ width: `${Math.abs(item.value || 0) / max * 100}%` }} /><b style={{ width: `${Math.abs(item.secondaryValue || 0) / max * 100}%` }} /></div><small>{formatValue(item.value, visual.unit)} / {formatValue(item.secondaryValue, visual.unit)}</small></div>)}</div>
}

function InfographicVisual({ visual }) {
  return <ol className="johnny-infographic-visual">{visual.items.map((item, index) => <li key={`${item.label}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.label}</strong>{Number.isFinite(item.value) ? <b>{formatValue(item.value, visual.unit)}</b> : null}{item.detail ? <p>{item.detail}</p> : null}</div></li>)}</ol>
}

function normalizeVisualization(result) {
  if (!result || (result.action !== 'create_visualization' && result.tool_name !== 'create_visualization')) return null
  if (!['line', 'bar', 'progress', 'comparison', 'infographic'].includes(result.type)) return null
  const items = (Array.isArray(result.items) ? result.items : []).slice(0, 12).map(item => ({
    label: formatVisualizationChartLabel(item?.label),
    value: item?.value == null ? null : Number(item.value),
    secondaryValue: item?.secondary_value == null ? null : Number(item.secondary_value),
    detail: String(item?.detail || '').trim(),
  })).filter(item => item.label)
  if (!items.length) return null
  return {
    type: result.type,
    title: String(result.title || 'Visual summary'),
    subtitle: String(result.subtitle || ''),
    unit: String(result.unit || ''),
    target: Number(result.target) || 0,
    sourceLabel: String(result.source_label || ''),
    items,
  }
}

function formatValue(value, unit = '') {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const formatted = Number.isInteger(number) ? number.toLocaleString() : number.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return unit === '%' ? `${formatted}%` : `${formatted}${unit ? ` ${unit}` : ''}`
}

function formatVisualizationChartLabel(value) {
  const label = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}(?:$|[T\s])/.test(label)) return label
  return formatUsChartDate(label, label)
}

function normalizeWorkout(draft, activeSession) {
  const source = draft || (activeSession?.session?.id ? activeSession : null)
  if (!source) return null
  const sessionRecord = source.session || source
  const exercises = Array.isArray(source.exercises) ? source.exercises : []
  if (!exercises.length) return null

  return {
    id: sessionRecord.id || source.id,
    name: sessionRecord.custom_title || source.name || 'Your workout',
    structure: sessionRecord.workout_structure || source.workout_structure || 'standard',
    rounds: Number(sessionRecord.rounds || source.rounds || 1),
    exercises: exercises.map(exercise => ({
      id: exercise.id || exercise.exercise_id,
      name: exercise.exercise_name || exercise.name || 'Exercise',
      detail: formatExerciseDetail(exercise),
      raw: exercise,
    })),
  }
}

function formatExerciseDetail(exercise) {
  const sets = Number(exercise.planned_sets || exercise.sets || 1)
  const targetType = String(exercise.target_type || exercise.planned_target_type || '').toLowerCase()
  const repMin = Number(exercise.planned_reps || exercise.target_reps || exercise.reps || exercise.rep_min || exercise.planned_rep_min || 0)
  const repMax = Number(exercise.rep_max || exercise.planned_rep_max || repMin || 0)
  const seconds = Number(exercise.planned_duration_seconds || exercise.duration_seconds || exercise.seconds || 0)
  const perSide = exercise.reps_per_side || exercise.is_per_side || exercise.per_side
  if (targetType === 'duration' && seconds > 0) return `${sets > 1 ? `${sets} × ` : ''}${seconds} sec`
  if (repMin > 0) {
    const repLabel = repMax > 0 && repMax !== repMin ? `${repMin}–${repMax}` : String(repMin)
    return `${sets > 1 ? `${sets} × ` : ''}${repLabel} reps${perSide ? ' per side' : ''}`
  }
  if (seconds > 0) return `${sets > 1 ? `${sets} × ` : ''}${seconds} sec`
  return `${sets > 1 ? `${sets} × ` : ''}— reps`
}

function collectToolNames(data) {
  return [...(data?.used_tools || []), ...(data?.action_results || [])]
    .map(item => typeof item === 'string' ? item : item?.tool || item?.tool_name || item?.name || item?.action)
    .filter(Boolean)
}

const CARDIO_TYPES = [
  ['walking', 'Walking'], ['running', 'Running'], ['cycling', 'Cycling'], ['swimming', 'Swimming'],
  ['rowing', 'Rowing'], ['stairmaster', 'Stairmaster'], ['hiit', 'HIIT'], ['other', 'Other'],
].map(([value, label]) => ({ value, label }))

function buildDailyTrainingRail(hasWorkout) {
  return {
    action: 'present_choices',
    prompt: 'What would you like to do?',
    style: 'actions',
    choices: [
      { label: hasWorkout ? 'Review & approve workout' : 'Plan a workout', type: 'reply', response: hasWorkout ? '__johnny_review_workout__' : 'Build a workout for today based on my schedule.', emphasis: 'primary' },
      { label: 'Log cardio', type: 'reply', response: '__johnny_log_cardio__' },
      { label: 'Log a rest day', type: 'reply', response: '__johnny_log_rest__' },
    ],
  }
}

function buildWorkoutApprovalRail() {
  return {
    action: 'present_choices',
    prompt: 'Ready to lock this in for today?',
    style: 'actions',
    choices: [
      { label: 'Approve workout', type: 'reply', response: '__johnny_approve_workout__', emphasis: 'primary' },
      { label: 'Ask for changes', type: 'reply', response: 'I want to make changes to this workout.' },
    ],
  }
}

function normalizeDayType(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function formatDayType(value) {
  return normalizeDayType(value).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function buildScheduleLine(scheduledType, recorded) {
  if (recorded) return 'Today’s scheduled training has already been recorded. You can still plan a workout, add cardio, or mark a rest day if the plan changed.'
  if (scheduledType === 'rest') return 'Today is scheduled as a rest day. You can confirm it, choose cardio instead, or plan a workout if you want to train.'
  if (scheduledType === 'cardio') return 'Cardio is scheduled for today. You can log it now, plan a strength workout instead, or record a rest day.'
  if (scheduledType) return `Today is scheduled for ${formatDayType(scheduledType)}. You can plan and approve that workout, log cardio instead, or record a rest day.`
  return 'There isn’t a specific training type scheduled today. Choose how you want to handle the day.'
}

function formatCardioType(value) {
  return CARDIO_TYPES.find(option => option.value === value)?.label || 'Cardio'
}

function localDateString() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '')
    reader.onerror = () => reject(new Error('The voice recording could not be prepared.'))
    reader.readAsDataURL(blob)
  })
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}
