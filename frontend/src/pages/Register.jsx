import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register as registerAPI } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

const BLOOD_GROUPS = ['A+','A-','B+','B-','O+','O-','AB+','AB-']
const ROLES = [
  { value: 'DONOR',    label: '🩸 Donor — I want to donate blood' },
  { value: 'HOSPITAL', label: '🏥 Hospital — We need blood donors' },
]

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'DONOR',
    bloodGroup: 'O+', city: 'Chennai', lat: '13.0827', lng: '80.2707',
    hospitalName: '', licenseNumber: '', age: '', weight: '',
  })
  const [show, setShow]     = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate  = useNavigate()

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        name: form.name, email: form.email, password: form.password,
        role: form.role, city: form.city,
        lat: parseFloat(form.lat), lng: parseFloat(form.lng),
        ...(form.role === 'DONOR'    && { bloodGroup: form.bloodGroup, age: parseInt(form.age), weight: parseFloat(form.weight) }),
        ...(form.role === 'HOSPITAL' && { hospitalName: form.hospitalName, licenseNumber: form.licenseNumber }),
      }
      const res = await registerAPI(payload)
      login(res.data.user, res.data.token)
      toast.success('Account created!')
      const role = res.data.user.role
      navigate(role === 'HOSPITAL' ? '/hospital' : '/donor', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#e51d1d10_0%,_transparent_70%)]" />
      <div className="relative w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blood-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-display text-lg">B</span>
            </div>
            <span className="font-display text-3xl text-blood-400 tracking-wider">BLOODLINK</span>
          </Link>
          <h1 className="font-display text-4xl text-slate-100">CREATE ACCOUNT</h1>
        </div>

        <div className="card border-slate-700">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role */}
            <div>
              <label className="label">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map(({ value, label }) => (
                  <button key={value} type="button"
                    onClick={() => set('role', value)}
                    className={`p-3 rounded-lg border text-sm text-left transition-all
                      ${form.role === value
                        ? 'border-blood-600 bg-blood-900/30 text-blood-300'
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Full Name</label>
                <input className="input" placeholder="Arun Kumar" required
                  value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="you@example.com" required
                  value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Password</label>
                <div className="relative">
                  <input type={show ? 'text' : 'password'} className="input pr-10" placeholder="Min. 8 characters" required
                    value={form.password} onChange={(e) => set('password', e.target.value)} />
                  <button type="button" onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Donor specific */}
            {form.role === 'DONOR' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Blood Group</label>
                  <select className="input" value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
                    {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Age</label>
                  <input type="number" className="input" placeholder="25" min="18" max="65"
                    value={form.age} onChange={(e) => set('age', e.target.value)} />
                </div>
                <div>
                  <label className="label">Weight (kg)</label>
                  <input type="number" className="input" placeholder="60" min="50"
                    value={form.weight} onChange={(e) => set('weight', e.target.value)} />
                </div>
              </div>
            )}

            {/* Hospital specific */}
            {form.role === 'HOSPITAL' && (
              <div className="space-y-3">
                <div>
                  <label className="label">Hospital Name</label>
                  <input className="input" placeholder="Apollo Hospitals Chennai" required={form.role === 'HOSPITAL'}
                    value={form.hospitalName} onChange={(e) => set('hospitalName', e.target.value)} />
                </div>
                <div>
                  <label className="label">License Number</label>
                  <input className="input" placeholder="TN-HOSP-001"
                    value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} />
                </div>
              </div>
            )}

            {/* Location */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">City</label>
                <input className="input" placeholder="Chennai"
                  value={form.city} onChange={(e) => set('city', e.target.value)} />
              </div>
              <div>
                <label className="label">Latitude</label>
                <input type="number" step="any" className="input" placeholder="13.0827"
                  value={form.lat} onChange={(e) => set('lat', e.target.value)} />
              </div>
              <div>
                <label className="label">Longitude</label>
                <input type="number" step="any" className="input" placeholder="80.2707"
                  value={form.lng} onChange={(e) => set('lng', e.target.value)} />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-blood-400 hover:text-blood-300">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
