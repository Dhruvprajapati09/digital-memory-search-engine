import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { useAuth } from '../hooks/useAuth'
import {
  validateEmail,
  validatePassword,
  validateName,
  validateConfirmPassword,
  getPasswordStrength,
} from '../utils/validation'

function PasswordStrengthIndicator({ password }) {
  const strength = getPasswordStrength(password)

  if (!password) return null

  return (
    <div className="mb-4 -mt-2" aria-live="polite">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-text-muted">Password strength</span>
        <span className="text-xs font-medium text-gray-700">{strength.label}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${strength.color} transition-all duration-300`}
          style={{ width: strength.width }}
          role="progressbar"
          aria-valuenow={strength.score}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-label={`Password strength: ${strength.label}`}
        />
      </div>
    </div>
  )
}

function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()

    const nameError = validateName(name)
    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)
    const confirmError = validateConfirmPassword(password, confirmPassword)

    if (nameError || emailError || passwordError || confirmError) {
      setErrors({
        name: nameError,
        email: emailError,
        password: passwordError,
        confirmPassword: confirmError,
      })
      return
    }

    setErrors({})
    setLoading(true)
    setFormError('')

    try {
      await register({ name, email, password })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        setFormError('Network error. Please check your connection and try again.')
      } else {
        setFormError(err.message || 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md" as="section" aria-labelledby="register-heading">
        <h1 id="register-heading" className="text-2xl font-bold text-gray-900 mb-2">
          Create your account
        </h1>
        <p className="text-sm text-text-muted mb-6">
          Start building your digital memory library
        </p>

        {formError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200"
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            error={errors.name}
            autoComplete="name"
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            error={errors.email}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            error={errors.password}
            autoComplete="new-password"
            required
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
          />
          <PasswordStrengthIndicator password={password} />
          <Input
            label="Confirm password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            error={errors.confirmPassword}
            autoComplete="new-password"
            required
          />

          <Button type="submit" className="w-full mt-2" loading={loading}>
            {loading ? 'Creating account...' : 'Sign up'}
          </Button>
        </form>

        <p className="text-sm text-text-muted mt-6 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  )
}

export default Register
