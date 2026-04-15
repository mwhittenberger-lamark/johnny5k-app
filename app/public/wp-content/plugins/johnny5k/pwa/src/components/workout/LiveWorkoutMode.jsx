import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { aiApi } from '../../api/modules/ai'
import { onboardingApi } from '../../api/modules/onboarding'
import AppDialog from '../ui/AppDialog'
import { getDefaultLiveWorkoutFrames } from '../../lib/appImages'
import { getAccessibleScrollBehavior, useOverlayAccessibility } from '../../lib/accessibility'
import { reportClientDiagnostic, showGlobalToast } from '../../lib/clientDiagnostics'
import { speakNativeJohnnyAnnouncement, stopNativeJohnnySpeech } from '../../lib/nativeAudioSpeech'
import {
  cycleLiveWorkoutVoiceMode,
  formatInstantVoiceLabel,
  formatLiveWorkoutVoiceModeLabel,
  formatOpenAiVoiceLabel,
  getPreferredInstantVoice,
  getLiveWorkoutInstantVoiceRate,
  LIVE_WORKOUT_DEFAULT_INSTANT_VOICE,
  LIVE_WORKOUT_VOICE_RATE_OPTIONS,
  normalizeInstantVoiceOptions,
  readLiveWorkoutVoicePrefs,
  writeLiveWorkoutVoicePrefs,
} from '../../lib/liveWorkoutVoice'
import { useAuthStore } from '../../store/authStore'
import { getPausedTimerNowValue } from '../../screens/workout/workoutScreenUtils'
import {
  buildCoachPrompt,
  buildLiveExerciseSnapshot,
  buildSavedSetSummary,
  formatRepRange,
  normalizeLiveWorkoutCoachingCues,
  normalizeLiveWorkoutHistory,
} from './liveWorkoutCoachHelpers'

const DEFAULT_REST_TIMING = {
  setMinSeconds: 30,
  setMaxSeconds: 60,
  exerciseMinSeconds: 60,
  exerciseMaxSeconds: 120,
}
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
  const [lastTransition, setLastTransition] = useState(() => ({
    kind: 'exercise',
    at: Date.now(),
    summary: 'Workout live mode opened.',
    allowRestMessages: false,
    targetExerciseName: '',
  }))
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
  const exitButtonRef = useRef(null)
  const textareaRef = useRef(null)
  const spokenMessageRef = useRef('')
  const isOpenRef = useRef(isOpen)
  const panelRef = useRef(null)
  const stickyMetaRef = useRef(null)
  const currentLiftRef = useRef(null)
  const johnnyCardRef = useRef(null)
  const coachLogRef = useRef(null)
  const voiceTestingCardRef = useRef(null)
  const latestAssistantMessageKeyRef = useRef('')
  const restToastTimerRef = useRef(null)
  const restGuidanceMessageKeyRef = useRef('')
  const voiceSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const playbackSupported = typeof window !== 'undefined' && typeof window.Audio !== 'undefined'
  const instantVoiceSupported = typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined'
  const voicePlaybackSupported = playbackSupported || instantVoiceSupported
  const workoutSessionId = Number(session?.session?.id || 0)
  const preferredInstantVoiceURI = voicePrefs.instantVoiceURI === LIVE_WORKOUT_DEFAULT_INSTANT_VOICE
    ? ''
    : voicePrefs.instantVoiceURI
  const activeExercise = exercises?.[activeExerciseIdx] ?? null
  const totalExerciseCount = Array.isArray(exercises) ? exercises.length : 0
  const totalSetCount = getLiveTotalSetCount(activeExercise)
  const nextExercise = exercises?.[activeExerciseIdx + 1] ?? null
  const currentSet = activeExercise?.sets?.[currentSetIdx] ?? null
  const currentSetKey = activeExercise?.id ? `${activeExercise.id}:${currentSetIdx}` : 'idle'
  const currentDraft = drafts[currentSetKey] ?? buildDraftFromSet(currentSet)
  const effectiveRestNow = getPausedTimerNowValue(now, restTimerPausedAt, restTimerPausedMs)
  const workoutTimerLabel = timerLabel || ''
  const restElapsedSeconds = Math.max(0, Math.floor((effectiveRestNow - Number(lastTransition?.at || effectiveRestNow)) / 1000))
  const restGuidance = useMemo(() => buildRestGuidance(lastTransition?.kind, restElapsedSeconds, restTiming), [lastTransition?.kind, restElapsedSeconds, restTiming])
  const restCueExerciseName = String(lastTransition?.targetExerciseName || activeExercise?.exercise_name || 'the current lift').trim()
  const liveVoiceMode = String(voicePrefs.liveModeVoiceMode || 'premium').trim().toLowerCase()
  const voiceLabel = formatOpenAiVoiceLabel(voicePrefs.openAiVoice)
  const selectedInstantVoice = useMemo(
    () => getPreferredInstantVoice(instantVoiceOptions, voicePrefs.instantVoiceURI),
    [instantVoiceOptions, voicePrefs.instantVoiceURI],
  )
  const selectedInstantVoiceLabel = formatInstantVoiceLabel(selectedInstantVoice)
  const defaultLiveWorkoutFrames = useMemo(() => getDefaultLiveWorkoutFrames(appImages), [appImages])
  const voiceTestBusy = premiumVoiceTest.status === 'running' || instantVoiceTest.status === 'running'
  const scrollBehavior = getAccessibleScrollBehavior()
  const applyVoicePrefs = useCallback((updater) => {
    setVoicePrefs(current => {
      const nextPrefs = typeof updater === 'function' ? updater(current) : updater
      writeLiveWorkoutVoicePrefs(nextPrefs)
      return nextPrefs
    })
  }, [])
  const scrollPanelToSection = useCallback((targetRef) => {
    const panelNode = panelRef.current
    const targetNode = targetRef?.current
    if (!panelNode || !targetNode) return

    const panelRect = panelNode.getBoundingClientRect()
    const targetRect = targetNode.getBoundingClientRect()
    const stickyHeight = stickyMetaRef.current?.offsetHeight || 0
    const nextTop = panelNode.scrollTop + (targetRect.top - panelRect.top) - stickyHeight - 12

    panelNode.scrollTo({
      top: Math.max(0, nextTop),
      behavior: scrollBehavior,
    })
  }, [scrollBehavior])
  const coachFrames = useMemo(() => {
    const configuredFrames = normalizeLiveWorkoutFrames(liveFrames)
    return configuredFrames.length ? configuredFrames : defaultLiveWorkoutFrames
  }, [defaultLiveWorkoutFrames, liveFrames])
  const currentFrame = coachFrames[frameIndex % coachFrames.length]
  const dismissIntroModal = useCallback(() => {
    setShowIntroModal(false)
  }, [])

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useOverlayAccessibility({
    open: isOpen,
    containerRef: panelRef,
    initialFocusRef: exitButtonRef,
    onClose: onClose,
    dismissible: !showIntroModal,
    trapFocus: !showIntroModal,
  })

  useEffect(() => {
    if (!isOpen) return undefined

    setNow(Date.now())
    const intervalId = restTimerPausedAt == null
      ? window.setInterval(() => {
        setNow(Date.now())
      }, 1000)
      : null

    panelRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    window.scrollTo({ top: 0, behavior: 'auto' })

    return () => {
      if (intervalId != null) {
        window.clearInterval(intervalId)
      }
    }
  }, [isOpen, restTimerPausedAt])

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
    void stopNativeJohnnySpeech()
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

  const handleSpeechAttemptEvent = useCallback((event, { liveVoiceMode: currentVoiceMode, messageText, voiceLabel: currentVoiceLabel, sessionId }) => {
    if (!event) return

    const failureNotice = buildLiveVoiceFailureNotice(event, {
      liveVoiceMode: currentVoiceMode,
      messageText,
      voiceLabel: currentVoiceLabel,
    })

    if (failureNotice) {
      const details = Array.isArray(failureNotice.details) ? failureNotice.details.filter(Boolean) : []
      const shouldSuggestVoiceModeChange = currentVoiceMode === 'premium' && event.type === 'premium_failed'
      const toastActions = shouldSuggestVoiceModeChange && instantVoiceSupported
        ? [
            {
              label: 'Switch to Auto',
              tone: 'primary',
              onClick: () => {
                applyVoicePrefs(current => ({ ...current, liveModeVoiceMode: 'auto' }))
                setVoiceTestingOpen(true)
                scrollPanelToSection(voiceTestingCardRef)
              },
            },
            {
              label: 'Switch to Instant',
              onClick: () => {
                applyVoicePrefs(current => ({ ...current, liveModeVoiceMode: 'instant' }))
                setVoiceTestingOpen(true)
                scrollPanelToSection(voiceTestingCardRef)
              },
            },
          ]
        : []
      const toastMessage = shouldSuggestVoiceModeChange
        ? 'Premium voice failed. Switch live coach to Instant or Auto so Johnny can keep speaking.'
        : failureNotice.message
      const toastDetails = shouldSuggestVoiceModeChange
        ? [
            ...details,
            'Use the voice mode button in live coach if you want to change it manually.',
          ]
        : details
      setLatestVoiceIssue({
        title: failureNotice.title,
        message: toastMessage,
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
          message: toastMessage,
          details: toastDetails,
          tone: 'error',
          persistent: shouldSuggestVoiceModeChange,
          kind: shouldSuggestVoiceModeChange ? 'live-workout-premium-fallback-hint' : failureNotice.kind,
          actions: toastActions,
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
  }, [applyVoicePrefs, instantVoiceSupported, scrollPanelToSection])

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
    queueRef.current = coalesceQueuedCoachEvents(queueRef.current, event)
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
    setLastTransition({
      kind: 'exercise',
      at: Date.now(),
      summary: 'Workout live mode opened.',
      allowRestMessages: false,
      targetExerciseName: '',
    })
    appendCoachMessage({
      role: 'assistant',
      text: buildSessionOpenedCoachMessage({
        activeExercise,
        displayDayType,
        totalExerciseCount,
      }),
      eventType: 'session_opened',
      createdAt: Date.now(),
      actions: [],
    })
    setCoachStatus('Johnny set the opening cue for live mode.')
  }, [activeExercise, displayDayType, isOpen, totalExerciseCount, workoutSessionId])

  useEffect(() => {
    if (!isOpen || coachMessages[coachMessages.length - 1]?.role !== 'assistant') return
    setFrameIndex(index => (index + 1) % coachFrames.length)
  }, [coachFrames.length, coachMessages, isOpen])

  useEffect(() => {
    if (!isOpen || !coachLogOpen) return
    coachLogRef.current?.scrollTo({ top: coachLogRef.current.scrollHeight, behavior: scrollBehavior })
  }, [coachBusy, coachLogOpen, coachMessages, isOpen, scrollBehavior])

  useEffect(() => {
    if (!isOpen) return

    const latestAssistantMessage = [...coachMessages].reverse().find(message => message.role === 'assistant')
    const nextKey = latestAssistantMessage ? `${latestAssistantMessage.createdAt || ''}-${latestAssistantMessage.text || ''}` : ''
    if (!nextKey || latestAssistantMessageKeyRef.current === nextKey) return

    latestAssistantMessageKeyRef.current = nextKey
    scrollPanelToSection(johnnyCardRef)
  }, [coachMessages, isOpen, scrollPanelToSection])

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
      preferNativeSpeech: voicePrefs.preferNativeSpeech,
      nativeAudioMode: voicePrefs.nativeAudioMode,
      usePremiumVoice,
      useInstantVoice,
      openAiVoice: voicePrefs.openAiVoice,
      rate: voicePrefs.rate,
      instantVoiceURI: preferredInstantVoiceURI,
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
  }, [coachMessages, handleSpeechAttemptEvent, instantVoiceSupported, isOpen, liveVoiceMode, playbackSupported, preferredInstantVoiceURI, stopTtsPlayback, voicePlaybackSupported, voicePrefs.nativeAudioMode, voicePrefs.openAiVoice, voicePrefs.preferNativeSpeech, voicePrefs.rate, voiceTestingOpen, voiceLabel, workoutSessionId])

  useEffect(() => {
    if (!isOpen || !lastTransition?.summary || !lastTransition?.allowRestMessages) {
      setRestToast(null)
      return
    }

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
    if (!isOpen || !workoutSessionId || voiceTestingOpen) return
    if (!lastTransition?.at || !lastTransition?.allowRestMessages || !restCueExerciseName) return
    if (!['sweet', 'drift'].includes(restGuidance.tone)) return

    const nextKey = `${workoutSessionId}:${lastTransition.at}:${restGuidance.tone}`
    if (restGuidanceMessageKeyRef.current === nextKey) return

    restGuidanceMessageKeyRef.current = nextKey
    appendCoachMessage({
      role: 'assistant',
      text: buildRestCoachMessage({
        exerciseName: restCueExerciseName,
        kind: lastTransition.kind,
        restGuidance,
      }),
      eventType: `rest_${restGuidance.tone}`,
      createdAt: Date.now(),
      actions: [],
    })
    setCoachStatus('Johnny updated the live rest cue.')
  }, [isOpen, lastTransition, restCueExerciseName, restGuidance, voiceTestingOpen, workoutSessionId])

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
          chatOptions: nextEvent?.manual
            ? { thread_history: 'full' }
            : { thread_history: 'short' },
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
            timerLabel: workoutTimerLabel,
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
      allowRestMessages: false,
      targetExerciseName: nextExercise?.exercise_name || '',
    })
    enqueueCoachEvent({
      type: 'exercise_changed',
      summary: `The user moved to exercise ${nextIndex + 1} of ${totalExerciseCount}: ${nextExercise?.exercise_name || 'next exercise'}.`,
      exerciseContext: buildLiveExerciseSnapshot(nextExercise),
    })
    setCoachStatus('Johnny is updating for the next exercise.')
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
      allowRestMessages: false,
      targetExerciseName: activeExercise.exercise_name || '',
    })
    appendCoachMessage({
      role: 'assistant',
      text: buildSetNavigationCoachMessage({
        exercise: activeExercise,
        setNumber: nextSetNumber,
        totalSetCount,
        restGuidance,
      }),
      eventType: 'set_changed',
      createdAt: Date.now(),
      actions: [],
    })
    setCoachStatus('Johnny updated the next-set cue.')
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
    const setNumber = currentSetIdx + 1
    const completedExercise = setNumber >= totalSetCount
    const hasNextExercise = completedExercise && Boolean(nextExercise?.exercise_name)
    const restTransitionKind = completedExercise ? 'exercise' : 'set'
    const restTargetExerciseName = completedExercise
      ? (nextExercise?.exercise_name || '')
      : (activeExercise?.exercise_name || '')
    const allowRestMessages = !completedExercise || hasNextExercise

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
          set_number: setNumber,
          ...payload,
        })
      }

      const savedSummary = buildSavedSetSummary(activeExercise, currentSetIdx, payload, {
        totalSetCount,
        completedExercise,
      })
      setLastTransition({
        kind: restTransitionKind,
        at: Date.now(),
        summary: savedSummary,
        allowRestMessages,
        targetExerciseName: restTargetExerciseName,
      })
      enqueueCoachEvent({
        type: completedExercise ? 'exercise_completed' : 'set_saved',
        summary: savedSummary,
        exerciseContext: buildLiveExerciseSnapshot(activeExercise),
        savedSet: {
          setNumber,
          totalSetCount,
          completedExercise,
          ...payload,
        },
      })
      setCoachStatus(completedExercise ? 'Exercise saved. Johnny is wrapping up the lift.' : 'Set saved. Johnny is updating.')

      const nextSetKey = `${activeExercise.id}:${currentSetIdx + 1}`
      if (!completedExercise) {
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
      }
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
    const nextOpen = event.currentTarget.open
    setVoiceTestingOpen(nextOpen)

    if (!nextOpen) return

    window.requestAnimationFrame(() => {
      scrollPanelToSection(voiceTestingCardRef)
    })
  }

  function updateVoicePref(field, value) {
    applyVoicePrefs(current => ({
      ...current,
      [field]: value,
    }))
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
      preferNativeSpeech: voicePrefs.preferNativeSpeech,
      nativeAudioMode: voicePrefs.nativeAudioMode,
      usePremiumVoice: true,
      useInstantVoice: false,
      openAiVoice: voicePrefs.openAiVoice,
      rate: voicePrefs.rate,
      instantVoiceURI: preferredInstantVoiceURI,
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
      preferNativeSpeech: voicePrefs.preferNativeSpeech,
      nativeAudioMode: voicePrefs.nativeAudioMode,
      usePremiumVoice: false,
      useInstantVoice: true,
      openAiVoice: voicePrefs.openAiVoice,
      rate: voicePrefs.rate,
      stopPlayback: stopTtsPlayback,
      audioSupported: playbackSupported,
      instantSupported: instantVoiceSupported,
      instantVoiceURI: voiceURI || preferredInstantVoiceURI,
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
        {workoutTimerLabel ? <span className="dashboard-chip workout-session-timer">Workout {workoutTimerLabel}</span> : null}
        <span className={`dashboard-chip subtle live-workout-rest-chip ${restGuidance.tone}`}>{restGuidance.label}</span>
      </div>
      <nav className="live-workout-sticky-nav" aria-label="Live workout shortcuts">
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
      </nav>
    </div>
  )

  return (
    <div className="live-workout-shell">
      <div className="live-workout-backdrop" onClick={onClose} aria-hidden="true" />
      <section ref={panelRef} className="live-workout-panel" role="dialog" aria-modal="true" aria-labelledby="live-workout-title" aria-describedby="live-workout-description" tabIndex={-1}>
        <header className="live-workout-header">
          <div className="live-workout-header-copy">
            <span className="dashboard-chip ai">Live Workout Mode</span>
            <h2 id="live-workout-title">{todayLabel} • {formatToken(displayDayType || session?.session?.planned_day_type || 'workout')} day</h2>
            <div className="live-workout-header-meta">
              {voicePlaybackSupported ? <span className={`dashboard-chip subtle ${liveVoiceMode !== 'mute' ? 'success' : ''}`}>{voiceStatusLabel}</span> : null}
            </div>
            <p id="live-workout-description" className="sr-only">Live workout mode with set logging, session navigation, and Johnny coaching controls.</p>
            {latestVoiceIssue ? <p className="settings-subtitle live-workout-voice-diagnostic" role="status" aria-live="polite">{latestVoiceIssue.message}</p> : null}
          </div>
          <div className="live-workout-header-actions">
            <button ref={exitButtonRef} type="button" className="btn-secondary" onClick={onClose}>Exit live mode</button>
            {voicePlaybackSupported ? (
              <div className="live-workout-voice-switch-shell">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => applyVoicePrefs(current => ({ ...current, liveModeVoiceMode: cycleLiveWorkoutVoiceMode(current.liveModeVoiceMode) }))}
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

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {latestCoachMessage?.role === 'assistant' ? latestCoachMessage.text : ''}
        </div>

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
                <button type="button" className="btn-outline live-workout-nav-next-set" onClick={() => moveSet(1)} disabled={currentSetIdx >= totalSetCount - 1}>Next set</button>
                <button type="button" className="btn-outline live-workout-nav-previous-set" onClick={() => moveSet(-1)} disabled={currentSetIdx <= 0}>Previous set</button>
                <button type="button" className="btn-secondary live-workout-nav-next-exercise" onClick={() => moveExercise(1)} disabled={activeExerciseIdx >= totalExerciseCount - 1}>Next exercise</button>
                <button type="button" className="btn-secondary live-workout-nav-previous-exercise" onClick={() => moveExercise(-1)} disabled={activeExerciseIdx <= 0}>Previous exercise</button>
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
                <div ref={coachLogRef} className="live-workout-coach-log" role="log" aria-live="polite" aria-relevant="additions text" aria-busy={coachBusy}>
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

              {coachStatus ? <p className="settings-subtitle" role="status" aria-live="polite">{coachStatus}</p> : null}
              {!voiceSupported ? <p className="settings-subtitle" id="live-workout-voice-unavailable">Voice capture is unavailable in this browser. Type your question instead.</p> : null}

              <div className="live-workout-coach-actions">
                <textarea
                  ref={textareaRef}
                  value={coachInput}
                  onChange={event => setCoachInput(event.target.value)}
                  onKeyDown={handleCoachInputKeyDown}
                  aria-label="Ask Johnny a workout question"
                  placeholder="Type or record your question here."
                  rows={3}
                />
                <div className="live-workout-coach-buttons">
                  <button type="button" className={`btn-secondary ${listening ? 'recording' : ''}`} onClick={listening ? stopListening : startListening} disabled={!voiceSupported} aria-pressed={listening} aria-label={listening ? 'Stop recording workout question' : 'Record workout question'} aria-describedby={!voiceSupported ? 'live-workout-voice-unavailable' : undefined}>
                    {voiceSupported ? (listening ? 'Stop recording' : 'Record question') : 'Voice unavailable'}
                  </button>
                  <button type="button" className="btn-primary" onClick={handleAskJohnny} disabled={!coachInput.trim()}>
                    Ask Johnny
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section ref={voiceTestingCardRef} className="dash-card live-workout-voice-test-card">
          <details open={voiceTestingOpen} onToggle={handleVoiceTestingToggle}>
            <summary className="live-workout-voice-test-summary">
              <div>
                <span className="dashboard-chip subtle">Voice settings</span>
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
                  <p className="settings-subtitle">Pick which device voice live coach uses when instant voice is active, plus the playback speed.</p>
                  <label>
                    <span>Computer voice</span>
                    <select
                      value={voicePrefs.instantVoiceURI || LIVE_WORKOUT_DEFAULT_INSTANT_VOICE}
                      onChange={event => updateVoicePref('instantVoiceURI', event.target.value)}
                      disabled={!instantVoiceSupported || !instantVoiceOptions.length}
                    >
                      <option value={LIVE_WORKOUT_DEFAULT_INSTANT_VOICE}>Default device voice</option>
                      {instantVoiceOptions.map(voice => (
                        <option key={voice.id} value={voice.voiceURI}>{formatInstantVoiceLabel(voice)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Playback speed</span>
                    <select
                      value={String(voicePrefs.rate)}
                      onChange={event => updateVoicePref('rate', Number(event.target.value))}
                    >
                      {LIVE_WORKOUT_VOICE_RATE_OPTIONS.map(rate => (
                        <option key={rate} value={rate}>{rate.toFixed(rate % 1 === 0 ? 0 : 2)}x</option>
                      ))}
                    </select>
                  </label>
                  <p className="settings-subtitle">Current device voice: {selectedInstantVoiceLabel}. Instant playback runs at {getLiveWorkoutInstantVoiceRate(voicePrefs.rate, false).toFixed(voicePrefs.rate % 1 === 0 ? 0 : 2)}x before any browser-level acceleration.</p>
                  <button type="button" className="btn-outline small" onClick={() => runInstantVoiceTest(preferredInstantVoiceURI)} disabled={!instantVoiceSupported || voiceTestBusy}>
                    {instantVoiceTest.status === 'running' ? 'Testing instant...' : 'Test selected instant voice'}
                  </button>
                  {!instantVoiceSupported ? <p className="error live-workout-inline-error">This browser does not expose the computer voice APIs.</p> : null}
                </div>
                <VoiceTestResultCard result={instantVoiceTest} idleMessage="No instant voice test has run yet." />
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

function buildSessionOpenedCoachMessage({ activeExercise, displayDayType, totalExerciseCount }) {
  const workoutLabel = formatToken(displayDayType || 'workout').toLowerCase()
  const exerciseName = activeExercise?.exercise_name || 'your first exercise'
  const repRange = formatRepRange(activeExercise)
  const queueLabel = totalExerciseCount > 1 ? `${totalExerciseCount} exercises are queued.` : 'You are on the only exercise in the session.'

  return `Live mode is on for this ${workoutLabel} session. Open with ${exerciseName} for ${repRange}, and get moving early so the pace stays tight. ${queueLabel}`
}

function buildSetNavigationCoachMessage({ exercise, setNumber, totalSetCount, restGuidance }) {
  const exerciseName = exercise?.exercise_name || 'the current exercise'
  const repRange = formatRepRange(exercise)
  const totalSetsLabel = totalSetCount > 0 ? `Set ${setNumber} of ${totalSetCount}` : `Set ${setNumber}`

  return `${totalSetsLabel} is up for ${exerciseName}. Stay inside ${repRange} and keep rest in the ${restGuidance.windowLabel} range so the next set does not go stale.`
}

function buildRestCoachMessage({ exerciseName, kind, restGuidance }) {
  const movementLabel = exerciseName || 'the current lift'

  if (restGuidance.tone === 'sweet') {
    return kind === 'exercise'
      ? `Transition timing is in the sweet spot. Roll straight into ${movementLabel} while you are still inside the ${restGuidance.windowLabel} target.`
      : `Rest is in the sweet spot for ${movementLabel}. Take the next set now while you are still inside the ${restGuidance.windowLabel} target.`
  }

  return kind === 'exercise'
    ? `Transition time is drifting long. Get ${movementLabel} started now so the session stays sharp.`
    : `Rest is drifting long on ${movementLabel}. Start the next set now unless you need a little more time for safety.`
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
    active_coaching_cues: normalizeLiveWorkoutCoachingCues(activeExercise?.coaching_cues ?? activeExercise?.coaching_cues_json),
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
    event_saved_set: event?.savedSet || null,
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

function coalesceQueuedCoachEvents(queue, nextEvent) {
  const normalizedQueue = Array.isArray(queue) ? queue.filter(Boolean) : []
  if (!nextEvent || typeof nextEvent !== 'object') return normalizedQueue

  if (nextEvent.manual) {
    return [...normalizedQueue, nextEvent]
  }

  return [
    ...normalizedQueue.filter(candidate => candidate?.manual),
    nextEvent,
  ]
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
  preferNativeSpeech,
  nativeAudioMode,
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
  const nativeResult = await speakNativeJohnnyAnnouncement({
    text,
    utteranceId: messageKey,
    voicePrefs: {
      preferNativeSpeech,
      nativeAudioMode,
      openAiVoice,
      rate,
    },
    onEvent: onAttemptEvent,
  })
  if (nativeResult.started) {
    markSpoken(messageKey)
    return true
  }

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

async function playInstantSpeech({
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
    return false
  }

  if (!isJobCurrent(jobId) || !isVoiceMessageFresh(createdAt)) {
    onAttemptEvent?.({
      type: 'voice_skipped',
      requestStartedAt,
      elapsedMs: Date.now() - requestStartedAt,
      reason: 'stale',
      message: 'Voice reply was delayed too long and was skipped.',
    })
    return false
  }

  const { availableVoices, selectedVoice } = await waitForInstantVoiceSelection(instantVoiceURI)
  if (!isJobCurrent(jobId) || !isVoiceMessageFresh(createdAt)) {
    onAttemptEvent?.({
      type: 'voice_skipped',
      requestStartedAt,
      elapsedMs: Date.now() - requestStartedAt,
      reason: 'stale',
      message: 'Voice reply was delayed too long and was skipped.',
    })
    return false
  }

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
    return false
  }

  return new Promise(resolve => {
    let settled = false
    const utterance = new window.SpeechSynthesisUtterance(text)
    utterance.rate = getLiveWorkoutInstantVoiceRate(rate)
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
        fallbackFromPremium,
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

function waitForInstantVoiceSelection(instantVoiceURI, timeoutMs = 1500) {
  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') {
    return Promise.resolve({ availableVoices: [], selectedVoice: null })
  }

  const resolveSelection = () => {
    const availableVoices = window.speechSynthesis.getVoices()
    return {
      availableVoices,
      selectedVoice: getPreferredInstantVoice(availableVoices, instantVoiceURI),
    }
  }

  const initialSelection = resolveSelection()
  if (initialSelection.availableVoices.length && initialSelection.selectedVoice) {
    return Promise.resolve(initialSelection)
  }

  return new Promise(resolve => {
    let settled = false
    let timeoutId = null
    let pollId = null

    const finish = (selection = resolveSelection()) => {
      if (settled) return
      settled = true
      if (timeoutId != null) {
        window.clearTimeout(timeoutId)
      }
      if (pollId != null) {
        window.clearInterval(pollId)
      }
      window.speechSynthesis.removeEventListener?.('voiceschanged', handleVoicesChanged)
      resolve(selection)
    }

    const handleVoicesChanged = () => {
      const nextSelection = resolveSelection()
      if (nextSelection.availableVoices.length && nextSelection.selectedVoice) {
        finish(nextSelection)
      }
    }

    window.speechSynthesis.addEventListener?.('voiceschanged', handleVoicesChanged)
    pollId = window.setInterval(handleVoicesChanged, 100)
    timeoutId = window.setTimeout(() => finish(), timeoutMs)
    handleVoicesChanged()
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
