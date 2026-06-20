import { useAuth } from '../hooks/useAuth'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import { useState } from 'react'

function Settings() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-sm text-text-muted mb-6">Manage your account and preferences.</p>

      <Card className="max-w-lg">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
          <Avatar name={user?.name || user?.email} size="lg" />
          <div>
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-sm text-text-muted">{user?.email}</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            console.log('Save settings:', { name, email })
          }}
        >
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Button type="submit">Save changes</Button>
        </form>
      </Card>
    </div>
  )
}

export default Settings
