import { startTransition, useCallback, useEffect, useState } from 'react'
import { adminApi } from '../../api/modules/admin'
import { mediaApi } from '../../api/modules/media'
import AppIcon from '../../components/ui/AppIcon'
import { normalizeAppIconName } from '../../components/ui/AppIcon.utils'
import { reportClientDiagnostic } from '../../lib/clientDiagnostics'
import { APP_IMAGE_FIELDS } from '../../lib/appImages'
import { getColorSchemeOptions, setAvailableColorSchemes } from '../../lib/theme'

const TABS = ['invites', 'costs', 'persona', 'users', 'exercises', 'awards', 'recipes', 'support', 'diagnostics', 'settings']
const AWARD_ICON_OPTIONS = ['award', 'trophy', 'star', 'flame', 'bolt']
const COLOR_FIELDS = ['bg', 'bg2', 'bg3', 'border', 'text', 'textMuted', 'accent', 'accent2', 'accent3', 'danger', 'success', 'yellow']

function getErrorMessage(error, fallback) {
  const detail = String(error?.message || '').trim()
  return detail ? `${fallback} ${detail}` : fallback
}

function handleAdminDiagnostic({ source, message, error, context = {}, setMsg = null }) {
  const nextMessage = getErrorMessage(error, message)

  if (typeof setMsg === 'function') {
    setMsg(`Error: ${nextMessage}`)
  }

  reportClientDiagnostic({
    source,
    message,
    error,
    context: {
      screen: 'admin',
      ...context,
    },
    toast: null,
  })
}

function createEmptyColorScheme(index = 0) {
  const fallback = getColorSchemeOptions()[0]

  return {
    id: `scheme-${Date.now()}-${index}`,
    label: `New Scheme ${index + 1}`,
    description: 'Custom color scheme',
    colors: { ...(fallback?.colors ?? {}) },
  }
}

function createEmptyAppImages() {
  return APP_IMAGE_FIELDS.reduce((acc, field) => {
    acc[field.key] = ''
    return acc
  }, {})
}

function createEmptyLiveWorkoutFrame(index = 0) {
  return {
    image_url: '',
    label: `Live frame ${index + 1}`,
    note: '',
  }
}

function reorderItems(items, fromIndex, toIndex) {
  if (!Array.isArray(items)) return []
  if (fromIndex < 0 || fromIndex >= items.length) return items
  if (toIndex < 0 || toIndex >= items.length) return items
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export default function AdminScreen() {
  const [tab, setTab] = useState('invites')
  const tabLabel = (id) => id.charAt(0).toUpperCase() + id.slice(1)

  return (
    <div>
      <div className="row admin-tab-bar">
        {TABS.map((id) => (
          <button key={id} type="button" className={tab === id ? 'segment active' : 'segment'} onClick={() => setTab(id)}>
            {tabLabel(id)}
          </button>
        ))}
      </div>
      {tab === 'invites' ? <InviteTab /> : null}
      {tab === 'costs' ? <CostTab /> : null}
      {tab === 'persona' ? <PersonaTab /> : null}
      {tab === 'users' ? <UsersTab /> : null}
      {tab === 'exercises' ? <ExercisesTab /> : null}
      {tab === 'awards' ? <AwardsTab /> : null}
      {tab === 'recipes' ? <RecipesTab /> : null}
      {tab === 'support' ? <SupportTab /> : null}
      {tab === 'diagnostics' ? <DiagnosticsTab /> : null}
      {tab === 'settings' ? <SettingsTab /> : null}
    </div>
  )
}

function InviteTab() {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const loadCodes = useCallback(async () => {
    try {
      const data = await adminApi.inviteCodes()
      setCodes(Array.isArray(data) ? data : [])
    } catch (err) {
      setMsg('Error: ' + err.message)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCodes()
  }, [loadCodes])

  async function generate() {
    setLoading(true)
    setMsg('')
    try {
      await adminApi.generateCode()
      await loadCodes()
    } catch (err) {
      setMsg('Error: ' + err.message)
    }
    setLoading(false)
  }

  async function deleteCode(id) {
    setMsg('')
    try {
      await adminApi.deleteCode(id)
      setCodes((current) => current.filter((item) => item.id !== id))
    } catch (err) {
      setMsg('Error: ' + err.message)
    }
  }

  return (
    <div className="admin-tab">
      {msg ? <p className="success-msg">{msg}</p> : null}
      <button className="btn-primary" type="button" onClick={generate} disabled={loading}>{loading ? 'Generating…' : 'Generate Code'}</button>
      <div className="code-list">
        {codes.map((item) => (
          <div key={item.id} className="code-row">
            <code>{item.code}</code>
            <span className="code-status">{item.used_by ? `Used by ${item.used_by}` : 'Available'}</span>
            {!item.used_by ? <button className="btn-danger small" type="button" onClick={() => deleteCode(item.id)}>Delete</button> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function CostTab() {
  const [data, setData] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminApi.costs()
      .then(setData)
      .catch(error => {
        handleAdminDiagnostic({
          source: 'admin_costs_load',
          message: 'Could not load admin cost analytics.',
          error,
          setMsg,
          context: {
            tab: 'costs',
          },
        })
      })
  }, [])

  if (!data) {
    return (
      <div className="admin-tab">
        {msg ? <p className="error">{msg}</p> : <p>Loading…</p>}
      </div>
    )
  }

  return (
    <div className="admin-tab">
      {msg ? <p className="error">{msg}</p> : null}
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
  const [actionPreviewMsg, setActionPreviewMsg] = useState('Look at my nutrition today and take the next best action.')
  const [actionPreviewReply, setActionPreviewReply] = useState('')
  const [actionPreviewActions, setActionPreviewActions] = useState([])
  const [actionPreviewWhy, setActionPreviewWhy] = useState('')
  const [actionPreviewContextUsed, setActionPreviewContextUsed] = useState([])
  const [actionPreviewConfidence, setActionPreviewConfidence] = useState('')
  const [saving, setSaving] = useState(false)
  const [runningContractChecks, setRunningContractChecks] = useState(false)
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
    }).catch(error => {
      handleAdminDiagnostic({
        source: 'admin_persona_load',
        message: 'Could not load the current persona settings.',
        error,
        setMsg,
        context: {
          tab: 'persona',
        },
      })
    })
  }, [])

  useEffect(() => {
    adminApi.users().then(data => {
      setQaUsers(Array.isArray(data) ? data : [])
    }).catch(error => {
      handleAdminDiagnostic({
        source: 'admin_persona_users_load',
        message: 'Could not load users for persona QA.',
        error,
        setMsg,
        context: {
          tab: 'persona',
          flow: 'qa_users',
        },
      })
    })
  }, [])

  const loadFollowUpQa = useCallback(async (userId = '') => {
    setLoadingFollowUpQa(true)
    try {
      const data = await adminApi.personaFollowUps(userId || undefined)
      setFollowUpQa(data)
    } catch (err) {
      setMsg('Error: ' + err.message)
    }
    setLoadingFollowUpQa(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadFollowUpQa(followUpQaUserId)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [followUpQaUserId, loadFollowUpQa])

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
      <div className="test-chat-form">
        <button type="button" className="btn-secondary" onClick={handleRunAllContractChecks} disabled={runningContractChecks}>
          {runningContractChecks ? 'Running checks…' : 'Run all checks'}
        </button>
      </div>
      <div className="chat-sources">
        {contractChecks.map(check => (
          <div key={check.id} className="chat-msg assistant">
            <p><strong>{check.label}</strong></p>
            <p>{check.expectation}</p>
            <p>{check.prompt}</p>
            <button type="button" className="btn-outline small" onClick={() => handleRunSingleContractCheck(check)} disabled={runningContractChecks}>
              {runningContractChecks ? 'Running…' : 'Run check'}
            </button>
          </div>
        ))}
      </div>
      {contractResults.length > 0 && (
        <div className="chat-sources">
          {contractResults.map(result => (
            <div key={`result-${result.id}`} className="chat-msg assistant">
              <p><strong>{result.label}</strong></p>
              <p><strong>Prompt:</strong> {result.prompt}</p>
              <p><strong>Expectation:</strong> {result.expectation}</p>
              <p><strong>Reply:</strong> {result.reply || '(No reply)'}</p>
              {result.sources.length > 0 ? <p><strong>Sources:</strong> {result.sources.join(' | ')}</p> : null}
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
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminApi.users()
      .then(setUsers)
      .catch(error => {
        handleAdminDiagnostic({
          source: 'admin_users_load',
          message: 'Could not load admin users.',
          error,
          setMsg,
          context: {
            tab: 'users',
          },
        })
      })
  }, [])

  return (
    <div className="admin-tab">
      {msg ? <p className="error">{msg}</p> : null}
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
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ name: '', slug: '', movement_pattern: '', primary_muscle: '', equipment: 'dumbbell', difficulty: 'beginner' })

  useEffect(() => {
    adminApi.exercises().then(setExercises).catch(error => {
      handleAdminDiagnostic({
        source: 'admin_exercises_load',
        message: 'Could not load the exercise library.',
        error,
        setMsg,
        context: {
          tab: 'exercises',
          flow: 'library',
        },
      })
    })
    adminApi.substitutions().then(setSubs).catch(error => {
      handleAdminDiagnostic({
        source: 'admin_substitutions_load',
        message: 'Could not load exercise substitutions.',
        error,
        setMsg,
        context: {
          tab: 'exercises',
          flow: 'substitutions',
        },
      })
    })
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
        {msg ? <p className="error">{msg}</p> : null}
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
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ code: '', name: '', description: '', icon: 'award', points: 10 })

  useEffect(() => {
    adminApi.awards().then(setAwards).catch(error => {
      handleAdminDiagnostic({
        source: 'admin_awards_load',
        message: 'Could not load awards.',
        error,
        setMsg,
        context: {
          tab: 'awards',
        },
      })
    })
  }, [])

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
        {msg ? <p className="error">{msg}</p> : null}
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

  useEffect(() => {
    adminApi.recipes().then(setRecipes).catch(error => {
      handleAdminDiagnostic({
        source: 'admin_recipes_load',
        message: 'Could not load saved recipes.',
        error,
        setMsg,
        context: {
          tab: 'recipes',
        },
      })
    })
  }, [])

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

function SupportTab() {
  const [guides, setGuides] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [msg, setMsg] = useState('')
  const supportGuideEditorUrl = '/wp-admin/admin.php?page=jf-support-guides'

  useEffect(() => {
    adminApi.supportGuides()
      .then(data => {
        const nextGuides = Array.isArray(data?.guides) ? data.guides : []
        setGuides(nextGuides)
        setAnalytics(data?.analytics || null)
      })
      .catch(err => setMsg(`Error: ${err.message}`))
  }, [])

  return (
    <div className="admin-tab admin-grid-two">
      <div className="admin-list admin-support-list-pane">
        <div className="admin-support-toolbar">
          <div>
            <h3>Task guides</h3>
            <p>Guide editing now lives in the WordPress plugin backend.</p>
          </div>
          <a className="btn-primary small" href={supportGuideEditorUrl}>Open WP editor</a>
        </div>
        {msg ? <p className="success-msg">{msg}</p> : null}
        <div className="admin-card-row">
          <div>
            <strong>WordPress is the source of truth</strong>
            <p>Edit guide copy, starter prompts, and deep-link fields from the plugin screen so there is only one editing surface.</p>
          </div>
        </div>
        {guides.map(guide => (
          <div key={guide.id} className="admin-support-list-item">
            <span className="admin-support-list-head">
              <strong>{guide.title || 'Untitled guide'}</strong>
              <span className={guide.enabled ? 'badge green' : 'badge grey'}>{guide.enabled ? 'Live' : 'Off'}</span>
            </span>
            <span className="admin-support-list-meta">{guide.route_path || 'No route set'}</span>
            {guide.summary ? <span className="admin-support-list-copy">{guide.summary}</span> : null}
          </div>
        ))}
        {analytics ? (
          <div className="admin-support-analytics-card">
            <div className="admin-support-toolbar">
              <div>
                <h3>Support analytics</h3>
                <p>Last {analytics.days || 30} days of help usage and unresolved asks.</p>
              </div>
            </div>
            <div className="admin-support-analytics-grid">
              <div className="admin-card-row"><div><strong>Entrypoints</strong><p>{analytics.totals?.entrypoints || 0} help opens from the app.</p></div></div>
              <div className="admin-card-row"><div><strong>Prompt starts</strong><p>{analytics.totals?.prompts_started || 0} starter prompts sent to Johnny.</p></div></div>
              <div className="admin-card-row"><div><strong>Resolved</strong><p>{analytics.totals?.navigations || 0} support chats led to a destination or action.</p></div></div>
              <div className="admin-card-row"><div><strong>Unresolved</strong><p>{analytics.totals?.unresolved || 0} support chats ended without a clear next move.</p></div></div>
            </div>
            {(analytics.top_guides ?? []).length ? (
              <div className="admin-list">
                <h4>Top guides</h4>
                {analytics.top_guides.map(item => (
                  <div key={item.guide_id} className="admin-card-row">
                    <div>
                      <strong>{item.guide_id}</strong>
                      <p>{item.prompts_started || 0} prompts · {item.navigations || 0} resolved · {item.unresolved || 0} unresolved</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="admin-stack-form admin-support-editor">
        <div className="admin-support-toolbar">
          <div>
            <h3>Support guide editing moved</h3>
            <p>Use the native WordPress plugin screen for all copy changes and starter-pack resets.</p>
          </div>
          <a className="btn-primary" href={supportGuideEditorUrl}>Open Support Guides in WP</a>
        </div>
        <div className="admin-card-row">
          <div>
            <strong>What to edit in WordPress</strong>
            <p>Summary is Johnny&apos;s grounded explanation, Starter prompt seeds guided help opens, Steps define the walk-through, Common issues catch friction, and Route fields control where deep links land.</p>
          </div>
        </div>
        <div className="admin-card-row">
          <div>
            <strong>How refreshed starter copy is applied</strong>
            <p>The default starter pack is updated in the plugin, but existing saved guides stay intact until you use Reset to starter pack from the WordPress Support Guides screen.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DiagnosticsTab() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const loadDiagnostics = useCallback(async () => {
    setLoading(true)
    setMsg('')
    try {
      const data = await adminApi.diagnostics()
      setEntries(Array.isArray(data?.entries) ? data.entries : [])
    } catch (error) {
      handleAdminDiagnostic({
        source: 'admin_diagnostics_load',
        message: 'Could not load recent client diagnostics.',
        error,
        setMsg,
        context: {
          tab: 'diagnostics',
        },
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDiagnostics()
  }, [loadDiagnostics])

  return (
    <div className="admin-tab">
      <div className="admin-support-toolbar">
        <div>
          <h3>Client diagnostics</h3>
          <p>Recent frontend failures reported by authenticated users. Use this to inspect bootstrap and silent-flow regressions without opening browser devtools.</p>
        </div>
        <button type="button" className="btn-secondary small" onClick={() => void loadDiagnostics()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {msg ? <p className="error">{msg}</p> : null}
      {loading ? <p>Loading…</p> : null}
      {!loading && !entries.length ? <p className="settings-subtitle">No client diagnostics logged yet.</p> : null}
      {!loading ? (
        <div className="admin-list">
          {entries.map(entry => (
            <div key={entry.id || `${entry.source}-${entry.created_at}`} className="admin-card-row">
              <div>
                <strong>{entry.source || 'unknown_source'}</strong>
                <p>{entry.message || 'No message recorded.'}</p>
                <p>
                  {(entry.created_at || 'Unknown time')}
                  {entry.user_email ? ` · ${entry.user_email}` : ''}
                  {entry.status_code ? ` · HTTP ${entry.status_code}` : ''}
                </p>
                {entry.error_message ? <p><strong>Error:</strong> {entry.error_message}</p> : null}
                {entry.current_path ? <p><strong>Path:</strong> {entry.current_path}</p> : null}
                {entry.context && Object.keys(entry.context).length ? <p><strong>Context:</strong> {JSON.stringify(entry.context)}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
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
    push_settings: {
      enabled: 0,
      vapid_public_key: '',
      vapid_private_key: '',
      subject: 'mailto:support@johnny5k.app',
    },
    color_schemes: getColorSchemeOptions(),
    app_images: createEmptyAppImages(),
    live_workout_frames: [],
  })
  const [msg, setMsg] = useState('')
  const [pushTest, setPushTest] = useState({
    user_id: '',
    title: 'Johnny test push',
    body: 'This is a test notification from Johnny.',
    url: '/dashboard',
  })
  const [pushTestBusy, setPushTestBusy] = useState(false)
  const [draggedFrameIndex, setDraggedFrameIndex] = useState(null)
  const [mediaPickerFrameIndex, setMediaPickerFrameIndex] = useState(null)
  const [mediaPickerAppImageKey, setMediaPickerAppImageKey] = useState('')

  useEffect(() => {
    adminApi.settings()
      .then(data => {
        const schemes = setAvailableColorSchemes(data?.color_schemes)
        setSettings({
          ...data,
          push_settings: {
            enabled: data?.push_settings?.enabled ? 1 : 0,
            vapid_public_key: data?.push_settings?.vapid_public_key ?? '',
            vapid_private_key: data?.push_settings?.vapid_private_key ?? '',
            subject: data?.push_settings?.subject ?? 'mailto:support@johnny5k.app',
          },
          color_schemes: schemes,
          app_images: { ...createEmptyAppImages(), ...(data?.app_images ?? {}) },
        })
      })
      .catch(error => {
        handleAdminDiagnostic({
          source: 'admin_settings_load',
          message: 'Could not load admin settings.',
          error,
          setMsg,
          context: {
            tab: 'settings',
          },
        })
      })
  }, [])

  function updateAi(field, value) {
    setSettings(current => ({ ...current, ai_settings: { ...current.ai_settings, [field]: value } }))
  }

  function updateFlag(field, checked) {
    setSettings(current => ({ ...current, feature_flags: { ...current.feature_flags, [field]: checked ? 1 : 0 } }))
  }

  function updatePush(field, value) {
    setSettings(current => ({ ...current, push_settings: { ...current.push_settings, [field]: value } }))
  }

  function updateAppImage(field, value) {
    setSettings(current => ({
      ...current,
      app_images: { ...current.app_images, [field]: value },
    }))
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

  function updateLiveWorkoutFrame(index, field, value) {
    setSettings(current => ({
      ...current,
      live_workout_frames: (current.live_workout_frames ?? []).map((frame, frameIndex) => (
        frameIndex === index ? { ...frame, [field]: value } : frame
      )),
    }))
  }

  function addLiveWorkoutFrame() {
    setSettings(current => ({
      ...current,
      live_workout_frames: [...(current.live_workout_frames ?? []), createEmptyLiveWorkoutFrame((current.live_workout_frames ?? []).length)],
    }))
  }

  function removeLiveWorkoutFrame(index) {
    setSettings(current => ({
      ...current,
      live_workout_frames: (current.live_workout_frames ?? []).filter((_, frameIndex) => frameIndex !== index),
    }))
  }

  function moveLiveWorkoutFrame(fromIndex, toIndex) {
    setSettings(current => ({
      ...current,
      live_workout_frames: reorderItems(current.live_workout_frames ?? [], fromIndex, toIndex),
    }))
  }

  function handleLiveWorkoutFrameDrop(targetIndex) {
    if (draggedFrameIndex == null || draggedFrameIndex === targetIndex) {
      setDraggedFrameIndex(null)
      return
    }

    moveLiveWorkoutFrame(draggedFrameIndex, targetIndex)
    setDraggedFrameIndex(null)
  }

  function applyMediaToFrame(frameIndex, media) {
    if (frameIndex == null || !media?.source_url) return

    const fallbackLabel = String(media?.title?.rendered || media?.slug || '').trim()
    setSettings(current => ({
      ...current,
      live_workout_frames: (current.live_workout_frames ?? []).map((frame, currentIndex) => {
        if (currentIndex !== frameIndex) return frame
        return {
          ...frame,
          image_url: media.source_url,
          label: String(frame?.label || '').trim() ? frame.label : fallbackLabel || `Live frame ${frameIndex + 1}`,
        }
      }),
    }))
    setMediaPickerFrameIndex(null)
  }

  function applyMediaToAppImage(imageKey, media) {
    if (!imageKey || !media?.source_url) return

    setSettings(current => ({
      ...current,
      app_images: {
        ...current.app_images,
        [imageKey]: media.source_url,
      },
    }))
    setMediaPickerAppImageKey('')
  }

  async function save(event) {
    event.preventDefault()
    await adminApi.saveSettings(settings)
    setAvailableColorSchemes(settings.color_schemes)
    setMsg('Settings saved.')
  }

  async function sendPushTest() {
    setPushTestBusy(true)
    try {
      const data = await adminApi.testPush({
        user_id: Number(pushTest.user_id),
        title: pushTest.title,
        body: pushTest.body,
        url: pushTest.url,
      })
      setMsg(`Push sent. ${data?.result?.result?.success_count ?? 0} device(s) accepted it.`)
    } catch (err) {
      setMsg(`Push test failed: ${err.message}`)
    } finally {
      setPushTestBusy(false)
    }
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
          <h3>Push notifications</h3>
        </div>
        <p className="settings-subtitle">Stores the VAPID values used by the PWA to subscribe this device for browser notifications.</p>
        <label className="toggle-row"><input type="checkbox" checked={!!settings.push_settings?.enabled} onChange={e => updatePush('enabled', e.target.checked ? 1 : 0)} /> Enable web push</label>
        <label>
          <span>VAPID public key</span>
          <input value={settings.push_settings?.vapid_public_key ?? ''} onChange={e => updatePush('vapid_public_key', e.target.value)} placeholder="BEl..." />
        </label>
        <label>
          <span>VAPID private key</span>
          <input value={settings.push_settings?.vapid_private_key ?? ''} onChange={e => updatePush('vapid_private_key', e.target.value)} placeholder="y8f..." />
        </label>
        <label>
          <span>Subject</span>
          <input value={settings.push_settings?.subject ?? ''} onChange={e => updatePush('subject', e.target.value)} placeholder="mailto:support@johnny5k.app" />
        </label>
        <div className="admin-live-frame-card">
          <strong>Send test push</strong>
          <div className="admin-color-scheme-meta admin-live-frame-meta">
            <label>
              <span>User ID</span>
              <input value={pushTest.user_id} onChange={e => setPushTest(current => ({ ...current, user_id: e.target.value }))} placeholder="123" />
            </label>
            <label>
              <span>Title</span>
              <input value={pushTest.title} onChange={e => setPushTest(current => ({ ...current, title: e.target.value }))} />
            </label>
            <label className="admin-color-scheme-description">
              <span>Body</span>
              <input value={pushTest.body} onChange={e => setPushTest(current => ({ ...current, body: e.target.value }))} />
            </label>
            <label>
              <span>Target URL</span>
              <input value={pushTest.url} onChange={e => setPushTest(current => ({ ...current, url: e.target.value }))} />
            </label>
            <div className="admin-live-frame-picker-row">
              <button className="btn-secondary small" type="button" onClick={sendPushTest} disabled={pushTestBusy || !pushTest.user_id}>
                {pushTestBusy ? 'Sending…' : 'Send test push'}
              </button>
            </div>
          </div>
        </div>
      </div>
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
      <div className="admin-settings-section">
        <div className="admin-settings-section-head">
          <h3>Live workout frames</h3>
          <button className="btn-secondary small" type="button" onClick={addLiveWorkoutFrame}>Add frame</button>
        </div>
        <p className="settings-subtitle">Set remote image URLs for the rotating Johnny art in Live Workout Mode. If this list is empty, the app falls back to the bundled defaults.</p>
        <div className="admin-live-frame-list">
          {(settings.live_workout_frames ?? []).map((frame, index) => (
            <div
              key={`${frame.image_url || 'frame'}-${index}`}
              className={`admin-color-scheme-card admin-live-frame-card${draggedFrameIndex === index ? ' is-dragging' : ''}`}
              draggable
              onDragStart={() => setDraggedFrameIndex(index)}
              onDragEnd={() => setDraggedFrameIndex(null)}
              onDragOver={event => event.preventDefault()}
              onDrop={() => handleLiveWorkoutFrameDrop(index)}
            >
              <div className="admin-color-scheme-head">
                <div className="admin-live-frame-headline">
                  <strong>Frame {index + 1}</strong>
                  <span className="admin-live-frame-drag-hint">Drag to reorder</span>
                </div>
                <div className="admin-live-frame-actions">
                  <button className="btn-outline small" type="button" onClick={() => moveLiveWorkoutFrame(index, index - 1)} disabled={index === 0}>Up</button>
                  <button className="btn-outline small" type="button" onClick={() => moveLiveWorkoutFrame(index, index + 1)} disabled={index === (settings.live_workout_frames ?? []).length - 1}>Down</button>
                  <button className="btn-danger small" type="button" onClick={() => removeLiveWorkoutFrame(index)}>Remove</button>
                </div>
              </div>
              <div className="admin-live-frame-layout">
                <div className="admin-live-frame-preview" aria-hidden="true">
                  {frame.image_url ? <img src={frame.image_url} alt="" /> : <span>No preview</span>}
                </div>
                <div className="admin-color-scheme-meta admin-live-frame-meta">
                  <label className="admin-color-scheme-description">
                    <span>Image URL</span>
                    <input value={frame.image_url ?? ''} onChange={e => updateLiveWorkoutFrame(index, 'image_url', e.target.value)} placeholder="https://.../johnny-frame.jpg" />
                  </label>
                  <div className="admin-live-frame-picker-row">
                    <button className="btn-secondary small" type="button" onClick={() => setMediaPickerFrameIndex(index)}>Choose from media library</button>
                  </div>
                  <label>
                    <span>Label</span>
                    <input value={frame.label ?? ''} onChange={e => updateLiveWorkoutFrame(index, 'label', e.target.value)} />
                  </label>
                  <label>
                    <span>Note</span>
                    <input value={frame.note ?? ''} onChange={e => updateLiveWorkoutFrame(index, 'note', e.target.value)} />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="admin-settings-section">
        <div className="admin-settings-section-head">
          <h3>App images</h3>
        </div>
        <p className="settings-subtitle">These slots replace the bundled static artwork across the app, including login, navigation, Ask Johnny, and the Live Workout fallback frames.</p>
        <div className="admin-live-frame-list">
          {APP_IMAGE_FIELDS.map(field => (
            <div key={field.key} className="admin-color-scheme-card admin-live-frame-card">
              <div className="admin-color-scheme-head">
                <div className="admin-live-frame-headline">
                  <strong>{field.label}</strong>
                  <span className="admin-live-frame-drag-hint">{field.description}</span>
                </div>
              </div>
              <div className="admin-live-frame-layout">
                <div className="admin-live-frame-preview" aria-hidden="true">
                  {settings.app_images?.[field.key] ? <img src={settings.app_images[field.key]} alt="" /> : <span>No preview</span>}
                </div>
                <div className="admin-color-scheme-meta admin-live-frame-meta">
                  <label className="admin-color-scheme-description">
                    <span>Image URL</span>
                    <input value={settings.app_images?.[field.key] ?? ''} onChange={e => updateAppImage(field.key, e.target.value)} placeholder="https://.../image.webp" />
                  </label>
                  <div className="admin-live-frame-picker-row">
                    <button className="btn-secondary small" type="button" onClick={() => setMediaPickerAppImageKey(field.key)}>Choose from media library</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <MediaLibraryPicker
        isOpen={mediaPickerFrameIndex != null}
        onClose={() => setMediaPickerFrameIndex(null)}
        onSelect={applyMediaToFrame}
        selectionKey={mediaPickerFrameIndex}
      />
      <MediaLibraryPicker
        isOpen={!!mediaPickerAppImageKey}
        onClose={() => setMediaPickerAppImageKey('')}
        onSelect={applyMediaToAppImage}
        selectionKey={mediaPickerAppImageKey}
      />
      {msg ? <p className="success-msg">{msg}</p> : null}
      <button className="btn-primary" type="submit">Save settings</button>
    </form>
  )
}

function MediaLibraryPicker({ isOpen, onClose, onSelect, selectionKey }) {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    let active = true
    startTransition(() => {
      setLoading(true)
      setError('')
    })

    mediaApi.list({ search, page })
      .then(data => {
        if (active) {
          setItems(Array.isArray(data) ? data : [])
        }
      })
      .catch(err => {
        if (active) {
          setError(err.message || 'Could not load media library.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isOpen, page, search])

  useEffect(() => {
    if (!isOpen) {
      startTransition(() => {
        setSearch('')
        setPage(1)
        setItems([])
        setError('')
      })
    }
  }, [isOpen])

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const uploaded = await mediaApi.upload(file, { title: file.name.replace(/\.[^.]+$/, '') })
      setItems(current => [uploaded, ...current])
      setPage(1)
    } catch (err) {
      setError(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="exercise-drawer-shell" role="dialog" aria-modal="true" aria-labelledby="media-library-picker-title">
      <button type="button" className="exercise-drawer-backdrop" aria-label="Close media library" onClick={onClose} />
      <aside className="exercise-drawer admin-media-picker-drawer">
        <div className="exercise-drawer-head">
          <div>
            <p className="exercise-drawer-eyebrow">Media library</p>
            <h3 id="media-library-picker-title">Choose a live workout image</h3>
          </div>
          <button type="button" className="exercise-drawer-close" onClick={onClose}>Close</button>
        </div>
        <p className="exercise-drawer-subtitle">Select an existing WordPress image or upload a new one without leaving the admin app.</p>
        <div className="admin-media-picker-controls">
          <label className="field-label field-label-wide admin-media-picker-search">
            <span>Search media</span>
            <input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Search by title or filename" />
          </label>
          <label className="btn-secondary small admin-media-picker-upload">
            <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
            {uploading ? 'Uploading…' : 'Upload image'}
          </label>
        </div>
        {error ? <p className="error-msg">{error}</p> : null}
        <div className="admin-media-picker-grid">
          {loading ? <p className="settings-subtitle">Loading media…</p> : null}
          {!loading && !items.length ? <p className="settings-subtitle">No images found for this search.</p> : null}
          {items.map(item => {
            const preview = item?.media_details?.sizes?.medium?.source_url || item?.media_details?.sizes?.thumbnail?.source_url || item?.source_url
            const title = item?.title?.rendered || item?.slug || 'Untitled image'

            return (
              <button key={item.id} type="button" className="admin-media-picker-card" onClick={() => onSelect(selectionKey, item)}>
                <img src={preview} alt="" />
                <strong>{title}</strong>
                <span>{item?.media_details?.width && item?.media_details?.height ? `${item.media_details.width} x ${item.media_details.height}` : 'WordPress image'}</span>
              </button>
            )
          })}
        </div>
        <div className="admin-media-picker-pagination">
          <button type="button" className="btn-outline small" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1 || loading}>Previous</button>
          <span>Page {page}</span>
          <button type="button" className="btn-outline small" onClick={() => setPage(current => current + 1)} disabled={loading || items.length < 24}>Next</button>
        </div>
      </aside>
    </div>
  )
}
