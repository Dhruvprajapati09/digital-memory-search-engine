export function validateEmail(email) {
  if (!email.trim()) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address'
  return ''
}

export function validatePassword(password) {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter'
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter'
  if (!/[0-9]/.test(password)) return 'Password must contain a number'
  return ''
}

export function validateName(name) {
  if (!name.trim()) return 'Full name is required'
  if (name.trim().length < 2) return 'Name must be at least 2 characters'
  return ''
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) return 'Please confirm your password'
  if (password !== confirmPassword) return 'Passwords do not match'
  return ''
}

export function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: 'bg-gray-200', width: '0%' }

  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const levels = [
    { label: 'Too weak', color: 'bg-red-400', width: '25%' },
    { label: 'Weak', color: 'bg-red-500', width: '25%' },
    { label: 'Fair', color: 'bg-orange-500', width: '50%' },
    { label: 'Good', color: 'bg-yellow-500', width: '75%' },
    { label: 'Strong', color: 'bg-green-500', width: '100%' },
  ]

  const index = Math.min(score, 4)
  return { score, ...levels[index] }
}
