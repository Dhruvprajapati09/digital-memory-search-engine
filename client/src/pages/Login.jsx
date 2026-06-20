import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { useAuth } from '../hooks/useAuth'
import { validateEmail, validatePassword } from '../utils/validation'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const handleSubmit = async (e) => {
    e.preventDefault()

    const emailError = validateEmail(email)
    const passwordError = validatePassword(password)

    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError })
      return
    }

    setErrors({})
    setLoading(true)
    setFormError('')

    try {
      await login({ email, password, rememberMe })
      navigate(from, { replace: true })
    } catch {
      setFormError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md" as="section" aria-labelledby="login-heading">
        <h1 id="login-heading" className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back
        </h1>
        <p className="text-sm text-text-muted mb-6">
          Sign in to search your digital memories
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
            autoComplete="current-password"
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

          <div className="flex items-center justify-between mb-6 -mt-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Remember me
            </label>
            <Link
              to="/forgot-password"
              className="text-sm text-primary-600 hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Log in
          </Button>
        </form>

        <p className="text-sm text-text-muted mt-6 text-center">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-primary-600 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  )
}

export default Login
