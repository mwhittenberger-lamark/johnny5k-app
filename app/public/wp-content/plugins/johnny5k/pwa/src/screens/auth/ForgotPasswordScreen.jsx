import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../../api/modules/auth'
import ClearableInput from '../../components/ui/ClearableInput'
import ErrorState from '../../components/ui/ErrorState'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const data = await authApi.requestPasswordReset(email)
      setMessage(data.message || 'If that email exists in Johnny5k, a reset link has been sent.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <h1 className="logo">Reset<span>Password</span></h1>
      <p className="tagline">Enter your email and we’ll send a reset link.</p>

      <form onSubmit={handleSubmit} className="auth-form">
        <ClearableInput type="email" placeholder="Email" value={email} onChange={event => setEmail(event.target.value)} required />
        {error ? <ErrorState className="auth-inline-error" message={error} title="Could not send reset link" /> : null}
        {message ? <p className="success-message">{message}</p> : null}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="auth-link">Remembered it? <Link to="/login">Back to sign in</Link></p>
    </div>
  )
}
