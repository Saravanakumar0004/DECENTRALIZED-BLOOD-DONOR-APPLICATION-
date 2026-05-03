import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute, GuestRoute } from './routes'

// Pages
import Landing        from './pages/Landing'
import Login          from './pages/Login'
import Register       from './pages/Register'
import DonorDashboard from './pages/DonorDashboard'
import HospitalDashboard from './pages/HospitalDashboard'
import AdminDashboard from './pages/AdminDashboard'
import RequestsMap    from './pages/RequestsMap'
import Profile        from './pages/Profile'
import DonationDetail from './pages/DonationDetail'
// import RequestsPage   from './pages/RequestsPage'
import HospitalRequestsPage  from './pages/HospitalRequestsPage'
import HospitalDonationsPage from './pages/HospitalDonationsPage'
import AdminUsersPage        from './pages/AdminUsersPage'
import AdminDonationsPage    from './pages/AdminDonationsPage'
import NotFound       from './pages/NotFound'
import  RequestsPage  from './pages/RequestsPage'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />

      {/* Guest only (redirect if logged in) */}
      <Route element={<GuestRoute />}>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Donor routes */}
      <Route element={<ProtectedRoute roles={['DONOR']} />}>
        <Route path="/donor"    element={<DonorDashboard />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/map"      element={<RequestsMap />} />
      </Route>

      {/* Hospital routes */}
      <Route element={<ProtectedRoute roles={['HOSPITAL']} />}>
        <Route path="/hospital"           element={<HospitalDashboard />} />
        <Route path="/hospital/requests"  element={<HospitalRequestsPage />} />
        <Route path="/hospital/donations" element={<HospitalDonationsPage />} />
      </Route>

      {/* Admin routes */}
      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route path="/admin"           element={<AdminDashboard />} />
        <Route path="/admin/users"     element={<AdminUsersPage />} />
        <Route path="/admin/donations" element={<AdminDonationsPage />} />
      </Route>

      {/* Shared protected */}
      <Route element={<ProtectedRoute roles={['DONOR','HOSPITAL','ADMIN']} />}>
        <Route path="/profile"           element={<Profile />} />
        <Route path="/donations/:id"     element={<DonationDetail />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
