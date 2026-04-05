import { useState, useEffect, useRef } from 'react'
import { adminApi } from '../../api/client'

export default function AdminScreen() {
  const [tab, setTab] = useState('invites') // invites | costs | persona | users

  return (
    <div className="screen">
      <header className="screen-header"><h1>Admin</h1></header>
      <div className="tab-bar">
        {['invites','costs','persona','users'].map(t => (
          <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'invites' && <InviteTab />}
      {tab === 'costs'   && <CostTab />}
      {tab === 'persona' && <PersonaTab />}
      {tab === 'users'   && <UsersTab />}
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
