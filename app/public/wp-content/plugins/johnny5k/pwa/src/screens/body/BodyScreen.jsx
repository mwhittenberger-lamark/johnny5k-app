import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { bodyApi } from '../../api/client'
import { formatUsShortDate } from '../../lib/dateFormat'
import { useDashboardStore } from '../../store/dashboardStore'

export default function BodyScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const [weights, setWeights]   = useState([])
  const [sleepLogs, setSleepLogs] = useState([])
  const [stepLogs, setStepLogs] = useState([])
  const [cardioLogs, setCardioLogs] = useState([])
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
  const [msg, setMsg]           = useState('')
  const weightFormRef = useRef(null)
  const sleepFormRef = useRef(null)
  const stepsFormRef = useRef(null)
  const invalidate = useDashboardStore(s => s.invalidate)
  const snapshot = useDashboardStore(s => s.snapshot)
  const loadSnapshot = useDashboardStore(s => s.loadSnapshot)

  useEffect(() => {
    refreshBodyData()
    loadSnapshot()
  }, [])

  useEffect(() => {
    if (location.state?.focusTab) {
      setTab(location.state.focusTab)
    }
  }, [location.state?.focusTab])

  function refreshBodyData() {
    bodyApi.getWeight(14).then(setWeights).catch(() => {})
    bodyApi.getSleep(7).then(setSleepLogs).catch(() => {})
    bodyApi.getSteps(10).then(setStepLogs).catch(() => {})
    bodyApi.getCardio(10).then(setCardioLogs).catch(() => {})
    bodyApi.getMetrics(30).then(setMetrics).catch(() => {})
  }

  function setFlash(message) {
    setMsg(message)
  }

  async function logWeight(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingWeightId) {
        await bodyApi.updateWeight(editingWeightId, { weight_lb: +weightInput, date: weightDate })
        setFlash('Weight updated!')
      } else {
        await bodyApi.logWeight({ weight_lb: +weightInput, date: weightDate })
        setFlash('Weight logged!')
      }
      resetWeightForm()
      invalidate()
      loadSnapshot(true)
      refreshBodyData()
    } catch (err) { setFlash('Error: ' + err.message) }
    setSaving(false)
  }

  async function logSleep(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingSleepId) {
        await bodyApi.updateSleep(editingSleepId, { hours_sleep: +sleepInput, sleep_quality: sleepQuality, date: sleepDate })
        setFlash('Sleep updated!')
      } else {
        await bodyApi.logSleep({ hours_sleep: +sleepInput, sleep_quality: sleepQuality, date: sleepDate })
        setFlash('Sleep logged!')
      }
      resetSleepForm()
      invalidate()
      loadSnapshot(true)
      refreshBodyData()
    } catch (err) { setFlash('Error: ' + err.message) }
    setSaving(false)
  }

  async function logSteps(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingStepId) {
        await bodyApi.updateSteps(editingStepId, { steps: +stepsInput, date: stepsDate })
        setFlash('Steps updated!')
      } else {
        await bodyApi.logSteps({ steps: +stepsInput, date: stepsDate })
        setFlash('Steps logged!')
      }
      resetStepsForm()
      invalidate()
      loadSnapshot(true)
      refreshBodyData()
    } catch (err) { setFlash('Error: ' + err.message) }
    setSaving(false)
  }

  async function removeWeight(id) {
    if (!window.confirm('Delete this weight entry?')) return
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
    if (!window.confirm('Delete this sleep entry?')) return
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
    if (!window.confirm('Delete this step entry?')) return
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
  const todaySteps = snapshot?.steps?.today ?? latestMetricValue(metrics.steps, 'steps') ?? 0
  const stepTarget = snapshot?.steps?.target ?? 8000
  const sleepTarget = Number(snapshot?.goal?.target_sleep_hours ?? 8)
  const stepPct = stepTarget ? Math.min(100, Math.round((todaySteps / stepTarget) * 100)) : 0
  const lastSleep = sleepLogs[0]?.hours_sleep ?? snapshot?.sleep?.hours_sleep ?? '—'
  const recoverySummary = snapshot?.recovery_summary
  const activeFlagItems = Array.isArray(recoverySummary?.active_flag_items) ? recoverySummary.active_flag_items : []
  const caloriePreview = snapshot?.calorie_adjustment_preview
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
    metrics.steps,
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

  function scrollToForm(ref) {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const input = ref.current?.querySelector('input, select, textarea')
      input?.focus()
    })
  }

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

  function resetSleepForm() {
    setEditingSleepId(null)
    setSleep('')
    setSleepQuality('good')
    setSleepDate(yesterdayInputValue())
  }

  function resetStepsForm() {
    setEditingStepId(null)
    setSteps('')
    setStepsDate(todayInputValue())
  }

  return (
    <div className="screen body-screen">
      <header className="screen-header body-screen-header">
        <div>
          <h1>Progress</h1>
          <p className="body-screen-subtitle">Track bodyweight, recovery, movement, and cardio in one place.</p>
        </div>
      </header>

      {msg && <p className={msg.startsWith('Error') ? 'error' : 'success-msg'} onClick={() => setMsg('')}>{msg}</p>}

      <section className="body-summary-grid">
        <SummaryCard label="Latest weight" value={latestWeight} suffix=" lbs" meta={weightTrend} accent="orange" />
        <SummaryCard label="Avg sleep" value={avgSleep ? avgSleep.toFixed(1) : '—'} suffix=" h" meta={lastSleep !== '—' ? `Last night ${lastSleep}h` : 'Log sleep to see recovery trends'} accent="teal" />
        <SummaryCard label="Steps today" value={Number(todaySteps).toLocaleString()} meta={`Target ${Number(stepTarget).toLocaleString()} • ${stepPct}%`} accent="pink" />
      </section>

      <section className="dash-card body-progress-card">
        <div className="body-progress-header">
          <div>
            <h3>Movement Progress</h3>
            <p>{Number(todaySteps).toLocaleString()} of {Number(stepTarget).toLocaleString()} steps</p>
          </div>
          <strong>{stepPct}%</strong>
        </div>
        <div className="bar-track body-progress-track">
          <div className="bar-fill body-progress-fill" style={{ width: `${stepPct}%` }} />
        </div>
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

      {recoverySummary ? (
        <section className="dash-card body-recovery-card">
          <div className="body-card-header">
            <div>
              <h3>Recovery Loop</h3>
              <p>{recoverySummary.headline}</p>
            </div>
            <span className={`dashboard-chip ${recoverySummary.mode === 'normal' ? 'success' : 'subtle'}`}>{recoverySummary.mode}</span>
          </div>
          <div className="body-mini-stats">
            <div><strong>{recoverySummary.last_sleep_hours || '—'}h</strong><span>Last night</span></div>
            <div><strong>{recoverySummary.avg_sleep_3d || '—'}h</strong><span>3-day avg</span></div>
            <div><strong>{recoverySummary.cardio_minutes_7d || 0}</strong><span>Cardio min / 7d</span></div>
            <div><strong>{recoverySummary.active_flags || 0}</strong><span>Active flags</span></div>
          </div>
          {activeFlagItems.length ? (
            <div className="dashboard-johnny-metric-row">
              {activeFlagItems.map(flag => (
                <span key={flag.id || `${flag.label}-${flag.severity}`} className="dashboard-chip subtle dashboard-johnny-metric">
                  {flag.label}{flag.severity ? ` • ${flag.severity}` : ''}
                </span>
              ))}
            </div>
          ) : (
            <p className="body-recovery-note">Active flags: <strong>None</strong></p>
          )}
          <p className="body-recovery-note">Recommended training tier: <strong>{recoverySummary.recommended_time_tier}</strong></p>
          {caloriePreview ? (
            <p className="body-recovery-note">Calorie adjustment preview: <strong>{caloriePreview.action}</strong> {caloriePreview.delta_calories > 0 ? '+' : ''}{caloriePreview.delta_calories} kcal. {caloriePreview.reason}</p>
          ) : (
            <p className="body-recovery-note">No calorie change is queued right now. Keep logging weight and meals for a stronger adjustment signal.</p>
          )}
        </section>
      ) : null}

      <div className="tab-bar">
        {[
          ['weight', 'Weight'],
          ['sleep', 'Sleep'],
          ['steps', 'Steps'],
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
                {editingWeightId ? <button className="btn-secondary" type="button" onClick={resetWeightForm}>Cancel</button> : null}
                <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingWeightId ? 'Update Weight' : 'Log Weight'}</button>
              </div>
            </form>
          </section>
          <section className="dash-card">
            <div className="body-card-header">
              <h3>Recent weigh-ins</h3>
              <p>{weights.length ? 'Your latest 14 entries.' : 'No weigh-ins yet.'}</p>
            </div>
            <div className="trend-chart body-trend-chart">
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
                {editingSleepId ? <button className="btn-secondary" type="button" onClick={resetSleepForm}>Cancel</button> : null}
                <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingSleepId ? 'Update Last Night' : 'Log Last Night'}</button>
              </div>
            </form>
          </section>
          <section className="dash-card">
            <div className="body-card-header">
              <h3>Recent sleep</h3>
              <p>{sleepLogs.length ? 'Last 7 nights with quality tags.' : 'No sleep logs yet.'}</p>
            </div>
            <div className="trend-chart body-trend-chart">
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
                <h3>Step Trend</h3>
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
                {editingStepId ? <button className="btn-secondary" type="button" onClick={resetStepsForm}>Cancel</button> : null}
                <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingStepId ? 'Update Steps' : 'Save Steps'}</button>
              </div>
            </form>
            <div className="body-mini-stats">
              <div>
                <span>Today</span>
                <strong>{Number(todaySteps).toLocaleString()}</strong>
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
            <div className="trend-chart body-trend-chart compact">
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
          onRefreshSnapshot={() => loadSnapshot(true)}
          onFlash={setFlash}
        />
      )}
    </div>
  )
}

function CardioTab({ invalidate, cardioLogs, cardioSeries, cardioRange, currentWeight, onRangeChange, onLogged, onRefreshSnapshot, onFlash }) {
  const [form, setForm] = useState({ cardio_type: 'running', duration_minutes: '', intensity: 'moderate', estimated_calories: '', notes: '', date: todayInputValue() })
  const [editingCardioId, setEditingCardioId] = useState(null)
  const [caloriesDirty, setCaloriesDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const cardioFormRef = useRef(null)

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

    setForm(current => ({
      ...current,
      estimated_calories: estimate ? String(estimate) : '',
    }))
  }, [form.cardio_type, form.duration_minutes, form.intensity, currentWeight, caloriesDirty])

  function update(k, v) {
    if (k === 'estimated_calories') {
      setCaloriesDirty(v !== '')
    }
    setForm(f => ({ ...f, [k]: v }))
  }

  function scrollToCardioForm() {
    requestAnimationFrame(() => {
      cardioFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const input = cardioFormRef.current?.querySelector('input, select, textarea')
      input?.focus()
    })
  }

  function resetCardioForm(nextType = 'running', nextIntensity = 'moderate') {
    setEditingCardioId(null)
    setForm({ cardio_type: nextType, duration_minutes: '', intensity: nextIntensity, estimated_calories: '', notes: '', date: todayInputValue() })
    setCaloriesDirty(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingCardioId) {
        await bodyApi.updateCardio(editingCardioId, form)
        setMsg('Cardio updated!')
        onFlash?.('Cardio updated!')
      } else {
        await bodyApi.logCardio(form)
        setMsg('Cardio logged!')
        onFlash?.('Cardio logged!')
      }
      resetCardioForm(form.cardio_type, form.intensity)
      invalidate()
      onRefreshSnapshot?.()
      onLogged?.()
    } catch (err) { setMsg('Error: ' + err.message) }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this cardio entry?')) return
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
      onLogged?.()
    } catch (err) { setMsg('Error: ' + err.message) }
    setSaving(false)
  }

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
            <input type="text" placeholder="Intervals, hills, or steady state" value={form.notes} onChange={e => update('notes', e.target.value)} />
          </label>
          <div className="body-form-actions body-form-actions-full">
            <button className="btn-outline small" type="button" onClick={() => setCaloriesDirty(false)}>Recalculate calories</button>
            {editingCardioId ? <button className="btn-secondary" type="button" onClick={() => resetCardioForm()}>Cancel</button> : null}
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
        <div className="trend-chart body-trend-chart cardio-log-list">
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

function SparklineCard({ values, stroke, fill, emptyLabel, referenceValue = null, referenceLabel = '', tickLabels = [], tooltipFormatter = formatSparkTooltip }) {
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
      <div className="sparkline-scale">
        <span>{chart.maxLabel}</span>
        <span>{chart.minLabel}</span>
      </div>
    </div>
  )
}

function RangeTabs({ value, onChange }) {
  const ranges = [7, 14, 30]

  return (
    <div className="range-tabs" role="tablist" aria-label="Chart range">
      {ranges.map(days => (
        <button
          key={days}
          type="button"
          className={`range-tab ${value === days ? 'active' : ''}`}
          onClick={() => onChange(days)}
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
  const indices = Array.from(new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]))
  return indices.map(index => formatDate(series[index]?.label))
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
  const calories = (met * 3.5 * weightKg / 200) * minutes
  return Math.max(1, Math.round(calories))
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

function round(value) {
  return Math.round(value * 100) / 100
}
