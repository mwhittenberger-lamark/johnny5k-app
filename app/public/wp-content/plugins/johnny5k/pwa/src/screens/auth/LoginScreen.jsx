import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import welcomeImage from '../../assets/welcome.PNG'

export default function LoginScreen() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { setAuth, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await authApi.login(email, password)
      const nonce = await authApi.refreshNonce()
      setAuth({ ...data, nonce })
      navigate(data.onboarding_complete ? '/dashboard' : '/onboarding/welcome')
    } catch (err) {
      clearAuth()
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <h1 className="logo">Johnny <span>5000</span></h1>
      <img className="auth-welcome-image" src={welcomeImage} alt="Johnny 5000 welcome" />
      <p className="tagline">Your AI fitness coach. Let's go.</p>

      <form onSubmit={handleSubmit} className="auth-form">
        <input type="email"    placeholder="Email"    value={email}    onChange={e => setEmail(e.target.value)}    required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p className="auth-link"><Link to="/forgot-password">Forgot password?</Link></p>
      <p className="auth-link">New here? <Link to="/register">Create account</Link></p>
    </div>
  )
}
