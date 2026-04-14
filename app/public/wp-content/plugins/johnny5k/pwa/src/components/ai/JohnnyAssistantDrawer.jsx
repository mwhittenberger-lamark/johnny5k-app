import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { aiApi } from '../../api/modules/ai'
import { analyticsApi } from '../../api/modules/analytics'
import { getAccessibleScrollBehavior, useOverlayAccessibility } from '../../lib/accessibility'
import { formatUsShortDate } from '../../lib/dateFormat'
import { getAppImageUrl } from '../../lib/appImages'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import { readLiveWorkoutVoicePrefs } from '../../lib/liveWorkoutVoice'
import { confirmGlobalAction } from '../../lib/uiFeedback'
import { useAuthStore } from '../../store/authStore'
import { useDashboardStore } from '../../store/dashboardStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import { useWorkoutStore } from '../../store/workoutStore'
import { renderChatMessageBlocks } from './chatMessageFormatter'
import AppIcon from '../ui/AppIcon'
import ClearableInput from '../ui/ClearableInput'

const THREAD_KEY = 'main'
const ACTION_TOOLS = new Set([
  'log_steps',
  'log_sleep',
  'log_food_from_description',
  'create_training_plan',
  'create_custom_workout',
  'create_personal_exercise',
  'add_pantry_items',
  'add_grocery_gap_items',
  'swap_workout_exercise',
  'schedule_sms_reminder',
  'clear_follow_ups',
  'clear_sms_reminders',
])

const ACTION_DESTINATIONS = {
  log_steps: { path: '/body', state: { focusTab: 'steps' }, label: 'Open steps' },
  log_sleep: { path: '/body', state: { focusTab: 'sleep' }, label: 'Open sleep' },
  log_food_from_description: { path: '/nutrition', label: 'Open nutrition' },
  add_pantry_items: { path: '/nutrition/pantry', label: 'Open pantry' },
  add_grocery_gap_items: { path: '/nutrition', state: { focusSection: 'groceryGap' }, label: 'Open grocery gap' },
  create_training_plan: { path: '/workout', label: 'Open workout' },
  create_custom_workout: { path: '/workout', state: { johnnyActionNotice: 'Johnny queued a custom workout for you on the Workout screen.' }, label: 'Open workout' },
  create_personal_exercise: { path: '/workout/library', state: { johnnyActionNotice: 'Johnny added an exercise to your custom exercise library.' }, label: 'Open library' },
  swap_workout_exercise: { path: '/workout', label: 'Open workout' },
  clear_follow_ups: { path: '/settings', state: { johnnyActionNotice: 'Johnny cleared the requested follow-ups.' }, label: 'Open settings' },
  clear_sms_reminders: { path: '/settings', state: { johnnyActionNotice: 'Johnny canceled the requested SMS reminders.' }, label: 'Open settings' },
}

const SUPPORTED_MODEL_ACTIONS = new Set([
  'open_screen',
  'show_nutrition_summary',
  'show_grocery_gap',
  'highlight_goal_issue',
  'create_saved_meal_draft',
  'suggest_recipe_plan',
  'queue_follow_up',
  'run_workflow',
])

const AUTO_EXECUTABLE_MODEL_ACTIONS = new Set([
  'open_screen',
  'show_nutrition_summary',
  'show_grocery_gap',
  'highlight_goal_issue',
  'create_saved_meal_draft',
  'suggest_recipe_plan',
])

export default function JohnnyAssistantDrawer() {
  const navigate = useNavigate()
  const location = useLocation()
  const appImages = useAuthStore(state => state.appImages)
  const { isOpen, closeDrawer, consumeStarterPayload } = useJohnnyAssistantStore()
  const { invalidate, loadSnapshot } = useDashboardStore()
  const workoutSession = useWorkoutStore(state => state.session)
  const reloadWorkoutSession = useWorkoutStore(state => state.reloadSession)
  const exitWorkoutSession = useWorkoutStore(state => state.exitSession)
  const [messages, setMessages] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [durableMemory, setDurableMemory] = useState([])
  const [memoryDraft, setMemoryDraft] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialising, setInitialising] = useState(true)
  const [editingMemory, setEditingMemory] = useState(false)
  const [savingMemory, setSavingMemory] = useState(false)
  const [listening, setListening] = useState(false)
  const [exitingWorkout, setExitingWorkout] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [voicePrefs, setVoicePrefs] = useState(() => readLiveWorkoutVoicePrefs())
  const recognitionRef = useRef(null)
  const drawerRef = useRef(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const ttsAudioRef = useRef(null)
  const spokenMessageKeyRef = useRef('')
  const voiceSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const playbackSupported = typeof window !== 'undefined' && typeof window.Audio !== 'undefined'
  const chatMode = deriveJohnnyMode(location.pathname, messages)
  const johnnyDrawerImage = getAppImageUrl(appImages, 'johnny_drawer')
  const starterSuggestions = getStarterSuggestionsForCurrentTime()
  const drawerTitleId = useId()
  const drawerDescriptionId = useId()
  const scrollBehavior = getAccessibleScrollBehavior()

  useOverlayAccessibility({
    open: isOpen,
    containerRef: drawerRef,
    initialFocusRef: textareaRef,
    onClose: closeDrawer,
  })

  async function hydrateThread() {
    try {
      const data = await aiApi.getThread(THREAD_KEY)
      setMessages(data.messages ?? [])
      setFollowUps(Array.isArray(data.follow_ups) ? data.follow_ups : [])
      const bullets = Array.isArray(data.durable_memory?.bullets) ? data.durable_memory.bullets : []
      setDurableMemory(bullets)
      setMemoryDraft(bullets)
    } catch (error) {
      reportClientDiagnostic({
        source: 'johnny_drawer_thread_hydrate',
        message: 'Johnny assistant history failed to load.',
        error,
        context: {
          thread_key: THREAD_KEY,
        },
      })
      setStatusMessage('Johnny opened, but earlier chat history did not load. You can still start a new conversation.')
    } finally {
      setInitialising(false)
    }
  }

  useEffect(() => {
    hydrateThread()
  }, [])

  useEffect(() => {
    if (initialising || !followUps.length) return
    analyticsApi.event('coach_followups_viewed', {
      screen: 'ai',
      context: 'drawer',
      value_num: followUps.length,
      metadata: {
        follow_up_ids: followUps.slice(0, 4).map(item => item.id),
      },
    }).catch(() => {})
  }, [followUps, initialising])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const stopTtsPlayback = useCallback(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      if (ttsAudioRef.current.src && ttsAudioRef.current.src.startsWith('blob:')) {
        window.URL.revokeObjectURL(ttsAudioRef.current.src)
      }
      ttsAudioRef.current = null
    }
  }, [])

  useEffect(() => () => {
    stopTtsPlayback()
  }, [stopTtsPlayback])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: scrollBehavior })
  }, [messages, loading, isOpen, scrollBehavior])

  useEffect(() => {
    setVoicePrefs(readLiveWorkoutVoicePrefs())
  }, [isOpen])

  useEffect(() => {
    if (isOpen || !playbackSupported) return
    stopTtsPlayback()
  }, [isOpen, playbackSupported, stopTtsPlayback])

  function stopListening() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  function startListening() {
    if (!voiceSupported) {
      setStatusMessage('Voice capture is not supported in this browser.')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = event => {
      let nextTranscript = ''
      for (let index = 0; index < event.results.length; index += 1) {
        nextTranscript += `${event.results[index][0]?.transcript || ''} `
      }
      setInput(nextTranscript.trim())
    }

    recognition.onerror = event => {
      setListening(false)
      recognitionRef.current = null
      setStatusMessage(event?.error ? `Voice capture failed: ${event.error}` : 'Voice capture failed.')
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognition.start()
    recognitionRef.current = recognition
    setStatusMessage('')
    setListening(true)
  }

  async function handleExitWorkout() {
    if (!workoutSession?.session?.id || exitingWorkout) return
    const confirmed = await confirmGlobalAction({
      title: 'Discard in-progress workout?',
      message: 'Exit and discard this workout? Nothing from this session will be logged and it will be treated as if it never happened.',
      confirmLabel: 'Discard workout',
      tone: 'danger',
    })
    if (!confirmed) return

    setExitingWorkout(true)
    try {
      await exitWorkoutSession()
      invalidate()
      loadSnapshot(true)
      setStatusMessage('Johnny discarded the live workout. Nothing was logged.')
      closeDrawer()
      navigate('/dashboard', { state: { johnnyActionNotice: 'Johnny discarded the in-progress workout. Nothing from that session was saved.' } })
    } catch (err) {
      setStatusMessage(err?.message || 'Could not discard the live workout.')
    } finally {
      setExitingWorkout(false)
    }
  }

  const sendPrompt = useCallback(async (message, options = {}) => {
    const nextMessage = message.trim()
    if (!nextMessage || loading) return

    const supportMeta = normalizeSupportStarterMeta(options.meta)

    if (supportMeta.isSupport) {
      analyticsApi.event('support_prompt_started', {
        screen: supportMeta.screen,
        context: supportMeta.surface,
        metadata: {
          guide_id: supportMeta.guideId,
          surface: supportMeta.surface,
        },
      }).catch(() => {})
    }

    setInput('')
    setStatusMessage('')
    setMessages(current => [...current, { role: 'user', message_text: nextMessage }])
    setLoading(true)

    try {
      const data = await aiApi.chat(nextMessage, THREAD_KEY, chatMode, {
        context: buildJohnnyChatContext(location.pathname, chatMode, options.context),
      })
      const modelActions = normalizeModelActions(data.actions)
      const usedTools = Array.isArray(data.used_tools) ? data.used_tools : []
      const actionResults = Array.isArray(data.action_results) ? data.action_results : []
      const actionTools = getActionTools(usedTools, actionResults)
      const autoAction = !actionTools.length ? getAutoExecutableModelAction(modelActions) : null

      setMessages(current => [...current, {
        role: 'assistant',
        message_text: data.reply,
        sources: data.sources ?? [],
        actions: modelActions,
        used_tools: usedTools,
        action_results: actionResults,
        why: data.why || '',
        context_used: Array.isArray(data.context_used) ? data.context_used : [],
        confidence: data.confidence || '',
      }])
      if (Array.isArray(data.queued_follow_ups) && data.queued_follow_ups.length) {
        setFollowUps(current => dedupeFollowUps([...current, ...data.queued_follow_ups]))
      }

      if (actionTools.length) {
        const clearedFollowUpIds = actionResults
          .filter(result => getActionName(result) === 'clear_follow_ups')
          .flatMap(result => Array.isArray(result?.cleared_ids) ? result.cleared_ids : [])

        if (clearedFollowUpIds.length) {
          const clearedSet = new Set(clearedFollowUpIds.map(id => String(id)))
          setFollowUps(current => current.filter(item => !clearedSet.has(String(item?.id || ''))))
        }

        invalidate()
        loadSnapshot(true)
        if (actionTools.includes('swap_workout_exercise')) {
          reloadWorkoutSession().catch(error => {
            reportClientDiagnostic({
              source: 'johnny_drawer_workout_refresh',
              message: 'Workout session refresh failed after Johnny action.',
              error,
              context: {
                action_tools: actionTools,
              },
            })
            setStatusMessage('Johnny made the change, but the workout screen needs a refresh to show it.')
          })
        }
        setStatusMessage(buildActionStatus(actionResults, actionTools))
        window.dispatchEvent(new CustomEvent('johnny-assistant-action', { detail: { usedTools: actionTools, actionResults } }))
      } else if (modelActions.length) {
        if (autoAction) {
          const destination = getModelActionDestination(autoAction)
          if (destination) {
            navigate(destination.path, destination.state ? { state: destination.state } : undefined)
          }
        }
        setStatusMessage(buildModelActionStatus(modelActions, autoAction))
        window.dispatchEvent(new CustomEvent('johnny-assistant-action', { detail: { actions: modelActions, autoAction: autoAction?.type || null } }))
      }

      if (supportMeta.isSupport) {
        const supportDestination = autoAction
          ? getModelActionDestination(autoAction)
          : getFirstModelActionDestination(modelActions)

        if (actionTools.length || supportDestination) {
          analyticsApi.event('support_navigation_used', {
            screen: supportMeta.screen,
            context: supportMeta.surface,
            metadata: {
              guide_id: supportMeta.guideId,
              surface: supportMeta.surface,
              destination_path: supportDestination?.path || '',
              auto_action: autoAction?.type || '',
              tool_count: actionTools.length,
            },
          }).catch(() => {})
        } else {
          analyticsApi.event('support_help_unresolved', {
            screen: supportMeta.screen,
            context: supportMeta.surface,
            metadata: {
              guide_id: supportMeta.guideId,
              surface: supportMeta.surface,
              confidence: String(data.confidence || ''),
              action_count: modelActions.length,
            },
          }).catch(() => {})
        }
      }
    } catch (err) {
      const messageText = err?.message || 'Something went wrong.'
      setMessages(current => [...current, { role: 'assistant', message_text: `⚠️ ${messageText}` }])
      setStatusMessage(messageText)

      const supportMeta = normalizeSupportStarterMeta(options.meta)
      if (supportMeta.isSupport) {
        analyticsApi.event('support_help_unresolved', {
          screen: supportMeta.screen,
          context: supportMeta.surface,
          metadata: {
            guide_id: supportMeta.guideId,
            surface: supportMeta.surface,
            error: messageText,
          },
        }).catch(() => {})
      }
    } finally {
      setLoading(false)
    }
  }, [chatMode, invalidate, loadSnapshot, loading, location.pathname, navigate, reloadWorkoutSession])

  useEffect(() => {
    if (!isOpen || initialising || loading) return

    const starterPayload = consumeStarterPayload()
    if (!starterPayload?.prompt) return
    sendPrompt(starterPayload.prompt, starterPayload)
  }, [isOpen, initialising, loading, consumeStarterPayload, sendPrompt])

  useEffect(() => {
    if (!isOpen || initialising || !voicePrefs.assistantAutoSpeak || !playbackSupported) return

    const latestAssistantMessage = [...messages].reverse().find(entry => entry.role === 'assistant')
    const nextText = String(latestAssistantMessage?.message_text || '').trim()
    const nextKey = latestAssistantMessage ? `${latestAssistantMessage.created_at || ''}-${nextText}` : ''
    if (!nextText || !nextKey) return

    if (!spokenMessageKeyRef.current) {
      spokenMessageKeyRef.current = nextKey
      return
    }
    if (spokenMessageKeyRef.current === nextKey) return
    spokenMessageKeyRef.current = nextKey

    aiApi.speech(nextText, {
      voice: voicePrefs.openAiVoice,
      speed: voicePrefs.rate,
      format: 'mp3',
    }).then(blob => {
      if (!isOpen) return
      stopTtsPlayback()
      const objectUrl = window.URL.createObjectURL(blob)
      const audio = new window.Audio(objectUrl)
      audio.onended = () => {
        if (audio.src.startsWith('blob:')) {
          window.URL.revokeObjectURL(audio.src)
        }
        if (ttsAudioRef.current === audio) {
          ttsAudioRef.current = null
        }
      }
      audio.onerror = () => {
        if (audio.src.startsWith('blob:')) {
          window.URL.revokeObjectURL(audio.src)
        }
        if (ttsAudioRef.current === audio) {
          ttsAudioRef.current = null
        }
      }
      ttsAudioRef.current = audio
      audio.play().catch(() => {
        if (audio.src.startsWith('blob:')) {
          window.URL.revokeObjectURL(audio.src)
        }
        if (ttsAudioRef.current === audio) {
          ttsAudioRef.current = null
        }
      })
    }).catch(() => {})
  }, [initialising, isOpen, messages, playbackSupported, stopTtsPlayback, voicePrefs.assistantAutoSpeak, voicePrefs.openAiVoice, voicePrefs.rate])

  async function handleSubmit(event) {
    event?.preventDefault()
    await sendPrompt(input)
  }

  async function handleInputKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) {
      return
    }

    event.preventDefault()
    await sendPrompt(input)
  }

  async function handleClearThread() {
    if (loading) return

    try {
      await aiApi.clearThread(THREAD_KEY)
      setMessages([])
      setFollowUps([])
      setStatusMessage('Johnny chat cleared.')
    } catch (err) {
      setStatusMessage(err?.message || 'Could not clear the chat.')
    }
  }

  async function handleDismissFollowUp(followUpId) {
    try {
      await aiApi.dismissFollowUp(followUpId)
      setFollowUps(current => current.filter(item => item.id !== followUpId))
      analyticsApi.event('coach_followup_dismissed', {
        screen: 'ai',
        context: 'drawer',
        metadata: {
          follow_up_id: followUpId,
        },
      }).catch(() => {})
    } catch (err) {
      setStatusMessage(err?.message || 'Could not dismiss the follow-up.')
    }
  }

  async function handleUpdateFollowUp(followUpId, state, dueAt = '') {
    try {
      const data = await aiApi.updateFollowUp(followUpId, { state, due_at: dueAt })
      setFollowUps(Array.isArray(data.follow_ups) ? data.follow_ups : [])
      analyticsApi.event(`coach_followup_${state}`, {
        screen: 'ai',
        context: 'drawer',
        metadata: {
          follow_up_id: followUpId,
          due_at: dueAt,
        },
      }).catch(() => {})
    } catch (err) {
      setStatusMessage(err?.message || 'Could not update the follow-up.')
    }
  }

  async function handleSaveMemory() {
    if (savingMemory) return

    setSavingMemory(true)
    try {
      const bullets = memoryDraft.map(item => item.trim()).filter(Boolean)
      const data = await aiApi.updateMemory(bullets)
      const nextBullets = Array.isArray(data.durable_memory?.bullets) ? data.durable_memory.bullets : bullets
      setDurableMemory(nextBullets)
      setMemoryDraft(nextBullets)
      setEditingMemory(false)
      setStatusMessage('Updated Johnny’s coaching memory.')
    } catch (err) {
      setStatusMessage(err?.message || 'Could not update coaching memory.')
    } finally {
      setSavingMemory(false)
    }
  }

  function handleRunWorkflow(action) {
    const workflowContext = buildWorkflowExecutionContext(action)
    const destination = workflowContext.destination
    const starterPrompt = workflowContext.starterPrompt

    if (destination) {
      navigate(destination.path, destination.state ? { state: destination.state } : undefined)
    }

    if (starterPrompt) {
      sendPrompt(starterPrompt, {
        context: {
          workflow: action?.payload?.workflow || '',
          workflow_title: action?.payload?.title || '',
          workflow_steps: Array.isArray(action?.payload?.steps) ? action.payload.steps : [],
          workflow_focus_section: workflowContext.focusSection || '',
        },
      })
      return
    }

    setStatusMessage(buildModelActionSummary(action))
  }

  if (!isOpen) {
    return null
  }

  return (
    <>
      <div className="johnny-drawer-backdrop open" onClick={closeDrawer} aria-hidden="true" />
      <aside
        ref={drawerRef}
        className="johnny-drawer open"
        role="dialog"
        aria-modal="true"
        aria-labelledby={drawerTitleId}
        aria-describedby={drawerDescriptionId}
        tabIndex={-1}
      >
        <div className="johnny-drawer-shell">
          <header className="johnny-drawer-header">
            <div className="johnny-drawer-header-main">
              <div>
                <span className="dashboard-chip ai">Coach</span>
                <h2 id={drawerTitleId}>Johnny5k</h2>
                <p id={drawerDescriptionId}>Ask Johnny for health advice or have him log an entry for you.</p>
              </div>
              <span className="johnny-drawer-header-art" aria-hidden="true">
                <img src={johnnyDrawerImage} alt="" />
              </span>
            </div>
            <div className="johnny-drawer-actions johnny-drawer-actions-chat">
              {workoutSession?.session?.id && !workoutSession?.session?.completed ? (
                <button type="button" className="btn-secondary small johnny-drawer-action-button johnny-drawer-action-exit" title="Exit workout" onClick={handleExitWorkout} disabled={loading || exitingWorkout}>
                  <AppIcon name="close" />
                  <span>{exitingWorkout ? 'Exiting…' : 'Exit workout'}</span>
                </button>
              ) : null}
              <button type="button" className="btn-secondary small johnny-drawer-action-button" title="Clear chat" onClick={handleClearThread} disabled={loading}>
                <AppIcon name="trash" />
                <span>Clear</span>
              </button>
              <button type="button" className="btn-secondary small johnny-drawer-action-button" title="Close Johnny" onClick={closeDrawer}>
                <AppIcon name="close" />
                <span>Close</span>
              </button>
            </div>
          </header>

          {statusMessage ? <p className="johnny-drawer-status" role="status" aria-live="polite">{statusMessage}</p> : null}

          <div className="chat-log johnny-drawer-log" role="log" aria-live="polite" aria-relevant="additions text" aria-busy={loading} aria-label="Johnny conversation">
            {initialising ? <p className="chat-loading">Loading…</p> : null}
            {!initialising && (durableMemory.length || editingMemory) ? (
              <DurableMemoryCard
                bullets={durableMemory}
                draft={memoryDraft}
                editing={editingMemory}
                saving={savingMemory}
                onStartEdit={() => {
                  setMemoryDraft(durableMemory.length ? durableMemory : [''])
                  setEditingMemory(true)
                }}
                onCancelEdit={() => {
                  setMemoryDraft(durableMemory)
                  setEditingMemory(false)
                }}
                onChangeDraft={setMemoryDraft}
                onSave={handleSaveMemory}
              />
            ) : null}
            {!initialising && followUps.length ? (
              <div className="johnny-follow-up-stack">
                {followUps.slice(0, 2).map(followUp => (
                  <FollowUpCard
                    key={followUp.id}
                    followUp={followUp}
                    onAsk={async () => {
                      await sendPrompt(followUp.starter_prompt || followUp.prompt, {
                        context: {
                          follow_up_prompt: followUp.prompt,
                          follow_up_reason: followUp.reason || '',
                          follow_up_due_at: followUp.due_at || '',
                        },
                      })
                      handleUpdateFollowUp(followUp.id, 'completed')
                    }}
                    onComplete={() => handleUpdateFollowUp(followUp.id, 'completed')}
                    onSnooze={() => handleUpdateFollowUp(followUp.id, 'snoozed', buildTomorrowFollowUpDueAt())}
                    onDismiss={() => handleDismissFollowUp(followUp.id)}
                  />
                ))}
              </div>
            ) : null}
            {!initialising && messages.length === 0 ? (
              <div className="chat-welcome johnny-drawer-welcome">
                <p>Ask Johnny to log steps or sleep, log food, update pantry or grocery gap, swap a workout exercise, build a training plan, or talk through your next move.</p>
                <div className="johnny-drawer-suggestions">
                  {starterSuggestions.map(prompt => (
                    <button key={prompt} type="button" className="johnny-drawer-suggestion" onClick={() => sendPrompt(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message, index) => {
              const actionResults = Array.isArray(message.action_results) ? message.action_results : []
              const modelActions = normalizeModelActions(message.actions)
              const actionTools = getActionTools(
                Array.isArray(message.used_tools) ? message.used_tools : [],
                actionResults,
              )

              return (
                <div key={`${message.role}-${index}`} className={`chat-msg ${message.role}`}>
                  <div className="chat-msg-bubble">{renderChatMessageBlocks(message.message_text)}</div>
                  {message.role === 'assistant' && (message.why || (Array.isArray(message.context_used) && message.context_used.length) || message.confidence) ? (
                    <ReasoningCard
                      why={message.why}
                      contextUsed={Array.isArray(message.context_used) ? message.context_used : []}
                      confidence={message.confidence}
                    />
                  ) : null}
                  {actionResults.length ? <ActionResultList actionResults={actionResults} onNavigate={destination => {
                    navigate(destination.path, destination.state ? { state: destination.state } : undefined)
                    closeDrawer()
                  }} /> : null}
                  {!actionResults.length && modelActions.length ? <ModelActionList actions={modelActions} onNavigate={destination => {
                    navigate(destination.path, destination.state ? { state: destination.state } : undefined)
                    closeDrawer()
                  }} onQueueFollowUp={prompt => {
                    sendPrompt(prompt)
                  }} onRunWorkflow={handleRunWorkflow} /> : null}
                  {!actionResults.length && actionTools.length ? (
                    <div className="johnny-action-tags">
                      {actionTools.map(toolName => (
                        <span key={toolName} className="johnny-action-tag">{formatToolLabel(toolName)}</span>
                      ))}
                    </div>
                  ) : null}
                  {message.role === 'assistant' && Array.isArray(message.sources) && message.sources.length > 0 ? (
                    <div className="chat-sources">
                      {message.sources.map(source => (
                        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                          {source.title || source.url}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}

            {loading ? (
              <div className="chat-msg assistant">
                <div className="chat-msg-bubble typing-indicator">…</div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <form className="chat-input-bar johnny-drawer-input" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              aria-label="Message Johnny"
              placeholder="Ask Johnny to coach you or do something for you…"
              rows={3}
              disabled={loading}
            />
            <div className="johnny-input-actions">
              {voiceSupported ? (
                <button type="button" className={`btn-secondary small johnny-drawer-action-button johnny-voice-btn ${listening ? 'recording' : ''}`} onClick={listening ? stopListening : startListening} disabled={loading} aria-pressed={listening} aria-label={listening ? 'Stop voice input' : 'Start voice input'}>
                  {listening ? 'Stop' : 'Voice'}
                </button>
              ) : null}
              <button type="submit" className="btn-send small johnny-drawer-action-button" disabled={loading || !input.trim()} aria-label="Send message to Johnny">
                <span>Send</span>
                <AppIcon name="send" />
              </button>
            </div>
          </form>
        </div>
      </aside>
    </>
  )
}

function DurableMemoryCard({ bullets, draft, editing, saving, onStartEdit, onCancelEdit, onChangeDraft, onSave }) {
  return (
    <div className="johnny-memory-card">
      <div className="johnny-memory-card-head">
        <span className="dashboard-chip subtle">What Johnny remembers</span>
        {!editing ? <button type="button" className="btn-secondary small" onClick={onStartEdit}>Edit</button> : null}
      </div>
      {!editing ? (
        <ul>
          {bullets.slice(0, 4).map(bullet => <li key={bullet}>{bullet}</li>)}
        </ul>
      ) : (
        <div className="johnny-memory-editor">
          {(draft.length ? draft : ['']).map((bullet, index) => (
            <div key={`memory-${index}`} className="johnny-memory-editor-row">
              <ClearableInput
                type="text"
                value={bullet}
                onChange={event => onChangeDraft(current => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                placeholder="Short coaching note Johnny should remember"
              />
              <button
                type="button"
                className="btn-outline small"
                onClick={() => onChangeDraft(current => current.filter((_, itemIndex) => itemIndex !== index))}
                disabled={draft.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="johnny-memory-editor-actions">
            <button type="button" className="btn-secondary small" onClick={() => onChangeDraft(current => [...current, ''])}>Add memory</button>
            <button type="button" className="btn-outline small" onClick={onCancelEdit}>Cancel</button>
            <button type="button" className="btn-primary small" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function FollowUpCard({ followUp, onAsk, onComplete, onSnooze, onDismiss }) {
  return (
    <div className="johnny-follow-up-card">
      <div className="johnny-follow-up-head">
        <span className="dashboard-chip ai">Johnny follow-up</span>
        {followUp.status ? <span className={`johnny-follow-up-status ${followUp.status}`}>{formatFollowUpStateLabel(followUp.status)}</span> : null}
        {followUp.due_at ? <span className="johnny-follow-up-date">{formatFollowUpDueAt(followUp.due_at)}</span> : null}
      </div>
      <p className="johnny-follow-up-prompt">{followUp.prompt}</p>
      {followUp.reason ? <p className="johnny-follow-up-reason">{followUp.reason}</p> : null}
      {followUp.next_step ? <p className="johnny-follow-up-next-step">Next step: {followUp.next_step}</p> : null}
      <div className="johnny-follow-up-actions">
        <button type="button" className="btn-secondary small" onClick={onAsk}>Ask now</button>
        <button type="button" className="btn-secondary small" onClick={onComplete}>Done</button>
        <button type="button" className="btn-outline small" onClick={onSnooze}>Tomorrow</button>
        <button type="button" className="btn-outline small" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  )
}

function ReasoningCard({ why, contextUsed, confidence }) {
  return (
    <div className="johnny-reasoning-card">
      <div className="johnny-reasoning-head">
        <span className="dashboard-chip subtle">Why Johnny said this</span>
        {confidence ? <span className={`johnny-reasoning-confidence ${confidence}`}>{formatConfidenceLabel(confidence)}</span> : null}
      </div>
      {why ? <p>{why}</p> : null}
      {contextUsed.length ? (
        <ul>
          {contextUsed.slice(0, 4).map(item => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
    </div>
  )
}

function ActionResultList({ actionResults, onNavigate }) {
  return (
    <div className="johnny-action-cards">
      {actionResults.map((result, index) => {
        const actionName = getActionName(result)
        const destination = ACTION_DESTINATIONS[actionName] ?? null
        const meta = buildActionMeta(result)

        return (
          <div key={`${actionName}-${index}`} className="johnny-action-card">
            <div className="johnny-action-card-head">
              <span className="johnny-action-tag">{formatToolLabel(actionName)}</span>
            </div>
            <p className="johnny-action-card-title">{buildActionTitle(result)}</p>
            <p className="johnny-action-card-summary">{result.summary || buildFallbackSummary(result)}</p>
            {result.coach_note ? <p className="johnny-action-card-coach-note">{result.coach_note}</p> : null}
            {meta ? <p className="johnny-action-card-meta">{meta}</p> : null}
            {destination ? (
              <button type="button" className="btn-secondary small johnny-action-link" onClick={() => onNavigate(destination)}>
                {destination.label}
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function ModelActionList({ actions, onNavigate, onQueueFollowUp, onRunWorkflow }) {
  return (
    <div className="johnny-action-cards">
      {actions.map((action, index) => {
        const destination = getModelActionDestination(action)
        const summary = buildModelActionSummary(action)
        const meta = buildModelActionMeta(action)
        const followUpPrompt = getQueuedFollowUpPrompt(action)
        const workflowSteps = getWorkflowSteps(action)
        const isWorkflow = action.type === 'run_workflow'

        return (
          <div key={`${action.type}-${index}`} className="johnny-action-card">
            <div className="johnny-action-card-head">
              <span className="johnny-action-tag">{formatModelActionLabel(action.type)}</span>
            </div>
            <p className="johnny-action-card-title">{buildModelActionTitle(action)}</p>
            <p className="johnny-action-card-summary">{summary}</p>
            {meta ? <p className="johnny-action-card-meta">{meta}</p> : null}
            {workflowSteps.length ? (
              <ol className="johnny-workflow-steps">
                {workflowSteps.map(step => <li key={step}>{step}</li>)}
              </ol>
            ) : null}
            {isWorkflow ? (
              <button type="button" className="btn-secondary small johnny-action-link" onClick={() => onRunWorkflow(action)}>
                Start workflow
              </button>
            ) : null}
            {destination ? (
              <button type="button" className="btn-secondary small johnny-action-link" onClick={() => onNavigate(destination)}>
                {destination.actionLabel || destination.label}
              </button>
            ) : null}
            {!destination && !isWorkflow && followUpPrompt ? (
              <button type="button" className="btn-secondary small johnny-action-link" onClick={() => onQueueFollowUp(followUpPrompt)}>
                Ask follow-up
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function formatToolLabel(toolName) {
  switch (toolName) {
    case 'log_steps':
      return 'Steps logged'
    case 'log_sleep':
      return 'Sleep logged'
    case 'log_food_from_description':
      return 'Food logged'
    case 'add_pantry_items':
      return 'Pantry updated'
    case 'add_grocery_gap_items':
      return 'Grocery gap updated'
    case 'create_training_plan':
      return 'Plan created'
    case 'create_custom_workout':
      return 'Custom workout ready'
    case 'create_personal_exercise':
      return 'Exercise saved'
    case 'swap_workout_exercise':
      return 'Workout updated'
    case 'schedule_sms_reminder':
      return 'SMS reminder scheduled'
    case 'clear_follow_ups':
      return 'Follow-ups cleared'
    case 'clear_sms_reminders':
      return 'SMS reminders cleared'
    default:
      return 'Action completed'
  }
}

function getActionTools(usedTools, actionResults) {
  const names = new Set()

  usedTools.forEach(toolName => {
    if (ACTION_TOOLS.has(toolName)) {
      names.add(toolName)
    }
  })

  actionResults.forEach(result => {
    const actionName = getActionName(result)
    if (ACTION_TOOLS.has(actionName)) {
      names.add(actionName)
    }
  })

  return Array.from(names)
}

function normalizeModelActions(actions) {
  return (Array.isArray(actions) ? actions : []).filter(action => {
    const type = String(action?.type || '').trim()
    return type && SUPPORTED_MODEL_ACTIONS.has(type)
  })
}

function buildJohnnyChatContext(pathname, mode, extraContext = {}) {
  const base = {
    surface: 'assistant_drawer',
    current_path: pathname || '/',
    current_screen: getCurrentScreenName(pathname),
    conversation_mode: mode || 'general',
  }

  return { ...base, ...(extraContext || {}) }
}

function buildModelActionStatus(actions, autoAction = null) {
  if (!actions.length) return ''
  if (autoAction) {
    return `${buildModelActionSummary(autoAction)} Opened automatically.`
  }
  if (actions.length === 1) {
    return buildModelActionSummary(actions[0])
  }
  return `${actions.length} suggested actions ready.`
}

function dedupeFollowUps(items) {
  const seen = new Set()
  return items.filter(item => {
    const prompt = String(item?.prompt || '').trim().toLowerCase()
    if (!prompt || seen.has(prompt)) return false
    seen.add(prompt)
    return true
  })
}

function deriveJohnnyMode(pathname, messages = []) {
  const recentUserText = [...messages].reverse().find(message => message?.role === 'user')?.message_text || ''
  const loweredPath = String(pathname || '').toLowerCase()
  const loweredText = String(recentUserText || '').toLowerCase()

  if (loweredPath.includes('/nutrition')) return 'nutrition'
  if (loweredPath.includes('/workout')) return loweredText.includes('review') ? 'workout_review' : 'coach'
  if (loweredPath.includes('/settings')) return 'planning'
  if (loweredPath.includes('/dashboard')) return 'accountability'
  return 'general'
}

function formatModelActionLabel(type) {
  switch (type) {
    case 'open_screen':
      return 'Open screen'
    case 'show_nutrition_summary':
      return 'Nutrition summary'
    case 'show_grocery_gap':
      return 'Grocery gap'
    case 'highlight_goal_issue':
      return 'Goal issue'
    case 'create_saved_meal_draft':
      return 'Saved meal draft'
    case 'suggest_recipe_plan':
      return 'Recipe plan'
    case 'queue_follow_up':
      return 'Follow-up ready'
    case 'run_workflow':
      return 'Workflow'
    default:
      return 'Suggested action'
  }
}

function buildModelActionTitle(action) {
  const payload = action?.payload ?? {}

  switch (action.type) {
    case 'open_screen':
      return payload.screen ? `Open ${String(payload.screen).replace(/_/g, ' ')}` : 'Open app screen'
    case 'show_nutrition_summary':
      return 'Review nutrition summary'
    case 'show_grocery_gap':
      return 'Review grocery gap'
    case 'highlight_goal_issue':
      return payload.issue ? String(payload.issue) : 'Goal issue surfaced'
    case 'create_saved_meal_draft':
      return payload.name || 'Draft saved meal'
    case 'suggest_recipe_plan':
      return payload.title || 'Recipe suggestions ready'
    case 'queue_follow_up':
      return 'Queued follow-up'
    case 'run_workflow':
      return payload.title || humanizeWorkflowName(payload.workflow || 'workflow')
    default:
      return 'Suggested action'
  }
}

function buildModelActionSummary(action) {
  const payload = action?.payload ?? {}

  switch (action.type) {
    case 'open_screen':
      return 'Johnny suggested opening the most relevant screen for the next step.'
    case 'show_nutrition_summary':
      return 'Open nutrition to review calories, protein, and today\'s meals.'
    case 'show_grocery_gap':
      return 'Open nutrition and jump straight to the grocery gap list.'
    case 'highlight_goal_issue':
      return payload.summary || 'Johnny flagged a goal issue worth addressing now.'
    case 'create_saved_meal_draft':
      return 'Open saved meals with a draft name prefilled so you can finish the meal quickly.'
    case 'suggest_recipe_plan':
      return 'Open recipe ideas and keep planning tied to what you can actually cook next.'
    case 'queue_follow_up':
      return payload.prompt || 'Johnny suggested one short follow-up question.'
    case 'run_workflow':
      return payload.summary || 'Johnny mapped a short sequence so you can move from advice into action.'
    default:
      return 'Johnny suggested a next step.'
  }
}

function buildModelActionMeta(action) {
  const payload = action?.payload ?? {}

  switch (action.type) {
    case 'create_saved_meal_draft':
      return [
        payload.meal_type ? `Meal: ${payload.meal_type}` : '',
        Array.isArray(payload.items) && payload.items.length ? `${payload.items.length} draft items` : '',
      ].filter(Boolean).join(' | ')
    case 'suggest_recipe_plan':
      return payload.meal_type ? `Focus: ${payload.meal_type}` : ''
    case 'queue_follow_up':
      return [
        payload.reason ? `Reason: ${payload.reason}` : '',
        payload.due_at ? `Due: ${formatFollowUpDueAt(payload.due_at)}` : '',
      ].filter(Boolean).join(' | ')
    case 'run_workflow':
      return payload.screen ? `Starts on ${String(payload.screen).replace(/_/g, ' ')}` : ''
    default:
      return ''
  }
}

function getQueuedFollowUpPrompt(action) {
  if (action?.type !== 'queue_follow_up') {
    return ''
  }

  return String(action?.payload?.starter_prompt || action?.payload?.prompt || '').trim()
}

function getWorkflowStarterPrompt(action) {
  if (action?.type !== 'run_workflow') {
    return ''
  }

  const explicitPrompt = String(action?.payload?.starter_prompt || '').trim()
  if (explicitPrompt) {
    return explicitPrompt
  }

  const workflow = String(action?.payload?.workflow || '').trim()
  switch (workflow) {
    case 'fix_macros':
      return 'Look at today and give me the fastest fix for my calories and protein using foods I can realistically eat next.'
    case 'plan_next_meal':
      return 'Plan my next meal based on today so far, my likely macro gap, and what feels easiest to execute.'
    case 'close_grocery_gap':
      return 'Turn my grocery gap into the smallest useful list so I can actually close it on the next trip.'
    case 'review_recovery':
      return 'Review my recovery and tell me the one change that will help tomorrow most.'
    case 'build_tomorrow_plan':
      return 'Build tomorrow for me with a simple meal and training plan based on how today went.'
    default:
      return ''
  }
}

function getWorkflowSteps(action) {
  if (action?.type !== 'run_workflow') {
    return []
  }

  return Array.isArray(action?.payload?.steps) ? action.payload.steps.filter(Boolean) : []
}

function getModelActionDestination(action) {
  const payload = action?.payload ?? {}

  switch (action.type) {
    case 'show_nutrition_summary':
      return { path: '/nutrition', state: { johnnyActionNotice: 'Johnny opened Nutrition so you can review today\'s totals and meal logs.' }, label: 'Open nutrition' }
    case 'show_grocery_gap':
      return { path: '/nutrition', state: { focusSection: 'groceryGap', johnnyActionNotice: 'Johnny jumped you to Grocery Gap so you can close the missing items fast.' }, label: 'Open grocery gap' }
    case 'highlight_goal_issue':
      return { path: '/dashboard', state: { johnnyActionNotice: payload.summary || 'Johnny surfaced the main goal issue on your dashboard.' }, label: 'Open dashboard' }
    case 'suggest_recipe_plan':
      return {
        path: '/nutrition',
        state: { focusSection: 'recipes', recipeMealFilter: payload.meal_type || 'all', johnnyActionNotice: 'Johnny opened recipe ideas so you can plan the next meal instead of guessing.' },
        label: 'Open recipes',
      }
    case 'create_saved_meal_draft':
      return {
        path: '/nutrition',
        state: {
          focusSection: 'savedMeals',
          openSavedMealForm: true,
          johnnyActionNotice: `Johnny started a saved meal draft${payload.name ? ` for ${payload.name}` : ''}.`,
          savedMealDraft: {
            name: payload.name || '',
            meal_type: payload.meal_type || 'lunch',
            items: Array.isArray(payload.items) ? payload.items : [],
          },
        },
        label: 'Open saved meals',
      }
    case 'open_screen':
      return resolveOpenScreenDestination(payload.screen, payload)
    case 'run_workflow':
      return resolveWorkflowDestination(payload)
    default:
      return null
  }
}

function buildWorkflowExecutionContext(action) {
  const payload = action?.payload ?? {}
  return {
    destination: resolveWorkflowDestination(payload),
    starterPrompt: getWorkflowStarterPrompt(action),
    focusSection: getWorkflowFocusSection(payload.workflow),
  }
}

function buildWorkflowSavedMealDraft(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items.filter(item => item && typeof item === 'object') : []
  if (!items.length && !payload.name && !payload.meal_type) {
    return null
  }

  return {
    name: payload.name || '',
    meal_type: payload.meal_type || 'lunch',
    items,
  }
}

function getCurrentScreenName(pathname) {
  const parts = String(pathname || '/').split('/').filter(Boolean)
  return parts[1] || parts[0] || 'dashboard'
}

function humanizeWorkflowName(workflow) {
  return String(workflow || 'workflow')
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildTomorrowFollowUpDueAt() {
  const next = new Date()
  next.setDate(next.getDate() + 1)
  next.setHours(9, 0, 0, 0)
  const year = next.getFullYear()
  const month = String(next.getMonth() + 1).padStart(2, '0')
  const day = String(next.getDate()).padStart(2, '0')
  const hours = String(next.getHours()).padStart(2, '0')
  const minutes = String(next.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function formatFollowUpDueAt(value) {
  if (!value) return ''
  const parsed = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return `${formatUsShortDate(parsed, parsed)} · ${parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function formatFollowUpStateLabel(value) {
  switch (value) {
    case 'missed':
      return 'Missed'
    case 'snoozed':
      return 'Snoozed'
    default:
      return 'Open'
  }
}

function formatConfidenceLabel(value) {
  switch (value) {
    case 'high':
      return 'High confidence'
    case 'medium':
      return 'Medium confidence'
    case 'low':
      return 'Low confidence'
    default:
      return ''
  }
}

function getAutoExecutableModelAction(actions) {
  return actions.find(action => AUTO_EXECUTABLE_MODEL_ACTIONS.has(action.type) && getModelActionDestination(action)) || null
}

function getFirstModelActionDestination(actions) {
  return (Array.isArray(actions) ? actions : []).map(getModelActionDestination).find(Boolean) || null
}

function normalizeSupportStarterMeta(meta = {}) {
  return {
    isSupport: Boolean(meta?.isSupport),
    guideId: String(meta?.guideId || '').trim(),
    surface: String(meta?.surface || '').trim(),
    screen: String(meta?.screen || '').trim(),
  }
}

function buildGuidedOpenScreenDestination(screen, payload = {}) {
  const routePath = String(payload?.route_path || '').trim()
  if (!routePath.startsWith('/')) {
    return null
  }

  const state = {}
  const focusSection = String(payload?.focus_section || '').trim()
  const focusTab = String(payload?.focus_tab || '').trim()
  const notice = String(payload?.notice || '').trim()
  const mealType = String(payload?.meal_type || '').trim()

  if (focusSection) state.focusSection = focusSection
  if (focusTab) state.focusTab = focusTab
  if (mealType && focusSection === 'recipes') state.recipeMealFilter = mealType
  if (notice) state.johnnyActionNotice = notice

  return {
    path: routePath,
    state: Object.keys(state).length ? state : undefined,
    label: String(payload?.action_label || '').trim() || `Open ${String(screen || 'screen').replace(/_/g, ' ')}`,
    actionLabel: 'Open again',
  }
}

function resolveOpenScreenDestination(screen, payload = {}) {
  const guidedDestination = buildGuidedOpenScreenDestination(screen, payload)
  if (guidedDestination) {
    return guidedDestination
  }

  switch (screen) {
    case 'nutrition':
      return { path: '/nutrition', state: { johnnyActionNotice: 'Johnny opened Nutrition for the next step.' }, label: 'Open nutrition', actionLabel: 'Open again' }
    case 'saved_meals':
      return { path: '/nutrition', state: { focusSection: 'savedMeals', johnnyActionNotice: 'Johnny opened Saved Meals so you can reuse or build a fast default.' }, label: 'Open saved meals', actionLabel: 'Open again' }
    case 'recipes':
      return { path: '/nutrition', state: { focusSection: 'recipes', recipeMealFilter: payload.meal_type || 'all', johnnyActionNotice: 'Johnny opened Recipes to narrow the next best meal option.' }, label: 'Open recipes', actionLabel: 'Open again' }
    case 'grocery_gap':
      return { path: '/nutrition', state: { focusSection: 'groceryGap', johnnyActionNotice: 'Johnny opened Grocery Gap so you can fix the missing ingredients list.' }, label: 'Open grocery gap', actionLabel: 'Open again' }
    case 'pantry':
      return { path: '/nutrition/pantry', state: { johnnyActionNotice: 'Johnny opened Pantry to work from what you already have.' }, label: 'Open pantry', actionLabel: 'Open again' }
    case 'steps':
    case 'sleep':
    case 'weight':
    case 'workouts':
    case 'cardio':
      return {
        path: '/body',
        state: { focusTab: screen, johnnyActionNotice: `Johnny opened Progress on ${screen} so you can handle that step right now.` },
        label: `Open ${screen}`,
        actionLabel: 'Open again',
      }
    case 'workout':
      return {
        path: '/workout',
        state: { johnnyActionNotice: 'Johnny opened Workout so you can move straight into the next training step.' },
        label: 'Open workout',
        actionLabel: 'Open again',
      }
    case 'dashboard':
      return { path: '/dashboard', state: { johnnyActionNotice: 'Johnny opened your dashboard to anchor the next decision in your live progress.' }, label: 'Open dashboard', actionLabel: 'Open again' }
    case 'settings':
      return { path: '/settings', state: { johnnyActionNotice: 'Johnny opened Profile so you can handle the setting that matters here.' }, label: 'Open profile', actionLabel: 'Open again' }
    default:
      return null
  }
}

function resolveWorkflowDestination(payload = {}) {
  const workflow = String(payload?.workflow || '').trim()
  const fallback = payload.screen ? resolveOpenScreenDestination(payload.screen, payload) : null
  const savedMealDraft = buildWorkflowSavedMealDraft(payload)

  switch (workflow) {
    case 'fix_macros':
      return {
        path: '/nutrition',
        state: {
          focusSection: savedMealDraft ? 'savedMeals' : payload.meal_type ? 'recipes' : 'groceryGap',
          openSavedMealForm: Boolean(savedMealDraft),
          savedMealDraft,
          recipeMealFilter: !savedMealDraft && payload.meal_type ? payload.meal_type : undefined,
          johnnyActionNotice: payload.summary || 'Johnny opened Nutrition to fix today’s macro gap with the fastest move available.',
        },
        label: 'Repair macros',
        actionLabel: 'Open repair view',
      }
    case 'plan_next_meal':
      return {
        path: '/nutrition',
        state: {
          focusSection: 'recipes',
          recipeMealFilter: payload.meal_type || 'all',
          johnnyActionNotice: payload.summary || 'Johnny opened Recipes so the next meal gets planned instead of improvised.',
        },
        label: 'Plan next meal',
        actionLabel: 'Open plan',
      }
    case 'close_grocery_gap':
      return {
        path: '/nutrition',
        state: {
          focusSection: 'groceryGap',
          johnnyActionNotice: payload.summary || 'Johnny opened Grocery Gap so you can shrink the missing-items problem fast.',
        },
        label: 'Close grocery gap',
        actionLabel: 'Open list',
      }
    case 'build_tomorrow_plan':
      return {
        path: '/nutrition',
        state: {
          focusSection: 'savedMeals',
          openSavedMealForm: true,
          savedMealDraft,
          recipeMealFilter: payload.meal_type || undefined,
          johnnyActionNotice: payload.summary || 'Johnny opened Saved Meals to turn tomorrow into a concrete default plan.',
        },
        label: 'Build tomorrow plan',
        actionLabel: 'Open tomorrow plan',
      }
    case 'review_recovery':
      return {
        path: '/body',
        state: {
          focusTab: 'sleep',
          johnnyActionNotice: payload.summary || 'Johnny opened Progress on sleep so recovery decisions are grounded in your actual data.',
        },
        label: 'Review recovery',
        actionLabel: 'Open recovery',
      }
    default:
      return fallback
  }
}

function getWorkflowFocusSection(workflow) {
  switch (workflow) {
    case 'fix_macros':
    case 'close_grocery_gap':
      return 'groceryGap'
    case 'plan_next_meal':
      return 'recipes'
    case 'build_tomorrow_plan':
      return 'savedMeals'
    case 'review_recovery':
      return 'sleep'
    default:
      return ''
  }
}

function getActionName(result) {
  return result?.action || result?.tool_name || ''
}

function buildActionStatus(actionResults, toolNames) {
  if (actionResults.length === 1) {
    return actionResults[0].summary || `${formatToolLabel(getActionName(actionResults[0]))}.`
  }
  if (actionResults.length > 1) {
    return `${actionResults.length} actions completed.`
  }
  if (toolNames.length === 1) return `${formatToolLabel(toolNames[0])}.`
  if (!toolNames.length) return ''
  return `${toolNames.map(formatToolLabel).join(', ')}.`
}

function buildActionTitle(result) {
  const actionName = getActionName(result)

  switch (actionName) {
    case 'log_steps':
      return `${Number(result.steps || 0).toLocaleString()} steps logged`
    case 'log_sleep':
      return `${result.hours_sleep || 0} hours of sleep logged`
    case 'log_food_from_description':
      return `${result.estimated ? 'Estimated' : 'Logged'} ${result.food_name || 'food entry'}`
    case 'add_pantry_items':
      return pluraliseItems(result.item_names?.length || 0, 'Pantry item')
    case 'add_grocery_gap_items':
      return pluraliseItems(result.item_names?.length || 0, 'Grocery item')
    case 'create_training_plan':
      return result.name || 'Training plan created'
    case 'create_custom_workout':
      return result.name || 'Custom workout ready'
    case 'create_personal_exercise':
      return result.name || 'Exercise saved'
    case 'swap_workout_exercise':
      return result.new_exercise || 'Workout swap complete'
    case 'schedule_sms_reminder':
      return 'SMS reminder scheduled'
    case 'clear_follow_ups':
      return result.cleared_count === 1 ? '1 follow-up cleared' : `${Number(result.cleared_count || 0).toLocaleString()} follow-ups cleared`
    case 'clear_sms_reminders':
      return result.canceled_count === 1 ? '1 SMS reminder canceled' : `${Number(result.canceled_count || 0).toLocaleString()} SMS reminders canceled`
    default:
      return formatToolLabel(actionName)
  }
}

function buildFallbackSummary(result) {
  const actionName = getActionName(result)

  switch (actionName) {
    case 'swap_workout_exercise':
      return `Swapped ${result.previous_exercise || 'the current exercise'} for ${result.new_exercise || 'a new movement'}.`
    case 'add_pantry_items':
      return 'Pantry updated.'
    case 'add_grocery_gap_items':
      return 'Grocery gap updated.'
    case 'log_sleep':
      return 'Sleep logged.'
    case 'log_food_from_description':
      return result.estimated ? 'Estimated food entry logged. Review if serving size was rough.' : 'Food logged.'
    case 'schedule_sms_reminder':
      return 'SMS reminder scheduled.'
    case 'clear_follow_ups':
      return 'Johnny cleared the requested follow-ups.'
    case 'clear_sms_reminders':
      return 'Johnny canceled the requested SMS reminders.'
    case 'create_custom_workout':
      return result.summary || 'Johnny queued a custom workout on the Workout screen.'
    case 'create_personal_exercise':
      return result.summary || 'Johnny saved that exercise to your custom exercise library.'
    default:
      return `${formatToolLabel(actionName)}.`
  }
}

function buildActionMeta(result) {
  const actionName = getActionName(result)
  const displayDate = result.date_display || (result.date ? formatUsShortDate(result.date, result.date) : '')

  switch (actionName) {
    case 'log_steps':
      return [
        displayDate ? `Date: ${displayDate}` : '',
        result.target_steps ? `Target: ${Number(result.target_steps).toLocaleString()}` : '',
        Number.isFinite(result.remaining_steps) ? `${Number(result.remaining_steps).toLocaleString()} left` : '',
      ].filter(Boolean).join(' | ')
    case 'log_sleep':
      return [
        displayDate ? `Date: ${displayDate}` : '',
        result.sleep_quality ? `Quality: ${result.sleep_quality}` : '',
        result.target_sleep_hours ? `Target: ${result.target_sleep_hours}h` : '',
      ].filter(Boolean).join(' | ')
    case 'log_food_from_description':
      return [
        result.meal_type ? `Meal: ${result.meal_type}` : '',
        Number.isFinite(result.calories) && result.calories > 0 ? `${result.calories} cal` : '',
        Number.isFinite(result.protein_g) && result.protein_g > 0 ? `${result.protein_g}g protein` : '',
        result.estimated ? 'Estimate' : '',
        result.review_recommended ? 'Review recommended' : '',
      ].filter(Boolean).join(' | ')
    case 'add_pantry_items':
    case 'add_grocery_gap_items':
      return [
        result.created_count ? `${result.created_count} added` : '',
        result.merged_count ? `${result.merged_count} merged` : '',
        result.updated_count ? `${result.updated_count} updated` : '',
      ].filter(Boolean).join(' | ')
    case 'create_training_plan':
      return result.days_created ? `${result.days_created} days scheduled` : ''
    case 'create_custom_workout':
      return [
        result.day_type ? `Base split: ${String(result.day_type).replace(/_/g, ' ')}` : '',
        result.exercise_count ? `${result.exercise_count} exercises` : '',
      ].filter(Boolean).join(' | ')
    case 'create_personal_exercise':
      return [
        result.primary_muscle ? `Muscle: ${String(result.primary_muscle).replace(/_/g, ' ')}` : '',
        result.equipment ? `Equipment: ${String(result.equipment).replace(/_/g, ' ')}` : '',
        result.created === false ? 'Already existed' : 'Saved',
      ].filter(Boolean).join(' | ')
    case 'swap_workout_exercise':
      return result.previous_exercise ? `From: ${result.previous_exercise}` : ''
    case 'schedule_sms_reminder':
      return [
        result.send_at_display ? `When: ${result.send_at_display}` : (result.send_at_local ? `When: ${result.send_at_local}` : ''),
        result.timezone_display ? `Timezone: ${result.timezone_display}` : (result.timezone ? `Timezone: ${result.timezone}` : ''),
      ].filter(Boolean).join(' | ')
    case 'clear_follow_ups':
      return [
        Number.isFinite(result.cleared_count) ? `${result.cleared_count} cleared` : '',
        Number.isFinite(result.failed_count) && result.failed_count > 0 ? `${result.failed_count} failed` : '',
      ].filter(Boolean).join(' | ')
    case 'clear_sms_reminders':
      return [
        Number.isFinite(result.canceled_count) ? `${result.canceled_count} canceled` : '',
        Number.isFinite(result.failed_count) && result.failed_count > 0 ? `${result.failed_count} failed` : '',
      ].filter(Boolean).join(' | ')
    default:
      return ''
  }
}

function pluraliseItems(count, label) {
  if (count <= 0) {
    return `${label}s updated`
  }
  return `${count} ${label.toLowerCase()}${count === 1 ? '' : 's'}`
}

function getStarterSuggestionsForCurrentTime(now = new Date()) {
  const currentHour = now.getHours()

  if (currentHour >= 22 || currentHour < 5) {
    return [
      'Should I eat anything else tonight or just go to bed?',
      'Fix my macros',
      'Adjust tomorrow based on today',
    ]
  }

  if (currentHour < 11) {
    return [
      'Plan my breakfast',
      'Fix my macros',
      'Adjust tomorrow based on today',
    ]
  }

  if (currentHour < 15) {
    return [
      'Plan my lunch',
      'Fix my macros',
      'Adjust tomorrow based on today',
    ]
  }

  return [
    'Plan my dinner',
    'Fix my macros',
    'Adjust tomorrow based on today',
  ]
}
