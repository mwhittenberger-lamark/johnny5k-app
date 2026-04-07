import { useEffect, useState } from 'react'
import { adminApi } from '../../api/client'
import AppIcon, { normalizeAppIconName } from '../../components/ui/AppIcon'
import { getColorSchemeOptions, setAvailableColorSchemes } from '../../lib/theme'

const TABS = ['invites', 'costs', 'persona', 'users', 'exercises', 'awards', 'recipes', 'settings']
const AWARD_ICON_OPTIONS = ['award', 'trophy', 'star', 'flame', 'bolt']
const COLOR_FIELDS = ['bg', 'bg2', 'bg3', 'border', 'text', 'textMuted', 'accent', 'accent2', 'accent3', 'danger', 'success', 'yellow']

function createEmptyColorScheme(index = 0) {
  const fallback = getColorSchemeOptions()[0]

  return {
    id: `scheme-${Date.now()}-${index}`,
    label: `New Scheme ${index + 1}`,
    description: 'Custom color scheme',
    colors: { ...(fallback?.colors ?? {}) },
  }
}

export default function AdminScreen() {
  const [tab, setTab] = useState('invites')

  return (
    <div className="screen">
      <header className="screen-header"><h1>Admin</h1></header>
      <div className="tab-bar admin-tab-bar">
        {TABS.map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'invites' && <InviteTab />}
      {tab === 'costs' && <CostTab />}
      {tab === 'persona' && <PersonaTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'exercises' && <ExercisesTab />}
      {tab === 'awards' && <AwardsTab />}
      {tab === 'recipes' && <RecipesTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}

function InviteTab() {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { adminApi.inviteCodes().then(setCodes).catch(() => {}) }, [])

  async function generate() {
    setLoading(true)
    try {
      const data = await adminApi.generateCode()
      setMsg(`Generated: ${data.code}`)
      adminApi.inviteCodes().then(setCodes)
    } catch (err) { setMsg('Error: ' + err.message) }
    setLoading(false)
  }

  async function deleteCode(id) {
    try {
      await adminApi.deleteCode(id)
      setCodes(c => c.filter(x => x.id !== id))
    } catch (err) { setMsg('Error: ' + err.message) }
  }

  return (
    <div className="admin-tab">
      {msg && <p className="success-msg">{msg}</p>}
      <button className="btn-primary" onClick={generate} disabled={loading}>Generate Code</button>
      <div className="code-list">
        {codes.map(c => (
          <div key={c.id} className="code-row">
            <code>{c.code}</code>
            <span className="code-status">{c.used_by ? `Used by ${c.used_by}` : 'Available'}</span>
            {!c.used_by && <button className="btn-danger small" onClick={() => deleteCode(c.id)}>Delete</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

function CostTab() {
  const [data, setData] = useState(null)
  useEffect(() => { adminApi.costs().then(setData).catch(() => {}) }, [])
  if (!data) return <p>Loading…</p>

  return (
    <div className="admin-tab">
      <p><strong>This Month Total:</strong> ${parseFloat(data.monthly_total?.total_cost_usd ?? 0).toFixed(4)}</p>
      <h3>By User</h3>
      {(data.monthly_by_user ?? []).map((r, i) => (
        <div key={i} className="cost-row">
          <span>{r.user_email ?? r.user_id}</span>
          <span>{r.service}</span>
          <span>${parseFloat(r.total_cost_usd ?? 0).toFixed(4)}</span>
        </div>
      ))}
      <h3>Daily (Last 30)</h3>
      {(data.daily_last_30 ?? []).map((r, i) => (
        <div key={i} className="cost-row">
          <span>{r.log_date}</span>
          <span>{r.service}</span>
          <span>${parseFloat(r.total_cost_usd ?? 0).toFixed(4)}</span>
        </div>
      ))}
    </div>
  )
}

function PersonaTab() {
  const [persona, setPersona] = useState({ name: '', tagline: '', tone: '', rules: '', extra: '' })
  const [systemPrompt, setSystemPrompt] = useState('')
  const [promptSource, setPromptSource] = useState('default')
  const [contractChecks, setContractChecks] = useState([])
  const [contractResults, setContractResults] = useState([])
  const [chatMsg, setChatMsg] = useState('')
  const [chatReply, setChatReply] = useState('')
  const [chatSources, setChatSources] = useState([])
  const [chatWhy, setChatWhy] = useState('')
  const [chatContextUsed, setChatContextUsed] = useState([])
  const [chatConfidence, setChatConfidence] = useState('')
  const [timePreviewMsg, setTimePreviewMsg] = useState('Give me a helpful snack suggestion right now.')
  const [timePreviewResults, setTimePreviewResults] = useState([])
  const [actionPreviewMsg, setActionPreviewMsg] = useState('Look at my nutrition today and take the next best action.')
  const [actionPreviewReply, setActionPreviewReply] = useState('')
  const [actionPreviewActions, setActionPreviewActions] = useState([])
  const [actionPreviewWhy, setActionPreviewWhy] = useState('')
  const [actionPreviewContextUsed, setActionPreviewContextUsed] = useState([])
  const [actionPreviewConfidence, setActionPreviewConfidence] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [runningContractChecks, setRunningContractChecks] = useState(false)
  const [previewingTime, setPreviewingTime] = useState(false)
  const [previewingActions, setPreviewingActions] = useState(false)
  const [qaUsers, setQaUsers] = useState([])
  const [followUpQaUserId, setFollowUpQaUserId] = useState('')
  const [followUpQa, setFollowUpQa] = useState(null)
  const [loadingFollowUpQa, setLoadingFollowUpQa] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminApi.getPersona().then(d => {
      setPersona(d.persona ?? {})
      setSystemPrompt(d.system_prompt ?? '')
      setPromptSource(d.prompt_source ?? 'default')
      setContractChecks(Array.isArray(d.contract_checks) ? d.contract_checks : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    adminApi.users().then(data => {
      setQaUsers(Array.isArray(data) ? data : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadFollowUpQa(followUpQaUserId)
  }, [followUpQaUserId])

  function update(k, v) { setPersona(p => ({ ...p, [k]: v })) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await adminApi.savePersona(persona)
      setSystemPrompt(data.system_prompt)
      setPromptSource('custom')
      setMsg('Saved!')
    } catch (err) { setMsg('Error: ' + err.message) }
    setSaving(false)
  }

  async function loadFollowUpQa(userId = '') {
    setLoadingFollowUpQa(true)
    try {
      const data = await adminApi.personaFollowUps(userId || undefined)
      setFollowUpQa(data)
    } catch (err) {
      setMsg('Error: ' + err.message)
    }
    setLoadingFollowUpQa(false)
  }

  async function testChat(e) {
    e.preventDefault()
    setTesting(true)
    setChatReply('')
    setChatSources([])
    setChatWhy('')
    setChatContextUsed([])
    setChatConfidence('')
    try {
      const data = await adminApi.testPersona(chatMsg)
      setChatReply(data.reply)
      setChatSources(data.sources ?? [])
      setChatWhy(data.why || '')
      setChatContextUsed(Array.isArray(data.context_used) ? data.context_used : [])
      setChatConfidence(data.confidence || '')
    } catch (err) { setChatReply('Error: ' + err.message) }
    setTesting(false)
  }

  async function testTimePreview(e) {
    e.preventDefault()
    setPreviewingTime(true)
    setTimePreviewResults([])
    try {
      const data = await adminApi.previewPersonaTime(timePreviewMsg)
      setTimePreviewResults(data.scenarios ?? [])
    } catch (err) { setMsg('Error: ' + err.message) }
    setPreviewingTime(false)
  }

  async function testActionPreview(e) {
    e.preventDefault()
    setPreviewingActions(true)
    setActionPreviewReply('')
    setActionPreviewActions([])
    setActionPreviewWhy('')
    setActionPreviewContextUsed([])
    setActionPreviewConfidence('')
    try {
      const data = await adminApi.previewPersonaActions(actionPreviewMsg)
      setActionPreviewReply(data.reply || '')
      setActionPreviewActions(Array.isArray(data.actions) ? data.actions : [])
      setActionPreviewWhy(data.why || '')
      setActionPreviewContextUsed(Array.isArray(data.context_used) ? data.context_used : [])
      setActionPreviewConfidence(data.confidence || '')
    } catch (err) { setMsg('Error: ' + err.message) }
    setPreviewingActions(false)
  }

  async function runContractCheck(check) {
    const data = await adminApi.testPersona(check.prompt)
    return {
      id: check.id,
      label: check.label,
      prompt: check.prompt,
      expectation: check.expectation,
      reply: data.reply || '',
      sources: Array.isArray(data.sources) ? data.sources : [],
    }
  }

  async function handleRunAllContractChecks() {
    setRunningContractChecks(true)
    setContractResults([])
    try {
      const results = []
      for (const check of contractChecks) {
        // Keep execution ordered so the output stays easy to compare.
        results.push(await runContractCheck(check))
      }
      setContractResults(results)
    } catch (err) {
      setMsg('Error: ' + err.message)
    }
    setRunningContractChecks(false)
  }

  async function handleRunSingleContractCheck(check) {
    setRunningContractChecks(true)
    try {
      const result = await runContractCheck(check)
      setContractResults(current => [result, ...current.filter(item => item.id !== result.id)])
    } catch (err) {
      setMsg('Error: ' + err.message)
    }
    setRunningContractChecks(false)
  }

  return (
    <div className="admin-tab">
      <form onSubmit={save}>
        {[
          ['Name', 'name', 'text'],
          ['Tagline', 'tagline', 'text'],
          ['Tone', 'tone', 'textarea'],
          ['Extra Rules', 'rules', 'textarea'],
          ['Additional Notes', 'extra', 'textarea'],
        ].map(([label, key, type]) => (
          <div key={key} className="persona-field">
            <label>{label}</label>
            {type === 'textarea'
              ? <textarea value={persona[key] ?? ''} onChange={e => update(key, e.target.value)} rows={3} />
              : <input type="text" value={persona[key] ?? ''} onChange={e => update(key, e.target.value)} />
            }
          </div>
        ))}
        {msg && <p className="success-msg">{msg}</p>}
        <button type="submit" className="btn-primary" disabled={saving}>Save Persona</button>
      </form>

      {systemPrompt && (
        <details className="compiled-prompt">
          <summary>View compiled system prompt</summary>
          <pre>{systemPrompt}</pre>
        </details>
      )}

      <div className="chat-msg assistant">
        <p><strong>Live prompt source:</strong> {promptSource === 'custom' ? 'Custom Personality Editor prompt is active.' : 'Default fallback persona is active.'}</p>
        <p><strong>Test mode:</strong> Admin test chat now runs as a stateless preview against the current compiled prompt, so old thread memory does not blur persona QA.</p>
      </div>

      <h3>Persona Contract QA</h3>
      <p className="settings-subtitle">Run fixed checks for concise coaching, non-corporate tone, data use, and honest next-step guidance.</p>
      <div className="chat-sources">
        {contractChecks.map(check => (
          <div key={check.id} className="chat-msg assistant">
            <p><strong>{check.label}</strong></p>
            <p>{check.expectation}</p>
            <p>{check.prompt}</p>
            <button type="button" className="btn-secondary" disabled={runningContractChecks} onClick={() => handleRunSingleContractCheck(check)}>
              {runningContractChecks ? '…' : 'Run check'}
            </button>
          </div>
        ))}
      </div>
      {contractChecks.length > 0 ? (
        <p>
          <button type="button" className="btn-primary" disabled={runningContractChecks} onClick={handleRunAllContractChecks}>
            {runningContractChecks ? 'Running checks…' : 'Run all contract checks'}
          </button>
        </p>
      ) : null}
      {contractResults.length > 0 ? (
        <div className="chat-sources">
          {contractResults.map(result => (
            <div key={result.id} className="chat-msg assistant">
              <p><strong>{result.label}</strong></p>
              <p><strong>Expectation:</strong> {result.expectation}</p>
              <p><strong>Prompt:</strong> {result.prompt}</p>
              <p>{result.reply}</p>
            </div>
          ))}
        </div>
      ) : null}

      <h3>Test Chat</h3>
      <p className="settings-subtitle">Stateless preview using the current saved persona prompt.</p>
      <form onSubmit={testChat} className="test-chat-form">
        <input type="text" value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Say something…" required />
        <button type="submit" className="btn-secondary" disabled={testing}>{testing ? '…' : 'Send'}</button>
      </form>
      {chatReply && (
        <div className="chat-msg assistant">
          <p>{chatReply}</p>
          {chatWhy ? <p><strong>Why:</strong> {chatWhy}</p> : null}
          {chatConfidence ? <p><strong>Confidence:</strong> {chatConfidence}</p> : null}
          {chatContextUsed.length > 0 ? <p><strong>Context used:</strong> {chatContextUsed.join(' | ')}</p> : null}
          {chatSources.length > 0 && (
            <div className="chat-sources">
              {chatSources.map(source => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.title || source.url}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <h3>Time-Aware Preview</h3>
      <form onSubmit={testTimePreview} className="test-chat-form">
        <input type="text" value={timePreviewMsg} onChange={e => setTimePreviewMsg(e.target.value)} placeholder="Ask for advice that should change by time of day…" required />
        <button type="submit" className="btn-secondary" disabled={previewingTime}>{previewingTime ? '…' : 'Compare 8am vs 10:30pm'}</button>
      </form>
      {timePreviewResults.length > 0 && (
        <div className="chat-sources">
          {timePreviewResults.map(result => (
            <div key={result.key} className="chat-msg assistant">
              <p><strong>{result.label}</strong> · {result.preview_datetime}</p>
              <p>{result.reply}</p>
              {result.why ? <p><strong>Why:</strong> {result.why}</p> : null}
              {result.confidence ? <p><strong>Confidence:</strong> {result.confidence}</p> : null}
              {Array.isArray(result.context_used) && result.context_used.length ? <p><strong>Context used:</strong> {result.context_used.join(' | ')}</p> : null}
            </div>
          ))}
        </div>
      )}

      <h3>Structured Action Preview</h3>
      <form onSubmit={testActionPreview} className="test-chat-form">
        <input type="text" value={actionPreviewMsg} onChange={e => setActionPreviewMsg(e.target.value)} placeholder="Ask for a next-step action…" required />
        <button type="submit" className="btn-secondary" disabled={previewingActions}>{previewingActions ? '…' : 'Preview actions'}</button>
      </form>
      {actionPreviewReply ? (
        <div className="chat-msg assistant">
          <p>{actionPreviewReply}</p>
          {actionPreviewWhy ? <p><strong>Why:</strong> {actionPreviewWhy}</p> : null}
          {actionPreviewConfidence ? <p><strong>Confidence:</strong> {actionPreviewConfidence}</p> : null}
          {actionPreviewContextUsed.length > 0 ? <p><strong>Context used:</strong> {actionPreviewContextUsed.join(' | ')}</p> : null}
          <pre>{JSON.stringify(actionPreviewActions, null, 2)}</pre>
        </div>
      ) : null}

    <h3>Follow-Up History QA</h3>
    <p className="settings-subtitle">Inspect current pending commitments, missed commitments, and recent follow-up outcomes for any user.</p>
    <div className="test-chat-form">
      <select value={followUpQaUserId} onChange={e => setFollowUpQaUserId(e.target.value)}>
        <option value="">Current admin user</option>
        {qaUsers.map(user => (
          <option key={user.user_id} value={String(user.user_id)}>
            {user.first_name ? `${user.first_name} · ${user.user_email}` : user.user_email}
          </option>
        ))}
      </select>
      <button type="button" className="btn-secondary" onClick={() => loadFollowUpQa(followUpQaUserId)} disabled={loadingFollowUpQa}>
        {loadingFollowUpQa ? '…' : 'Refresh'}
      </button>
    </div>
    {followUpQa ? (
      <div className="chat-sources">
        <div className="chat-msg assistant">
          <p><strong>User:</strong> {followUpQa.user?.display_name || followUpQa.user?.email || `User ${followUpQa.user?.id}`}</p>
          <p><strong>Pending:</strong> {followUpQa.overview?.pending_count ?? 0} | <strong>Missed:</strong> {followUpQa.overview?.missed_count ?? 0} | <strong>Overdue:</strong> {followUpQa.overview?.overdue_count ?? 0} | <strong>Completed 14d:</strong> {followUpQa.overview?.completed_last_14_days ?? 0}</p>
          {followUpQa.overview?.recent_summary ? <p><strong>Summary:</strong> {followUpQa.overview.recent_summary}</p> : null}
        </div>
        {(followUpQa.overview?.missed_items ?? []).map(item => (
          <div key={`missed-${item.id}`} className="chat-msg assistant">
            <p><strong>Missed commitment</strong></p>
            <p>{item.prompt}</p>
            {item.reason ? <p><strong>Reason:</strong> {item.reason}</p> : null}
            {item.due_at ? <p><strong>Due:</strong> {item.due_at}</p> : null}
          </div>
        ))}
        {(followUpQa.pending ?? []).slice(0, 6).map(item => (
          <div key={item.id} className="chat-msg assistant">
            <p><strong>{String(item.status || 'pending').toUpperCase()}</strong></p>
            <p>{item.prompt}</p>
            {item.reason ? <p><strong>Reason:</strong> {item.reason}</p> : null}
            {item.due_at ? <p><strong>Due:</strong> {item.due_at}</p> : null}
          </div>
        ))}
        {(followUpQa.overview?.history ?? []).slice(0, 6).map((item, index) => (
          <div key={`${item.id || index}-${item.changed_at || ''}`} className="chat-msg assistant">
            <p><strong>{String(item.state || 'updated').toUpperCase()}</strong> · {item.changed_at || 'Unknown time'}</p>
            <p>{item.prompt}</p>
            {item.reason ? <p><strong>Reason:</strong> {item.reason}</p> : null}
          </div>
        ))}
      </div>
    ) : null}
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState([])
  useEffect(() => { adminApi.users().then(setUsers).catch(() => {}) }, [])
  return (
    <div className="admin-tab">
      {users.map(u => (
        <div key={u.user_id} className="user-row">
          <span>{u.user_email}</span>
          <span className={u.onboarding_complete ? 'badge green' : 'badge grey'}>
            {u.onboarding_complete ? 'Active' : 'Onboarding'}
          </span>
        </div>
      ))}
    </div>
  )
}

function ExercisesTab() {
  const [exercises, setExercises] = useState([])
  const [subs, setSubs] = useState([])
  const [form, setForm] = useState({ name: '', slug: '', movement_pattern: '', primary_muscle: '', equipment: 'dumbbell', difficulty: 'beginner' })

  useEffect(() => {
    adminApi.exercises().then(setExercises).catch(() => {})
    adminApi.substitutions().then(setSubs).catch(() => {})
  }, [])

  async function saveExercise(event) {
    event.preventDefault()
    await adminApi.saveExercise(form)
    setForm({ name: '', slug: '', movement_pattern: '', primary_muscle: '', equipment: 'dumbbell', difficulty: 'beginner' })
    setExercises(await adminApi.exercises())
  }

  async function addSubstitution(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    await adminApi.saveSubstitution({
      exercise_id: Number(formData.get('exercise_id')),
      substitute_exercise_id: Number(formData.get('substitute_exercise_id')),
      reason_code: formData.get('reason_code'),
      priority: Number(formData.get('priority') || 1),
    })
    event.currentTarget.reset()
    setSubs(await adminApi.substitutions())
  }

  return (
    <div className="admin-tab admin-grid-two">
      <div>
        <h3>Exercise library</h3>
        <form className="admin-stack-form" onSubmit={saveExercise}>
          <input placeholder="Exercise name" value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} required />
          <input placeholder="Slug" value={form.slug} onChange={e => setForm(current => ({ ...current, slug: e.target.value }))} />
          <input placeholder="Movement pattern" value={form.movement_pattern} onChange={e => setForm(current => ({ ...current, movement_pattern: e.target.value }))} />
          <input placeholder="Primary muscle" value={form.primary_muscle} onChange={e => setForm(current => ({ ...current, primary_muscle: e.target.value }))} />
          <button className="btn-primary" type="submit">Save exercise</button>
        </form>
        <div className="admin-list">
          {exercises.map(item => (
            <div key={item.id} className="cost-row">
              <span>{item.name}</span>
              <span>{item.primary_muscle}</span>
              <span>{item.equipment}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3>Substitutions</h3>
        <form className="admin-stack-form" onSubmit={addSubstitution}>
          <select name="exercise_id" required>
            <option value="">Base exercise</option>
            {exercises.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select name="substitute_exercise_id" required>
            <option value="">Substitute exercise</option>
            {exercises.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select name="reason_code" defaultValue="variation">
            {['variation', 'equipment', 'joint_friendly', 'skill_level'].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <input name="priority" type="number" min="1" defaultValue="1" />
          <button className="btn-primary" type="submit">Add substitution</button>
        </form>
        <div className="admin-list">
          {subs.map(item => (
            <div key={item.id} className="cost-row">
              <span>{item.exercise_name}</span>
              <span>{item.substitute_name}</span>
              <button className="btn-danger small" onClick={async () => { await adminApi.deleteSubstitution(item.id); setSubs(await adminApi.substitutions()) }}>Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AwardsTab() {
  const [awards, setAwards] = useState([])
  const [form, setForm] = useState({ code: '', name: '', description: '', icon: 'award', points: 10 })

  useEffect(() => { adminApi.awards().then(setAwards).catch(() => {}) }, [])

  async function save(event) {
    event.preventDefault()
    await adminApi.saveAward({ ...form, icon: normalizeAppIconName(form.icon, 'award') })
    setForm({ code: '', name: '', description: '', icon: 'award', points: 10 })
    setAwards(await adminApi.awards())
  }

  return (
    <div className="admin-tab admin-grid-two">
      <form className="admin-stack-form" onSubmit={save}>
        <h3>Create award</h3>
        <input placeholder="Code" value={form.code} onChange={e => setForm(current => ({ ...current, code: e.target.value }))} required />
        <input placeholder="Name" value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} required />
        <textarea placeholder="Description" value={form.description} onChange={e => setForm(current => ({ ...current, description: e.target.value }))} rows={3} />
        <div className="admin-award-icon-picker" role="group" aria-label="Award icon">
          {AWARD_ICON_OPTIONS.map(iconName => (
            <button
              key={iconName}
              type="button"
              className={`admin-award-icon-option ${form.icon === iconName ? 'active' : ''}`}
              onClick={() => setForm(current => ({ ...current, icon: iconName }))}
              aria-pressed={form.icon === iconName}
            >
              <AppIcon name={iconName} />
              <span>{iconName}</span>
            </button>
          ))}
        </div>
        <input type="number" min="0" value={form.points} onChange={e => setForm(current => ({ ...current, points: Number(e.target.value) }))} />
        <button className="btn-primary" type="submit">Save award</button>
      </form>
      <div className="admin-list">
        {awards.map(item => (
          <div key={item.id} className="cost-row admin-award-row">
            <span className="admin-award-summary">
              <span className="admin-award-icon">
                <AppIcon name={normalizeAppIconName(item.icon, 'award')} />
              </span>
              <span>{item.name}</span>
            </span>
            <span>{item.code}</span>
            <span>{item.points} pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecipesTab() {
  const [recipes, setRecipes] = useState([])
  const [form, setForm] = useState({
    recipe_name: '',
    meal_type: 'lunch',
    ingredients: '',
    instructions: '',
    estimated_calories: 0,
    estimated_protein_g: 0,
    estimated_carbs_g: 0,
    estimated_fat_g: 0,
    why_this_works: '',
    source_url: '',
    source_title: '',
    source_type: 'manual',
  })
  const [finder, setFinder] = useState({ query: '', meal_type: 'lunch', count: 5 })
  const [discoveries, setDiscoveries] = useState([])
  const [discovering, setDiscovering] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { adminApi.recipes().then(setRecipes).catch(() => {}) }, [])

  async function save(event) {
    event.preventDefault()
    await adminApi.saveRecipe({
      ...form,
      meal_type: form.meal_type,
      ingredients: form.ingredients.split(',').map(item => item.trim()).filter(Boolean),
      instructions: form.instructions.split('\n').map(item => item.trim()).filter(Boolean),
    })
    setForm({
      recipe_name: '',
      meal_type: form.meal_type,
      ingredients: '',
      instructions: '',
      estimated_calories: 0,
      estimated_protein_g: 0,
      estimated_carbs_g: 0,
      estimated_fat_g: 0,
      why_this_works: '',
      source_url: '',
      source_title: '',
      source_type: 'manual',
    })
    setRecipes(await adminApi.recipes())
    setMsg('Recipe saved.')
  }

  async function discover(event) {
    event.preventDefault()
    setDiscovering(true)
    setMsg('')
    try {
      const result = await adminApi.discoverRecipes(finder)
      setDiscoveries(Array.isArray(result?.recipes) ? result.recipes : [])
      setMsg(result?.used_web_search ? 'AI recipe search complete.' : 'AI recipe suggestions generated.')
    } catch (err) {
      setDiscoveries([])
      setMsg(`Error: ${err.message}`)
    } finally {
      setDiscovering(false)
    }
  }

  async function saveDiscovery(recipe) {
    await adminApi.saveRecipe(recipe)
    setRecipes(await adminApi.recipes())
    setMsg(`Saved ${recipe.recipe_name}.`)
  }

  return (
    <div className="admin-tab admin-grid-two">
      <form className="admin-stack-form" onSubmit={save}>
        <h3>Recipe library</h3>
        {msg ? <p className="success-msg">{msg}</p> : null}
        <input placeholder="Recipe name" value={form.recipe_name} onChange={e => setForm(current => ({ ...current, recipe_name: e.target.value }))} required />
        <select value={form.meal_type} onChange={e => setForm(current => ({ ...current, meal_type: e.target.value }))}>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
        <textarea placeholder="Ingredients, comma separated" value={form.ingredients} onChange={e => setForm(current => ({ ...current, ingredients: e.target.value }))} rows={3} />
        <textarea placeholder="Instructions, one per line" value={form.instructions} onChange={e => setForm(current => ({ ...current, instructions: e.target.value }))} rows={4} />
        <div className="macro-inputs">
          <input type="number" placeholder="Calories" value={form.estimated_calories} onChange={e => setForm(current => ({ ...current, estimated_calories: Number(e.target.value) }))} />
          <input type="number" placeholder="Protein" value={form.estimated_protein_g} onChange={e => setForm(current => ({ ...current, estimated_protein_g: Number(e.target.value) }))} />
          <input type="number" placeholder="Carbs" value={form.estimated_carbs_g} onChange={e => setForm(current => ({ ...current, estimated_carbs_g: Number(e.target.value) }))} />
          <input type="number" placeholder="Fat" value={form.estimated_fat_g} onChange={e => setForm(current => ({ ...current, estimated_fat_g: Number(e.target.value) }))} />
        </div>
        <textarea placeholder="Why this works" value={form.why_this_works} onChange={e => setForm(current => ({ ...current, why_this_works: e.target.value }))} rows={2} />
        <input placeholder="Source title" value={form.source_title} onChange={e => setForm(current => ({ ...current, source_title: e.target.value }))} />
        <input placeholder="Source URL" value={form.source_url} onChange={e => setForm(current => ({ ...current, source_url: e.target.value }))} />
        <button className="btn-primary" type="submit">Save recipe</button>
      </form>
      <div className="admin-list">
        <form className="admin-stack-form" onSubmit={discover}>
          <h3>Find recipes with AI</h3>
          <input
            placeholder="Search theme, like high protein chicken bowls"
            value={finder.query}
            onChange={e => setFinder(current => ({ ...current, query: e.target.value }))}
          />
          <select value={finder.meal_type} onChange={e => setFinder(current => ({ ...current, meal_type: e.target.value }))}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
          <input
            type="number"
            min="1"
            max="10"
            value={finder.count}
            onChange={e => setFinder(current => ({ ...current, count: Number(e.target.value) || 5 }))}
          />
          <button className="btn-primary" type="submit" disabled={discovering}>{discovering ? 'Searching…' : 'Find recipes'}</button>
        </form>
        {discoveries.length ? (
          <div className="admin-list">
            {discoveries.map((item, index) => (
              <div key={`${item.recipe_name}-${index}`} className="admin-card-row">
                <div>
                  <strong>{item.recipe_name}</strong>
                  <p>{item.meal_type} · {Math.round(item.estimated_calories || 0)} Calories · {Math.round(item.estimated_protein_g || 0)}g protein</p>
                  <p>{(item.ingredients ?? []).join(', ')}</p>
                  {item.why_this_works ? <p>{item.why_this_works}</p> : null}
                  {item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">{item.source_title || item.source_url}</a> : null}
                </div>
                <button className="btn-primary small" onClick={() => saveDiscovery(item)}>Save</button>
              </div>
            ))}
          </div>
        ) : null}
        {recipes.map(item => (
          <div key={item.id} className="admin-card-row">
            <div>
              <strong>{item.recipe_name}</strong>
              <p>{item.meal_type} · {(item.ingredients ?? []).join(', ')}</p>
              {item.why_this_works ? <p>{item.why_this_works}</p> : null}
              {item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">{item.source_title || item.source_url}</a> : null}
            </div>
            <button className="btn-danger small" onClick={async () => { await adminApi.deleteRecipe(item.id); setRecipes(await adminApi.recipes()) }}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsTab() {
  const [settings, setSettings] = useState({
    ai_settings: {
      default_model: 'gpt-5.4-mini',
      web_search_enabled: 1,
      tool_calls_enabled: 1,
      progress_photo_compare_debug_enabled: 0,
    },
    feature_flags: {},
    color_schemes: getColorSchemeOptions(),
  })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminApi.settings()
      .then(data => {
        const schemes = setAvailableColorSchemes(data?.color_schemes)
        setSettings({ ...data, color_schemes: schemes })
      })
      .catch(() => {})
  }, [])

  function updateAi(field, value) {
    setSettings(current => ({ ...current, ai_settings: { ...current.ai_settings, [field]: value } }))
  }

  function updateFlag(field, checked) {
    setSettings(current => ({ ...current, feature_flags: { ...current.feature_flags, [field]: checked ? 1 : 0 } }))
  }

  function updateScheme(index, field, value) {
    setSettings(current => ({
      ...current,
      color_schemes: current.color_schemes.map((scheme, schemeIndex) => (
        schemeIndex === index ? { ...scheme, [field]: value } : scheme
      )),
    }))
  }

  function updateSchemeColor(index, colorKey, value) {
    setSettings(current => ({
      ...current,
      color_schemes: current.color_schemes.map((scheme, schemeIndex) => (
        schemeIndex === index ? { ...scheme, colors: { ...scheme.colors, [colorKey]: value } } : scheme
      )),
    }))
  }

  function addScheme() {
    setSettings(current => ({
      ...current,
      color_schemes: [...(current.color_schemes ?? []), createEmptyColorScheme((current.color_schemes ?? []).length)],
    }))
  }

  function removeScheme(index) {
    setSettings(current => ({
      ...current,
      color_schemes: (current.color_schemes ?? []).filter((_, schemeIndex) => schemeIndex !== index),
    }))
  }

  async function save(event) {
    event.preventDefault()
    await adminApi.saveSettings(settings)
    setAvailableColorSchemes(settings.color_schemes)
    setMsg('Settings saved.')
  }

  return (
    <form className="admin-tab admin-stack-form" onSubmit={save}>
      <h3>AI settings</h3>
      <input value={settings.ai_settings?.default_model ?? ''} onChange={e => updateAi('default_model', e.target.value)} placeholder="Default model" />
      <label className="toggle-row"><input type="checkbox" checked={!!settings.ai_settings?.web_search_enabled} onChange={e => updateAi('web_search_enabled', e.target.checked ? 1 : 0)} /> Web search enabled</label>
      <label className="toggle-row"><input type="checkbox" checked={!!settings.ai_settings?.tool_calls_enabled} onChange={e => updateAi('tool_calls_enabled', e.target.checked ? 1 : 0)} /> Tool calls enabled</label>
      <label className="toggle-row"><input type="checkbox" checked={!!settings.ai_settings?.progress_photo_compare_debug_enabled} onChange={e => updateAi('progress_photo_compare_debug_enabled', e.target.checked ? 1 : 0)} /> Progress photo compare debug logging</label>
      <p className="settings-subtitle">Writes raw and parsed compare responses to the PHP error log for admin debugging.</p>
      <h3>Feature flags</h3>
      {Object.keys(settings.feature_flags ?? {}).map(key => (
        <label key={key} className="toggle-row"><input type="checkbox" checked={!!settings.feature_flags[key]} onChange={e => updateFlag(key, e.target.checked)} /> {key}</label>
      ))}
      <div className="admin-settings-section">
        <div className="admin-settings-section-head">
          <h3>Color schemes</h3>
          <button className="btn-secondary small" type="button" onClick={addScheme}>Add color scheme</button>
        </div>
        <p className="settings-subtitle">These schemes drive the profile selector in the app. The first scheme becomes the fallback default.</p>
        <div className="admin-color-scheme-list">
          {(settings.color_schemes ?? []).map((scheme, index) => (
            <div key={`${scheme.id}-${index}`} className="admin-color-scheme-card">
              <div className="admin-color-scheme-head">
                <strong>Scheme {index + 1}</strong>
                <button className="btn-danger small" type="button" onClick={() => removeScheme(index)} disabled={(settings.color_schemes ?? []).length <= 1}>Remove</button>
              </div>
              <div className="admin-color-scheme-meta">
                <label>
                  <span>ID</span>
                  <input value={scheme.id ?? ''} onChange={e => updateScheme(index, 'id', e.target.value)} />
                </label>
                <label>
                  <span>Label</span>
                  <input value={scheme.label ?? ''} onChange={e => updateScheme(index, 'label', e.target.value)} />
                </label>
                <label className="admin-color-scheme-description">
                  <span>Description</span>
                  <input value={scheme.description ?? ''} onChange={e => updateScheme(index, 'description', e.target.value)} />
                </label>
              </div>
              <div className="admin-color-grid">
                {COLOR_FIELDS.map(colorKey => (
                  <label key={colorKey} className="admin-color-field">
                    <span>{colorKey}</span>
                    <div className="admin-color-input-row">
                      <input type="color" value={scheme.colors?.[colorKey] ?? '#000000'} onChange={e => updateSchemeColor(index, colorKey, e.target.value)} />
                      <input value={scheme.colors?.[colorKey] ?? ''} onChange={e => updateSchemeColor(index, colorKey, e.target.value)} />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {msg ? <p className="success-msg">{msg}</p> : null}
      <button className="btn-primary" type="submit">Save settings</button>
    </form>
  )
}
