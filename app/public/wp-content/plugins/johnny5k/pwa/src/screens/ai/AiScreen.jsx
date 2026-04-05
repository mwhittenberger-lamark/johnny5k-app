import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { aiApi } from '../../api/client'

const THREAD_KEY = 'main'

export default function AiScreen() {
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [initialising, setInit] = useState(true)
  const bottomRef               = useRef(null)
  const usedStarterRef          = useRef(null)
  const location                = useLocation()

  useEffect(() => {
    aiApi.getThread(THREAD_KEY).then(data => {
      setMessages(data.messages ?? [])
    }).catch(() => {}).finally(() => setInit(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const starterPrompt = location.state?.starterPrompt
    if (!starterPrompt || initialising || loading || usedStarterRef.current === starterPrompt) return

    usedStarterRef.current = starterPrompt
    sendPrompt(starterPrompt)
  }, [location.state?.starterPrompt, initialising, loading])

  async function sendPrompt(message) {
    const msg = message.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', message_text: msg }])
    setLoading(true)
    try {
      const data = await aiApi.chat(msg, THREAD_KEY)
      setMessages(prev => [...prev, {
        role: 'assistant',
        message_text: data.reply,
        sources: data.sources ?? [],
      }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', message_text: '⚠️ ' + err.message }])
    } finally {
      setLoading(false)
    }
  }

  async function send(e) {
    e?.preventDefault()
    await sendPrompt(input)
  }

  return (
    <div className="screen ai-screen">
      <header className="screen-header">
        <h1>Johnny 5000 🤖</h1>
        <button className="btn-icon" title="Clear chat" onClick={async () => {
          await aiApi.clearThread(THREAD_KEY)
          setMessages([])
        }}>🗑</button>
      </header>

      <div className="chat-log">
        {initialising && <p className="chat-loading">Loading…</p>}
        {!initialising && messages.length === 0 && (
          <div className="chat-welcome">
            <p>Hey! I'm Johnny 5000 — your AI fitness coach. Ask me anything about your training, nutrition, or just say hi.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <p>{m.message_text}</p>
            {m.role === 'assistant' && Array.isArray(m.sources) && m.sources.length > 0 && (
              <div className="chat-sources">
                {m.sources.map(source => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.title || source.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <p className="typing-indicator">…</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-bar" onSubmit={send}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Message Johnny…"
          disabled={loading}
        />
        <button type="submit" className="btn-send" disabled={loading || !input.trim()}>
          ➤
        </button>
      </form>
    </div>
  )
}
