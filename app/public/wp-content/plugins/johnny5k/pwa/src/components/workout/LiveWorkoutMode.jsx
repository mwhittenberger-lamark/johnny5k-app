import { useEffect, useMemo, useRef, useState } from 'react'
import { aiApi } from '../../api/client'
import { readLiveWorkoutVoicePrefs, writeLiveWorkoutVoicePrefs } from '../../lib/liveWorkoutVoice'
import johnnyFrameOne from '../../assets/8CD0AD13-4C88-49C7-A455-4B180A3F732B.PNG'
import johnnyFrameTwo from '../../assets/F9159E4E-E475-4BE5-8674-456B7BEFDBEE.PNG'
import johnnyFrameThree from '../../assets/hero.png'

const DEFAULT_LIVE_JOHNNY_FRAMES = [
  { image: johnnyFrameOne, label: 'Locked in', note: 'Placeholder frame 1 of Johnny live coaching art.' },
  { image: johnnyFrameTwo, label: 'Watching the set', note: 'Placeholder frame 2 of Johnny live coaching art.' },
  { image: johnnyFrameThree, label: 'Mid-session cue', note: 'Placeholder frame 3 of Johnny live coaching art.' },
]

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
  timerLabel,
  todayLabel,
  displayDayType,
}) {
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
  const [availableVoices, setAvailableVoices] = useState([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [lastTransition, setLastTransition] = useState(() => ({ kind: 'exercise', at: Date.now(), summary: 'Workout live mode opened.' }))
  const [sessionMapOpen, setSessionMapOpen] = useState(false)
  const [coachLogOpen, setCoachLogOpen] = useState(false)
  const [restToast, setRestToast] = useState(null)
  const queueRef = useRef([])
  const processingRef = useRef(false)
  const recognitionRef = useRef(null)
  const initializedSessionRef = useRef(0)
  const previousExerciseIdRef = useRef(0)
  const textareaRef = useRef(null)
  const spokenMessageRef = useRef('')
  const onCloseRef = useRef(onClose)
  const panelRef = useRef(null)
  const stickyMetaRef = useRef(null)
  const currentLiftRef = useRef(null)
  const johnnyCardRef = useRef(null)
  const coachLogRef = useRef(null)
  const latestAssistantMessageKeyRef = useRef('')
  const restToastTimerRef = useRef(null)
  const voiceSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const playbackSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const workoutSessionId = Number(session?.session?.id || 0)
  const activeExercise = exercises?.[activeExerciseIdx] ?? null
  const totalExerciseCount = Array.isArray(exercises) ? exercises.length : 0
  const totalSetCount = getLiveTotalSetCount(activeExercise)
  const currentSet = activeExercise?.sets?.[currentSetIdx] ?? null
  const currentSetKey = activeExercise?.id ? `${activeExercise.id}:${currentSetIdx}` : 'idle'
  const currentDraft = drafts[currentSetKey] ?? buildDraftFromSet(currentSet)
  const restElapsedSeconds = Math.max(0, Math.floor((now - Number(lastTransition?.at || now)) / 1000))
  const restGuidance = useMemo(() => buildRestGuidance(lastTransition?.kind, restElapsedSeconds), [lastTransition?.kind, restElapsedSeconds])
  const coachFrames = useMemo(() => {
    const configuredFrames = normalizeLiveWorkoutFrames(liveFrames)
    return configuredFrames.length ? configuredFrames : DEFAULT_LIVE_JOHNNY_FRAMES
  }, [liveFrames])
  const currentFrame = coachFrames[frameIndex % coachFrames.length]

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return undefined

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCloseRef.current?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    panelRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    window.scrollTo({ top: 0, behavior: 'auto' })

    return () => {
      window.clearInterval(intervalId)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    writeLiveWorkoutVoicePrefs(voicePrefs)
  }, [voicePrefs])

  useEffect(() => {
    if (!playbackSupported) return undefined

    function syncVoices() {
      const nextVoices = window.speechSynthesis.getVoices()
      setAvailableVoices(Array.isArray(nextVoices) ? nextVoices : [])
    }

    syncVoices()
    window.speechSynthesis.addEventListener('voiceschanged', syncVoices)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', syncVoices)
    }
  }, [playbackSupported])

  useEffect(() => {
    if ((isOpen && voicePrefs.autoSpeak) || !playbackSupported) return
    window.speechSynthesis.cancel()
  }, [isOpen, playbackSupported, voicePrefs.autoSpeak])

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
  }, [activeExercise?.id, currentSet, currentSetIdx, currentSetKey, isOpen])

  useEffect(() => {
    if (!isOpen || !workoutSessionId || initializedSessionRef.current === workoutSessionId) return

    initializedSessionRef.current = workoutSessionId
    setCoachMessages([])
    setFrameIndex(0)
    setSessionMapOpen(false)
    setCoachLogOpen(false)
    setLastTransition({ kind: 'exercise', at: Date.now(), summary: 'Workout live mode opened.' })
    enqueueCoachEvent({
      type: 'session_opened',
      summary: `The user opened Live Workout Mode for a ${formatToken(displayDayType || session?.session?.planned_day_type || 'workout').toLowerCase()} session.`,
      manual: false,
    })
  }, [displayDayType, isOpen, session?.session?.planned_day_type, workoutSessionId])

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
    if (!isOpen || !voicePrefs.autoSpeak || !playbackSupported) return

    const latestAssistantMessage = [...coachMessages].reverse().find(message => message.role === 'assistant')
    const nextText = String(latestAssistantMessage?.text || '').trim()
    if (!nextText || spokenMessageRef.current === nextText) return

    spokenMessageRef.current = nextText
    const utterance = new SpeechSynthesisUtterance(nextText)
    const preferredVoice = availableVoices.find(voice => voice.voiceURI === voicePrefs.voiceURI)
    utterance.rate = voicePrefs.rate
    utterance.pitch = voicePrefs.pitch
    utterance.lang = preferredVoice?.lang || 'en-US'
    if (preferredVoice) {
      utterance.voice = preferredVoice
    }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [availableVoices, coachMessages, isOpen, playbackSupported, voicePrefs.autoSpeak, voicePrefs.pitch, voicePrefs.rate, voicePrefs.voiceURI])

  useEffect(() => {
    if (!isOpen || !lastTransition?.summary) return

    const guidance = buildRestGuidance(lastTransition.kind, 0)
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
  }, [isOpen, lastTransition])

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

  function enqueueCoachEvent(event) {
    queueRef.current.push(event)
    void pumpCoachQueue()
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

  function openDemoSearch(query, exerciseName = activeExercise.exercise_name) {
    const normalizedQuery = String(query || '').trim() || `${exerciseName} exercise tutorial`
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(normalizedQuery)}`, '_blank', 'noopener,noreferrer')
  }

  function handleCoachAction(action, options = {}) {
    if (!action || typeof action !== 'object') return

    if (action.type === 'open_exercise_demo') {
      openDemoSearch(action.payload?.query, action.payload?.exercise_name || activeExercise.exercise_name)
      setCoachStatus(options.auto ? 'Johnny opened a demo for the current exercise.' : 'Opened the exercise demo Johnny suggested.')
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
  const voiceLabel = availableVoices.find(voice => voice.voiceURI === voicePrefs.voiceURI)?.name || 'Default'
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
              {playbackSupported ? <span className={`dashboard-chip subtle ${voicePrefs.autoSpeak ? 'success' : ''}`}>Voice {voicePrefs.autoSpeak ? 'on' : 'off'} • {voiceLabel}</span> : null}
            </div>
          </div>
          <div className="live-workout-header-actions">
            {playbackSupported ? <button type="button" className="btn-outline" onClick={() => setVoicePrefs(current => ({ ...current, autoSpeak: !current.autoSpeak }))}>{voicePrefs.autoSpeak ? 'Mute Johnny' : 'Unmute Johnny'}</button> : null}
            <button type="button" className="btn-secondary" onClick={onClose}>Exit live mode</button>
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
                <span className="dashboard-chip subtle">Every workout change updates him</span>
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

        {restToast ? (
          <div className="live-workout-toast" role="status" aria-live="polite">
            <strong>{restToast.title}</strong>
            <p>{restToast.message}</p>
          </div>
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
    return `You are Johnny coaching a user live during their workout inside Johnny5k. Current exercise: ${exerciseName}. Answer the user's question directly in no more than 3 short sentences. Give one concrete coaching cue when possible. If the question is about form, setup, or how to perform the movement, prefer returning an open_exercise_demo action for the current exercise. User question: ${userText}`
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

function buildRestGuidance(kind, elapsedSeconds) {
  const isExerciseTransition = kind === 'exercise'
  const minSeconds = isExerciseTransition ? 120 : 30
  const maxSeconds = isExerciseTransition ? 180 : 60
  const windowLabel = isExerciseTransition ? '2-3 min between exercises' : '30-60 sec between sets'

  if (elapsedSeconds < minSeconds) {
    return {
      tone: 'tight',
      title: 'Keep rest honest',
      label: `${formatElapsedSeconds(elapsedSeconds)} elapsed`,
      windowLabel,
      message: isExerciseTransition
        ? 'You are still inside the planned exercise transition window. Set up the next station, breathe, and get moving before downtime stretches.'
        : 'You are still inside the target set-rest window. Catch your breath, then get back under the bar before the set gets stale.',
    }
  }

  if (elapsedSeconds <= maxSeconds) {
    return {
      tone: 'sweet',
      title: 'This is the sweet spot',
      label: `${formatElapsedSeconds(elapsedSeconds)} elapsed`,
      windowLabel,
      message: isExerciseTransition
        ? 'Transition time is still right where Johnny wants it. Move into the next exercise before focus drifts.'
        : 'Rest is right where Johnny wants it. You are clear to take the next set while tension and focus are still there.',
    }
  }

  return {
    tone: 'drift',
    title: 'Downtime is drifting',
    label: `${formatElapsedSeconds(elapsedSeconds)} elapsed`,
    windowLabel,
    message: isExerciseTransition
      ? 'You are past the preferred 2 to 3 minute transition window. Get the next exercise started so the session stays sharp.'
      : 'You are past the preferred 30 to 60 second rest window. Start the next set now unless technique or safety says you need a touch longer.',
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
