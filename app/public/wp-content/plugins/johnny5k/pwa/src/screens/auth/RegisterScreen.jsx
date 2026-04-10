import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../../api/modules/auth'
import { useAuthStore } from '../../store/authStore'

export default function RegisterScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [code, setCode]         = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { setAuth, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const data = await authApi.register(email, password, code)
      const nonce = await authApi.refreshNonce()
      setAuth({ ...data, nonce })
      navigate('/onboarding/welcome')
    } catch (err) {
      clearAuth()
      setError(err.data?.message || err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <h1 className="logo">Johnny<span>5k</span></h1>
      <p className="tagline">Join by invite. Let's build something.</p>

      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="text"
          placeholder="Invite code (e.g. X7K2-PQ9R)"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          maxLength={9}
          required
        />
        <input type="email"    placeholder="Email"            value={email}    onChange={e => setEmail(e.target.value)}    required />
        <input type="password" placeholder="Password"         value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
        <input type="password" placeholder="Confirm password" value={confirm}  onChange={e => setConfirm(e.target.value)}  required />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className="auth-link">Already have an account? <Link to="/login">Sign in</Link></p>
    </div>
  )
}
