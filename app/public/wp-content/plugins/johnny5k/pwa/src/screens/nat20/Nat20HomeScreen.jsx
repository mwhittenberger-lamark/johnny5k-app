import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bodyApi } from '../../api/modules/body'
import { ironquestApi } from '../../api/modules/ironquest'
import { applyBrand } from '../../brands/registry'
import { useIronQuestStarterPortrait } from '../../hooks/useIronQuestStarterPortrait'
import { useDashboardStore } from '../../store/dashboardStore'
import { useJohnnyAssistantStore } from '../../store/johnnyAssistantStore'
import JohnnyAssistantDrawer from '../../components/ai/JohnnyAssistantDrawer'

const DESTINATIONS = [
  { id: 'brinewatch', name: 'Brinewatch', region: 'Saltwind Coast', copy: 'A weathered harbor where long walks follow the sea wall.', distance: '2 days', x: 10, y: 64 },
  { id: 'mossmere', name: 'Mossmere', region: 'The Green Lowlands', copy: 'Quiet trails, apothecaries, and patient endurance work.', distance: '1 day', x: 31, y: 34 },
  { id: 'cinderhold', name: 'Cinderhold', region: 'The Ironspine Range', copy: 'A forge-city known for trials of strength beneath the mountain.', distance: 'Your camp', x: 52, y: 53 },
  { id: 'whisperwood', name: 'Whisperwood', region: 'The Elder Grove', copy: 'Twilight paths reward balance, recovery, and a steady pace.', distance: '3 days', x: 72, y: 69 },
  { id: 'starfall', name: 'Starfall Spire', region: 'The Astral Reach', copy: 'A distant observatory for adventurers chasing mastery.', distance: '5 days', x: 89, y: 38 },
]

export default function Nat20HomeScreen() {
  const navigate = useNavigate()
  const snapshot = useDashboardStore(state => state.snapshot)
  const loading = useDashboardStore(state => state.loading)
  const dashboardError = useDashboardStore(state => state.error)
  const loadSnapshot = useDashboardStore(state => state.loadSnapshot)
  const { openDrawer, closeDrawer, isOpen: oracleOpen } = useJohnnyAssistantStore()
  const [hub, setHub] = useState(null)
  const [history, setHistory] = useState({ weight: [], sleep: [], steps: [] })
  const [selectedDestination, setSelectedDestination] = useState('cinderhold')
  const [hubError, setHubError] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [quickLogOpen, setQuickLogOpen] = useState(false)
  const [oracleOrigin, setOracleOrigin] = useState({ x: 'calc(100% - 54px)', y: 'calc(100% - 54px)' })

  function summonGrimshaw(event) {
    const box = event?.currentTarget?.getBoundingClientRect?.()
    if (box) setOracleOrigin({ x: `${box.left + box.width / 2}px`, y: `${box.top + box.height / 2}px` })
    openDrawer()
  }

  useEffect(() => {
    applyBrand('nat20')
    void loadSnapshot()
    ironquestApi.profile().then(setHub).catch(error => setHubError(error?.message || 'The quest ledger could not be opened.'))
    Promise.all([bodyApi.getWeight(7), bodyApi.getSleep(7), bodyApi.getSteps(7)])
      .then(([weight, sleep, steps]) => setHistory({ weight: rowsFrom(weight), sleep: rowsFrom(sleep), steps: rowsFrom(steps) }))
      .catch(() => {})
  }, [loadSnapshot])

  const profile = hub?.profile || {}
  const portrait = useIronQuestStarterPortrait(profile.starter_portrait_attachment_id)
  const scheduledType = String(snapshot?.training_status?.scheduled_day_type || snapshot?.today_schedule?.day_type || 'training')
  const workoutDone = Boolean(snapshot?.training_status?.recorded || snapshot?.session?.completed)
  const steps = Number(snapshot?.steps?.total_movement_today ?? snapshot?.steps?.today ?? 0)
  const stepTarget = Number(snapshot?.steps?.target || 8000)
  const mealCount = Array.isArray(snapshot?.meals_today) ? snapshot.meals_today.length : 0
  const isRestDay = ['rest', 'full_rest'].includes(scheduledType) || snapshot?.training_status?.status === 'rest_day'
  const locationName = hub?.location?.name || humanize(profile.current_location_slug) || 'Cinderhold'
  const currentMission = useMemo(() => {
    const missions = Array.isArray(hub?.missions) ? hub.missions : []
    const slug = hub?.active_run?.mission_slug || profile.active_mission_slug
    return missions.find(item => item.slug === slug) || missions[0] || null
  }, [hub, profile.active_mission_slug])
  const adventureName = currentMission?.name || adventureFor(scheduledType)
  const quests = [
    { name: 'Visit the Tavern', detail: 'Log today’s provisions or plan the meals ahead.', meta: mealCount ? `${mealCount} logged` : 'Plan meals', xp: 10, done: mealCount > 0, to: '/nutrition' },
    { name: 'Retrieve the Ashglass Artifact', detail: `Walk the eastern road and log ${stepTarget.toLocaleString()} steps.`, meta: `${steps.toLocaleString()} steps`, xp: 15, done: steps >= stepTarget, to: '/body' },
    { name: `Daily Adventure: ${adventureName}`, detail: isRestDay ? 'Recovery is today’s appointed adventure.' : `Prepare for today’s ${humanize(scheduledType)} training.`, meta: workoutDone ? 'Complete' : 'Plan workout', xp: 30, done: workoutDone, to: '/workout' },
    { name: 'Visit the Emberrest Inn', detail: 'Record recovery and hear what the body is telling you.', meta: isRestDay ? 'Rest appointed' : 'Recovery', xp: 10, done: isRestDay, to: '/body' },
  ]
  const completed = quests.filter(item => item.done).length
  const calories = Number(snapshot?.nutrition_totals?.calories || 0)
  const calorieTarget = Number(snapshot?.goal?.target_calories || 0)
  const protein = Number(snapshot?.nutrition_totals?.protein_g || 0)
  const proteinTarget = Number(snapshot?.goal?.target_protein_g || 0)
  const carbs = Number(snapshot?.nutrition_totals?.carbs_g || 0)
  const carbsTarget = Number(snapshot?.goal?.target_carbs_g || 0)
  const fat = Number(snapshot?.nutrition_totals?.fat_g || 0)
  const fatTarget = Number(snapshot?.goal?.target_fat_g || 0)
  const sleep = Number(snapshot?.sleep?.hours_sleep || 0)
  const sleepTarget = Number(snapshot?.goal?.target_sleep_hours || 8)
  const weight = Number(snapshot?.latest_weight?.weight_lb || 0)
  const readiness = Math.max(0, Math.min(100, Math.round(Number(snapshot?.score_7d || 0))))
  const destination = DESTINATIONS.find(item => item.id === selectedDestination) || DESTINATIONS[2]

  return (
    <main className={`nat20-home ${navOpen ? 'is-nav-open' : ''}`}>
      <header className="nat20-home-topbar">
        <div className="nat20-brand-lockup"><span className="nat20-d20-crest" aria-hidden="true"><D20Icon showNumber /></span><div><h1>Nat20 Fitness</h1><p>Roll for Strength</p></div></div>
        <div className="nat20-home-actions">
          <button type="button" onClick={() => setQuickLogOpen(true)} aria-label="Open Quick Log"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 3h11a2 2 0 012 2v14H7a2 2 0 01-2-2V3zM8 7h7M8 11h5M17 3v16M15.5 15.5l4-4 1.5 1.5-4 4-2.5.8.8-2.3z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round"/></svg><span>Quick Log</span></button>
          <div className="nat20-header-level"><strong>Level {Number(profile.level || 1)} {className(profile.class_slug)}</strong><i><b style={{ width: `${xpProgress(profile)}%` }} /></i><span>{Number(profile.xp || 0)} XP</span></div>
        </div>
      </header>

      <Nat20Navigation open={navOpen} onClose={() => setNavOpen(false)} navigate={navigate} adventureName={adventureName} onAskGrimshaw={summonGrimshaw} />
      <Nat20QuickLog open={quickLogOpen} onClose={() => setQuickLogOpen(false)} navigate={navigate} />
      <JohnnyAssistantDrawer variant="grimshaw" origin={oracleOrigin} />

      {(dashboardError || hubError) ? <p className="nat20-home-alert" role="alert">{dashboardError || hubError}</p> : null}
      {loading && !snapshot ? <p className="nat20-home-loading">Consulting today’s ledger…</p> : null}

      <div className="nat20-home-grid">
        <aside className="nat20-adventurer-card">
          <div className="nat20-sheet-heading"><span>Character Sheet</span><button type="button" onClick={summonGrimshaw}>✦ Ask Grimshaw</button></div>
          <div className="nat20-adventurer-portrait">{portrait?.src ? <img src={portrait.src} alt={portrait.label || 'Your adventurer'} /> : <span className="nat20-oracle-eye" aria-hidden="true"><i /></span>}<b>LV. {Number(profile.level || 1)}</b></div>
          <div className="nat20-hp-row"><div><span>Hit Points</span><b>{Math.max(10, Math.round(readiness || 68))} / 100</b><i><em style={{ width: `${Math.max(10, readiness || 68)}%` }} /></i></div><strong>{Math.max(10, Math.round(10 + readiness / 18))}<small>AC</small></strong></div>
          <p className="nat20-vitals-caption">HP refills with rest and real food. AC is built from consistency, not avoidance.</p>
          <CharacterStat label="STR" value={Math.round(8 + percent(protein, proteinTarget) / 10)} progress={percent(protein, proteinTarget)} tone="str" />
          <CharacterStat label="END" value={Math.round(8 + percent(steps, stepTarget) / 10)} progress={percent(steps, stepTarget)} tone="end" />
          <CharacterStat label="VIT" value={Math.round(8 + percent(sleep, sleepTarget) / 10)} progress={percent(sleep, sleepTarget)} tone="vit" />
          <div className="nat20-streak-line">♨ <b>{bestStreak(snapshot?.streaks)}</b>-day training streak</div>
          <blockquote>“{className(profile.class_slug)}, tempered by the work already done. The forge remembers those who show up.”</blockquote>
        </aside>

        <section className="nat20-quest-board">
          <header><div><span className="nat20-home-kicker">Today’s Quest Board</span><h2>{adventureName}</h2><p>{isRestDay ? 'A restorative chapter beside the fire' : `A ${humanize(scheduledType)}-day trial from the guild ledger`}</p></div><span className="nat20-location-badge">♜ {locationName}</span></header>
          <div className="nat20-quest-list">
            {quests.map((quest, index) => (
              <button key={quest.name} type="button" className={`${quest.done ? 'is-complete' : ''} ${index === 2 ? 'is-adventure' : ''}`} onClick={() => navigate(quest.to)}>
                <span className="nat20-quest-check" aria-hidden="true">{quest.done ? '✓' : index === 2 ? '⚔' : '◇'}</span>
                <span><strong>{quest.name}</strong><small>{quest.detail}</small></span>
                <span className="nat20-quest-reward">{quest.meta}<b>+{quest.xp} XP</b></span>
              </button>
            ))}
          </div>
          <div className="nat20-torch-progress"><span><i style={{ width: `${completed / quests.length * 100}%` }} /></span><b>{completed} / {quests.length} completed</b></div>

        <section className="nat20-vitals">
          <header><div><span className="nat20-home-kicker">Seven-day field record</span><h2>Vital Chronicle</h2></div><div className="nat20-readiness"><strong>{readiness || '—'}</strong><span>{readiness ? 'Readiness' : 'Gathering data'}</span></div></header>
          <div className="nat20-trend-grid">
            <MetricCard label="Weight" value={weight ? `${formatNumber(weight, 1)} lb` : 'Not logged'} values={history.weight.map(row => Number(row.weight_lb))} color="#c85832" />
            <MetricCard label="Sleep" value={sleep ? `${formatNumber(sleep, 1)} hr` : 'Not logged'} note={sleep ? `${Math.round(sleep / sleepTarget * 100)}% of target` : ''} values={history.sleep.map(row => Number(row.hours_sleep))} color="#8267a0" />
            <MetricCard label="Steps" value={steps.toLocaleString()} note={`${Math.min(100, Math.round(steps / stepTarget * 100))}% of quest`} values={history.steps.map(row => Number(row.steps))} color="#718c4f" />
          </div>
          <div className="nat20-provisions">
            <div className="nat20-calorie-rune" style={{ '--fuel': `${percent(calories, calorieTarget)}%` }}><div><span>Daily fuel</span><strong>{Math.round(calories).toLocaleString()}</strong><small>of {Math.round(calorieTarget).toLocaleString() || '—'} kcal</small></div></div>
            <div className="nat20-macros"><Macro label="Protein" value={protein} target={proteinTarget} /><Macro label="Carbs" value={carbs} target={carbsTarget} /><Macro label="Fat" value={fat} target={fatTarget} /></div>
          </div>
        </section>
        </section>

        <section className="nat20-world-map">
          <header><div><span className="nat20-home-kicker">The Known Realms · Explorer’s Draft</span><h2>Choose a road to explore</h2></div><small>Select a sigil to learn more</small></header>
          <div className="nat20-map-scroll" tabIndex="0" aria-label="Scrollable map of Nat20 destinations">
            <div className="nat20-map-canvas">
              <svg viewBox="0 0 820 320" aria-hidden="true"><rect width="820" height="320" fill="#87958d"/><path d="M-20 38C70 10 98 68 159 50c66-20 88-42 140-19 47 20 37 54 92 61 54 7 87-40 143-20 48 17 44 52 95 55 60 4 98-30 153-1 42 22 65 58 98 75v130H-20z" fill="#c9b478" stroke="#63472b" strokeWidth="4"/><path d="M40 175c80-38 130-20 196 8s125-46 197-18 130 58 232 8" fill="none" stroke="#758d91" strokeWidth="15" opacity=".7"/><path d="M174 74l42 74-80 7zM528 78l61 94-113 4z" fill="#7d7659" opacity=".8"/><path d="M278 233c60-36 129-32 183 4" fill="none" stroke="#6b4c2c" strokeWidth="3" strokeDasharray="8 8"/></svg>
              {DESTINATIONS.map(item => <button key={item.id} type="button" className={item.id === selectedDestination ? 'is-selected' : ''} style={{ left: `${item.x}%`, top: `${item.y}%` }} onClick={() => setSelectedDestination(item.id)} aria-pressed={item.id === selectedDestination} aria-label={`Learn about ${item.name}`}>✦</button>)}
            </div>
          </div>
          <div className="nat20-map-detail"><div><span>{destination.region}</span><h3>{destination.name}</h3><p>{destination.copy}</p></div><strong>{destination.distance}<small> from your camp</small></strong></div>
        </section>
      </div>
      <button type="button" className={`nat20-floating-nav ${navOpen || oracleOpen ? 'is-active' : ''}`} aria-label={oracleOpen ? 'Close Grimshaw and return to your quest' : navOpen ? 'Close navigation' : 'Open navigation'} aria-pressed={navOpen || oracleOpen} onClick={() => { if (oracleOpen) closeDrawer(); else setNavOpen(open => !open) }}>
        <D20Icon />
      </button>
    </main>
  )
}

function D20Icon({ showNumber = false }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polygon points="12,2 21,8 21,16 12,22 3,16 3,8" stroke="currentColor" strokeWidth="1.5" fill={showNumber ? '#e9dcbb' : 'none'}/><line x1="12" y1="2" x2="12" y2="22" stroke="currentColor"/><line x1="3" y1="8" x2="21" y2="16" stroke="currentColor"/><line x1="21" y1="8" x2="3" y2="16" stroke="currentColor"/>{showNumber ? <text x="12" y="13.5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="currentColor">20</text> : null}</svg>
}

function Nat20QuickLog({ open, onClose, navigate }) {
  const [selection, setSelection] = useState('weight')
  const entries = [
    { id: 'weight', icon: '⚖', label: 'Weight', note: 'Record a new weigh-in', route: '/body', state: { focusTab: 'weight' } },
    { id: 'sleep', icon: '☾', label: 'Sleep', note: 'Log last night’s rest', route: '/body', state: { focusTab: 'sleep' } },
    { id: 'steps', icon: '⌁', label: 'Steps', note: 'Update today’s travel', route: '/body', state: { focusTab: 'steps' } },
    { id: 'photos', icon: '▣', label: 'Progress Photos', note: 'Add a new portrait', route: '/progress-photos' },
  ]
  const active = entries.find(entry => entry.id === selection) || entries[0]

  return <section className={`nat20-quick-log ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label="Quick Log journal">
    <header><div><span className="nat20-journal-sigil">▤</span><div><small>Adventurer’s record</small><h2>Quick Log Journal</h2></div></div><button type="button" onClick={onClose} aria-label="Close Quick Log">×</button></header>
    <div className="nat20-quick-log-shell">
      <nav aria-label="Choose what to record">{entries.map(entry => <button key={entry.id} type="button" aria-selected={selection === entry.id} onClick={() => setSelection(entry.id)}><i>{entry.icon}</i><span><strong>{entry.label}</strong><small>{entry.note}</small></span><b>›</b></button>)}<button type="button" className="nat20-tavern-link" onClick={() => navigate('/nutrition')}><i>♨</i><span><strong>Visit the Tavern</strong><small>Record meals and provisions</small></span><b>›</b></button></nav>
      <article><small className="nat20-quick-log-kicker">Entry · {active.label}</small><h3>{quickLogHeading(active.id)}</h3><p>{quickLogCopy(active.id)}</p>{active.id === 'photos' ? <div className="nat20-photo-drop">＋<strong>Add a progress portrait</strong><small>Choose or take a photo on the next screen</small></div> : <label><span>{quickLogFieldLabel(active.id)}</span><input type="number" inputMode="decimal" placeholder={quickLogPlaceholder(active.id)} /></label>}<button type="button" onClick={() => navigate(active.route, active.state ? { state: active.state } : undefined)}>Continue to record <span>→</span></button></article>
    </div>
  </section>
}

function quickLogHeading(id) { return ({ weight: 'Mark today’s measure', sleep: 'Record the night’s rest', steps: 'Count the road traveled', photos: 'Preserve this chapter' })[id] }
function quickLogCopy(id) { return ({ weight: 'A single honest number keeps the long journey legible.', sleep: 'Rest restores hit points. Add last night’s total to the ledger.', steps: 'Every mile advances the artifact quest. Add today’s current count.', photos: 'Create a visual chronicle of the adventurer you are becoming.' })[id] }
function quickLogFieldLabel(id) { return ({ weight: 'Weight (lb)', sleep: 'Hours slept', steps: 'Steps today' })[id] }
function quickLogPlaceholder(id) { return ({ weight: '194.0', sleep: '7.5', steps: '6000' })[id] }

function MetricCard({ label, value, note = 'Recent record', values, color }) {
  return <article><header><span>{label}</span><strong>{value}</strong></header><Sparkline values={values} color={color} label={`${label} seven-day trend`} /><small>{note}</small></article>
}

function Sparkline({ values, color, label }) {
  const clean = values.filter(Number.isFinite).slice(-7)
  if (clean.length < 2) return <div className="nat20-chart-empty">Log two entries to reveal the trail</div>
  const min = Math.min(...clean), max = Math.max(...clean), range = max - min || 1
  const points = clean.map((value, index) => `${4 + index * 172 / (clean.length - 1)},${65 - (value - min) / range * 52}`).join(' ')
  return <svg className="nat20-sparkline" viewBox="0 0 180 72" role="img" aria-label={label}><path d="M4 18H176M4 42H176M4 66H176" /><polyline points={points} style={{ stroke: color }} /><circle cx={points.split(' ').at(-1).split(',')[0]} cy={points.split(' ').at(-1).split(',')[1]} r="4" style={{ fill: color }} /></svg>
}

function Macro({ label, value, target }) {
  return <div><span>{label}</span><i><b style={{ width: `${percent(value, target)}%` }} /></i><strong>{Math.round(value)} / {Math.round(target) || '—'}g</strong></div>
}

function CharacterStat({ label, value, progress, tone }) {
  return <div className="nat20-character-stat"><span>{label}</span><i><b className={tone} style={{ width: `${Math.max(8, progress)}%` }} /></i><strong>{value}</strong></div>
}

function Nat20Navigation({ open, onClose, navigate, adventureName, onAskGrimshaw }) {
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const items = [
    { label: 'Today’s Adventure', note: adventureName, to: '/workout', featured: true },
    { label: 'The Tavern', note: 'Plan meals and record provisions', to: '/nutrition' },
    { label: 'Field Journal', note: 'Measurements, reflections, and progress photos', to: '/body' },
    { label: 'Field Guide', note: 'Exercises, movement lore, and form notes', to: '/workout/library' },
    { label: 'Character Chronicle', note: 'Manage your detailed character sheet', to: '/nat20/setup' },
    { label: 'Quest Log', note: 'Review completed quests and rewards', to: '/rewards' },
    { label: 'Ask the Oracle', note: 'Consult Grimshaw for guidance', action: onAskGrimshaw },
    { label: 'The Runekeeper', note: 'Preferences, privacy, and account settings', to: '/settings' },
  ]

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <nav className={`nat20-path-nav ${open ? 'is-open' : ''}`} aria-label="Main navigation" aria-hidden={!open} onScroll={event => { const scrollTop = event.currentTarget.scrollTop; setParallax(current => ({ ...current, y: Math.max(-18, Math.min(18, scrollTop * -.035)) })) }}>
      <button type="button" className="nat20-nav-close" onClick={onClose} aria-label="Close navigation">×</button>
      <div className="nat20-window-wrap" onPointerMove={event => { const box = event.currentTarget.getBoundingClientRect(); setParallax(current => ({ ...current, x: ((event.clientX - box.left) / box.width - .5) * 18, y: ((event.clientY - box.top) / box.height - .5) * 18 })) }} onPointerLeave={() => setParallax({ x: 0, y: 0 })}>
        <div className="nat20-window-frame"><div className="nat20-window-opening" style={{ '--px': `${parallax.x}px`, '--py': `${parallax.y}px` }}>
          <svg viewBox="0 0 300 375" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="nat20Sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#241a33"/><stop offset=".48" stopColor="#4a3468"/><stop offset="1" stopColor="#c1502e"/></linearGradient></defs><rect width="300" height="375" fill="url(#nat20Sky)"/><g className="far"><circle cx="45" cy="50" r="1.6"/><circle cx="92" cy="83" r="1"/><circle cx="152" cy="42" r="1.5"/><circle cx="245" cy="55" r="1.2"/><circle cx="225" cy="82" r="18" fill="#f0dfa0"/></g><path className="mid" d="M0 210c35-18 60-6 89-26 30-21 45-42 74-24 25 16 36 26 66 10 26-14 49-19 71 3v202H0z" fill="#3a2c4a"/><path className="near" d="M0 260c52-15 83 0 121-25 35-23 54-46 86-26 29 18 48 22 93-9v175H0z" fill="#211829"/></svg>
          <span className="nat20-window-sheen"/><i className="v"/><i className="h one"/><i className="h two"/>
        </div></div><span className="nat20-window-sill"/>
      </div>
      <div className="nat20-nav-title"><h2>Choose Your Path</h2><p>Where does the adventure lead next?</p></div>
      <div className="nat20-nav-items">{items.map((item, index) => <button key={item.label} type="button" className={item.featured ? 'featured' : ''} onClick={event => { onClose(); if (item.action) item.action(event); else navigate(item.to) }}><span className="nat20-nav-icon" aria-hidden="true">{['⚔','♨','▤','✥','♙','◇','◉','✦'][index]}</span><span><strong>{item.label}</strong><small>{item.note}</small></span>{item.featured ? <b>Active</b> : null}</button>)}</div>
    </nav>
  )
}

function rowsFrom(payload) { return Array.isArray(payload) ? payload : payload?.entries || payload?.logs || payload?.data || [] }
function percent(value, target) { return target > 0 ? Math.min(100, Math.max(0, value / target * 100)) : 0 }
function humanize(value) { return String(value || '').replace(/^the_/, '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) }
function formatNumber(value, digits = 0) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value) }
function className(slug) { return ({ warrior: 'Vanguard', ranger: 'Wayfinder', mage: 'Arcanist', rogue: 'Nightstep' })[slug] || 'Adventurer' }
function adventureFor(type) { return ({ push: 'The Ember Gate', pull: 'The Chainwood Trial', legs: 'The Stone Road', cardio: 'The Windroad Run', rest: 'The Quiet Hearth', full_rest: 'The Quiet Hearth' })[type] || 'The Open Road' }
function bestStreak(streaks) { return Math.max(0, ...Object.values(streaks || {}).map(value => Number(value) || 0)) }
function xpProgress(profile) { const xp = Number(profile.xp || 0), floor = Math.max(0, (Number(profile.level || 1) - 1) * 100); return Math.min(100, Math.max(4, xp - floor)) }
