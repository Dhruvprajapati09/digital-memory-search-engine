import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import DashboardLayout from '../components/layout/DashboardLayout'
import Spinner from '../components/ui/Spinner'

const Login = lazy(() => import('../pages/Login'))
const Register = lazy(() => import('../pages/Register'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Memories = lazy(() => import('../pages/Memories'))
const Search = lazy(() => import('../pages/Search'))
const Upload = lazy(() => import('../pages/Upload'))
const Settings = lazy(() => import('../pages/Settings'))
const NotFound = lazy(() => import('../pages/NotFound'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Spinner label="Loading page" />
    </div>
  )
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="memories" element={<Memories />} />
          <Route path="search" element={<Search />} />
          <Route path="upload" element={<Upload />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
