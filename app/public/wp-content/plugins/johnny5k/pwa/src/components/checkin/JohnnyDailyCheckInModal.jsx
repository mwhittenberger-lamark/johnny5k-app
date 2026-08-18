import { useEffect, useRef, useState } from 'react'
import { bodyApi } from '../../api/modules/body'
import { dashboardApi } from '../../api/modules/dashboard'
import AppDialog from '../ui/AppDialog'
import { formatUsChartDate } from '../../lib/dateFormat'

const today = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export default function JohnnyDailyCheckInModal({ onClose }) {
  const closeRef = useRef(null)
  const [sleepHours, setSleepHours] = useState('')
  const [sleepQuality, setSleepQuality] = useState('good')
  const [weight, setWeight] = useState('')
  const [steps, setSteps] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoAngle, setPhotoAngle] = useState('front')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [trends, setTrends] = useState({ sleep: [], weight: [], steps: [] })
  const [activeTrend, setActiveTrend] = useState('weight')

  useEffect(() => {
    let active = true
    Promise.all([
      bodyApi.getSteps(8).catch(() => []),
      bodyApi.getWeight(8).catch(() => []),
      bodyApi.getSleep(8).catch(() => []),
    ]).then(([stepEntries, weightEntries, sleepEntries]) => {
      if (!active) return
      const nextTrends = {
        steps: buildRecentTrend(stepEntries, null, 'step_date', 'steps'),
        weight: buildRecentTrend(weightEntries, null, 'metric_date', 'weight_lb'),
        sleep: buildRecentTrend(sleepEntries, null, 'sleep_date', 'hours_sleep'),
      }
      const todayKey = today()
      const todaySteps = nextTrends.steps.find(point => point.date === todayKey)
      const todayWeight = nextTrends.weight.find(point => point.date === todayKey)
      const todaySleep = nextTrends.sleep.find(point => point.date === todayKey)
      if (todaySteps) setSteps(String(todaySteps.value))
      if (todayWeight) setWeight(String(todayWeight.value))
      if (todaySleep) setSleepHours(String(todaySleep.value))
      setTrends(nextTrends)
    })
    return () => { active = false }
  }, [])

  async function saveCheckIn(event) {
    event.preventDefault()
    if (!sleepHours && !weight && !steps && !photo) {
      setError('Add sleep, weight, steps, or a progress photo first.')
      return
    }

    setSaving(true)
    setError('')
    setStatus('')
    setTrends(current => ({ sleep: [], weight: [], steps: current.steps }))
    try {
      const tasks = []
      if (sleepHours) tasks.push(bodyApi.logSleep({ hours_sleep: Number(sleepHours), sleep_quality: sleepQuality, date: today() }))
      if (weight) tasks.push(bodyApi.logWeight({ weight_lb: Number(weight), date: today() }))
      if (steps) tasks.push(bodyApi.logSteps({ steps: Number(steps), date: today() }))
      if (photo) {
        const form = new FormData()
        form.append('photo', photo)
        form.append('angle', photoAngle)
        form.append('date', today())
        tasks.push(dashboardApi.photoUpload(form))
      }
      await Promise.all(tasks)
      const [sleepHistory, weightHistory, stepHistory] = await Promise.all([
        sleepHours ? bodyApi.getSleep(8).catch(() => []) : Promise.resolve([]),
        weight ? bodyApi.getWeight(8).catch(() => []) : Promise.resolve([]),
        steps ? bodyApi.getSteps(8).catch(() => []) : Promise.resolve([]),
      ])
      setTrends({
        sleep: sleepHours ? buildRecentTrend(sleepHistory, { date: today(), value: Number(sleepHours) }, 'sleep_date', 'hours_sleep') : [],
        weight: weight ? buildRecentTrend(weightHistory, { date: today(), value: Number(weight) }, 'metric_date', 'weight_lb') : [],
        steps: steps ? buildRecentTrend(stepHistory, { date: today(), value: Number(steps) }, 'step_date', 'steps') : trends.steps,
      })
      setStatus('Check-in saved. Johnny has today’s latest recovery and progress data.')
    } catch (saveError) {
      setError(saveError?.message || 'The check-in could not be saved. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDialog ariaLabel="Daily progress check-in" className="johnny-daily-log-modal" initialFocusRef={closeRef} onClose={onClose} open overlayClassName="johnny-daily-log-shell" size="md">
      <form className="johnny-daily-log-form" onSubmit={saveCheckIn}>
        <header className="johnny-daily-log-head">
          <div>
            <span>Daily check-in</span>
            <h2>Log today’s signals</h2>
            <p>A quick snapshot for recovery and visible progress.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close daily check-in">×</button>
        </header>

        <div className="johnny-daily-log-fields">
          <label className="johnny-daily-log-weight">
            <span>Weight <i>lb</i></span>
            <input type="number" min="80" max="600" step="0.1" inputMode="decimal" placeholder="198.4" value={weight} onChange={event => setWeight(event.target.value)} />
          </label>
          <label className="johnny-daily-log-steps">
            <span>Steps today</span>
            <input id="johnny-steps" type="number" min="0" max="100000" step="1" inputMode="numeric" placeholder="8,000" value={steps} onChange={event => setSteps(event.target.value)} />
          </label>
          <label>
            <span>Hours of sleep</span>
            <input type="number" min="0.1" max="24" step="0.1" inputMode="decimal" placeholder="7.5" value={sleepHours} onChange={event => setSleepHours(event.target.value)} />
          </label>
          <label>
            <span>Sleep quality</span>
            <select value={sleepQuality} onChange={event => setSleepQuality(event.target.value)}>
              <option value="poor">Poor</option><option value="okay">Okay</option><option value="good">Good</option><option value="great">Great</option>
            </select>
          </label>
          <div className="johnny-daily-log-photo">
            <div><span>Progress photo</span><small>Private · JPG, PNG, or WebP</small></div>
            <select aria-label="Progress photo angle" value={photoAngle} onChange={event => setPhotoAngle(event.target.value)}>
              <option value="front">Front</option><option value="side">Side</option><option value="back">Back</option>
            </select>
            <label className={photo ? 'selected' : ''}>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setPhoto(event.target.files?.[0] || null)} />
              <span>{photo ? photo.name : 'Choose photo'}</span>
            </label>
          </div>
        </div>

        {error ? <p className="johnny-daily-log-error" role="alert">{error}</p> : null}
        {status ? <p className="johnny-daily-log-success" role="status">{status}</p> : null}
        <TrendNavigator activeTrend={activeTrend} onChange={setActiveTrend} trends={trends} />
        <footer>
          <button type="button" className="johnny-daily-log-later" onClick={onClose}>Not now</button>
          <button type="submit" className="johnny-daily-log-save" disabled={saving}>{saving ? 'Saving…' : status ? 'Saved' : 'Save check-in'}</button>
        </footer>
      </form>
    </AppDialog>
  )
}

function TrendNavigator({ activeTrend, onChange, trends }) {
  const views = {
    weight: { title: 'Recent weight', unit: 'lb', digits: 1 },
    steps: { title: 'Recent steps', unit: 'steps', digits: 0 },
    sleep: { title: 'Recent sleep', unit: 'h', digits: 1 },
  }
  const view = views[activeTrend]
  const points = trends[activeTrend] || []

  return (
    <section className="johnny-daily-trends" aria-label="Daily check-in trends">
      <nav className="johnny-daily-trend-nav" aria-label="Choose a trend" role="tablist">
        {Object.keys(views).map(key => (
          <button key={key} type="button" role="tab" aria-selected={activeTrend === key} className={activeTrend === key ? 'active' : ''} onClick={() => onChange(key)}>
            {key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
      </nav>
      {points.length
        ? <MiniTrendGraph title={view.title} unit={view.unit} points={points} digits={view.digits} />
        : <div className="johnny-daily-trend-empty" role="tabpanel"><strong>No {activeTrend} history yet</strong><span>Log today’s {activeTrend} to start this graph.</span></div>}
    </section>
  )
}

function buildRecentTrend(entries, current, dateKey, valueKey) {
  const points = (Array.isArray(entries) ? entries : [])
    .map(entry => ({ date: String(entry?.[dateKey] || entry?.date || ''), value: Number(entry?.[valueKey]) }))
    .filter(point => point.date && Number.isFinite(point.value))
  if (!current) return points.sort((a, b) => a.date.localeCompare(b.date)).slice(-8)
  const withoutToday = points.filter(point => point.date !== current.date)
  return [...withoutToday, current].sort((a, b) => a.date.localeCompare(b.date)).slice(-8)
}

function MiniTrendGraph({ title, unit, points, digits = 1 }) {
  const values = points.map(point => point.value)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = maximum - minimum || 1
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? 150 : 12 + (index / (points.length - 1)) * 276,
    y: 72 - ((point.value - minimum) / range) * 52,
  }))
  const path = coordinates.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const latest = coordinates.at(-1)

  return (
    <section className="johnny-daily-trend" aria-label={`${title} graph`}>
      <header><span>{title}</span><strong>{latest.value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })} {unit}</strong></header>
      <svg viewBox="0 0 300 88" role="img" aria-label={`${title}: ${points.map(point => `${formatUsChartDate(point.date, point.date)} ${point.value} ${unit}`).join(', ')}`}>
        <path className="johnny-daily-trend-grid" d="M12 20H288 M12 46H288 M12 72H288" />
        <path className="johnny-daily-trend-line" d={path} />
        {coordinates.map((point, index) => <circle key={`${point.date}-${point.value}-${index}`} cx={point.x} cy={point.y} r="3.5" />)}
      </svg>
      <footer><small>{formatUsChartDate(points[0].date, points[0].date)}</small><small>{formatUsChartDate(latest.date, latest.date)}</small></footer>
    </section>
  )
}
