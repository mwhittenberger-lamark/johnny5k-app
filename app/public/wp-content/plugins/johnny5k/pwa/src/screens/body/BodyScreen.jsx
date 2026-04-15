import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { bodyApi } from '../../api/modules/body'
import { ironquestApi } from '../../api/modules/ironquest'
import { workoutApi } from '../../api/modules/workout'
import ClearableInput from '../../components/ui/ClearableInput'
import SupportIconButton from '../../components/ui/SupportIconButton'
import { getAccessibleScrollBehavior } from '../../lib/accessibility'
import { formatUsShortDate } from '../../lib/dateFormat'
import { buildIronQuestDailyToast } from '../../lib/ironquestFeedback'
import { openSupportGuide } from '../../lib/supportHelp'
import { scrollAppToTop } from '../../lib/scrollAppToTop'
import { DAY_TYPE_OPTIONS } from '../../lib/trainingDayTypes'
import { confirmGlobalAction, showGlobalToast } from '../../lib/uiFeedback'
import { useDashboardStore } from '../../store/dashboardStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'

const EXERCISE_CALORIE_MULTIPLIER = 0.6

async function syncIronQuestDailyProgress(payload) {
  try {
    return await ironquestApi.updateDailyProgress(payload)
  } catch {
    return null
  }
}

export default function BodyScreen() {
  const scrollBehavior = getAccessibleScrollBehavior()
  const openDrawer = useJohnnyAssistantStore(state => state.openDrawer)
  const location = useLocation()
  const navigate = useNavigate()
  const [weights, setWeights]   = useState([])
  const [sleepLogs, setSleepLogs] = useState([])
  const [stepLogs, setStepLogs] = useState([])
  const [cardioLogs, setCardioLogs] = useState([])
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [metrics, setMetrics]   = useState({ weight: [], sleep: [], steps: [], cardio: [] })
  const [weightInput, setWt]    = useState('')
  const [weightDate, setWeightDate] = useState(todayInputValue())
  const [sleepInput, setSleep]  = useState('')
  const [sleepQuality, setSleepQuality] = useState('good')
  const [sleepDate, setSleepDate] = useState(yesterdayInputValue())
  const [stepsInput, setSteps]  = useState('')
  const [stepsDate, setStepsDate] = useState(todayInputValue())
  const [tab, setTab]           = useState('weight')
  const [chartRange, setChartRange] = useState({ weight: 14, sleep: 7, steps: 14, cardio: 14 })
  const [editingWeightId, setEditingWeightId] = useState(null)
  const [editingSleepId, setEditingSleepId] = useState(null)
  const [editingStepId, setEditingStepId] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [pendingScrollTarget, setPendingScrollTarget] = useState('')
  const [pendingRouteFocus, setPendingRouteFocus] = useState(null)
  const weightFormRef = useRef(null)
  const sleepFormRef = useRef(null)
  const stepsFormRef = useRef(null)
  const weightListRef = useRef(null)
  const sleepListRef = useRef(null)
  const stepsListRef = useRef(null)
  const invalidate = useDashboardStore(s => s.invalidate)
  const snapshot = useDashboardStore(s => s.snapshot)
  const loadSnapshot = useDashboardStore(s => s.loadSnapshot)

  function handleOpenBodySupport() {
    const promptsByTab = {
      weight: 'Show me where to log weight here and how to review the trend without overthinking it.',
      sleep: 'Show me how to log sleep here and where to review recovery.',
      steps: 'Show me how to log steps here and how to use this screen when movement is behind.',
      cardio: 'Show me how to log cardio here and where to review recent conditioning work.',
    }

    openSupportGuide(openDrawer, {
      screen: 'body',
      surface: `body_${tab}`,
      guideId: 'log-sleep-and-steps',
      prompt: promptsByTab[tab] || promptsByTab.weight,
      context: { body_tab: tab },
    })
  }

  const refreshBodyData = useCallback(async () => {
    const [weightsResult, sleepResult, stepsResult, cardioResult, workoutsResult, metricsResult] = await Promise.allSettled([
      bodyApi.getWeight(14),
      bodyApi.getSleep(7),
      bodyApi.getSteps(10),
      bodyApi.getCardio(10),
      workoutApi.getHistory(3, 10),
      bodyApi.getMetrics(30),
    ])

    if (weightsResult.status === 'fulfilled') setWeights(weightsResult.value)
    if (sleepResult.status === 'fulfilled') setSleepLogs(sleepResult.value)
    if (stepsResult.status === 'fulfilled') setStepLogs(stepsResult.value)
    if (cardioResult.status === 'fulfilled') setCardioLogs(cardioResult.value)
    if (workoutsResult.status === 'fulfilled') setWorkoutLogs(workoutsResult.value)
    if (metricsResult.status === 'fulfilled') setMetrics(metricsResult.value)
  }, [])

  const setFlash = useCallback((message) => {
    const normalizedMessage = String(message || '').trim()
    if (!normalizedMessage) {
      return
    }

    showGlobalToast({
      title: normalizedMessage.startsWith('Error:') ? 'Could not complete that action' : '',
      message: normalizedMessage,
      tone: normalizedMessage.startsWith('Error:') ? 'error' : 'success',
    })
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void refreshBodyData()
      void loadSnapshot()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [loadSnapshot, refreshBodyData])

  useEffect(() => {
    const focusTab = String(location.state?.focusTab || '').trim()
    if (!focusTab) {
      return
    }

    startTransition(() => {
      setTab(focusTab)
      setPendingRouteFocus({
        tab: focusTab,
        key: `${location.key}:${focusTab}`,
      })
    })
  }, [location.key, location.state?.focusTab])

  useEffect(() => {
    const notice = location.state?.johnnyActionNotice
    if (!notice) {
      return undefined
    }

    startTransition(() => {
      showGlobalToast({
        title: 'Johnny update',
        message: notice,
        tone: 'info',
        kind: 'johnny-action-notice',
      })
    })
    const nextState = { ...(location.state || {}) }
    delete nextState.johnnyActionNotice
    navigate(location.pathname, { replace: true, state: Object.keys(nextState).length ? nextState : null })
    return undefined
  }, [location.pathname, location.state, location.state?.johnnyActionNotice, navigate])

  async function logWeight(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let result = null
      if (editingWeightId) {
        result = await bodyApi.updateWeight(editingWeightId, { weight_lb: +weightInput, date: weightDate })
        setWeights(current => upsertLocalBodyEntry(
          current,
          buildLocalWeightEntry({ id: editingWeightId, weight_lb: +weightInput, date: weightDate }, result),
          'metric_date',
          true,
        ))
        setMetrics(current => ({
          ...current,
          weight: upsertLocalSeriesEntry(current.weight, { date: weightDate, weight_lb: +weightInput }, 'date'),
        }))
        setFlash(result?.queued ? 'Weight saved offline. It will sync when you reconnect.' : 'Weight updated!')
      } else {
        result = await bodyApi.logWeight({ weight_lb: +weightInput, date: weightDate })
        setWeights(current => upsertLocalBodyEntry(
          current,
          buildLocalWeightEntry({ weight_lb: +weightInput, date: weightDate }, result),
          'metric_date',
          true,
        ))
        setMetrics(current => ({
          ...current,
          weight: upsertLocalSeriesEntry(current.weight, { date: weightDate, weight_lb: +weightInput }, 'date'),
        }))
        setFlash(result?.queued ? 'Weight saved offline. It will sync when you reconnect.' : 'Weight logged!')
      }
      resetWeightForm()
      invalidate()
      if (!result?.queued) {
        loadSnapshot(true)
        await refreshBodyData()
      }
      setPendingScrollTarget('weight')
    } catch (err) { setFlash('Error: ' + err.message) }
    setSaving(false)
  }

  async function logSleep(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let result = null
      if (editingSleepId) {
        result = await bodyApi.updateSleep(editingSleepId, { hours_sleep: +sleepInput, sleep_quality: sleepQuality, date: sleepDate })
        setSleepLogs(current => upsertLocalBodyEntry(
          current,
          buildLocalSleepEntry({ id: editingSleepId, hours_sleep: +sleepInput, sleep_quality: sleepQuality, date: sleepDate }, result),
          'sleep_date',
          true,
        ))
        setMetrics(current => ({
          ...current,
          sleep: upsertLocalSeriesEntry(current.sleep, { date: sleepDate, hours_sleep: +sleepInput }, 'date'),
        }))
        setFlash(result?.queued ? 'Sleep saved offline. It will sync when you reconnect.' : 'Sleep updated!')
      } else {
        result = await bodyApi.logSleep({ hours_sleep: +sleepInput, sleep_quality: sleepQuality, date: sleepDate })
        setSleepLogs(current => upsertLocalBodyEntry(
          current,
          buildLocalSleepEntry({ hours_sleep: +sleepInput, sleep_quality: sleepQuality, date: sleepDate }, result),
          'sleep_date',
          true,
        ))
        setMetrics(current => ({
          ...current,
          sleep: upsertLocalSeriesEntry(current.sleep, { date: sleepDate, hours_sleep: +sleepInput }, 'date'),
        }))
        setFlash(result?.queued ? 'Sleep saved offline. It will sync when you reconnect.' : 'Sleep logged!')
      }
      resetSleepForm()
      invalidate()
      if (!result?.queued) {
        const ironquestProgress = await syncIronQuestDailyProgress({
          quest_key: 'sleep',
          state_date: sleepDate,
        })
        const ironQuestToast = buildIronQuestDailyToast(ironquestProgress, {
          sourceLabel: 'Sleep logged',
          onOpenHub: () => navigate('/ironquest'),
        })
        if (ironQuestToast) {
          showGlobalToast(ironQuestToast)
        }
        loadSnapshot(true)
        await refreshBodyData()
      }
      setPendingScrollTarget('sleep')
    } catch (err) { setFlash('Error: ' + err.message) }
    setSaving(false)
  }

  async function logSteps(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let result = null
      if (editingStepId) {
        result = await bodyApi.updateSteps(editingStepId, { steps: +stepsInput, date: stepsDate })
        setStepLogs(current => upsertLocalBodyEntry(
          current,
          buildLocalStepsEntry({ id: editingStepId, steps: +stepsInput, date: stepsDate }, result),
          'step_date',
          true,
        ))
        setMetrics(current => ({
          ...current,
          steps: upsertLocalSeriesEntry(current.steps, { date: stepsDate, steps: +stepsInput }, 'date'),
          movement: upsertLocalSeriesEntry(current.movement, { date: stepsDate, steps: +stepsInput }, 'date'),
        }))
        setFlash(result?.queued ? 'Steps saved offline. They will sync when you reconnect.' : 'Steps updated!')
      } else {
        result = await bodyApi.logSteps({ steps: +stepsInput, date: stepsDate })
        setStepLogs(current => upsertLocalBodyEntry(
          current,
          buildLocalStepsEntry({ steps: +stepsInput, date: stepsDate }, result),
          'step_date',
          true,
        ))
        setMetrics(current => ({
          ...current,
          steps: upsertLocalSeriesEntry(current.steps, { date: stepsDate, steps: +stepsInput }, 'date'),
          movement: upsertLocalSeriesEntry(current.movement, { date: stepsDate, steps: +stepsInput }, 'date'),
        }))
        setFlash(result?.queued ? 'Steps saved offline. They will sync when you reconnect.' : 'Steps logged!')
      }
      resetStepsForm()
      invalidate()
      if (!result?.queued) {
        const ironquestProgress = await syncIronQuestDailyProgress({
          quest_key: +stepsInput > 0 ? 'steps' : '',
          state_date: stepsDate,
          travel_source: `steps_${stepsDate}`,
          steps: +stepsInput,
        })
        const ironQuestToast = buildIronQuestDailyToast(ironquestProgress, {
          sourceLabel: 'Movement logged',
          onOpenHub: () => navigate('/ironquest'),
        })
        if (ironQuestToast) {
          showGlobalToast(ironQuestToast)
        }
        loadSnapshot(true)
        await refreshBodyData()
      }
      setPendingScrollTarget('steps')
    } catch (err) { setFlash('Error: ' + err.message) }
    setSaving(false)
  }

  async function removeWeight(id) {
    const confirmed = await confirmGlobalAction({
      title: 'Delete weight entry?',
      message: 'This removes the saved weight log from your progress history.',
      confirmLabel: 'Delete entry',
      tone: 'danger',
    })
    if (!confirmed) return
    setSaving(true)
    try {
      await bodyApi.deleteWeight(id)
      if (editingWeightId === id) {
        resetWeightForm()
      }
      setFlash('Weight entry deleted.')
      invalidate()
      loadSnapshot(true)
      refreshBodyData()
    } catch (err) { setFlash('Error: ' + err.message) }
    setSaving(false)
  }

  async function removeSleep(id) {
    const confirmed = await confirmGlobalAction({
      title: 'Delete sleep entry?',
      message: 'This removes the saved sleep log from your recovery history.',
      confirmLabel: 'Delete entry',
      tone: 'danger',
    })
    if (!confirmed) return
    setSaving(true)
    try {
      await bodyApi.deleteSleep(id)
      if (editingSleepId === id) {
        resetSleepForm()
      }
      setFlash('Sleep entry deleted.')
      invalidate()
      loadSnapshot(true)
      refreshBodyData()
    } catch (err) { setFlash('Error: ' + err.message) }
    setSaving(false)
  }

  async function removeSteps(id) {
    const confirmed = await confirmGlobalAction({
      title: 'Delete step entry?',
      message: 'This removes the saved step log from your movement history.',
      confirmLabel: 'Delete entry',
      tone: 'danger',
    })
    if (!confirmed) return
    setSaving(true)
    try {
      await bodyApi.deleteSteps(id)
      if (editingStepId === id) {
        resetStepsForm()
      }
      setFlash('Step entry deleted.')
      invalidate()
      loadSnapshot(true)
      refreshBodyData()
    } catch (err) { setFlash('Error: ' + err.message) }
    setSaving(false)
  }

  const latestWeight = weights[0]?.weight_lb ?? snapshot?.latest_weight?.weight_lb ?? '—'
  const weightTrend = getWeightTrend(weights)
  const avgSleep = average(sleepLogs.map(item => Number(item.hours_sleep)))
  const todayMovement = snapshot?.steps?.total_movement_today ?? snapshot?.steps?.today ?? latestMetricValue(metrics.steps, 'steps') ?? 0
  const todayActualSteps = snapshot?.steps?.actual_today ?? latestMetricValue(metrics.steps, 'steps') ?? 0
  const todayCardioEquivalentSteps = snapshot?.steps?.cardio_equivalent_today ?? 0
  const stepTarget = snapshot?.steps?.target ?? 8000
  const sleepTarget = Number(snapshot?.goal?.target_sleep_hours ?? 8)
  const stepPct = stepTarget ? Math.min(100, Math.round((todayMovement / stepTarget) * 100)) : 0
  const lastSleep = sleepLogs[0]?.hours_sleep ?? snapshot?.sleep?.hours_sleep ?? '—'

  function handleQueuedCardioMutation(nextForm, editingId, result) {
    const nextEntry = buildLocalCardioEntry({ ...nextForm, id: editingId || 0 }, result)
    setCardioLogs(current => upsertLocalBodyEntry(current, nextEntry, 'cardio_date', false))
    setMetrics(current => ({
      ...current,
      cardio: upsertLocalSeriesEntry(current.cardio, { date: nextForm.date, duration_minutes: Number(nextForm.duration_minutes || 0) }, 'date'),
    }))
  }
  const weightSeries = selectSeries(
    metrics.weight,
    chartRange.weight,
    item => Number(item.weight_lb),
    item => item.date
  )
  const sleepSeries = selectSeries(
    metrics.sleep,
    chartRange.sleep,
    item => Number(item.hours_sleep),
    item => item.date
  )
  const stepSeries = selectSeries(
    Array.isArray(metrics.movement) && metrics.movement.length ? metrics.movement : metrics.steps,
    chartRange.steps,
    item => Number(item.steps),
    item => item.date
  )
  const cardioSeries = selectSeries(
    metrics.cardio,
    chartRange.cardio,
    item => Number(item.duration_minutes),
    item => item.date
  )
  const weightSpark = getWeightSparkStyle(weights)

  function setRange(chart, days) {
    setChartRange(current => ({ ...current, [chart]: days }))
  }

  const scrollToForm = useCallback((ref) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: scrollBehavior, block: 'start' })
      const input = ref.current?.querySelector('input, select, textarea')
      input?.focus()
    })
  }, [scrollBehavior])

  function startEditWeight(entry) {
    setEditingWeightId(entry.id)
    setWt(String(entry.weight_lb))
    setWeightDate(entry.metric_date || todayInputValue())
    scrollToForm(weightFormRef)
  }

  function startEditSleep(entry) {
    setEditingSleepId(entry.id)
    setSleep(String(entry.hours_sleep))
    setSleepQuality(entry.sleep_quality || 'good')
    setSleepDate(entry.sleep_date || yesterdayInputValue())
    scrollToForm(sleepFormRef)
  }

  function startEditSteps(entry) {
    setEditingStepId(entry.id)
    setSteps(String(entry.steps))
    setStepsDate(entry.step_date || todayInputValue())
    scrollToForm(stepsFormRef)
  }

  function resetWeightForm() {
    setEditingWeightId(null)
    setWt('')
    setWeightDate(todayInputValue())
  }

  function cancelWeightEdit() {
    resetWeightForm()
    scrollAppToTop()
  }

  function resetSleepForm() {
    setEditingSleepId(null)
    setSleep('')
    setSleepQuality('good')
    setSleepDate(yesterdayInputValue())
  }

  function cancelSleepEdit() {
    resetSleepForm()
    scrollAppToTop()
  }

  function resetStepsForm() {
    setEditingStepId(null)
    setSteps('')
    setStepsDate(todayInputValue())
  }

  function cancelStepsEdit() {
    resetStepsForm()
    scrollAppToTop()
  }

  useEffect(() => {
    if (!pendingScrollTarget) return

    if (pendingScrollTarget === 'weight' && weights.length && weightListRef.current) {
      requestAnimationFrame(() => {
        weightListRef.current?.querySelector('.body-log-row')?.scrollIntoView({ behavior: scrollBehavior, block: 'center' })
        setPendingScrollTarget('')
      })
      return
    }

    if (pendingScrollTarget === 'sleep' && sleepLogs.length && sleepListRef.current) {
      requestAnimationFrame(() => {
        sleepListRef.current?.querySelector('.body-log-row')?.scrollIntoView({ behavior: scrollBehavior, block: 'center' })
        setPendingScrollTarget('')
      })
      return
    }

    if (pendingScrollTarget === 'steps' && stepLogs.length && stepsListRef.current) {
      requestAnimationFrame(() => {
        stepsListRef.current?.querySelector('.body-log-row')?.scrollIntoView({ behavior: scrollBehavior, block: 'center' })
        setPendingScrollTarget('')
      })
    }
  }, [pendingScrollTarget, scrollBehavior, sleepLogs, stepLogs, weights])

  useEffect(() => {
    if (!pendingRouteFocus || pendingRouteFocus.tab !== tab) {
      return
    }

    const formRef = pendingRouteFocus.tab === 'weight'
      ? weightFormRef
      : pendingRouteFocus.tab === 'sleep'
        ? sleepFormRef
        : pendingRouteFocus.tab === 'steps'
          ? stepsFormRef
          : null

    if (!formRef) {
      return
    }

    scrollToForm(formRef)
    const timeoutId = window.setTimeout(() => {
      setPendingRouteFocus(current => current?.key === pendingRouteFocus.key ? null : current)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [pendingRouteFocus, scrollToForm, tab])

  return (
    <div className="screen body-screen">
      <header className="screen-header body-screen-header support-icon-anchor">
        <SupportIconButton label="Get help with progress tracking" onClick={handleOpenBodySupport} />
        <div>
          <h1>Progress</h1>
          <p className="body-screen-subtitle">Track bodyweight, movement, and cardio in one place.</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary progress-activity-log-button" type="button" onClick={() => navigate('/activity-log')}>
            Activity Log
          </button>
        </div>
      </header>

      <section className="body-summary-grid">
        <SummaryCard label="Latest weight" value={latestWeight} suffix=" lbs" meta={weightTrend} accent="orange" />
        <SummaryCard label="Avg sleep" value={avgSleep ? avgSleep.toFixed(1) : '—'} suffix=" h" meta={lastSleep !== '—' ? `Last night ${lastSleep}h` : 'Log sleep to see recovery trends'} accent="teal" />
        <SummaryCard label="Movement today" value={Number(todayMovement).toLocaleString()} meta={`Target ${Number(stepTarget).toLocaleString()} • ${stepPct}%`} accent="pink" />
      </section>

      <section className="dash-card progress-photos-entry-card">
        <div className="body-progress-header">
          <div>
            <h3>Progress Photos</h3>
            <p>Manage your shared timeline, choose baselines, and run side-by-side comparisons.</p>
          </div>
          <button className="btn-primary" type="button" onClick={() => navigate('/progress-photos')}>
            Open Photos
          </button>
        </div>
      </section>

      <div className="tab-bar">
        {[
          ['weight', 'Weight'],
          ['sleep', 'Sleep'],
          ['steps', 'Steps'],
          ['workouts', 'Workouts'],
          ['cardio', 'Cardio'],
        ].map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'weight' && (
        <div className="body-tab">
          <section className="dash-card body-chart-card">
            <div className="body-card-header body-chart-header">
              <div>
                <h3>Weight Trend</h3>
                <p>{weightSeries.length > 1 ? `${chartRange.weight}-day trend view.` : 'Log a few weigh-ins to unlock the trend line.'}</p>
              </div>
              <div className="body-chart-actions body-chart-actions-stack">
                <strong>{latestWeight !== '—' ? `${latestWeight} lbs` : '—'}</strong>
                <RangeTabs value={chartRange.weight} onChange={days => setRange('weight', days)} />
              </div>
            </div>
            <SparklineCard
              values={weightSeries}
              stroke={weightSpark.stroke}
              fill={weightSpark.fill}
              emptyLabel="No weight trend yet"
              tickLabels={buildTickLabels(weightSeries)}
              valueLabels={buildTickValueLabels(weightSeries, point => formatSparkValue(point.value))}
              tooltipFormatter={point => `${formatDate(point.label)}: ${formatSparkValue(point.value)} lbs`}
            />
          </section>
          <section ref={weightFormRef} className="dash-card body-form-card">
            <div className="body-card-header">
              <h3>{editingWeightId ? 'Edit weigh-in' : 'Log weigh-in'}</h3>
              <p>{editingWeightId ? 'Update the logged value or cancel to keep it as-is.' : 'Use a consistent time of day for the cleanest trend line.'}</p>
            </div>
            <form className="body-form-grid two-column" onSubmit={logWeight}>
              <label>
                Weight (lbs)
                <input type="number" min="80" max="600" step="0.1" placeholder="198.4" value={weightInput} onChange={e => setWt(e.target.value)} required />
              </label>
              <label>
                Date
                <input type="date" value={weightDate} onChange={e => setWeightDate(e.target.value)} required />
              </label>
              <div className="body-form-actions body-form-actions-full">
                {editingWeightId ? <button className="btn-secondary" type="button" onClick={cancelWeightEdit}>Cancel</button> : null}
                <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingWeightId ? 'Update Weight' : 'Log Weight'}</button>
              </div>
            </form>
          </section>
          <section className="dash-card">
            <div className="body-card-header">
              <h3>Recent weigh-ins</h3>
              <p>{weights.length ? 'Your latest 14 entries.' : 'No weigh-ins yet.'}</p>
            </div>
            <div ref={weightListRef} className="trend-chart body-trend-chart">
            {weights.map((w, i) => (
              <div key={w.id || i} className="trend-row body-trend-row body-log-row">
                <div className="body-log-main">
                  <span className="trend-date">{formatDate(w.metric_date)}</span>
                  <span className="trend-val">{w.weight_lb} lbs</span>
                </div>
                <RowActions
                  onEdit={() => startEditWeight(w)}
                  onDelete={() => removeWeight(w.id)}
                />
              </div>
            ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'sleep' && (
        <div className="body-tab">
          <section className="dash-card body-chart-card">
            <div className="body-card-header body-chart-header">
              <div>
                <h3>Sleep Trend</h3>
                <p>{sleepSeries.length > 1 ? `${chartRange.sleep}-day recovery view.` : 'Add sleep entries to see the trend line.'}</p>
              </div>
              <div className="body-chart-actions body-chart-actions-stack">
                <strong>{avgSleep ? `${avgSleep.toFixed(1)} h avg` : '—'}</strong>
                <RangeTabs value={chartRange.sleep} onChange={days => setRange('sleep', days)} />
              </div>
            </div>
            <SparklineCard
              values={sleepSeries}
              stroke="var(--accent2)"
              fill="rgba(0, 188, 222, 0.12)"
              referenceValue={sleepTarget}
              referenceLabel={`${sleepTarget}h goal`}
              emptyLabel="No sleep trend yet"
              tickLabels={buildTickLabels(sleepSeries)}
              tooltipFormatter={point => `${formatDate(point.label)}: ${formatSparkValue(point.value)} h`}
            />
          </section>
          <section ref={sleepFormRef} className="dash-card body-form-card">
            <div className="body-card-header">
              <h3>{editingSleepId ? 'Edit last night sleep' : 'Log last night sleep'}</h3>
              <p>{editingSleepId ? 'Adjust the night entry or cancel to leave it unchanged.' : 'This defaults to last night so the Recovery Loop card updates off the right sleep entry.'}</p>
            </div>
            <form className="body-form-grid two-column" onSubmit={logSleep}>
              <label>
                Hours slept
                <input type="number" min="0" max="16" step="0.5" placeholder="7.5" value={sleepInput} onChange={e => setSleep(e.target.value)} required />
              </label>
              <label>
                Sleep quality
                <select value={sleepQuality} onChange={e => setSleepQuality(e.target.value)}>
                  {['poor', 'fair', 'good', 'great'].map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Night of
                <input type="date" value={sleepDate} onChange={e => setSleepDate(e.target.value)} required />
              </label>
              <div className="body-form-actions body-form-actions-full">
                {editingSleepId ? <button className="btn-secondary" type="button" onClick={cancelSleepEdit}>Cancel</button> : null}
                <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingSleepId ? 'Update Last Night' : 'Log Last Night'}</button>
              </div>
            </form>
          </section>
          <section className="dash-card">
            <div className="body-card-header">
              <h3>Recent sleep</h3>
              <p>{sleepLogs.length ? 'Last 7 nights with quality tags.' : 'No sleep logs yet.'}</p>
            </div>
            <div ref={sleepListRef} className="trend-chart body-trend-chart">
              {sleepLogs.map((entry, i) => (
                <div key={entry.id || i} className="trend-row body-trend-row sleep-row body-log-row">
                  <div className="body-log-main">
                    <span className="trend-date">{formatDate(entry.sleep_date)}</span>
                    <span className="trend-val">{entry.hours_sleep}h</span>
                    <span className={`sleep-quality-pill ${entry.sleep_quality || 'good'}`}>{entry.sleep_quality || 'logged'}</span>
                  </div>
                  <RowActions
                    onEdit={() => startEditSleep(entry)}
                    onDelete={() => removeSleep(entry.id)}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'steps' && (
        <div className="body-tab">
          <section className="dash-card body-chart-card">
            <div className="body-card-header body-chart-header">
              <div>
                <h3>Movement Trend</h3>
                <p>{stepSeries.length > 1 ? `${chartRange.steps}-day movement view.` : 'Log steps over a few days to build the trend line.'}</p>
              </div>
              <div className="body-chart-actions body-chart-actions-stack">
                <strong>{stepPct}% of target</strong>
                <RangeTabs value={chartRange.steps} onChange={days => setRange('steps', days)} />
              </div>
            </div>
            <SparklineCard
              values={stepSeries}
              stroke="var(--accent3)"
              fill="rgba(255, 56, 160, 0.12)"
              referenceValue={stepTarget}
              referenceLabel={`${Number(stepTarget).toLocaleString()} goal`}
              emptyLabel="No step trend yet"
              tickLabels={buildTickLabels(stepSeries)}
              tooltipFormatter={point => `${formatDate(point.label)}: ${Math.round(point.value).toLocaleString()} steps`}
            />
          </section>
          <section ref={stepsFormRef} className="dash-card body-form-card steps-form-card">
            <div className="body-card-header">
              <h3>{editingStepId ? 'Edit steps' : 'Log steps'}</h3>
              <p>{editingStepId ? 'Update the saved day total or cancel to keep the current entry.' : 'Update the day total if your phone or watch missed part of your movement.'}</p>
            </div>
            <form className="body-form-grid two-column" onSubmit={logSteps}>
              <label>
                Steps today
                <input type="number" min="0" max="100000" step="1" placeholder="8559" value={stepsInput} onChange={e => setSteps(e.target.value)} required />
              </label>
              <label>
                Date
                <input type="date" value={stepsDate} onChange={e => setStepsDate(e.target.value)} required />
              </label>
              <div className="body-form-actions body-form-actions-full">
                {editingStepId ? <button className="btn-secondary" type="button" onClick={cancelStepsEdit}>Cancel</button> : null}
                <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingStepId ? 'Update Steps' : 'Save Steps'}</button>
              </div>
            </form>
            <div className="body-mini-stats">
              <div>
                <span>Today</span>
                <strong>{Number(todayMovement).toLocaleString()}</strong>
              </div>
              <div>
                <span>Actual steps</span>
                <strong>{Number(todayActualSteps).toLocaleString()}</strong>
              </div>
              <div>
                <span>Cardio equiv.</span>
                <strong>{Number(todayCardioEquivalentSteps).toLocaleString()}</strong>
              </div>
              <div>
                <span>Target</span>
                <strong>{Number(stepTarget).toLocaleString()}</strong>
              </div>
              <div>
                <span>Completion</span>
                <strong>{stepPct}%</strong>
              </div>
            </div>
          </section>
          <section className="dash-card">
            <div className="body-card-header">
              <h3>30-day movement trail</h3>
              <p>{stepLogs.length ? 'Recent daily step totals with inline edit/delete actions.' : 'No step entries yet.'}</p>
            </div>
            <div ref={stepsListRef} className="trend-chart body-trend-chart compact">
              {stepLogs.map((entry, i) => (
                <div key={entry.id || i} className="trend-row body-trend-row body-log-row">
                  <div className="body-log-main">
                    <span className="trend-date">{formatDate(entry.step_date)}</span>
                    <span className="trend-val">{Number(entry.steps).toLocaleString()} steps</span>
                  </div>
                  <RowActions
                    onEdit={() => startEditSteps(entry)}
                    onDelete={() => removeSteps(entry.id)}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'cardio' && (
        <CardioTab
          invalidate={invalidate}
          cardioLogs={cardioLogs}
          cardioSeries={cardioSeries}
          cardioRange={chartRange.cardio}
          currentWeight={Number(latestWeight)}
          onRangeChange={days => setRange('cardio', days)}
          onLogged={refreshBodyData}
          onIronQuestProgress={syncIronQuestDailyProgress}
          onOpenIronQuest={() => navigate('/ironquest')}
          onQueuedMutation={handleQueuedCardioMutation}
          onRefreshSnapshot={() => loadSnapshot(true)}
          onFlash={setFlash}
          focusRequestKey={pendingRouteFocus?.tab === 'cardio' ? pendingRouteFocus.key : ''}
          onFocusHandled={() => setPendingRouteFocus(current => current?.tab === 'cardio' ? null : current)}
        />
      )}

    {tab === 'workouts' && (
    <WorkoutHistoryTab
      workoutLogs={workoutLogs}
      currentWeight={Number(latestWeight) || null}
      invalidate={invalidate}
      onRefreshSnapshot={() => loadSnapshot(true)}
      onRefreshBodyData={refreshBodyData}
      onFlash={setFlash}
      focusRequestKey={pendingRouteFocus?.tab === 'workouts' ? pendingRouteFocus.key : ''}
      onFocusHandled={() => setPendingRouteFocus(current => current?.tab === 'workouts' ? null : current)}
    />
    )}
    </div>
  )
}

function WorkoutHistoryTab({ workoutLogs, currentWeight, invalidate, onRefreshSnapshot, onRefreshBodyData, onFlash, focusRequestKey = '', onFocusHandled = null }) {
  const scrollBehavior = getAccessibleScrollBehavior()
  const [editingWorkoutId, setEditingWorkoutId] = useState(null)
  const [form, setForm] = useState({ session_date: todayInputValue(), actual_day_type: 'push', duration_minutes: '', time_tier: 'medium', estimated_calories: '' })
  const [caloriesDirty, setCaloriesDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [pendingScrollToLatest, setPendingScrollToLatest] = useState(false)
  const workoutFormRef = useRef(null)
  const workoutListRef = useRef(null)

  const totalMinutes = (workoutLogs ?? []).reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0)
  const totalCalories = (workoutLogs ?? []).reduce((sum, entry) => sum + Number(entry.estimated_calories || 0), 0)
  useEffect(() => {
    if (caloriesDirty) return

    const estimate = estimateWorkoutCalories({
      dayType: form.actual_day_type,
      timeTier: form.time_tier,
      durationMinutes: form.duration_minutes,
      weightLb: currentWeight,
    })

    startTransition(() => {
      setForm(current => ({
        ...current,
        estimated_calories: estimate ? String(estimate) : '',
      }))
    })
  }, [caloriesDirty, currentWeight, form.actual_day_type, form.duration_minutes, form.time_tier])

  const scrollToForm = useCallback(() => {
    requestAnimationFrame(() => {
      workoutFormRef.current?.scrollIntoView({ behavior: scrollBehavior, block: 'start' })
      const input = workoutFormRef.current?.querySelector('input, select')
      input?.focus()
    })
  }, [scrollBehavior])

  function resetForm() {
    setEditingWorkoutId(null)
    setForm({ session_date: todayInputValue(), actual_day_type: 'push', duration_minutes: '', time_tier: 'medium', estimated_calories: '' })
    setCaloriesDirty(false)
  }

  function cancelForm() {
    resetForm()
    scrollAppToTop()
  }

  function startEdit(entry) {
    setEditingWorkoutId(entry.id)
    setForm({
      session_date: entry.session_date || todayInputValue(),
      actual_day_type: entry.actual_day_type || entry.planned_day_type || 'push',
      duration_minutes: entry.duration_minutes != null ? String(entry.duration_minutes) : '',
      time_tier: entry.time_tier || 'medium',
      estimated_calories: entry.estimated_calories != null ? String(entry.estimated_calories) : '',
    })
    setCaloriesDirty(entry.estimated_calories != null && entry.estimated_calories !== '')
    scrollToForm()
  }

  function updateField(key, value) {
    if (key === 'estimated_calories') {
      setCaloriesDirty(value !== '')
    }
    setForm(current => ({ ...current, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!editingWorkoutId) return
    setSaving(true)
    try {
    await workoutApi.updateHistory(editingWorkoutId, {
      session_date: form.session_date,
      actual_day_type: form.actual_day_type,
      duration_minutes: Number(form.duration_minutes || 0),
      time_tier: form.time_tier,
      estimated_calories: form.estimated_calories === '' ? '' : Number(form.estimated_calories || 0),
    })
    setMsg('Workout updated!')
    onFlash?.('Workout updated!')
    resetForm()
    invalidate()
    onRefreshSnapshot?.()
    await onRefreshBodyData?.()
    setPendingScrollToLatest(true)
    } catch (err) { setMsg('Error: ' + err.message) }
    setSaving(false)
  }

  async function handleDelete(id) {
    const confirmed = await confirmGlobalAction({
      title: 'Delete workout history?',
      message: 'This removes the workout and all of its logged sets from your recent activity.',
      confirmLabel: 'Delete workout',
      tone: 'danger',
    })
    if (!confirmed) return
    setSaving(true)
    try {
    await workoutApi.deleteHistory(id)
    if (editingWorkoutId === id) {
      resetForm()
    }
    setMsg('Workout deleted.')
    onFlash?.('Workout deleted.')
    invalidate()
    onRefreshSnapshot?.()
    await onRefreshBodyData?.()
    setPendingScrollToLatest(true)
    } catch (err) { setMsg('Error: ' + err.message) }
    setSaving(false)
  }

  useEffect(() => {
    if (!pendingScrollToLatest || !workoutLogs?.length || !workoutListRef.current) return

    requestAnimationFrame(() => {
      workoutListRef.current?.querySelector('.body-log-row')?.scrollIntoView({ behavior: scrollBehavior, block: 'center' })
      setPendingScrollToLatest(false)
    })
  }, [pendingScrollToLatest, scrollBehavior, workoutLogs])

  useEffect(() => {
    if (!focusRequestKey) {
      return
    }

    scrollToForm()
    onFocusHandled?.()
  }, [focusRequestKey, onFocusHandled, scrollToForm])

  return (
    <div className="body-tab cardio-tab">
    <section className="body-summary-grid cardio-summary-grid">
      <SummaryCard label="Past 3 days" value={workoutLogs.length} meta={workoutLogs.length ? 'Completed workouts you can still edit' : 'No recent workouts to manage'} accent="orange" />
      <SummaryCard label="Logged minutes" value={totalMinutes || '—'} suffix={totalMinutes ? ' min' : ''} meta={totalMinutes ? 'Across recent completed sessions' : 'Duration shows up after you complete a workout'} accent="teal" />
      <SummaryCard label="Estimated burn" value={totalCalories || '—'} suffix={totalCalories ? ' cal' : ''} meta={totalCalories ? 'Across recent completed sessions' : 'Calories appear after workout completion'} accent="pink" />
    </section>
    <section ref={workoutFormRef} className="dash-card body-form-card cardio-card">
      <div className="body-card-header">
      <h3>{editingWorkoutId ? 'Edit workout' : 'Select a recent workout to edit'}</h3>
      <p>{editingWorkoutId ? 'Adjust the date, split, time tier, duration, or calorie estimate. Delete removes the workout and its logged sets.' : 'Use Edit on any workout from the last 3 days to update it here.'}</p>
      </div>
      {editingWorkoutId ? (
      <form className="body-form-grid two-column cardio-form-grid" onSubmit={handleSubmit}>
        <label>
        Workout type
        <select value={form.actual_day_type} onChange={e => updateField('actual_day_type', e.target.value)}>
          {DAY_TYPE_OPTIONS.map(([option, label]) => (
          <option key={option} value={option}>{label}</option>
          ))}
        </select>
        </label>
        <label>
        Time tier
        <select value={form.time_tier} onChange={e => updateField('time_tier', e.target.value)}>
          {['short', 'medium', 'full'].map(option => (
          <option key={option} value={option}>{formatDayType(option)}</option>
          ))}
        </select>
        </label>
        <label>
        Date
        <input type="date" value={form.session_date} onChange={e => updateField('session_date', e.target.value)} required />
        </label>
        <label>
        Duration (minutes)
        <input type="number" min="0" max="600" value={form.duration_minutes} onChange={e => updateField('duration_minutes', e.target.value)} required />
        </label>
        <label>
        Estimated calories
        <input type="number" min="0" max="5000" value={form.estimated_calories} onChange={e => updateField('estimated_calories', e.target.value)} />
        </label>
        <div className="body-form-actions body-form-actions-full">
        <button className="btn-outline small" type="button" onClick={() => setCaloriesDirty(false)}>Recalculate calories</button>
        <button className="btn-secondary" type="button" onClick={cancelForm}>Cancel</button>
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Update Workout'}</button>
        </div>
      </form>
      ) : (
      <p className="body-recovery-note">Pick a workout below to edit it. Only the past 3 days stay editable here.</p>
      )}
      {msg && <p className={msg.startsWith('Error') ? 'error' : 'success-msg'}>{msg}</p>}
    </section>
    <section className="dash-card">
      <div className="body-card-header">
      <h3>Recent workouts</h3>
      <p>{workoutLogs.length ? 'Completed workouts from the last 3 days with duration and estimated burn.' : 'No completed workouts from the last 3 days yet.'}</p>
      </div>
      <div ref={workoutListRef} className="trend-chart body-trend-chart cardio-log-list">
      {workoutLogs.map((entry, index) => (
        <div key={entry.id || index} className="trend-row body-trend-row cardio-row body-log-row">
        <div className="body-log-main">
          <span className="trend-date">{formatDate(entry.session_date)}</span>
          <strong className="cardio-row-title">{formatDayType(entry.actual_day_type || entry.planned_day_type)}</strong>
          <span className="cardio-note">{Number(entry.completed_sets || 0)} completed sets across {Number(entry.exercise_count || 0)} exercises</span>
        </div>
        <div className="cardio-row-meta">
          <span className="cardio-intensity-pill moderate">{entry.time_tier || 'medium'}</span>
          <span className="trend-val">{Number(entry.duration_minutes || 0)} min</span>
          {entry.estimated_calories ? <span className="cardio-calories">{Number(entry.estimated_calories).toLocaleString()} cal</span> : null}
          <RowActions onEdit={() => startEdit(entry)} onDelete={() => handleDelete(entry.id)} />
        </div>
        </div>
      ))}
      </div>
    </section>
    </div>
  )
}

function CardioTab({ invalidate, cardioLogs, cardioSeries, cardioRange, currentWeight, onRangeChange, onLogged, onIronQuestProgress, onOpenIronQuest, onQueuedMutation, onRefreshSnapshot, onFlash, focusRequestKey = '', onFocusHandled = null }) {
  const scrollBehavior = getAccessibleScrollBehavior()
  const [form, setForm] = useState({ cardio_type: 'running', duration_minutes: '', intensity: 'moderate', estimated_calories: '', notes: '', date: todayInputValue() })
  const [editingCardioId, setEditingCardioId] = useState(null)
  const [caloriesDirty, setCaloriesDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [pendingScrollToLatest, setPendingScrollToLatest] = useState(false)
  const cardioFormRef = useRef(null)
  const cardioListRef = useRef(null)

  const cardioMinutesWeek = sumCardioMinutes(cardioLogs, 7)
  const cardioSessionsWeek = countCardioSessions(cardioLogs, 7)
  const cardioCaloriesWeek = sumCardioCalories(cardioLogs, 7)
  const latestCardio = cardioLogs[0]

  useEffect(() => {
    if (caloriesDirty) return

    const estimate = estimateCardioCalories({
      cardioType: form.cardio_type,
      intensity: form.intensity,
      durationMinutes: form.duration_minutes,
      weightLb: currentWeight,
    })

    startTransition(() => {
      setForm(current => ({
        ...current,
        estimated_calories: estimate ? String(estimate) : '',
      }))
    })
  }, [form.cardio_type, form.duration_minutes, form.intensity, currentWeight, caloriesDirty])

  function update(k, v) {
    if (k === 'estimated_calories') {
      setCaloriesDirty(v !== '')
    }
    setForm(f => ({ ...f, [k]: v }))
  }

  const scrollToCardioForm = useCallback(() => {
    requestAnimationFrame(() => {
      cardioFormRef.current?.scrollIntoView({ behavior: scrollBehavior, block: 'start' })
      const input = cardioFormRef.current?.querySelector('input, select, textarea')
      input?.focus()
    })
  }, [scrollBehavior])

  function resetCardioForm(nextType = 'running', nextIntensity = 'moderate') {
    setEditingCardioId(null)
    setForm({ cardio_type: nextType, duration_minutes: '', intensity: nextIntensity, estimated_calories: '', notes: '', date: todayInputValue() })
    setCaloriesDirty(false)
  }

  function cancelCardioEdit() {
    resetCardioForm()
    scrollAppToTop()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let result = null
      if (editingCardioId) {
        result = await bodyApi.updateCardio(editingCardioId, form)
        setMsg(result?.queued ? 'Cardio saved offline. It will sync when you reconnect.' : 'Cardio updated!')
        onFlash?.(result?.queued ? 'Cardio saved offline. It will sync when you reconnect.' : 'Cardio updated!')
      } else {
        result = await bodyApi.logCardio(form)
        setMsg(result?.queued ? 'Cardio saved offline. It will sync when you reconnect.' : 'Cardio logged!')
        onFlash?.(result?.queued ? 'Cardio saved offline. It will sync when you reconnect.' : 'Cardio logged!')
      }
      if (result?.queued) {
        onQueuedMutation?.(form, editingCardioId, result)
      }
      resetCardioForm(form.cardio_type, form.intensity)
      invalidate()
      if (!result?.queued) {
        const cardioEntryId = Number(result?.id || editingCardioId || 0)
        const ironquestProgress = await onIronQuestProgress?.({
          quest_key: 'cardio',
          state_date: form.date,
          travel_source: cardioEntryId > 0 ? `cardio_${cardioEntryId}` : `cardio_${form.date}`,
          cardio_duration_minutes: Number(form.duration_minutes) || 0,
          cardio_type: form.cardio_type,
          cardio_intensity: form.intensity,
        })
        const ironQuestToast = buildIronQuestDailyToast(ironquestProgress, {
          sourceLabel: 'Cardio logged',
          onOpenHub: onOpenIronQuest,
        })
        if (ironQuestToast) {
          showGlobalToast(ironQuestToast)
        }
        onRefreshSnapshot?.()
        await onLogged?.()
      }
      setPendingScrollToLatest(true)
    } catch (err) { setMsg('Error: ' + err.message) }
    setSaving(false)
  }

  async function handleDelete(id) {
    const confirmed = await confirmGlobalAction({
      title: 'Delete cardio entry?',
      message: 'This removes the saved cardio log from your conditioning history.',
      confirmLabel: 'Delete entry',
      tone: 'danger',
    })
    if (!confirmed) return
    setSaving(true)
    try {
      await bodyApi.deleteCardio(id)
      if (editingCardioId === id) {
        resetCardioForm()
      }
      setMsg('Cardio entry deleted.')
      onFlash?.('Cardio entry deleted.')
      invalidate()
      onRefreshSnapshot?.()
      await onLogged?.()
      setPendingScrollToLatest(true)
    } catch (err) { setMsg('Error: ' + err.message) }
    setSaving(false)
  }

  useEffect(() => {
    if (!pendingScrollToLatest || !cardioLogs?.length || !cardioListRef.current) return

    requestAnimationFrame(() => {
      cardioListRef.current?.querySelector('.body-log-row')?.scrollIntoView({ behavior: scrollBehavior, block: 'center' })
      setPendingScrollToLatest(false)
    })
  }, [cardioLogs, pendingScrollToLatest, scrollBehavior])

  useEffect(() => {
    if (!focusRequestKey) {
      return
    }

    scrollToCardioForm()
    onFocusHandled?.()
  }, [focusRequestKey, onFocusHandled, scrollToCardioForm])

  return (
    <div className="body-tab cardio-tab">
      <section className="body-summary-grid cardio-summary-grid">
        <SummaryCard label="This week" value={cardioMinutesWeek} suffix=" min" meta={`${cardioSessionsWeek} sessions logged`} accent="orange" />
        <SummaryCard label="Weekly burn" value={cardioCaloriesWeek || '—'} suffix={cardioCaloriesWeek ? ' cal' : ''} meta={cardioCaloriesWeek ? 'Estimated from cardio entries' : 'Add calories if you want burn totals'} accent="teal" />
        <SummaryCard label="Latest session" value={latestCardio ? latestCardio.cardio_type : '—'} meta={latestCardio ? `${latestCardio.duration_minutes} min • ${latestCardio.intensity}` : 'No cardio logged yet'} accent="pink" />
      </section>
      <section className="dash-card body-chart-card">
        <div className="body-card-header body-chart-header">
          <div>
            <h3>Cardio Trend</h3>
            <p>{cardioSeries.length > 1 ? `${cardioRange}-day conditioning view.` : 'Log a few sessions to unlock the cardio trend line.'}</p>
          </div>
          <div className="body-chart-actions body-chart-actions-stack">
            <strong>{cardioMinutesWeek} min this week</strong>
            <RangeTabs value={cardioRange} onChange={onRangeChange} />
          </div>
        </div>
        <SparklineCard
          values={cardioSeries}
          stroke="var(--yellow)"
          fill="rgba(255, 208, 0, 0.18)"
          emptyLabel="No cardio trend yet"
          tickLabels={buildTickLabels(cardioSeries)}
          tooltipFormatter={point => `${formatDate(point.label)}: ${Math.round(point.value)} min cardio`}
        />
      </section>
      <section ref={cardioFormRef} className="dash-card body-form-card cardio-card">
        <div className="body-card-header">
          <h3>{editingCardioId ? 'Edit cardio' : 'Log cardio'}</h3>
          <p>{editingCardioId ? 'Update the session details or cancel to leave it unchanged.' : 'Keep conditioning separate from steps so weekly recovery stays readable.'}</p>
        </div>
        <form className="body-form-grid two-column cardio-form-grid" onSubmit={handleSubmit}>
          <label>
            Modality
            <select value={form.cardio_type} onChange={e => update('cardio_type', e.target.value)}>
              {['running','cycling','swimming','walking','rowing','stairmaster','hiit','other'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Intensity
            <select value={form.intensity} onChange={e => update('intensity', e.target.value)}>
              {[
                ['light', 'light'],
                ['moderate', 'moderate'],
                ['hard', 'hard'],
              ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Duration (minutes)
            <input type="number" min="1" max="300" placeholder="30" value={form.duration_minutes} onChange={e => update('duration_minutes', e.target.value)} required />
          </label>
          <label>
            Estimated calories
            <input type="number" min="0" max="3000" placeholder="240" value={form.estimated_calories} onChange={e => update('estimated_calories', e.target.value)} />
          </label>
          <label>
            Date
            <input type="date" value={form.date} onChange={e => update('date', e.target.value)} required />
          </label>
          <p className="cardio-estimate-note">Auto-estimated from your latest weight, modality, intensity, and duration. You can override it.</p>
          <label className="cardio-notes-field">
            Notes
            <ClearableInput type="text" placeholder="Intervals, hills, or steady state" value={form.notes} onChange={e => update('notes', e.target.value)} />
          </label>
          <div className="body-form-actions body-form-actions-full">
            <button className="btn-outline small" type="button" onClick={() => setCaloriesDirty(false)}>Recalculate calories</button>
            {editingCardioId ? <button className="btn-secondary" type="button" onClick={cancelCardioEdit}>Cancel</button> : null}
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingCardioId ? 'Update Cardio' : 'Log Cardio'}</button>
          </div>
        </form>
        {msg && <p className={msg.startsWith('Error') ? 'error' : 'success-msg'}>{msg}</p>}
      </section>
      <section className="dash-card">
        <div className="body-card-header">
          <h3>Recent cardio sessions</h3>
          <p>{cardioLogs.length ? 'Latest conditioning sessions with modality and intensity.' : 'No cardio sessions yet.'}</p>
        </div>
        <div ref={cardioListRef} className="trend-chart body-trend-chart cardio-log-list">
          {cardioLogs.map((entry, i) => (
            <div key={entry.id || i} className="trend-row body-trend-row cardio-row body-log-row">
              <div className="body-log-main">
                <span className="trend-date">{formatDate(entry.cardio_date)}</span>
                <strong className="cardio-row-title">{entry.cardio_type}</strong>
                {entry.notes ? <span className="cardio-note">{entry.notes}</span> : null}
              </div>
              <div className="cardio-row-meta">
                <span className={`cardio-intensity-pill ${entry.intensity || 'moderate'}`}>{entry.intensity || 'moderate'}</span>
                <span className="trend-val">{entry.duration_minutes} min</span>
                {entry.estimated_calories ? <span className="cardio-calories">{Number(entry.estimated_calories).toLocaleString()} cal</span> : null}
                <RowActions
                  onEdit={() => {
                    setEditingCardioId(entry.id)
                    setForm({
                      cardio_type: entry.cardio_type || 'running',
                      duration_minutes: String(entry.duration_minutes || ''),
                      intensity: normalizeFrontendCardioIntensity(entry.intensity),
                      estimated_calories: entry.estimated_calories != null ? String(entry.estimated_calories) : '',
                      notes: entry.notes || '',
                      date: entry.cardio_date || todayInputValue(),
                    })
                    setCaloriesDirty(entry.estimated_calories != null && entry.estimated_calories !== '')
                    scrollToCardioForm()
                  }}
                  onDelete={() => handleDelete(entry.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="row-actions">
      <button className="btn-outline small" type="button" onClick={onEdit}>Edit</button>
      <button className="btn-danger small" type="button" onClick={onDelete}>Delete</button>
    </div>
  )
}

function SummaryCard({ label, value, suffix = '', meta, accent }) {
  return (
    <div className={`dash-card body-summary-card ${accent || ''}`}>
      <span className="body-summary-label">{label}</span>
      <strong className="body-summary-value">{value}{suffix}</strong>
      <span className="body-summary-meta">{meta}</span>
    </div>
  )
}

function SparklineCard({ values, stroke, fill, emptyLabel, referenceValue = null, referenceLabel = '', tickLabels = [], valueLabels = [], tooltipFormatter = formatSparkTooltip }) {
  const chart = buildSparkline(values, referenceValue)

  if (!chart) {
    return <div className="sparkline-empty">{emptyLabel}</div>
  }

  return (
    <div className="sparkline-card">
      <svg viewBox="0 0 220 96" className="sparkline-svg" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`spark-${stroke.replace(/[^a-z0-9]/gi, '').toLowerCase()}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path d={chart.areaPath} fill={`url(#spark-${stroke.replace(/[^a-z0-9]/gi, '').toLowerCase()})`} />
        {chart.referenceY !== null && (
          <line
            x1="8"
            y1={chart.referenceY}
            x2="212"
            y2={chart.referenceY}
            className="sparkline-reference"
          />
        )}
        <path d={chart.linePath} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {chart.points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r={index === chart.points.length - 1 ? 4 : 3} fill={stroke}>
            <title>{tooltipFormatter(point)}</title>
          </circle>
        ))}
      </svg>
      {referenceLabel && chart.referenceY !== null && (
        <div className="sparkline-legend">
          <span className="sparkline-legend-line" />
          <span>{referenceLabel}</span>
        </div>
      )}
      {tickLabels.length > 0 && (
        <div className="sparkline-ticks">
          {tickLabels.map((tick, index) => (
            <span key={`${tick}-${index}`}>{tick}</span>
          ))}
        </div>
      )}
      {valueLabels.length > 0 ? (
        <div className="sparkline-scale">
          {valueLabels.map((valueLabel, index) => (
            <span key={`${valueLabel}-${index}`}>{valueLabel}</span>
          ))}
        </div>
      ) : (
        <div className="sparkline-scale">
          <span>{chart.maxLabel}</span>
          <span>{chart.minLabel}</span>
        </div>
      )}
    </div>
  )
}

function RangeTabs({ value, onChange }) {
  const ranges = [7, 14, 30]
  const buttonRefs = useRef([])

  function focusRange(index) {
    buttonRefs.current[index]?.focus()
  }

  function handleKeyDown(event, index) {
    const lastIndex = ranges.length - 1

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      const nextIndex = index === lastIndex ? 0 : index + 1
      onChange(ranges[nextIndex])
      focusRange(nextIndex)
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      const nextIndex = index === 0 ? lastIndex : index - 1
      onChange(ranges[nextIndex])
      focusRange(nextIndex)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      onChange(ranges[0])
      focusRange(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      onChange(ranges[lastIndex])
      focusRange(lastIndex)
    }
  }

  return (
    <div className="range-tabs" role="group" aria-label="Chart range">
      {ranges.map((days, index) => (
        <button
          key={days}
          ref={element => {
            buttonRefs.current[index] = element
          }}
          type="button"
          className={`range-tab ${value === days ? 'active' : ''}`}
          aria-pressed={value === days}
          onClick={() => onChange(days)}
          onKeyDown={event => handleKeyDown(event, index)}
        >
          {days}d
        </button>
      ))}
    </div>
  )
}

function average(values) {
  const valid = values.filter(value => Number.isFinite(value) && value > 0)
  if (!valid.length) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function latestMetricValue(items, key) {
  if (!items?.length) return null
  return items[items.length - 1]?.[key] ?? null
}

function getWeightTrend(weights) {
  if (weights.length < 2) return 'Log a few weigh-ins to see a trend'
  const latest = Number(weights[0].weight_lb)
  const prior = Number(weights[1].weight_lb)
  const delta = Math.round((latest - prior) * 10) / 10
  if (delta === 0) return 'Flat from your last entry'
  return `${delta > 0 ? '+' : ''}${delta} lbs vs previous log`
}

function getWeightSparkStyle(weights) {
  if (weights.length < 2) {
    return { stroke: 'var(--accent)', fill: 'rgba(255, 85, 48, 0.12)' }
  }

  const latest = Number(weights[0].weight_lb)
  const prior = Number(weights[1].weight_lb)

  if (latest > prior) {
    return { stroke: 'var(--accent)', fill: 'rgba(255, 85, 48, 0.12)' }
  }

  if (latest < prior) {
    return { stroke: 'var(--success)', fill: 'rgba(34, 196, 126, 0.16)' }
  }

  return { stroke: 'var(--accent2)', fill: 'rgba(0, 188, 222, 0.12)' }
}

function formatDate(value) {
  if (!value) return '—'
  return formatUsShortDate(value, value)
}

function formatDayType(value) {
	if (!value) return 'Workout'
	return value.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayInputValue() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date.toISOString().slice(0, 10)
}

function selectSeries(items, days, valueGetter, labelGetter) {
  return (items ?? [])
    .slice(-days)
    .map(item => ({
      value: valueGetter(item),
      label: labelGetter(item),
    }))
    .filter(item => Number.isFinite(item.value))
}

function buildTickLabels(series) {
  if (!series || series.length < 2) return []
  const indices = buildSparkTickIndices(series)
  return indices.map(index => formatDate(series[index]?.label))
}

function buildTickValueLabels(series, formatter = point => formatSparkValue(point?.value)) {
  if (!series || series.length < 2) return []
  const indices = buildSparkTickIndices(series)
  return indices.map(index => formatter(series[index]))
}

function buildSparkTickIndices(series) {
  return Array.from(new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]))
}

function buildSparkline(values, referenceValue = null) {
  if (!values || values.length < 2) return null

  const normalizedValues = values.map(item => typeof item === 'number' ? { value: item, label: '' } : item)
  const numericValues = normalizedValues.map(item => item.value)

  const width = 220
  const height = 96
  const paddingX = 8
  const paddingY = 10
  const minCandidates = referenceValue === null ? numericValues : [...numericValues, referenceValue]
  const maxCandidates = referenceValue === null ? numericValues : [...numericValues, referenceValue]
  const min = Math.min(...minCandidates)
  const max = Math.max(...maxCandidates)
  const spread = max - min || 1
  const stepX = (width - paddingX * 2) / Math.max(numericValues.length - 1, 1)

  const points = normalizedValues.map((item, index) => {
    const value = item.value
    const x = paddingX + stepX * index
    const normalized = (value - min) / spread
    const y = height - paddingY - normalized * (height - paddingY * 2)
    return { x: round(x), y: round(y), value, label: item.label }
  })

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const lastPoint = points[points.length - 1]
  const firstPoint = points[0]
  const areaPath = `${linePath} L ${lastPoint.x} ${height - paddingY} L ${firstPoint.x} ${height - paddingY} Z`
  const referenceY = Number.isFinite(referenceValue)
    ? round(height - paddingY - (((referenceValue - min) / spread) * (height - paddingY * 2)))
    : null

  return {
    points,
    linePath,
    areaPath,
    referenceY,
    minLabel: formatSparkValue(min),
    maxLabel: formatSparkValue(max),
  }
}

function formatSparkValue(value) {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString()
  return Math.round(value * 10) / 10
}

function formatSparkTooltip(point) {
  return `${formatDate(point.label)}: ${formatSparkValue(point.value)}`
}

function estimateCardioCalories({ cardioType, intensity, durationMinutes, weightLb }) {
  const minutes = Number(durationMinutes)
  if (!Number.isFinite(minutes) || minutes <= 0) return null

  const weightKg = Number.isFinite(weightLb) && weightLb > 0 ? weightLb * 0.453592 : 81.6
  const met = getCardioMet(cardioType, intensity)
  const calories = ((met * 3.5 * weightKg / 200) * minutes) * EXERCISE_CALORIE_MULTIPLIER
  return Math.max(1, Math.round(calories))
}

function estimateWorkoutCalories({ dayType, timeTier, durationMinutes, weightLb }) {
  const minutes = Number(durationMinutes)
  if (!Number.isFinite(minutes) || minutes <= 0) return null

  const weightKg = Number.isFinite(weightLb) && weightLb > 0 ? weightLb * 0.453592 : 81.6
  const met = getWorkoutMet(dayType, timeTier)
  if (!Number.isFinite(met) || met <= 0) return null
  const calories = (met * weightKg * (minutes / 60)) * EXERCISE_CALORIE_MULTIPLIER

  return Math.max(1, Math.round(calories))
}

function getWorkoutMet(dayType, timeTier) {
  const normalizedDayType = String(dayType || '').trim().toLowerCase()
  const normalizedTimeTier = String(timeTier || '').trim().toLowerCase()

  if (normalizedDayType === 'rest') {
    return 0
  }

  if (normalizedDayType === 'cardio') {
    const cardioMap = { short: 6.5, medium: 7.3, full: 8.0 }
    return cardioMap[normalizedTimeTier] || cardioMap.medium
  }

  const strengthMap = { short: 4.8, medium: 5.4, full: 6.0 }
  return strengthMap[normalizedTimeTier] || strengthMap.medium
}

function getCardioMet(cardioType, intensity) {
  const normalizedIntensity = normalizeFrontendCardioIntensity(intensity)
  const metTable = {
    running: { light: 8.3, moderate: 9.8, hard: 11.0 },
    cycling: { light: 4.0, moderate: 6.8, hard: 8.8 },
    swimming: { light: 6.0, moderate: 8.3, hard: 10.0 },
    walking: { light: 2.8, moderate: 3.8, hard: 5.0 },
    rowing: { light: 5.0, moderate: 7.0, hard: 8.5 },
    stairmaster: { light: 4.0, moderate: 8.8, hard: 9.5 },
    hiit: { light: 6.0, moderate: 8.5, hard: 10.5 },
    other: { light: 3.5, moderate: 5.5, hard: 7.5 },
  }

  const typeTable = metTable[cardioType] || metTable.other
  return typeTable[normalizedIntensity] || typeTable.moderate
}

function normalizeFrontendCardioIntensity(intensity) {
  if (intensity === 'low') return 'light'
  if (intensity === 'high' || intensity === 'max') return 'hard'
  if (intensity === 'light' || intensity === 'moderate' || intensity === 'hard') return intensity
  return 'moderate'
}

function sumCardioMinutes(logs, days) {
  return withinDays(logs, days).reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0)
}

function sumCardioCalories(logs, days) {
  return withinDays(logs, days).reduce((sum, entry) => sum + Number(entry.estimated_calories || 0), 0)
}

function countCardioSessions(logs, days) {
  return withinDays(logs, days).length
}

function withinDays(logs, days) {
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - (days - 1))

  return (logs ?? []).filter(entry => {
    const date = new Date(`${entry.cardio_date}T12:00:00`)
    return !Number.isNaN(date.getTime()) && date >= cutoff
  })
}

function upsertLocalBodyEntry(entries, nextEntry, dateKey, allowDateFallback = false) {
  const list = Array.isArray(entries) ? [...entries] : []
  const entryId = String(nextEntry?.id || '')
  const entryDate = String(nextEntry?.[dateKey] || '')
  const nextIndex = list.findIndex((entry) => {
    if (entryId && String(entry?.id || '') === entryId) return true
    return allowDateFallback && entryDate && String(entry?.[dateKey] || '') === entryDate
  })

  if (nextIndex >= 0) {
    list[nextIndex] = { ...list[nextIndex], ...nextEntry }
  } else {
    list.unshift(nextEntry)
  }

  return list.sort((a, b) => String(b?.[dateKey] || '').localeCompare(String(a?.[dateKey] || '')))
}

function upsertLocalSeriesEntry(entries, nextEntry, dateKey) {
  const list = Array.isArray(entries) ? [...entries] : []
  const entryDate = String(nextEntry?.[dateKey] || '')
  const nextIndex = list.findIndex((entry) => String(entry?.[dateKey] || '') === entryDate)

  if (nextIndex >= 0) {
    list[nextIndex] = { ...list[nextIndex], ...nextEntry }
  } else {
    list.unshift(nextEntry)
  }

  return list.sort((a, b) => String(b?.[dateKey] || '').localeCompare(String(a?.[dateKey] || '')))
}

function buildLocalWeightEntry(data, result) {
  return {
    id: data?.id || result?.local_id || `weight_${Date.now()}`,
    weight_lb: Number(data?.weight_lb || 0),
    metric_date: String(data?.date || todayInputValue()),
  }
}

function buildLocalSleepEntry(data, result) {
  return {
    id: data?.id || result?.local_id || `sleep_${Date.now()}`,
    hours_sleep: Number(data?.hours_sleep || 0),
    sleep_quality: String(data?.sleep_quality || 'good'),
    sleep_date: String(data?.date || yesterdayInputValue()),
  }
}

function buildLocalStepsEntry(data, result) {
  return {
    id: data?.id || result?.local_id || `steps_${Date.now()}`,
    steps: Number(data?.steps || 0),
    step_date: String(data?.date || todayInputValue()),
  }
}

function buildLocalCardioEntry(data, result) {
  return {
    id: data?.id || result?.local_id || `cardio_${Date.now()}`,
    cardio_type: String(data?.cardio_type || 'running'),
    duration_minutes: Number(data?.duration_minutes || 0),
    intensity: normalizeFrontendCardioIntensity(data?.intensity),
    estimated_calories: data?.estimated_calories ? Number(data.estimated_calories) : 0,
    notes: String(data?.notes || ''),
    cardio_date: String(data?.date || todayInputValue()),
    time_tier: String(data?.time_tier || 'medium'),
  }
}

function round(value) {
  return Math.round(value * 100) / 100
}
