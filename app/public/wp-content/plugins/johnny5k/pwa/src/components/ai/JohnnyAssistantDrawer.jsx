import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi } from '../../api/client'
import { formatUsShortDate } from '../../lib/dateFormat'
import { useDashboardStore } from '../../store/dashboardStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import { useWorkoutStore } from '../../store/workoutStore'

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
      const usedTools = Array.isArray(data.used_tools) ? data.used_tools : []
      const actionResults = Array.isArray(data.action_results) ? data.action_results : []
      const actionTools = getActionTools(usedTools, actionResults)

      setMessages(current => [...current, {
        role: 'assistant',
        message_text: data.reply,
        sources: data.sources ?? [],
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
              <button type="button" className="btn-icon" title="Clear chat" onClick={handleClearThread} disabled={loading}>🗑</button>
              <button type="button" className="btn-icon" title="Close Johnny" onClick={closeDrawer}>✕</button>
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
                ➤
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