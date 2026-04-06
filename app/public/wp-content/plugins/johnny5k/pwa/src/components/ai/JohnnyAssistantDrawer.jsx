import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi } from '../../api/client'
import { formatUsShortDate } from '../../lib/dateFormat'
import { useDashboardStore } from '../../store/dashboardStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import { useWorkoutStore } from '../../store/workoutStore'
import AppIcon from '../ui/AppIcon'

const THREAD_KEY = 'main'
const ACTION_TOOLS = new Set([
  'log_steps',
  'log_sleep',
  'log_food_from_description',
  'create_training_plan',
  'add_pantry_items',
  'add_grocery_gap_items',
  'swap_workout_exercise',
])

const ACTION_DESTINATIONS = {
  log_steps: { path: '/body', state: { focusTab: 'steps' }, label: 'Open steps' },
  log_sleep: { path: '/body', state: { focusTab: 'sleep' }, label: 'Open sleep' },
  log_food_from_description: { path: '/nutrition', label: 'Open nutrition' },
  add_pantry_items: { path: '/nutrition', state: { focusSection: 'pantry' }, label: 'Open pantry' },
  add_grocery_gap_items: { path: '/nutrition', state: { focusSection: 'groceryGap' }, label: 'Open grocery gap' },
  create_training_plan: { path: '/workout', label: 'Open workout' },
  swap_workout_exercise: { path: '/workout', label: 'Open workout' },
}

const SUPPORTED_MODEL_ACTIONS = new Set([
  'open_screen',
  'show_nutrition_summary',
  'show_grocery_gap',
  'highlight_goal_issue',
  'create_saved_meal_draft',
  'suggest_recipe_plan',
  'queue_follow_up',
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
  const { isOpen, closeDrawer, consumeStarterPrompt } = useJohnnyAssistantStore()
  const { invalidate, loadSnapshot } = useDashboardStore()
  const reloadWorkoutSession = useWorkoutStore(state => state.reloadSession)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialising, setInitialising] = useState(true)
  const [listening, setListening] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const recognitionRef = useRef(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const voiceSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => {
    aiApi.getThread(THREAD_KEY)
      .then(data => setMessages(data.messages ?? []))
      .catch(() => {})
      .finally(() => setInitialising(false))
  }, [])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, isOpen])

  useEffect(() => {
    if (!isOpen) return
    textareaRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || initialising || loading) return

    const starterPrompt = consumeStarterPrompt()
    if (!starterPrompt) return
    sendPrompt(starterPrompt)
  }, [isOpen, initialising, loading, consumeStarterPrompt])

  useEffect(() => {
    if (!isOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') closeDrawer()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeDrawer])

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

  async function sendPrompt(message) {
    const nextMessage = message.trim()
    if (!nextMessage || loading) return

    setInput('')
    setStatusMessage('')
    setMessages(current => [...current, { role: 'user', message_text: nextMessage }])
    setLoading(true)

    try {
      const data = await aiApi.chat(nextMessage, THREAD_KEY)
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
      }])

      if (actionTools.length) {
        invalidate()
        loadSnapshot(true)
        if (actionTools.includes('swap_workout_exercise')) {
          reloadWorkoutSession().catch(() => {})
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
    } catch (err) {
      const messageText = err?.message || 'Something went wrong.'
      setMessages(current => [...current, { role: 'assistant', message_text: `⚠️ ${messageText}` }])
      setStatusMessage(messageText)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event) {
    event?.preventDefault()
    await sendPrompt(input)
  }

  async function handleClearThread() {
    if (loading) return

    try {
      await aiApi.clearThread(THREAD_KEY)
      setMessages([])
      setStatusMessage('Johnny chat cleared.')
    } catch (err) {
      setStatusMessage(err?.message || 'Could not clear the chat.')
    }
  }

  return (
    <>
      <div className={`johnny-drawer-backdrop ${isOpen ? 'open' : ''}`} onClick={closeDrawer} aria-hidden={!isOpen} />
      <aside className={`johnny-drawer ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen} aria-label="Johnny assistant">
        <div className="johnny-drawer-shell">
          <header className="johnny-drawer-header">
            <div>
              <span className="dashboard-chip ai">Coach</span>
              <h2>Johnny 5000</h2>
              <p>Ask Johnny to coach you or do it for you.</p>
            </div>
            <div className="johnny-drawer-actions">
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

          {statusMessage ? <p className="johnny-drawer-status">{statusMessage}</p> : null}

          <div className="chat-log johnny-drawer-log">
            {initialising ? <p className="chat-loading">Loading…</p> : null}
            {!initialising && messages.length === 0 ? (
              <div className="chat-welcome johnny-drawer-welcome">
                <p>Ask Johnny to log steps or sleep, log food, update pantry or grocery gap, swap a workout exercise, build a training plan, or talk through your next move.</p>
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
                  <p>{message.message_text}</p>
                  {actionResults.length ? <ActionResultList actionResults={actionResults} onNavigate={destination => {
                    navigate(destination.path, destination.state ? { state: destination.state } : undefined)
                    closeDrawer()
                  }} /> : null}
                  {!actionResults.length && modelActions.length ? <ModelActionList actions={modelActions} onNavigate={destination => {
                    navigate(destination.path, destination.state ? { state: destination.state } : undefined)
                    closeDrawer()
                  }} onQueueFollowUp={prompt => {
                    sendPrompt(prompt)
                  }} /> : null}
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
                <p className="typing-indicator">…</p>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <form className="chat-input-bar johnny-drawer-input" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="Ask Johnny to coach you or do something for you…"
              rows={3}
              disabled={loading}
            />
            <div className="johnny-input-actions">
              {voiceSupported ? (
                <button type="button" className={`btn-secondary johnny-voice-btn ${listening ? 'recording' : ''}`} onClick={listening ? stopListening : startListening} disabled={loading}>
                  {listening ? 'Stop' : 'Voice'}
                </button>
              ) : null}
              <button type="submit" className="btn-send" disabled={loading || !input.trim()}>
                <AppIcon name="send" />
                <span>Send</span>
              </button>
            </div>
          </form>
        </div>
      </aside>
    </>
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

function ModelActionList({ actions, onNavigate, onQueueFollowUp }) {
  return (
    <div className="johnny-action-cards">
      {actions.map((action, index) => {
        const destination = getModelActionDestination(action)
        const summary = buildModelActionSummary(action)
        const meta = buildModelActionMeta(action)
        const followUpPrompt = getQueuedFollowUpPrompt(action)

        return (
          <div key={`${action.type}-${index}`} className="johnny-action-card">
            <div className="johnny-action-card-head">
              <span className="johnny-action-tag">{formatModelActionLabel(action.type)}</span>
            </div>
            <p className="johnny-action-card-title">{buildModelActionTitle(action)}</p>
            <p className="johnny-action-card-summary">{summary}</p>
            {meta ? <p className="johnny-action-card-meta">{meta}</p> : null}
            {destination ? (
              <button type="button" className="btn-secondary small johnny-action-link" onClick={() => onNavigate(destination)}>
                {destination.actionLabel || destination.label}
              </button>
            ) : null}
            {!destination && followUpPrompt ? (
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
    case 'swap_workout_exercise':
      return 'Workout updated'
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
      return payload.reason ? `Reason: ${payload.reason}` : ''
    default:
      return ''
  }
}

function getQueuedFollowUpPrompt(action) {
  if (action?.type !== 'queue_follow_up') {
    return ''
  }

  return String(action?.payload?.prompt || '').trim()
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
    default:
      return null
  }
}

function getAutoExecutableModelAction(actions) {
  return actions.find(action => AUTO_EXECUTABLE_MODEL_ACTIONS.has(action.type) && getModelActionDestination(action)) || null
}

function resolveOpenScreenDestination(screen, payload = {}) {
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
      return { path: '/nutrition', state: { focusSection: 'pantry', johnnyActionNotice: 'Johnny opened Pantry to work from what you already have.' }, label: 'Open pantry', actionLabel: 'Open again' }
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
    default:
      return null
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
      return result.food_name || 'Food logged'
    case 'add_pantry_items':
      return pluraliseItems(result.item_names?.length || 0, 'Pantry item')
    case 'add_grocery_gap_items':
      return pluraliseItems(result.item_names?.length || 0, 'Grocery item')
    case 'create_training_plan':
      return result.name || 'Training plan created'
    case 'swap_workout_exercise':
      return result.new_exercise || 'Workout swap complete'
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
    default:
      return `${formatToolLabel(actionName)}.`
  }
}

function buildActionMeta(result) {
  const actionName = getActionName(result)
  const displayDate = result.date_display || (result.date ? formatUsShortDate(result.date, result.date) : '')

  switch (actionName) {
    case 'log_steps':
      return displayDate ? `Date: ${displayDate}` : ''
    case 'log_sleep':
      return [
        displayDate ? `Date: ${displayDate}` : '',
        result.sleep_quality ? `Quality: ${result.sleep_quality}` : '',
      ].filter(Boolean).join(' | ')
    case 'log_food_from_description':
      return [
        result.meal_type ? `Meal: ${result.meal_type}` : '',
        Number.isFinite(result.calories) && result.calories > 0 ? `${result.calories} cal` : '',
        Number.isFinite(result.protein_g) && result.protein_g > 0 ? `${result.protein_g}g protein` : '',
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
    case 'swap_workout_exercise':
      return result.previous_exercise ? `From: ${result.previous_exercise}` : ''
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