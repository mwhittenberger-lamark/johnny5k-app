import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/modules/auth'

export default function ResetPasswordScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = searchParams.get('login') || ''
  const key = searchParams.get('key') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const hasToken = useMemo(() => Boolean(login && key), [login, key])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!hasToken) {
      setError('This reset link is missing the required login or key.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const data = await authApi.resetPassword(login, key, password)
      setMessage(data.message || 'Password updated successfully.')
      window.setTimeout(() => navigate('/login', { replace: true }), 1200)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <h1 className="logo">New<span>Password</span></h1>
      <p className="tagline">Choose a new password for your Johnny5k account.</p>

      <form onSubmit={handleSubmit} className="auth-form">
        <input type="password" placeholder="New password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} />
        <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required minLength={8} />
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success-message">{message}</p> : null}
        <button type="submit" className="btn-primary" disabled={loading || !hasToken}>
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>

      {!hasToken ? <p className="error">Open the reset link from your email, then try again.</p> : null}
      <p className="auth-link"><Link to="/login">Back to sign in</Link></p>
    </div>
  )
}
