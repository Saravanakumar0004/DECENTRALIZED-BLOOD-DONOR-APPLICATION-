import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login as loginAPI } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Zap } from 'lucide-react'

// Seed credentials from backend seed.js - shown as quick-fill buttons
const SEED_ACCOUNTS = [
  { role: 'ADMIN',    label: 'Admin',        email: 'admin@bloodlink.io',    password: 'Admin@1234',    icon: '🛡️' },
  { role: 'HOSPITAL', label: 'Apollo',       email: 'apollo@bloodlink.io',   password: 'Hospital@1234', icon: '🏥' },
  { role: 'HOSPITAL', label: 'MIOT',         email: 'miot@bloodlink.io',     password: 'Hospital@1234', icon: '🏥' },
  { role: 'DONOR',    label: 'Arun (O+)',    email: 'arun@bloodlink.io',     password: 'Donor@1234',    icon: '🩸' },
  { role: 'DONOR',    label: 'Priya (A+)',   email: 'priya@bloodlink.io',    password: 'Donor@1234',    icon: '🩸' },
  { role: 'DONOR',    label: 'Karthik (B-)', email: 'karthik@bloodlink.io',  password: 'Donor@1234',    icon: '🩸' },
]

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' })
  const [show, setShow]       = useState(false)
  const [loading, setLoading] = useState(false)
  const { login }             = useAuthStore()
  const navigate              = useNavigate()

  const fillAccount = (acc) => {
    setForm({ email: acc.email, password: acc.password })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await loginAPI(form)
      login(res.data.user, res.data.token)
      toast.success(`Welcome back, ${res.data.user.name}!`)
      const role = res.data.user.role
      navigate(role === 'HOSPITAL' ? '/hospital' : role === 'ADMIN' ? '/admin' : '/donor', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#e51d1d10_0%,_transparent_70%)]" />
      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-blood-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-display text-lg">B</span>
            </div>
            <span className="font-display text-3xl text-blood-400 tracking-wider">BLOODLINK</span>
          </Link>
          <h1 className="font-display text-4xl text-slate-100">WELCOME BACK</h1>
          <p className="text-slate-500 text-sm mt-2">Sign in to your account</p>
        </div>

        {/* 1st: Login form */}
        <div className="card border-slate-700 mb-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-blood-400 hover:text-blood-300">Register</Link>
          </p>
        </div>

        {/* 2nd: Quick-fill demo accounts */}
        <div className="card border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={13} className="text-amber-400" />
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              Quick Login — Click to Auto-Fill
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SEED_ACCOUNTS.map(acc => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillAccount(acc)}
                className={`text-left p-2 rounded-xl border transition-all text-xs ${
                  form.email === acc.email
                    ? 'border-blood-600 bg-blood-950 text-blood-300'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                <div className="text-base leading-none mb-1">{acc.icon}</div>
                <div className="font-medium truncate">{acc.label}</div>
                <div className={`text-[10px] mt-0.5 ${
                  acc.role === 'ADMIN'    ? 'text-purple-400' :
                  acc.role === 'HOSPITAL' ? 'text-orange-400' : 'text-blood-400'
                }`}>{acc.role}</div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-700 mt-4">
          Backend: localhost:5000 · Seed data loaded with 3 donors, 2 hospitals, 1 admin
        </p>

      </div>
    </div>
  )
}