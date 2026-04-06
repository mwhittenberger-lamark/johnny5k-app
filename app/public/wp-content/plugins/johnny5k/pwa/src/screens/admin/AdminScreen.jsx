import { useEffect, useState } from 'react'
import { adminApi } from '../../api/client'

const TABS = ['invites', 'costs', 'persona', 'users', 'exercises', 'awards', 'recipes', 'settings']

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
  const [chatMsg, setChatMsg] = useState('')
  const [chatReply, setChatReply] = useState('')
  const [chatSources, setChatSources] = useState([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminApi.getPersona().then(d => {
      setPersona(d.persona ?? {})
      setSystemPrompt(d.system_prompt ?? '')
    }).catch(() => {})
  }, [])

  function update(k, v) { setPersona(p => ({ ...p, [k]: v })) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await adminApi.savePersona(persona)
      setSystemPrompt(data.system_prompt)
      setMsg('Saved!')
    } catch (err) { setMsg('Error: ' + err.message) }
    setSaving(false)
  }

  async function testChat(e) {
    e.preventDefault()
    setTesting(true)
    setChatReply('')
    setChatSources([])
    try {
      const data = await adminApi.testPersona(chatMsg)
      setChatReply(data.reply)
      setChatSources(data.sources ?? [])
    } catch (err) { setChatReply('Error: ' + err.message) }
    setTesting(false)
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

      <h3>Test Chat</h3>
      <form onSubmit={testChat} className="test-chat-form">
        <input type="text" value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Say something…" required />
        <button type="submit" className="btn-secondary" disabled={testing}>{testing ? '…' : 'Send'}</button>
      </form>
      {chatReply && (
        <div className="chat-msg assistant">
          <p>{chatReply}</p>
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
  const [form, setForm] = useState({ code: '', name: '', description: '', icon: '🏅', points: 10 })

  useEffect(() => { adminApi.awards().then(setAwards).catch(() => {}) }, [])

  async function save(event) {
    event.preventDefault()
    await adminApi.saveAward(form)
    setForm({ code: '', name: '', description: '', icon: '🏅', points: 10 })
    setAwards(await adminApi.awards())
  }

  return (
    <div className="admin-tab admin-grid-two">
      <form className="admin-stack-form" onSubmit={save}>
        <h3>Create award</h3>
        <input placeholder="Code" value={form.code} onChange={e => setForm(current => ({ ...current, code: e.target.value }))} required />
        <input placeholder="Name" value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} required />
        <textarea placeholder="Description" value={form.description} onChange={e => setForm(current => ({ ...current, description: e.target.value }))} rows={3} />
        <input placeholder="Icon" value={form.icon} onChange={e => setForm(current => ({ ...current, icon: e.target.value }))} />
        <input type="number" min="0" value={form.points} onChange={e => setForm(current => ({ ...current, points: Number(e.target.value) }))} />
        <button className="btn-primary" type="submit">Save award</button>
      </form>
      <div className="admin-list">
        {awards.map(item => (
          <div key={item.id} className="cost-row">
            <span>{item.icon} {item.name}</span>
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
                  <p>{item.meal_type} · {Math.round(item.estimated_calories || 0)} kcal · {Math.round(item.estimated_protein_g || 0)}g protein</p>
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
  const [settings, setSettings] = useState({ ai_settings: { default_model: 'gpt-5.4-mini', web_search_enabled: 1, tool_calls_enabled: 1 }, feature_flags: {} })
  const [msg, setMsg] = useState('')

  useEffect(() => { adminApi.settings().then(setSettings).catch(() => {}) }, [])

  function updateAi(field, value) {
    setSettings(current => ({ ...current, ai_settings: { ...current.ai_settings, [field]: value } }))
  }

  function updateFlag(field, checked) {
    setSettings(current => ({ ...current, feature_flags: { ...current.feature_flags, [field]: checked ? 1 : 0 } }))
  }

  async function save(event) {
    event.preventDefault()
    await adminApi.saveSettings(settings)
    setMsg('Settings saved.')
  }

  return (
    <form className="admin-tab admin-stack-form" onSubmit={save}>
      <h3>AI settings</h3>
      <input value={settings.ai_settings?.default_model ?? ''} onChange={e => updateAi('default_model', e.target.value)} placeholder="Default model" />
      <label className="toggle-row"><input type="checkbox" checked={!!settings.ai_settings?.web_search_enabled} onChange={e => updateAi('web_search_enabled', e.target.checked ? 1 : 0)} /> Web search enabled</label>
      <label className="toggle-row"><input type="checkbox" checked={!!settings.ai_settings?.tool_calls_enabled} onChange={e => updateAi('tool_calls_enabled', e.target.checked ? 1 : 0)} /> Tool calls enabled</label>
      <h3>Feature flags</h3>
      {Object.keys(settings.feature_flags ?? {}).map(key => (
        <label key={key} className="toggle-row"><input type="checkbox" checked={!!settings.feature_flags[key]} onChange={e => updateFlag(key, e.target.checked)} /> {key}</label>
      ))}
      {msg ? <p className="success-msg">{msg}</p> : null}
      <button className="btn-primary" type="submit">Save settings</button>
    </form>
  )
}
