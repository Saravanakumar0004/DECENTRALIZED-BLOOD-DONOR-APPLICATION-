import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { WalletButton, BDCCounter } from '../ui/index'
import { connectWallet } from '../../utils/blockchain'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Droplets, Map, User, Users,
  ClipboardList, Activity, LogOut, Menu, X, ChevronRight
} from 'lucide-react'

// ── Sidebar nav config ────────────────────────────────────────────────────────
const DONOR_NAV = [
  { to: '/donor',       icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/requests',    icon: Droplets,        label: 'Blood Requests' },
  { to: '/map',         icon: Map,             label: 'Donor Map' },
  { to: '/profile',     icon: User,            label: 'Profile' },
]
const HOSPITAL_NAV = [
  { to: '/hospital',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/hospital/requests',  icon: ClipboardList, label: 'My Requests' },
  { to: '/hospital/donations', icon: Droplets,      label: 'Donations' },
  { to: '/profile',     icon: User,            label: 'Profile' },
]
const ADMIN_NAV = [
  { to: '/admin',       icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users,           label: 'Users' },
  { to: '/admin/donations', icon: Activity,    label: 'All Donations' },
]

function getNav(role) {
  if (role === 'HOSPITAL') return HOSPITAL_NAV
  if (role === 'ADMIN')    return ADMIN_NAV
  return DONOR_NAV
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export function Sidebar({ open, onClose }) {
  const { user, logout, walletAddress, setWallet, updateBDC } = useAuthStore()
  const location = useLocation()
  const navigate  = useNavigate()
  const navItems  = getNav(user?.role)

  const handleLogout = () => { logout(); navigate('/login') }

  const handleWallet = async () => {
    try {
      const { address } = await connectWallet()
      setWallet(address)
      toast.success(`Wallet connected: ${address.slice(0,6)}...`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <>
      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar panel */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-40 flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blood-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-display text-sm">B</span>
            </div>
            <span className="font-display text-xl text-blood-400 tracking-wider">BLOODLINK</span>
          </Link>
          <button onClick={onClose} className="lg:hidden btn-ghost p-1">
            <X size={18} />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blood-800 flex items-center justify-center text-blood-300 font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role}</p>
            </div>
          </div>
          {user?.role === 'DONOR' && <BDCCounter balance={user?.bdcBalance || 0} />}
          <div className="mt-2">
            <WalletButton address={walletAddress} onClick={handleWallet} />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || (to !== '/donor' && to !== '/hospital' && to !== '/admin' && location.pathname.startsWith(to))
            return (
              <Link key={to} to={to} onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group
                  ${active
                    ? 'bg-blood-600/20 text-blood-400 border border-blood-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}>
                <Icon size={18} className={active ? 'text-blood-400' : 'text-slate-500 group-hover:text-slate-300'} />
                {label}
                {active && <ChevronRight size={14} className="ml-auto text-blood-500" />}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-slate-800">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-900/20 w-full transition-all">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}

// ── Navbar ────────────────────────────────────────────────────────────────────
export function Navbar({ onMenuClick }) {
  const { user } = useAuthStore()
  const location = useLocation()

  const titleMap = {
    '/donor':              'Dashboard',
    '/hospital':           'Hospital Dashboard',
    '/admin':              'Admin Panel',
    '/requests':           'Blood Requests',
    '/map':                'Donor Map',
    '/profile':            'My Profile',
    '/hospital/requests':  'My Requests',
    '/hospital/donations': 'Incoming Donations',
    '/admin/users':        'User Management',
    '/admin/donations':    'Donations Audit',
  }
  const title = titleMap[location.pathname] || 'BloodLink'

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden btn-ghost p-1.5">
          <Menu size={20} />
        </button>
        <h1 className="font-display text-2xl text-slate-100 tracking-wide">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-slate-300 font-mono">{user?.bloodGroup || user?.role}</span>
        </div>
      </div>
    </header>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────
export function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
