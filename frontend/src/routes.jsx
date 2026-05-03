import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/layout/index'

export function ProtectedRoute({ roles }) {
  const { user, token } = useAuthStore()
  if (!token || !user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) {
    const redirect = user.role === 'HOSPITAL' ? '/hospital'
                   : user.role === 'ADMIN'    ? '/admin'
                   : '/donor'
    return <Navigate to={redirect} replace />
  }
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

export function GuestRoute() {
  const { token, user } = useAuthStore()
  if (token && user) {
    const redirect = user.role === 'HOSPITAL' ? '/hospital'
                   : user.role === 'ADMIN'    ? '/admin'
                   : '/donor'
    return <Navigate to={redirect} replace />
  }
  return <Outlet />
}
