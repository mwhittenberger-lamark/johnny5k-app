import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { aiApi } from '../../api/modules/ai'
import { onboardingApi } from '../../api/modules/onboarding'
import AppDialog from '../ui/AppDialog'
import { getDefaultLiveWorkoutFrames } from '../../lib/appImages'
import { reportClientDiagnostic, showGlobalToast } from '../../lib/clientDiagnostics'
import {
  cycleLiveWorkoutVoiceMode,
  formatInstantVoiceLabel,
  formatLiveWorkoutVoiceModeLabel,
  formatOpenAiVoiceLabel,
  getPreferredInstantVoice,
  normalizeInstantVoiceOptions,
  readLiveWorkoutVoicePrefs,
  writeLiveWorkoutVoicePrefs,
} from '../../lib/liveWorkoutVoice'
import { useAuthStore } from '../../store/authStore'
import { getPausedTimerNowValue } from '../../screens/workout/workoutScreenUtils'

const DEFAULT_REST_TIMING = {
  setMinSeconds: 30,
  setMaxSeconds: 60,
  exerciseMinSeconds: 60,
  exerciseMaxSeconds: 120,
}
const LIVE_WORKOUT_INTRO_SKIP_KEY = 'johnny5k.liveWorkoutIntroSkipsRemaining'
const LIVE_WORKOUT_INTRO_REPEAT_AFTER_SKIPS = 2
const OPENAI_TTS_TIMEOUT_MS = 4000
const MAX_VOICE_MESSAGE_AGE_MS = 8000
const PREMIUM_VOICE_TEST_TEXT = 'Premium voice check. Keep the pace tight and make the next set clean.'
const INSTANT_VOICE_TEST_TEXT = 'Instant voice check. This should come from the default voice on this device.'

export default function LiveWorkoutMode({
  isOpen,
  session,
  exercises,
  liveFrames = [],
  activeExerciseIdx,
  onSetActiveExerciseIdx,
  onCreateSet,
  onUpdateSet,
  onClose,
  pauseSessionTimer,
  resumeSessionTimer,
  sessionTimerPaused = false,
  timerLabel,
  todayLabel,
  displayDayType,
}) {
  const appImages = useAuthStore(state => state.appImages)
  const [currentSetIdx, setCurrentSetIdx] = useState(0)
  const [drafts, setDrafts] = useState({})
  const [savingSet, setSavingSet] = useState(false)
  const [setError, setSetError] = useState('')
  const [coachMessages, setCoachMessages] = useState([])
  const [coachBusy, setCoachBusy] = useState(false)
  const [coachStatus, setCoachStatus] = useState('')
  const [coachInput, setCoachInput] = useState('')
  const [listening, setListening] = useState(false)
  const [voicePrefs, setVoicePrefs] = useState(() => readLiveWorkoutVoicePrefs())
  const [frameIndex, setFrameIndex] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [lastTransition, setLastTransition] = useState(() => ({ kind: 'exercise', at: Date.now(), summary: 'Workout live mode opened.' }))
  const [sessionMapOpen, setSessionMapOpen] = useState(false)
  const [coachLogOpen, setCoachLogOpen] = useState(false)
  const [voiceTestingOpen, setVoiceTestingOpen] = useState(false)
  const [restToast, setRestToast] = useState(null)
  const [showIntroModal, setShowIntroModal] = useState(false)
  const [restTiming, setRestTiming] = useState(DEFAULT_REST_TIMING)
  const [restTimerPausedAt, setRestTimerPausedAt] = useState(null)
  const [restTimerPausedMs, setRestTimerPausedMs] = useState(0)
  const [premiumVoiceTest, setPremiumVoiceTest] = useState(() => buildVoiceTestState())
  const [instantVoiceTest, setInstantVoiceTest] = useState(() => buildVoiceTestState())
  const [instantVoiceOptions, setInstantVoiceOptions] = useState([])
  const [latestVoiceIssue, setLatestVoiceIssue] = useState(null)
  const queueRef = useRef([])
  const pumpCoachQueueRef = useRef(null)
  const processingRef = useRef(false)
  const recognitionRef = useRef(null)
  const ttsAudioRef = useRef(null)
  const ttsAbortRef = useRef(null)
  const speechJobRef = useRef(0)
  const requestedSpeechKeyRef = useRef('')
  const initializedSessionRef = useRef(0)
  const previousExerciseIdRef = useRef(0)
  const textareaRef = useRef(null)
  const spokenMessageRef = useRef('')
  const isOpenRef = useRef(isOpen)
  const onCloseRef = useRef(onClose)
  const panelRef = useRef(null)
  const stickyMetaRef = useRef(null)
  const currentLiftRef = useRef(null)
  const johnnyCardRef = useRef(null)
  const coachLogRef = useRef(null)
  const latestAssistantMessageKeyRef = useRef('')
  const restToastTimerRef = useRef(null)
  const voiceSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const playbackSupported = typeof window !== 'undefined' && typeof window.Audio !== 'undefined'
  const instantVoiceSupported = typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined'
  const voicePlaybackSupported = playbackSupported || instantVoiceSupported
  const workoutSessionId = Number(session?.session?.id || 0)
  const activeExercise = exercises?.[activeExerciseIdx] ?? null
  const totalExerciseCount = Array.isArray(exercises) ? exercises.length : 0
  const totalSetCount = getLiveTotalSetCount(activeExercise)
  const currentSet = activeExercise?.sets?.[currentSetIdx] ?? null
  const currentSetKey = activeExercise?.id ? `${activeExercise.id}:${currentSetIdx}` : 'idle'
  const currentDraft = drafts[currentSetKey] ?? buildDraftFromSet(currentSet)
  const effectiveRestNow = getPausedTimerNowValue(now, restTimerPausedAt, restTimerPausedMs)
  const restElapsedSeconds = Math.max(0, Math.floor((effectiveRestNow - Number(lastTransition?.at || effectiveRestNow)) / 1000))
  const restGuidance = useMemo(() => buildRestGuidance(lastTransition?.kind, restElapsedSeconds, restTiming), [lastTransition?.kind, restElapsedSeconds, restTiming])
  const liveVoiceMode = String(voicePrefs.liveModeVoiceMode || 'premium').trim().toLowerCase()
  const voiceLabel = formatOpenAiVoiceLabel(voicePrefs.openAiVoice)
  const defaultLiveWorkoutFrames = useMemo(() => getDefaultLiveWorkoutFrames(appImages), [appImages])
  const voiceTestBusy = premiumVoiceTest.status === 'running' || instantVoiceTest.status === 'running'
  const coachFrames = useMemo(() => {
    const configuredFrames = normalizeLiveWorkoutFrames(liveFrames)
    return configuredFrames.length ? configuredFrames : defaultLiveWorkoutFrames
  }, [defaultLiveWorkoutFrames, liveFrames])
  const currentFrame = coachFrames[frameIndex % coachFrames.length]
  const dismissIntroModal = useCallback(() => {
    setShowIntroModal(false)
    writeLiveWorkoutIntroSkips(LIVE_WORKOUT_INTRO_REPEAT_AFTER_SKIPS)
  }, [])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    setNow(Date.now())
    const intervalId = restTimerPausedAt == null
      ? window.setInterval(() => {
        setNow(Date.now())
      }, 1000)
      : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (showIntroModal) {
          dismissIntroModal()
          return
        }
        onCloseRef.current?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    panelRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    window.scrollTo({ top: 0, behavior: 'auto' })

    return () => {
      if (intervalId != null) {
        window.clearInterval(intervalId)
      }
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dismissIntroModal, isOpen, restTimerPausedAt, showIntroModal])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const stopTtsPlayback = useCallback(() => {
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort()
      ttsAbortRef.current = null
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      if (ttsAudioRef.current.src && ttsAudioRef.current.src.startsWith('blob:')) {
        window.URL.revokeObjectURL(ttsAudioRef.current.src)
      }
      ttsAudioRef.current = null
    }
    if (instantVoiceSupported) {
      window.speechSynthesis.cancel()
    }
  }, [instantVoiceSupported])

  useEffect(() => () => {
    stopTtsPlayback()
  }, [stopTtsPlayback])

  useEffect(() => {
    writeLiveWorkoutVoicePrefs(voicePrefs)
  }, [voicePrefs])

  useEffect(() => {
    requestedSpeechKeyRef.current = ''
  }, [liveVoiceMode])

  useEffect(() => {
    if (isOpen && liveVoiceMode !== 'mute') return
    stopTtsPlayback()
  }, [isOpen, liveVoiceMode, stopTtsPlayback])

  useEffect(() => {
    if (!isOpen || !instantVoiceSupported) {
      setInstantVoiceOptions([])
      return undefined
    }

    const updateVoiceOptions = () => {
      setInstantVoiceOptions(normalizeInstantVoiceOptions(window.speechSynthesis.getVoices()))
    }

    updateVoiceOptions()
    window.speechSynthesis.addEventListener?.('voiceschanged', updateVoiceOptions)
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', updateVoiceOptions)
    }
  }, [instantVoiceSupported, isOpen])

  const pauseWorkoutTimers = useCallback(() => {
    if (restTimerPausedAt != null) return
    const pausedAt = Date.now()
    setNow(pausedAt)
    setRestTimerPausedAt(pausedAt)
    pauseSessionTimer?.()
  }, [pauseSessionTimer, restTimerPausedAt])

  const resumeWorkoutTimers = useCallback(() => {
    if (restTimerPausedAt == null) return
    const resumedAt = Date.now()
    setRestTimerPausedMs(current => current + Math.max(0, resumedAt - restTimerPausedAt))
    setRestTimerPausedAt(null)
    setNow(resumedAt)
    resumeSessionTimer?.()
  }, [restTimerPausedAt, resumeSessionTimer])

  useEffect(() => {
    if (!isOpen) {
      if (voiceTestingOpen) {
        setVoiceTestingOpen(false)
      }
      resumeWorkoutTimers()
      return
    }

    if (voiceTestingOpen) {
      stopTtsPlayback()
      pauseWorkoutTimers()
      return
    }

    resumeWorkoutTimers()
  }, [isOpen, pauseWorkoutTimers, resumeWorkoutTimers, stopTtsPlayback, voiceTestingOpen])

  useEffect(() => {
    if (!isOpen) return
    textareaRef.current?.focus()
  }, [isOpen])

  useEffect(() => () => {
    if (restToastTimerRef.current) {
      window.clearTimeout(restToastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !activeExercise?.id) return

    if (previousExerciseIdRef.current !== Number(activeExercise.id)) {
      previousExerciseIdRef.current = Number(activeExercise.id)
      setCurrentSetIdx(getSuggestedSetIndex(activeExercise))
    }
  }, [activeExercise, isOpen])

  useEffect(() => {
    if (!isOpen || !activeExercise?.id) return

    setDrafts(current => {
      if (currentSet) {
        return { ...current, [currentSetKey]: buildDraftFromSet(currentSet) }
      }

      if (current[currentSetKey]) {
        return current
      }

      const previousSet = activeExercise?.sets?.[Math.max(0, currentSetIdx - 1)] ?? null
      return {
        ...current,
        [currentSetKey]: previousSet ? buildDraftFromSet(previousSet) : buildDraftFromSet(null),
      }
    })
  }, [activeExercise?.id, activeExercise?.sets, currentSet, currentSetIdx, currentSetKey, isOpen])

  const enqueueCoachEvent = useCallback((event) => {
    queueRef.current.push(event)
    void pumpCoachQueueRef.current?.()
  }, [])

  useEffect(() => {
    if (!isOpen || !workoutSessionId || initializedSessionRef.current === workoutSessionId) return

    initializedSessionRef.current = workoutSessionId
    setCoachMessages([])
    setFrameIndex(0)
    setSessionMapOpen(false)
    setCoachLogOpen(false)
    setVoiceTestingOpen(false)
    setRestTimerPausedAt(null)
    setRestTimerPausedMs(0)
    setPremiumVoiceTest(buildVoiceTestState())
    setInstantVoiceTest(buildVoiceTestState())
    setLatestVoiceIssue(null)
    setLastTransition({ kind: 'exercise', at: Date.now(), summary: 'Workout live mode opened.' })
    enqueueCoachEvent({
      type: 'session_opened',
      summary: `The user opened Live Workout Mode for a ${formatToken(displayDayType || session?.session?.planned_day_type || 'workout').toLowerCase()} session.`,
      manual: false,
    })
  }, [displayDayType, enqueueCoachEvent, isOpen, session?.session?.planned_day_type, workoutSessionId])

  useEffect(() => {
    if (!isOpen || coachMessages[coachMessages.length - 1]?.role !== 'assistant') return
    setFrameIndex(index => (index + 1) % coachFrames.length)
  }, [coachFrames.length, coachMessages, isOpen])

  useEffect(() => {
    if (!isOpen || !coachLogOpen) return
    coachLogRef.current?.scrollTo({ top: coachLogRef.current.scrollHeight, behavior: 'smooth' })
  }, [coachBusy, coachLogOpen, coachMessages, isOpen])

  useEffect(() => {
    if (!isOpen) return

    const latestAssistantMessage = [...coachMessages].reverse().find(message => message.role === 'assistant')
    const nextKey = latestAssistantMessage ? `${latestAssistantMessage.createdAt || ''}-${latestAssistantMessage.text || ''}` : ''
    if (!nextKey || latestAssistantMessageKeyRef.current === nextKey) return

    latestAssistantMessageKeyRef.current = nextKey
    scrollPanelToSection(johnnyCardRef)
  }, [coachMessages, isOpen])

  useEffect(() => {
    setFrameIndex(0)
  }, [coachFrames.length])

  useEffect(() => {
    if (!isOpen || voiceTestingOpen || liveVoiceMode === 'mute' || !voicePlaybackSupported) return

    const latestAssistantMessage = [...coachMessages].reverse().find(message => message.role === 'assistant')
    const nextText = String(latestAssistantMessage?.text || '').trim()
    const nextCreatedAt = Number(latestAssistantMessage?.createdAt || Date.now())
    const nextKey = latestAssistantMessage ? `${nextCreatedAt}-${nextText}` : ''
    if (!nextText || !nextKey || spokenMessageRef.current === nextKey || requestedSpeechKeyRef.current === nextKey) return

    requestedSpeechKeyRef.current = nextKey
    const currentJobId = speechJobRef.current + 1
    speechJobRef.current = currentJobId

    const usePremiumVoice = playbackSupported && (liveVoiceMode === 'premium' || liveVoiceMode === 'auto')
    const useInstantVoice = instantVoiceSupported && (liveVoiceMode === 'instant' || liveVoiceMode === 'auto')

    void deliverSpeech({
      text: nextText,
      messageKey: nextKey,
      createdAt: nextCreatedAt,
      jobId: currentJobId,
      usePremiumVoice,
      useInstantVoice,
      openAiVoice: voicePrefs.openAiVoice,
      rate: voicePrefs.rate,
      stopPlayback: stopTtsPlayback,
      audioSupported: playbackSupported,
      instantSupported: instantVoiceSupported,
      isJobCurrent: candidateJobId => candidateJobId === speechJobRef.current && isOpenRef.current,
      markSpoken: () => {
        spokenMessageRef.current = nextKey
      },
      registerAudio: audio => {
        ttsAudioRef.current = audio
      },
      clearAudio: audio => {
        if (ttsAudioRef.current === audio) {
          ttsAudioRef.current = null
        }
      },
      onAttemptEvent: event => {
        handleSpeechAttemptEvent(event, {
          liveVoiceMode,
          messageText: nextText,
          voiceLabel,
          sessionId: workoutSessionId,
        })
      },
    })
  }, [coachMessages, instantVoiceSupported, isOpen, liveVoiceMode, playbackSupported, stopTtsPlayback, voicePlaybackSupported, voicePrefs.openAiVoice, voicePrefs.rate, voiceTestingOpen, voiceLabel, workoutSessionId])

  useEffect(() => {
    if (!isOpen || !lastTransition?.summary) return

    const guidance = buildRestGuidance(lastTransition.kind, 0, restTiming)
    setRestToast({
      title: guidance.title,
      message: guidance.message,
      key: `${lastTransition.kind}-${lastTransition.at}`,
    })

    if (restToastTimerRef.current) {
      window.clearTimeout(restToastTimerRef.current)
    }

    restToastTimerRef.current = window.setTimeout(() => {
      setRestToast(current => (current?.key === `${lastTransition.kind}-${lastTransition.at}` ? null : current))
    }, 10000)
  }, [isOpen, lastTransition, restTiming])

  useEffect(() => {
    if (!isOpen) return undefined

    let active = true

    onboardingApi.getState()
      .then(data => {
        if (!active) return
        setRestTiming(normalizeRestTiming(data?.profile))
      })
      .catch(() => {
        if (active) {
          setRestTiming(DEFAULT_REST_TIMING)
        }
      })

    return () => {
      active = false
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !workoutSessionId) return

    const skipsRemaining = readLiveWorkoutIntroSkips()
    if (skipsRemaining > 0) {
      writeLiveWorkoutIntroSkips(skipsRemaining - 1)
      setShowIntroModal(false)
      return
    }

    setShowIntroModal(true)
  }, [isOpen, workoutSessionId])

  useEffect(() => {
    pumpCoachQueueRef.current = pumpCoachQueue
  })

  if (!isOpen || !activeExercise) {
    return null
  }

  function setDraftField(field, value) {
    setDrafts(current => ({
      ...current,
      [currentSetKey]: {
        ...buildDraftFromSet(currentSet),
        ...(current[currentSetKey] ?? {}),
        [field]: value,
      },
    }))
  }

  function appendCoachMessage(message) {
    setCoachMessages(current => [...current, message].slice(-10))
  }

  async function pumpCoachQueue() {
    if (processingRef.current || !queueRef.current.length || !workoutSessionId) return

    processingRef.current = true
    setCoachBusy(true)

    const nextEvent = queueRef.current.shift()

    try {
      if (nextEvent?.manual) {
        appendCoachMessage({ role: 'user', text: nextEvent.userText, eventType: 'user_question' })
      }

      const data = await aiApi.chat(
        buildCoachPrompt(nextEvent, activeExercise),
        `live-workout-${workoutSessionId}`,
        'live_workout',
        {
          context: buildLiveWorkoutContext({
            session,
            exercises,
            activeExerciseIdx,
            currentSetIdx,
            currentSet,
            currentDraft,
            restElapsedSeconds,
            restGuidance,
            event: nextEvent,
            timerLabel,
          }),
        },
      )

      appendCoachMessage({
        role: 'assistant',
        text: (data?.reply || 'Stay on the plan and keep the next move clean.').trim(),
        eventType: nextEvent?.type || 'update',
        createdAt: Date.now(),
        actions: normalizeLiveWorkoutActions(data?.actions),
      })
      const demoAction = normalizeLiveWorkoutActions(data?.actions).find(action => action.type === 'open_exercise_demo')
      if (demoAction) {
        handleCoachAction(demoAction, { auto: Boolean(nextEvent?.manual) })
      }
      setCoachStatus('Johnny updated the live coaching feed.')
    } catch (error) {
      setCoachStatus(error?.message || 'Johnny could not update live coaching right now.')
    } finally {
      processingRef.current = false
      setCoachBusy(queueRef.current.length > 0)
      if (queueRef.current.length) {
        void pumpCoachQueue()
      }
    }
  }

  function moveExercise(direction) {
    const nextIndex = clampNumber(activeExerciseIdx + direction, 0, Math.max(0, totalExerciseCount - 1))
    if (nextIndex === activeExerciseIdx) return

    onSetActiveExerciseIdx(nextIndex)
    setCurrentSetIdx(getSuggestedSetIndex(exercises[nextIndex]))
    const nextExercise = exercises[nextIndex]
    setLastTransition({
      kind: 'exercise',
      at: Date.now(),
      summary: `Moved to exercise ${nextIndex + 1} of ${totalExerciseCount}: ${nextExercise?.exercise_name || 'next exercise'}.`,
    })
    enqueueCoachEvent({
      type: 'exercise_changed',
      summary: `The user moved to exercise ${nextIndex + 1} of ${totalExerciseCount}: ${nextExercise?.exercise_name || 'next exercise'}.`,
      exerciseContext: buildLiveExerciseSnapshot(nextExercise),
    })
  }

  function moveSet(direction) {
    const nextIndex = clampNumber(currentSetIdx + direction, 0, Math.max(0, totalSetCount - 1))
    if (nextIndex === currentSetIdx) return

    setCurrentSetIdx(nextIndex)
    const nextSetNumber = nextIndex + 1
    setLastTransition({
      kind: 'set',
      at: Date.now(),
      summary: `Moved to set ${nextSetNumber} for ${activeExercise.exercise_name}.`,
    })
    enqueueCoachEvent({
      type: 'set_changed',
      summary: `The user moved to set ${nextSetNumber} for ${activeExercise.exercise_name}.`,
    })
  }

  async function handleSaveSet() {
    if (savingSet) return

    const reps = parseInt(currentDraft.reps, 10) || 0
    if (reps <= 0) {
      setSetError('Enter reps before saving this set.')
      return
    }

    setSavingSet(true)
    setSetError('')

    const payload = {
      weight: parseFloat(currentDraft.weight) || 0,
      reps,
      rir: currentDraft.rir !== '' ? parseFloat(currentDraft.rir) : currentSet?.rir ?? null,
      completed: true,
    }

    try {
      if (currentSet?.id) {
        await onUpdateSet(currentSet.id, payload)
      } else {
        await onCreateSet(activeExercise.id, {
          session_exercise_id: activeExercise.id,
          set_number: currentSetIdx + 1,
          ...payload,
        })
      }

      const savedSummary = buildSavedSetSummary(activeExercise, currentSetIdx, payload)
      setLastTransition({
        kind: 'set',
        at: Date.now(),
        summary: savedSummary,
      })
      enqueueCoachEvent({
        type: 'set_saved',
        summary: savedSummary,
        savedSet: {
          setNumber: currentSetIdx + 1,
          ...payload,
        },
      })
      setCoachStatus('Set saved. Johnny is updating.')

      const nextSetKey = `${activeExercise.id}:${currentSetIdx + 1}`
      setDrafts(current => {
        if (current[nextSetKey]) return current
        return {
          ...current,
          [nextSetKey]: {
            weight: currentDraft.weight,
            reps: currentDraft.reps,
            rir: currentDraft.rir,
          },
        }
      })
    } catch (error) {
      setSetError(error?.message || 'Could not save that set right now.')
    } finally {
      setSavingSet(false)
    }
  }

  function openDemoForExercise(exerciseName = activeExercise.exercise_name) {
    const query = encodeURIComponent(`${exerciseName} exercise tutorial`)
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener,noreferrer')
  }

  function openDemoSearch(query, exerciseName = activeExercise.exercise_name, url = '') {
    const directUrl = String(url || '').trim()
    if (directUrl) {
      window.open(directUrl, '_blank', 'noopener,noreferrer')
      return
    }

    const normalizedQuery = String(query || '').trim() || `${exerciseName} exercise tutorial`
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(normalizedQuery)}`, '_blank', 'noopener,noreferrer')
  }

  function handleCoachAction(action, options = {}) {
    if (!action || typeof action !== 'object') return

    if (action.type === 'open_exercise_demo') {
      openDemoSearch(action.payload?.query, action.payload?.exercise_name || activeExercise.exercise_name, action.payload?.url)
      const sourceTitle = String(action.payload?.source_title || '').trim()
      const message = sourceTitle
        ? `Opened ${sourceTitle}.`
        : (options.auto ? 'Johnny opened a demo for the current exercise.' : 'Opened the exercise demo Johnny suggested.')
      setCoachStatus(message)
    }
  }

  function stopListening() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  function startListening() {
    if (!voiceSupported) {
      setCoachStatus('Voice capture is not supported in this browser.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = event => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += `${event.results[index][0]?.transcript || ''} `
      }
      setCoachInput(transcript.trim())
    }

    recognition.onerror = event => {
      setCoachStatus(event?.error ? `Voice capture failed: ${event.error}` : 'Voice capture failed.')
      setListening(false)
      recognitionRef.current = null
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
    setCoachStatus('Listening…')
  }

  function handleCoachInputKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) return
    event.preventDefault()
    handleAskJohnny()
  }

  function handleAskJohnny() {
    const userText = coachInput.trim()
    if (!userText) return

    enqueueCoachEvent({
      type: 'user_question',
      summary: `The user asked Johnny: ${userText}`,
      manual: true,
      userText,
    })
    setCoachInput('')
    if (listening) {
      stopListening()
    }
  }

  function handleVoiceTestingToggle(event) {
    setVoiceTestingOpen(event.currentTarget.open)
  }

  function updateVoiceTestProgress(setter, event, fallbackLabel) {
    if (event.type === 'premium_request_started' || event.type === 'instant_request_started') {
      setter({
        status: 'running',
        title: fallbackLabel,
        message: event.message || 'Waiting for voice playback to start.',
        elapsedMs: null,
        voiceLabel: event.voiceLabel || '',
        requestedAt: event.requestStartedAt || Date.now(),
      })
      return
    }

    if (event.type === 'premium_started' || event.type === 'instant_started') {
      setter({
        status: 'success',
        title: fallbackLabel,
        message: event.message || 'Voice playback started.',
        elapsedMs: event.elapsedMs ?? null,
        voiceLabel: event.voiceLabel || '',
        requestedAt: event.requestStartedAt || Date.now(),
      })
      return
    }

    if (event.type === 'premium_failed' || event.type === 'instant_failed') {
      setter({
        status: 'error',
        title: fallbackLabel,
        message: event.message || 'Voice playback failed.',
        elapsedMs: event.elapsedMs ?? null,
        voiceLabel: event.voiceLabel || '',
        requestedAt: event.requestStartedAt || Date.now(),
      })
    }
  }

  async function runPremiumVoiceTest() {
    if (!playbackSupported || voiceTestBusy) return

    const requestStartedAt = Date.now()
    const testJobId = speechJobRef.current + 1
    speechJobRef.current = testJobId

    setPremiumVoiceTest({
      status: 'running',
      title: 'Premium voice',
      message: `Requesting ${voiceLabel}.`,
      elapsedMs: null,
      voiceLabel,
      requestedAt: requestStartedAt,
    })

    await deliverSpeech({
      text: PREMIUM_VOICE_TEST_TEXT,
      messageKey: `premium-test-${requestStartedAt}`,
      createdAt: requestStartedAt,
      requestStartedAt,
      jobId: testJobId,
      usePremiumVoice: true,
      useInstantVoice: false,
      openAiVoice: voicePrefs.openAiVoice,
      rate: voicePrefs.rate,
      stopPlayback: stopTtsPlayback,
      audioSupported: playbackSupported,
      instantSupported: instantVoiceSupported,
      isJobCurrent: candidateJobId => candidateJobId === speechJobRef.current && isOpenRef.current,
      markSpoken: () => {},
      registerAudio: audio => {
        ttsAudioRef.current = audio
      },
      clearAudio: audio => {
        if (ttsAudioRef.current === audio) {
          ttsAudioRef.current = null
        }
      },
      onAttemptEvent: event => {
        updateVoiceTestProgress(setPremiumVoiceTest, event, 'Premium voice')
      },
    })
  }

  async function runInstantVoiceTest(voiceURI = '') {
    if (!instantVoiceSupported || voiceTestBusy) return

    const requestStartedAt = Date.now()
    const testJobId = speechJobRef.current + 1
    speechJobRef.current = testJobId
    const availableVoices = typeof window !== 'undefined' ? window.speechSynthesis.getVoices() : []
    const selectedVoice = getPreferredInstantVoice(availableVoices, voiceURI)
    const selectedVoiceLabel = formatInstantVoiceLabel(selectedVoice)

    setInstantVoiceTest({
      status: 'running',
      title: 'Instant voice',
      message: voiceURI
        ? `Testing ${selectedVoiceLabel}.`
        : 'Testing the default device voice.',
      elapsedMs: null,
      voiceLabel: selectedVoiceLabel,
      requestedAt: requestStartedAt,
    })

    await deliverSpeech({
      text: INSTANT_VOICE_TEST_TEXT,
      messageKey: `instant-test-${voiceURI || 'default'}-${requestStartedAt}`,
      createdAt: requestStartedAt,
      requestStartedAt,
      jobId: testJobId,
      usePremiumVoice: false,
      useInstantVoice: true,
      openAiVoice: voicePrefs.openAiVoice,
      rate: voicePrefs.rate,
      stopPlayback: stopTtsPlayback,
      audioSupported: playbackSupported,
      instantSupported: instantVoiceSupported,
      instantVoiceURI: voiceURI,
      isJobCurrent: candidateJobId => candidateJobId === speechJobRef.current && isOpenRef.current,
      markSpoken: () => {},
      registerAudio: audio => {
        ttsAudioRef.current = audio
      },
      clearAudio: audio => {
        if (ttsAudioRef.current === audio) {
          ttsAudioRef.current = null
        }
      },
      onAttemptEvent: event => {
        updateVoiceTestProgress(setInstantVoiceTest, event, 'Instant voice')
      },
    })
  }

  function handleSpeechAttemptEvent(event, { liveVoiceMode: currentVoiceMode, messageText, voiceLabel: currentVoiceLabel, sessionId }) {
    if (!event) return

    const failureNotice = buildLiveVoiceFailureNotice(event, {
      liveVoiceMode: currentVoiceMode,
      messageText,
      voiceLabel: currentVoiceLabel,
    })

    if (failureNotice) {
      const details = Array.isArray(failureNotice.details) ? failureNotice.details.filter(Boolean) : []
      setLatestVoiceIssue({
        title: failureNotice.title,
        message: failureNotice.message,
        details,
      })

      reportClientDiagnostic({
        source: 'live_workout_voice',
        message: failureNotice.diagnosticMessage,
        context: {
          live_mode_voice_mode: currentVoiceMode,
          workout_session_id: sessionId,
          openai_voice: currentVoiceLabel,
          elapsed_ms: event.elapsedMs ?? null,
          failure_reason: normalizeVoiceFailureReason(event.reason),
          fallback_from_premium: Boolean(event.fallbackFromPremium),
          message_preview: String(messageText || '').slice(0, 180),
          voice_type: event.type,
          voice_label: event.voiceLabel || '',
        },
        toast: {
          title: failureNotice.title,
          message: failureNotice.message,
          details,
          tone: 'error',
          kind: failureNotice.kind,
        },
      })
      return
    }

    if (event.type === 'instant_started' && event.fallbackFromPremium && currentVoiceMode === 'auto') {
      showGlobalToast({
        title: 'Switched to instant voice',
        message: event.voiceLabel
          ? `Johnny switched to ${event.voiceLabel}.`
          : 'Johnny switched to the default device voice.',
        tone: 'info',
        kind: 'live-workout-auto-instant-voice',
      })
    }
  }

  function scrollPanelToSection(targetRef) {
    const panelNode = panelRef.current
    const targetNode = targetRef?.current
    if (!panelNode || !targetNode) return

    const panelRect = panelNode.getBoundingClientRect()
    const targetRect = targetNode.getBoundingClientRect()
    const stickyHeight = stickyMetaRef.current?.offsetHeight || 0
    const nextTop = panelNode.scrollTop + (targetRect.top - panelRect.top) - stickyHeight - 12

    panelNode.scrollTo({
      top: Math.max(0, nextTop),
      behavior: 'smooth',
    })
  }

  const latestCoachMessage = [...coachMessages].reverse().find(message => message.role === 'assistant')
  const voiceModeLabel = formatLiveWorkoutVoiceModeLabel(liveVoiceMode)
  const voiceStatusLabel = liveVoiceMode === 'mute'
    ? 'Voice mute'
    : liveVoiceMode === 'instant'
      ? 'Voice instant'
      : liveVoiceMode === 'auto'
        ? `Voice auto • ${voiceLabel}`
        : `Voice premium • ${voiceLabel}`
  const stickyMeta = (
    <div ref={stickyMetaRef} className="live-workout-sticky-meta">
      <div className="live-workout-sticky-meta-copy">
        {timerLabel ? <span className="dashboard-chip subtle workout-session-timer">Workout {timerLabel}</span> : null}
        <span className={`dashboard-chip subtle live-workout-rest-chip ${restGuidance.tone}`}>{restGuidance.label}</span>
      </div>
      <div className="live-workout-sticky-nav" aria-label="Live workout shortcuts">
        <button
          type="button"
          className="btn-secondary small live-workout-sticky-arrow"
          aria-label="Go to current lift"
          onClick={() => scrollPanelToSection(currentLiftRef)}
        >
          ↑
        </button>
        <button
          type="button"
          className="btn-secondary small live-workout-sticky-arrow"
          aria-label="Go to Johnny Live"
          onClick={() => scrollPanelToSection(johnnyCardRef)}
        >
          ↓
        </button>
      </div>
    </div>
  )

  return (
    <div className="live-workout-shell" role="dialog" aria-modal="true" aria-label="Live workout mode">
      <div className="live-workout-backdrop" onClick={onClose} aria-hidden="true" />
      <section ref={panelRef} className="live-workout-panel">
        <header className="live-workout-header">
          <div className="live-workout-header-copy">
            <span className="dashboard-chip ai">Live Workout Mode</span>
            <h2>{todayLabel} • {formatToken(displayDayType || session?.session?.planned_day_type || 'workout')} day</h2>
            <div className="live-workout-header-meta">
              {voicePlaybackSupported ? <span className={`dashboard-chip subtle ${liveVoiceMode !== 'mute' ? 'success' : ''}`}>{voiceStatusLabel}</span> : null}
            </div>
            {latestVoiceIssue ? <p className="settings-subtitle live-workout-voice-diagnostic">{latestVoiceIssue.message}</p> : null}
          </div>
          <div className="live-workout-header-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Exit live mode</button>
            {voicePlaybackSupported ? (
              <div className="live-workout-voice-switch-shell">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setVoicePrefs(current => ({ ...current, liveModeVoiceMode: cycleLiveWorkoutVoiceMode(current.liveModeVoiceMode) }))}
                  aria-label={`Voice mode ${voiceModeLabel}. Tap to cycle Premium, Instant, Auto, and Mute.`}
                  title="Tap to cycle Premium, Instant, Auto, and Mute."
                >
                  {voiceModeLabel}
                </button>
                <span className="live-workout-voice-switch-hint" aria-hidden="true">Tap to switch</span>
              </div>
            ) : null}
          </div>
        </header>

        {stickyMeta}

        <div className="live-workout-grid">
          <div className="live-workout-main">
            <section ref={currentLiftRef} className="dash-card live-workout-exercise-card">
              <div className="live-workout-section-head">
                <span className="dashboard-chip workout">Current lift</span>
                <span className="dashboard-chip subtle">Exercise {activeExerciseIdx + 1} of {totalExerciseCount}</span>
              </div>
              <div className="live-workout-exercise-head">
                <div>
                  <h3>{activeExercise.exercise_name}</h3>
                  <p>
                    {formatToken(activeExercise.slot_type || 'accessory')} slot • {activeExercise.planned_sets || totalSetCount} planned sets • {formatRepRange(activeExercise)}
                  </p>
                </div>
                <button type="button" className="btn-outline small" onClick={() => openDemoForExercise(activeExercise.exercise_name)}>Demo on YouTube</button>
              </div>

              <div className="live-workout-progress-grid">
                <div className="live-workout-progress-card">
                  <span>Current set</span>
                  <strong>Set {currentSetIdx + 1} / {totalSetCount}</strong>
                  <small>{currentSet?.completed ? 'Logged already' : 'Ready to log'}</small>
                </div>
                <div className="live-workout-progress-card">
                  <span>Completed sets</span>
                  <strong>{activeExercise.sets?.filter(set => set.completed).length || 0}</strong>
                  <small>{activeExercise.planned_sets || totalSetCount} planned today</small>
                </div>
                <div className="live-workout-progress-card">
                  <span>Rest window</span>
                  <strong>{restGuidance.windowLabel}</strong>
                  <small>{formatElapsedSeconds(restElapsedSeconds)} since last change</small>
                </div>
              </div>

              <div className="live-workout-set-form">
                <label>
                  <span>Weight</span>
                  <input
                    inputMode="decimal"
                    value={currentDraft.weight}
                    onChange={event => setDraftField('weight', event.target.value)}
                    placeholder="0"
                  />
                </label>
                <label>
                  <span>Reps</span>
                  <input
                    inputMode="numeric"
                    value={currentDraft.reps}
                    onChange={event => setDraftField('reps', event.target.value)}
                    placeholder="0"
                  />
                </label>
                <label>
                  <span>RiR</span>
                  <input
                    inputMode="decimal"
                    value={currentDraft.rir}
                    onChange={event => setDraftField('rir', event.target.value)}
                    placeholder="Optional"
                  />
                </label>
                <button type="button" className="btn-primary live-workout-save" onClick={handleSaveSet} disabled={savingSet}>
                  {savingSet ? 'Saving…' : currentSet?.id ? 'Update set' : 'Save set'}
                </button>
              </div>
              {setError ? <p className="error live-workout-inline-error">{setError}</p> : null}

              <div className="live-workout-nav-grid">
                <button type="button" className="btn-outline" onClick={() => moveSet(-1)} disabled={currentSetIdx <= 0}>Previous set</button>
                <button type="button" className="btn-outline" onClick={() => moveSet(1)} disabled={currentSetIdx >= totalSetCount - 1}>Next set</button>
                <button type="button" className="btn-secondary" onClick={() => moveExercise(-1)} disabled={activeExerciseIdx <= 0}>Previous exercise</button>
                <button type="button" className="btn-secondary" onClick={() => moveExercise(1)} disabled={activeExerciseIdx >= totalExerciseCount - 1}>Next exercise</button>
              </div>
            </section>

            <section className="dash-card live-workout-plan-card">
              <details open={sessionMapOpen} onToggle={event => setSessionMapOpen(event.currentTarget.open)}>
                <summary className="live-workout-plan-summary">
                  <div className="live-workout-section-head">
                    <span className="dashboard-chip subtle">Session map</span>
                    <span className="settings-subtitle">{sessionMapOpen ? 'Hide the session map.' : 'Click me to see the exercises for todays session.'}</span>
                  </div>
                </summary>
                <div className="live-workout-session-strip">
                  {exercises.map((exercise, index) => (
                    <button
                      key={exercise.id}
                      type="button"
                      className={`live-workout-session-pill ${index === activeExerciseIdx ? 'active' : ''}`}
                      onClick={() => moveExercise(index - activeExerciseIdx)}
                    >
                      <strong>{index + 1}</strong>
                      <span>{exercise.exercise_name}</span>
                      <small>{exercise.sets?.filter(set => set.completed).length || 0}/{getLiveTotalSetCount(exercise)} sets</small>
                    </button>
                  ))}
                </div>
              </details>
            </section>
          </div>

          <aside className="live-workout-coach">
            <section ref={johnnyCardRef} className="dash-card live-workout-johnny-card">
              <div className="live-workout-section-head">
                <span className="dashboard-chip coach">Johnny live</span>
              </div>

              <div className="live-workout-johnny-hero">
                <div className="live-workout-johnny-frame">
                  <img src={currentFrame.image} alt="" />
                </div>
                <div className="live-workout-johnny-latest">
                  <span className="live-workout-johnny-label">What Johnny is saying</span>
                  <p>{latestCoachMessage?.text || 'Johnny is waiting for the next move. Save a set, change a set, or ask a question to kick off live coaching.'}</p>
                </div>
              </div>

              <details className="live-workout-coach-history" open={coachLogOpen} onToggle={event => setCoachLogOpen(event.currentTarget.open)}>
                <summary className="live-workout-coach-history-summary">
                  <div>
                    <strong>Chat history</strong>
                    <span>{coachMessages.length ? `${Math.min(coachMessages.length, 6)} recent message${Math.min(coachMessages.length, 6) === 1 ? '' : 's'}` : 'Open to review Johnny updates and your questions.'}</span>
                  </div>
                </summary>
                <div ref={coachLogRef} className="live-workout-coach-log" role="log" aria-live="polite">
                  {coachMessages.length ? coachMessages.slice(-6).map((message, index) => (
                    <div key={`${message.role}-${message.createdAt || index}`} className={`live-workout-coach-bubble ${message.role}`}>
                      <span>{message.role === 'assistant' ? 'Johnny' : 'You'}</span>
                      <p>{message.text}</p>
                      {message.role === 'assistant' && Array.isArray(message.actions) && message.actions.length ? (
                        <div className="live-workout-coach-bubble-actions">
                          {message.actions.map((action, actionIndex) => (
                            <button
                              key={`${action.type}-${actionIndex}`}
                              type="button"
                              className="btn-outline small"
                              onClick={() => handleCoachAction(action)}
                            >
                              {formatLiveWorkoutActionLabel(action)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )) : (
                    <p className="settings-subtitle">Johnny will keep this feed updated as you move through the workout.</p>
                  )}
                  {coachBusy ? <div className="live-workout-coach-bubble assistant pending"><span>Johnny</span><p>Thinking through the current workout state…</p></div> : null}
                </div>
              </details>

              {coachStatus ? <p className="settings-subtitle">{coachStatus}</p> : null}

              <div className="live-workout-coach-actions">
                <textarea
                  ref={textareaRef}
                  value={coachInput}
                  onChange={event => setCoachInput(event.target.value)}
                  onKeyDown={handleCoachInputKeyDown}
                  placeholder="Type or record your question here."
                  rows={3}
                />
                <div className="live-workout-coach-buttons">
                  <button type="button" className={`btn-secondary ${listening ? 'recording' : ''}`} onClick={listening ? stopListening : startListening}>
                    {listening ? 'Stop recording' : 'Record question'}
                  </button>
                  <button type="button" className="btn-primary" onClick={handleAskJohnny} disabled={!coachInput.trim()}>
                    Ask Johnny
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section className="dash-card live-workout-voice-test-card">
          <details open={voiceTestingOpen} onToggle={handleVoiceTestingToggle}>
            <summary className="live-workout-voice-test-summary">
              <div>
                <span className="dashboard-chip subtle">Hidden tools</span>
                <strong>Live Voice Testing</strong>
                <span>{voiceTestingOpen ? 'Workout timers are paused while this panel is open.' : 'Open to test premium and instant voice on this device.'}</span>
              </div>
            </summary>

            <div className="live-workout-voice-test-grid">
              <article className="live-workout-voice-test-block">
                <div className="live-workout-voice-test-copy">
                  <strong>Premium voice</strong>
                  <p className="settings-subtitle">Uses OpenAI voice {voiceLabel} at {voicePrefs.rate}x speed.</p>
                  <button type="button" className="btn-outline small" onClick={runPremiumVoiceTest} disabled={!playbackSupported || voiceTestBusy}>
                    {premiumVoiceTest.status === 'running' ? 'Testing premium...' : 'Test premium voice'}
                  </button>
                </div>
                <VoiceTestResultCard result={premiumVoiceTest} idleMessage="No premium voice test has run yet." />
              </article>

              <article className="live-workout-voice-test-block">
                <div className="live-workout-voice-test-copy">
                  <strong>Computer / instant voice</strong>
                  <p className="settings-subtitle">Live mode always uses the default voice from this device when instant voice is active.</p>
                  <button type="button" className="btn-outline small" onClick={() => runInstantVoiceTest()} disabled={!instantVoiceSupported || voiceTestBusy}>
                    {instantVoiceTest.status === 'running' ? 'Testing instant...' : 'Test default instant voice'}
                  </button>
                  {!instantVoiceSupported ? <p className="error live-workout-inline-error">This browser does not expose the computer voice APIs.</p> : null}
                </div>
                <VoiceTestResultCard result={instantVoiceTest} idleMessage="No instant voice test has run yet." />
                {instantVoiceOptions.length > 1 ? (
                  <div className="live-workout-voice-option-list">
                    {instantVoiceOptions.map(voice => (
                      <button
                        key={voice.id}
                        type="button"
                        className={`btn-ghost small ${voice.default ? 'active' : ''}`}
                        onClick={() => runInstantVoiceTest(voice.voiceURI)}
                        disabled={voiceTestBusy}
                      >
                        {formatInstantVoiceLabel(voice)}
                      </button>
                    ))}
                  </div>
                ) : null}
                {latestVoiceIssue ? (
                  <div className="live-workout-voice-test-diagnostic">
                    <strong>Most recent voice issue</strong>
                    <p>{latestVoiceIssue.message}</p>
                    {latestVoiceIssue.details?.map((detail, index) => <p key={`voice-issue-${index}`}>{detail}</p>)}
                  </div>
                ) : null}
                {voiceTestingOpen && sessionTimerPaused ? <p className="settings-subtitle">Workout timers are currently paused for testing.</p> : null}
              </article>
            </div>
          </details>
        </section>

        {restToast ? (
          <div className="live-workout-toast" role="status" aria-live="polite">
            <strong>{restToast.title}</strong>
            <p>{restToast.message}</p>
          </div>
        ) : null}

        {showIntroModal ? (
          <AppDialog
            open
            onClose={dismissIntroModal}
            overlayClassName="live-workout-intro-modal"
            className="live-workout-intro-panel"
          >
              <div className="live-workout-intro-head">
                <span className="dashboard-chip coach">Live coach flow</span>
                <button type="button" className="btn-outline small" onClick={dismissIntroModal}>Close</button>
              </div>
              <h3>Run one set at a time</h3>
              <p className="settings-subtitle">Live coach works best when you finish the set, save it, rest inside your target window, then start the next set.</p>
              <div className="live-workout-intro-steps">
                <article className="live-workout-intro-step">
                  <strong>1. Finish and save the set</strong>
                  <p>Complete 1 set of {activeExercise.exercise_name}, then save that set before you move on.</p>
                </article>
                <article className="live-workout-intro-step">
                  <strong>2. Rest, then hit next set</strong>
                  <p>Take {formatDurationRange(restTiming.setMinSeconds, restTiming.setMaxSeconds)} between sets, then tap Next set and begin the exercise again.</p>
                </article>
                <article className="live-workout-intro-step">
                  <strong>3. Keep exercise changes tight</strong>
                  <p>When you move to a new lift, aim for {formatDurationRange(restTiming.exerciseMinSeconds, restTiming.exerciseMaxSeconds)} before the first working set of that next exercise.</p>
                </article>
              </div>
              <div className="live-workout-intro-actions">
                <button type="button" className="btn-primary" onClick={dismissIntroModal}>Start live coach</button>
              </div>
          </AppDialog>
        ) : null}
      </section>
    </div>
  )
}

function buildCoachPrompt(event, activeExercise) {
  const eventSummary = String(event?.summary || '').trim()
  const userText = String(event?.userText || '').trim()
  const exerciseContext = event?.exerciseContext || buildLiveExerciseSnapshot(activeExercise)
  const exerciseName = exerciseContext?.exercise_name || activeExercise?.exercise_name || 'the current exercise'

  if (event?.manual && userText) {
    return `You are Johnny coaching a user live during their workout inside Johnny5k. Current exercise: ${exerciseName}. Answer the user's question directly in no more than 3 short sentences. Give one concrete coaching cue when possible. You can give form and setup advice, but you cannot see the user, so do not claim visual confirmation with lines like "great form" or "that looked clean" unless the user said that first. If the question is about form, setup, or how to perform the movement, prefer returning an open_exercise_demo action for the current exercise. User question: ${userText}`
  }

  if (event?.type === 'exercise_changed') {
    const loadGuidance = buildLoadGuidancePromptFragment(exerciseContext)
    return `You are Johnny coaching a user live during their workout inside Johnny5k. The user just moved to a new exercise. Respond with 1 to 2 short sentences only. ${loadGuidance} Give a direct setup cue or execution reminder for the first working set. Do not repeat the whole workout plan. Event: ${eventSummary}`
  }

  return `You are Johnny coaching a user live during their workout inside Johnny5k. The app is sending you a workout-state update. Respond with 1 to 2 short sentences only. Give live encouragement, one useful cue, or rest-timing guidance based on the current state. Do not repeat the entire workout plan. Event: ${eventSummary}`
}

function buildLiveWorkoutContext({
  session,
  exercises,
  activeExerciseIdx,
  currentSetIdx,
  currentSet,
  currentDraft,
  restElapsedSeconds,
  restGuidance,
  event,
  timerLabel,
}) {
  const activeExercise = exercises?.[activeExerciseIdx] ?? null

  return {
    surface: 'live_workout_mode',
    current_screen: 'workout',
    session_id: Number(session?.session?.id || 0),
    session_day_type: session?.session?.planned_day_type || '',
    workout_timer: timerLabel || '',
    active_exercise_index: activeExerciseIdx + 1,
    total_exercises: Array.isArray(exercises) ? exercises.length : 0,
    active_exercise: activeExercise?.exercise_name || '',
    active_slot_type: activeExercise?.slot_type || '',
    active_muscle: activeExercise?.primary_muscle || '',
    active_equipment: activeExercise?.equipment || '',
    active_target_reps: formatRepRange(activeExercise),
    active_recommended_weight: Number(activeExercise?.recommended_weight || 0) || null,
    active_recent_history: normalizeLiveWorkoutHistory(activeExercise?.recent_history),
    active_planned_sets: Number(activeExercise?.planned_sets || 0),
    completed_sets_for_exercise: activeExercise?.sets?.filter(set => set.completed).length || 0,
    current_set_number: currentSetIdx + 1,
    current_set_logged: Boolean(currentSet?.id),
    current_set_values: {
      weight: parseFloat(currentDraft?.weight) || 0,
      reps: parseInt(currentDraft?.reps, 10) || 0,
      rir: currentDraft?.rir !== '' ? parseFloat(currentDraft?.rir) : null,
    },
    last_rest_seconds: restElapsedSeconds,
    rest_window_label: restGuidance.windowLabel,
    rest_guidance_tone: restGuidance.tone,
    event_type: event?.type || '',
    event_summary: event?.summary || '',
    event_exercise_context: event?.exerciseContext || null,
    session_overview: Array.isArray(exercises)
      ? exercises.map((exercise, index) => ({
          position: index + 1,
          name: exercise.exercise_name,
          planned_sets: Number(exercise.planned_sets || 0),
          completed_sets: exercise.sets?.filter(set => set.completed).length || 0,
          rep_range: formatRepRange(exercise),
        }))
      : [],
  }
}

function buildDraftFromSet(set) {
  return {
    weight: set?.weight != null ? String(set.weight) : '',
    reps: set?.reps != null ? String(set.reps) : '',
    rir: set?.rir != null ? String(set.rir) : '',
  }
}

function buildLiveExerciseSnapshot(exercise) {
  if (!exercise) return null

  return {
    exercise_name: exercise.exercise_name || '',
    equipment: exercise.equipment || '',
    planned_rep_range: formatRepRange(exercise),
    recommended_weight: Number(exercise.recommended_weight || 0) || null,
    recent_history: normalizeLiveWorkoutHistory(exercise.recent_history),
  }
}

function normalizeLiveWorkoutHistory(history) {
  if (!Array.isArray(history)) return []

  return history
    .map(entry => ({
      snapshot_date: entry?.snapshot_date || '',
      best_weight: Number(entry?.best_weight || 0) || null,
      best_reps: Number(entry?.best_reps || 0) || null,
      best_volume: Number(entry?.best_volume || 0) || null,
      estimated_1rm: Number(entry?.estimated_1rm || 0) || null,
    }))
    .filter(entry => entry.snapshot_date || entry.best_weight || entry.best_reps || entry.best_volume || entry.estimated_1rm)
    .slice(0, 3)
}

function buildLoadGuidancePromptFragment(exerciseContext) {
  const recommendedWeight = Number(exerciseContext?.recommended_weight || 0) || 0
  const latestHistory = Array.isArray(exerciseContext?.recent_history) ? exerciseContext.recent_history[0] : null
  const previousWeight = Number(latestHistory?.best_weight || 0) || 0
  const previousReps = Number(latestHistory?.best_reps || 0) || 0

  if (recommendedWeight > 0) {
    const formattedWeight = formatLiveWorkoutWeight(recommendedWeight, exerciseContext?.equipment)
    if (previousWeight > 0) {
      return `Tell the user what weight to start with for this exercise. Recommended starting load is about ${formattedWeight} lbs, with recent history around ${formatLiveWorkoutWeight(previousWeight, exerciseContext?.equipment)} lbs${previousReps > 0 ? ` for ${previousReps} reps` : ''}.`
    }

    return `Tell the user what weight to start with for this exercise. Recommended starting load is about ${formattedWeight} lbs.`
  }

  if (previousWeight > 0) {
    return `Tell the user what weight to start with for this exercise using their recent history. Their latest top effort was about ${formatLiveWorkoutWeight(previousWeight, exerciseContext?.equipment)} lbs${previousReps > 0 ? ` for ${previousReps} reps` : ''}.`
  }

  return 'If no prior loading data exists, say that clearly and give a practical first-set feel target instead of inventing a number.'
}

function formatLiveWorkoutWeight(value, equipment = '') {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return '0'

  const increment = equipment === 'dumbbell'
    ? 10
    : (numeric >= 100 ? 5 : 2.5)
  const rounded = Math.round(numeric / increment) * increment

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function getSuggestedSetIndex(exercise) {
  if (!exercise) return 0
  const sets = Array.isArray(exercise.sets) ? exercise.sets : []
  const firstIncompleteIndex = sets.findIndex(set => !set?.completed)
  if (firstIncompleteIndex >= 0) return firstIncompleteIndex
  return clampNumber(sets.length, 0, Math.max(0, getLiveTotalSetCount(exercise) - 1))
}

function getLiveTotalSetCount(exercise) {
  const planned = Number(exercise?.planned_sets || 0)
  const logged = Array.isArray(exercise?.sets) ? exercise.sets.length : 0
  return Math.max(1, planned, logged)
}

function buildRestGuidance(kind, elapsedSeconds, restTiming = DEFAULT_REST_TIMING) {
  const isExerciseTransition = kind === 'exercise'
  const minSeconds = isExerciseTransition ? restTiming.exerciseMinSeconds : restTiming.setMinSeconds
  const maxSeconds = isExerciseTransition ? restTiming.exerciseMaxSeconds : restTiming.setMaxSeconds
  const preferredWindow = formatDurationRange(minSeconds, maxSeconds)
  const windowLabel = `${preferredWindow} between ${isExerciseTransition ? 'exercises' : 'sets'}`

  if (elapsedSeconds < minSeconds) {
    return {
      tone: 'tight',
      title: 'Keep rest honest',
      label: `${formatElapsedSeconds(elapsedSeconds)} elapsed`,
      windowLabel,
      message: isExerciseTransition
        ? `You are still inside the planned exercise transition window. Set up the next station, breathe, and get moving before downtime stretches past ${preferredWindow}.`
        : `You are still inside the target set-rest window. Catch your breath, then get back under the bar before the set gets stale past ${preferredWindow}.`,
    }
  }

  if (elapsedSeconds <= maxSeconds) {
    return {
      tone: 'sweet',
      title: 'This is the sweet spot',
      label: `${formatElapsedSeconds(elapsedSeconds)} elapsed`,
      windowLabel,
      message: isExerciseTransition
        ? `Transition time is still right where Johnny wants it. Move into the next exercise while you are inside the ${preferredWindow} target.`
        : `Rest is right where Johnny wants it. You are clear to take the next set while you are inside the ${preferredWindow} target.`,
    }
  }

  return {
    tone: 'drift',
    title: 'Downtime is drifting',
    label: `${formatElapsedSeconds(elapsedSeconds)} elapsed`,
    windowLabel,
    message: isExerciseTransition
      ? `You are past the preferred ${preferredWindow} transition window. Get the next exercise started so the session stays sharp.`
      : `You are past the preferred ${preferredWindow} rest window. Start the next set now unless technique or safety says you need a touch longer.`,
  }
}

function buildSavedSetSummary(exercise, currentSetIdx, payload) {
  const parts = [`Saved set ${currentSetIdx + 1} for ${exercise?.exercise_name || 'the current exercise'}`]
  parts.push(`${payload.reps} reps`)
  parts.push(`${payload.weight || 0} lb`)
  if (payload.rir != null && payload.rir !== '') {
    parts.push(`RiR ${payload.rir}`)
  }
  return `${parts.join(' • ')}.`
}

function formatRepRange(exercise) {
  const min = Number(exercise?.planned_rep_min || 0)
  const max = Number(exercise?.planned_rep_max || 0)
  if (!min && !max) return 'working reps'
  if (min && max && min !== max) return `${min}-${max} reps`
  return `${max || min} reps`
}

function formatToken(value) {
  return String(value || 'Workout')
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatElapsedSeconds(value) {
  const totalSeconds = Math.max(0, Number(value || 0))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function normalizeRestTiming(profile) {
  const setMinSeconds = normalizeRestSeconds(profile?.rest_between_sets_min_seconds, DEFAULT_REST_TIMING.setMinSeconds)
  const setMaxSeconds = Math.max(setMinSeconds, normalizeRestSeconds(profile?.rest_between_sets_max_seconds, DEFAULT_REST_TIMING.setMaxSeconds))
  const exerciseMinSeconds = normalizeRestSeconds(profile?.rest_between_exercises_min_seconds, DEFAULT_REST_TIMING.exerciseMinSeconds)
  const exerciseMaxSeconds = Math.max(exerciseMinSeconds, normalizeRestSeconds(profile?.rest_between_exercises_max_seconds, DEFAULT_REST_TIMING.exerciseMaxSeconds))

  return {
    setMinSeconds,
    setMaxSeconds,
    exerciseMinSeconds,
    exerciseMaxSeconds,
  }
}

function normalizeRestSeconds(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(900, Math.max(5, parsed))
}

function formatDurationRange(minSeconds, maxSeconds) {
  return `${formatDurationLabel(minSeconds)} to ${formatDurationLabel(maxSeconds)}`
}

function formatDurationLabel(seconds) {
  const normalized = Math.max(0, Number(seconds || 0))

  if (normalized < 60) {
    return `${Math.round(normalized)} sec`
  }

  if (normalized % 60 === 0) {
    return `${normalized / 60} min`
  }

  const minutes = normalized / 60
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`
}

function readLiveWorkoutIntroSkips() {
  if (typeof window === 'undefined') return 0

  const rawValue = window.localStorage.getItem(LIVE_WORKOUT_INTRO_SKIP_KEY)
  const parsed = Number.parseInt(rawValue || '0', 10)
  if (Number.isNaN(parsed) || parsed < 0) return 0
  return parsed
}

function writeLiveWorkoutIntroSkips(value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LIVE_WORKOUT_INTRO_SKIP_KEY, String(Math.max(0, Number(value || 0))))
}

function buildVoiceTestState() {
  return {
    status: 'idle',
    title: '',
    message: '',
    elapsedMs: null,
    voiceLabel: '',
    requestedAt: 0,
  }
}

function VoiceTestResultCard({ result, idleMessage }) {
  const status = String(result?.status || 'idle').trim().toLowerCase()
  const tone = status === 'error' ? 'error' : status === 'success' ? 'success' : ''
  const elapsedLabel = result?.elapsedMs != null ? `${result.elapsedMs} ms to playback` : 'Waiting for playback timing'

  return (
    <div className={`live-workout-voice-test-result ${tone}`.trim()}>
      <strong>{result?.title || 'Latest result'}</strong>
      <p>{result?.message || idleMessage}</p>
      <p>{elapsedLabel}</p>
      {result?.voiceLabel ? <p>{result.voiceLabel}</p> : null}
    </div>
  )
}

function normalizeVoiceFailureReason(reason = '') {
  const key = String(reason || '').trim().toLowerCase()
  if (!key) return 'request_failed'
  if (key === 'timeout' || key.includes('timeout')) return 'timeout'
  if (key === 'play_rejected') return 'play_rejected'
  if (key === 'audio_error') return 'audio_error'
  if (key === 'speech_error') return 'speech_error'
  if (key === 'no_instant_support') return 'no_instant_support'
  if (key === 'no_instant_voice_loaded') return 'no_instant_voice_loaded'
  if (key === 'stale') return 'stale'
  return 'request_failed'
}

function buildLiveVoiceFailureNotice(event, { liveVoiceMode, voiceLabel }) {
  const reason = normalizeVoiceFailureReason(event?.reason)
  const isAuto = liveVoiceMode === 'auto'
  const isPremiumFailure = event?.type === 'premium_failed'
  const isInstantFailure = event?.type === 'instant_failed'
  const isInstantUnavailable = event?.type === 'instant_unavailable'
  const isSkipped = event?.type === 'voice_skipped'

  if (isSkipped) {
    return {
      title: 'Voice reply skipped',
      message: 'Johnny generated a reply, but it arrived too late to play out loud.',
      details: ['The reply aged past the live voice window before playback started.'],
      diagnosticMessage: 'Live workout voice reply was skipped because it became stale before playback.',
      kind: 'live-workout-voice-skipped',
    }
  }

  if (isInstantUnavailable) {
    return {
      title: 'Instant voice unavailable',
      message: isAuto
        ? 'Premium voice failed, and this browser does not provide a device voice fallback.'
        : 'This browser does not provide a device voice fallback.',
      details: ['Try premium voice on a stable connection or switch to a browser/device that exposes a computer voice.'],
      diagnosticMessage: 'Live workout instant voice fallback was unavailable because the browser has no speech synthesis support.',
      kind: 'live-workout-instant-unavailable',
    }
  }

  if (isPremiumFailure) {
    if (reason === 'timeout') {
      return {
        title: 'Premium voice timed out',
        message: isAuto
          ? 'Premium voice took too long to return over the network. Switching to instant voice now.'
          : 'Premium voice took too long to return over the network.',
        details: ['A weak or unstable connection can cause this timeout.', voiceLabel ? `Selected premium voice: ${voiceLabel}.` : ''],
        diagnosticMessage: 'Premium live workout voice timed out before playback could start.',
        kind: 'live-workout-premium-timeout',
      }
    }

    if (reason === 'play_rejected') {
      return {
        title: 'Premium voice was blocked',
        message: 'Premium voice audio was returned, but the browser blocked playback.',
        details: ['Playback may require a direct tap, audio focus, or a different output route.'],
        diagnosticMessage: 'Premium live workout voice playback was rejected by the browser or audio system.',
        kind: 'live-workout-premium-blocked',
      }
    }

    if (reason === 'audio_error') {
      return {
        title: 'Premium voice could not play',
        message: isAuto
          ? 'Premium voice audio could not start. Switching to instant voice now.'
          : 'Premium voice audio could not start.',
        details: ['The premium voice response was returned, but the audio element failed to play it.'],
        diagnosticMessage: 'Premium live workout voice returned audio, but playback failed.',
        kind: 'live-workout-premium-audio-error',
      }
    }

    return {
      title: 'Premium voice failed',
      message: isAuto
        ? 'Johnny could not start premium voice. Switching to instant voice if the device voice is available.'
        : 'Johnny could not start premium voice.',
      details: ['The premium voice request failed before playback began.'],
      diagnosticMessage: 'Premium live workout voice failed before playback.',
      kind: 'live-workout-premium-failed',
    }
  }

  if (isInstantFailure) {
    if (reason === 'no_instant_voice_loaded') {
      return {
        title: 'Device voice not ready',
        message: 'Device voice is available, but no voices are ready yet.',
        details: ['Try again in a moment. Some mobile browsers load voices lazily after the page is active.'],
        diagnosticMessage: 'Instant live workout voice could not start because no native voices were loaded yet.',
        kind: 'live-workout-instant-not-ready',
      }
    }

    if (reason === 'play_rejected') {
      return {
        title: 'Instant voice was blocked',
        message: 'The device voice was selected, but playback was blocked by the browser or audio route.',
        details: ['Another audio source, route, or playback policy may be preventing the voice from speaking.'],
        diagnosticMessage: 'Instant live workout voice playback was rejected by the browser or audio system.',
        kind: 'live-workout-instant-blocked',
      }
    }

    if (reason === 'speech_error') {
      return {
        title: 'Instant voice failed',
        message: event?.fallbackFromPremium
          ? 'Premium voice failed, and the device voice failed to start too.'
          : 'The device voice failed to start.',
        details: [event?.voiceLabel ? `Device voice: ${event.voiceLabel}.` : 'The selected device voice could not initialize.'],
        diagnosticMessage: 'Instant live workout voice failed to initialize.',
        kind: 'live-workout-instant-failed',
      }
    }

    return {
      title: 'Instant voice failed',
      message: event?.fallbackFromPremium
        ? 'Premium voice failed, and the device voice fallback could not play either.'
        : 'The device voice could not play.',
      details: [event?.voiceLabel ? `Device voice: ${event.voiceLabel}.` : ''],
      diagnosticMessage: 'Instant live workout voice failed before playback.',
      kind: 'live-workout-instant-general-failed',
    }
  }

  return null
}

async function deliverSpeech({
  text,
  messageKey,
  createdAt,
  requestStartedAt = Date.now(),
  jobId,
  usePremiumVoice,
  useInstantVoice,
  openAiVoice,
  rate,
  stopPlayback,
  audioSupported,
  instantSupported,
  isJobCurrent,
  markSpoken,
  registerAudio,
  clearAudio,
  instantVoiceURI = '',
  onAttemptEvent,
}) {
  if (!isJobCurrent(jobId)) {
    return false
  }

  if (!isVoiceMessageFresh(createdAt)) {
    onAttemptEvent?.({
      type: 'voice_skipped',
      requestStartedAt,
      elapsedMs: Date.now() - requestStartedAt,
      reason: 'stale',
      message: 'Voice reply was delayed too long and was skipped.',
    })
    return false
  }

  stopPlayback()
  let premiumFailed = false

  if (usePremiumVoice && audioSupported) {
    onAttemptEvent?.({
      type: 'premium_request_started',
      requestStartedAt,
      voiceLabel: formatOpenAiVoiceLabel(openAiVoice),
      message: `Requesting ${formatOpenAiVoiceLabel(openAiVoice)}.`,
    })
    const premiumStarted = await playPremiumSpeech({
      text,
      messageKey,
      createdAt,
      requestStartedAt,
      jobId,
      openAiVoice,
      rate,
      isJobCurrent,
      markSpoken,
      registerAudio,
      clearAudio,
      onAttemptEvent,
    })

    if (premiumStarted?.started) {
      return true
    }

    premiumFailed = true
  }

  if (useInstantVoice && !instantSupported) {
    onAttemptEvent?.({
      type: 'instant_unavailable',
      requestStartedAt,
      elapsedMs: Date.now() - requestStartedAt,
      reason: 'no_instant_support',
      message: 'This browser does not provide a device voice fallback.',
      fallbackFromPremium: premiumFailed,
    })
    return false
  }

  if (useInstantVoice && instantSupported && isVoiceMessageFresh(createdAt) && isJobCurrent(jobId)) {
    onAttemptEvent?.({
      type: 'instant_request_started',
      requestStartedAt,
      message: instantVoiceURI ? 'Requesting the selected instant voice.' : 'Requesting the default device voice.',
    })
    return playInstantSpeech({
      text,
      messageKey,
      createdAt,
      requestStartedAt,
      jobId,
      rate,
      instantVoiceURI,
      isJobCurrent,
      markSpoken,
      onAttemptEvent,
      fallbackFromPremium: premiumFailed,
    })
  }

  return false
}

async function playPremiumSpeech({
  text,
  messageKey,
  createdAt,
  requestStartedAt,
  jobId,
  openAiVoice,
  rate,
  isJobCurrent,
  markSpoken,
  registerAudio,
  clearAudio,
  onAttemptEvent,
}) {
  try {
    const blob = await promiseWithTimeout(
      aiApi.speech(text, {
        voice: openAiVoice,
        speed: rate,
        format: 'mp3',
      }),
      OPENAI_TTS_TIMEOUT_MS,
    )

    if (!blob || !isJobCurrent(jobId) || !isVoiceMessageFresh(createdAt)) {
      onAttemptEvent?.({
        type: 'premium_failed',
        requestStartedAt,
        elapsedMs: Date.now() - requestStartedAt,
        reason: 'stale',
        message: 'Premium voice response arrived too late for playback.',
        voiceLabel: formatOpenAiVoiceLabel(openAiVoice),
      })
      return { started: false, reason: 'stale' }
    }

    return await startAudioPlayback({
      blob,
      messageKey,
      createdAt,
      requestStartedAt,
      jobId,
      isJobCurrent,
      markSpoken,
      registerAudio,
      clearAudio,
      onAttemptEvent,
      eventType: 'premium',
      voiceLabel: formatOpenAiVoiceLabel(openAiVoice),
    })
  } catch (error) {
    const reason = normalizeVoiceFailureReason(error?.message || 'request_failed')
    onAttemptEvent?.({
      type: 'premium_failed',
      requestStartedAt,
      elapsedMs: Date.now() - requestStartedAt,
      reason,
      message: reason === 'timeout'
        ? 'Premium voice request timed out before audio was returned.'
        : 'Premium voice did not return playable audio.',
      voiceLabel: formatOpenAiVoiceLabel(openAiVoice),
    })
    return { started: false, reason }
  }
}

function playInstantSpeech({
  text,
  messageKey,
  createdAt,
  requestStartedAt,
  jobId,
  rate,
  instantVoiceURI,
  isJobCurrent,
  markSpoken,
  onAttemptEvent,
  fallbackFromPremium = false,
}) {
  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined' || typeof window.SpeechSynthesisUtterance === 'undefined') {
    return Promise.resolve(false)
  }

  return new Promise(resolve => {
    if (!isJobCurrent(jobId) || !isVoiceMessageFresh(createdAt)) {
      onAttemptEvent?.({
        type: 'voice_skipped',
        requestStartedAt,
        elapsedMs: Date.now() - requestStartedAt,
        reason: 'stale',
        message: 'Voice reply was delayed too long and was skipped.',
      })
      resolve(false)
      return
    }

    let settled = false
    const utterance = new window.SpeechSynthesisUtterance(text)
    const availableVoices = window.speechSynthesis.getVoices()
    const selectedVoice = getPreferredInstantVoice(availableVoices, instantVoiceURI)
    if (!availableVoices.length || !selectedVoice) {
      onAttemptEvent?.({
        type: 'instant_failed',
        requestStartedAt,
        elapsedMs: Date.now() - requestStartedAt,
        reason: 'no_instant_voice_loaded',
        voiceLabel: '',
        fallbackFromPremium,
        message: 'Device voice is available but no voices are ready yet.',
      })
      resolve(false)
      return
    }
    utterance.rate = rate
    utterance.voice = selectedVoice || null
    utterance.lang = selectedVoice?.lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
    utterance.onstart = () => {
      if (!isJobCurrent(jobId) || !isVoiceMessageFresh(createdAt)) {
        window.speechSynthesis.cancel()
        onAttemptEvent?.({
          type: 'voice_skipped',
          requestStartedAt,
          elapsedMs: Date.now() - requestStartedAt,
          reason: 'stale',
          message: 'Voice reply was delayed too long and was skipped.',
        })
        if (!settled) {
          settled = true
          resolve(false)
        }
        return
      }
      markSpoken(messageKey)
      onAttemptEvent?.({
        type: 'instant_started',
        requestStartedAt,
        elapsedMs: Date.now() - requestStartedAt,
        voiceLabel: formatInstantVoiceLabel(selectedVoice),
        voiceURI: selectedVoice?.voiceURI || '',
        fallbackFromPremium,
        message: selectedVoice
          ? `Instant voice started with ${formatInstantVoiceLabel(selectedVoice)}.`
          : 'Instant voice started with the default device voice.',
      })
      if (!settled) {
        settled = true
        resolve(true)
      }
    }
    utterance.onerror = () => {
      onAttemptEvent?.({
        type: 'instant_failed',
        requestStartedAt,
        elapsedMs: Date.now() - requestStartedAt,
        reason: 'speech_error',
        voiceLabel: formatInstantVoiceLabel(selectedVoice),
        message: 'Instant voice could not start.',
      })
      if (!settled) {
        settled = true
        resolve(false)
      }
    }
    utterance.onend = () => {
      if (!settled) {
        settled = true
        resolve(true)
      }
    }

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  })
}

function startAudioPlayback({
  blob,
  messageKey,
  createdAt,
  requestStartedAt,
  jobId,
  isJobCurrent,
  markSpoken,
  registerAudio,
  clearAudio,
  onAttemptEvent,
  eventType,
  voiceLabel,
}) {
  if (typeof window === 'undefined' || typeof window.Audio === 'undefined') {
    return Promise.resolve(false)
  }

  return new Promise(resolve => {
    const objectUrl = window.URL.createObjectURL(blob)
    const audio = new window.Audio(objectUrl)
    let settled = false
    registerAudio?.(audio)

    const cleanup = () => {
      if (audio.src && audio.src.startsWith('blob:')) {
        window.URL.revokeObjectURL(audio.src)
      }
      clearAudio?.(audio)
    }

    const finalize = (result) => {
      if (settled) return
      settled = true
      if (result?.started) {
        markSpoken(messageKey)
      }
      resolve(result)
    }

    audio.onplaying = () => {
      if (!isJobCurrent(jobId) || !isVoiceMessageFresh(createdAt)) {
        audio.pause()
        cleanup()
        onAttemptEvent?.({
          type: 'voice_skipped',
          requestStartedAt,
          elapsedMs: Date.now() - requestStartedAt,
          reason: 'stale',
          voiceLabel,
          message: 'Voice reply was delayed too long and was skipped.',
        })
        finalize({ started: false, reason: 'stale' })
        return
      }

      onAttemptEvent?.({
        type: `${eventType}_started`,
        requestStartedAt,
        elapsedMs: Date.now() - requestStartedAt,
        voiceLabel,
        message: `${voiceLabel} started playing.`,
      })
      finalize({ started: true })
    }
    audio.onended = cleanup
    audio.onerror = () => {
      cleanup()
      onAttemptEvent?.({
        type: `${eventType}_failed`,
        requestStartedAt,
        elapsedMs: Date.now() - requestStartedAt,
        reason: 'audio_error',
        voiceLabel,
        message: `${voiceLabel} audio could not play.`,
      })
      finalize({ started: false, reason: 'audio_error' })
    }

    audio.play()
      .catch(() => {
        cleanup()
        onAttemptEvent?.({
          type: `${eventType}_failed`,
          requestStartedAt,
          elapsedMs: Date.now() - requestStartedAt,
          reason: 'play_rejected',
          voiceLabel,
          message: `${voiceLabel} playback was blocked.`,
        })
        finalize({ started: false, reason: 'play_rejected' })
      })
  })
}

function promiseWithTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error('timeout')), timeoutMs)
    }),
  ])
}

function isVoiceMessageFresh(createdAt, nowValue = Date.now()) {
  return Math.max(0, nowValue - Number(createdAt || nowValue)) <= MAX_VOICE_MESSAGE_AGE_MS
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeLiveWorkoutActions(actions) {
  return (Array.isArray(actions) ? actions : []).filter(action => {
    const type = String(action?.type || '').trim()
    return type === 'open_exercise_demo'
  })
}

function formatLiveWorkoutActionLabel(action) {
  if (action?.type === 'open_exercise_demo') {
    return action?.payload?.exercise_name ? `Open ${action.payload.exercise_name} demo` : 'Open demo'
  }

  return 'Open action'
}

function normalizeLiveWorkoutFrames(frames) {
  if (!Array.isArray(frames)) return []

  return frames
    .map((frame, index) => {
      const image = String(frame?.image_url || frame?.image || '').trim()
      if (!image) return null

      return {
        image,
        label: String(frame?.label || `Live frame ${index + 1}`).trim() || `Live frame ${index + 1}`,
        note: String(frame?.note || '').trim(),
      }
    })
    .filter(Boolean)
}
