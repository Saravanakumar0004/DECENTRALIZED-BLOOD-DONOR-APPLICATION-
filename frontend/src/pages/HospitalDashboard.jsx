import { useState, useEffect, useRef } from 'react'
import { getHospitalStats, getHospitalDonations } from '../api/admin'
import { createRequest } from '../api/requests'
import { receiverConfirm, uploadReceipt } from '../api/donations'
import { BloodBadge, UrgencyChip, StatusBadge, TxHashBadge, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/ui/index'
import { formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Package } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import HospitalInventoryPage from './HospitalInventoryPage'

const BLOOD_GROUPS = ['A+','A-','B+','B-','O+','O-','AB+','AB-']
const URGENCY      = ['Critical','High','Medium']

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = 'text-slate-100' }) {
  return (
    <div className="card text-center">
      <p className={`font-display text-4xl ${color} mb-1`}>{value ?? '—'}</p>
      <p className="text-slate-500 text-xs uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ── CreateRequestModal ─────────────────────────────────────────────────────────
function CreateRequestModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    bloodGroup: 'O+', unitsRequired: 1, urgencyLevel: 'High',
    city: 'Chennai', lat: '13.0625', lng: '80.2707', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await createRequest({ ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng), unitsRequired: parseInt(form.unitsRequired) })
      toast.success('Blood request posted!')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post request')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card w-full max-w-lg mx-4 border-slate-700 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display text-2xl text-slate-100">POST BLOOD REQUEST</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Blood Group</label>
              <select className="input" value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}>
                {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Units Required</label>
              <input type="number" className="input" min="1" max="20" value={form.unitsRequired}
                onChange={e => set('unitsRequired', e.target.value)} />
            </div>
            <div>
              <label className="label">Urgency</label>
              <select className="input" value={form.urgencyLevel} onChange={e => set('urgencyLevel', e.target.value)}>
                {URGENCY.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={e => set('city', e.target.value)} required />
            </div>
            <div>
              <label className="label">Latitude</label>
              <input type="number" step="any" className="input" value={form.lat} onChange={e => set('lat', e.target.value)} />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input type="number" step="any" className="input" value={form.lng} onChange={e => set('lng', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} placeholder="Additional details..."
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Posting...' : 'Post Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── IncomingDonationsTable ────────────────────────────────────────────────────
function IncomingDonationsTable({ onRefresh }) {
  const [donations, setDonations] = useState([])
  const [loading, setLoading]     = useState(true)
  const [bagIds, setBagIds]       = useState({})
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getHospitalDonations()
      setDonations(res.data.data)
    } catch { toast.error('Failed to load donations') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleConfirmReceipt = async (id) => {
    const bloodBagId = bagIds[id]?.trim()
    if (!bloodBagId) return toast.error('Enter Blood Bag ID first')
    try {
      await receiverConfirm(id, bloodBagId)
      toast.success('Receipt confirmed!')
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  if (loading) return <LoadingSpinner className="py-12" />
  if (!donations.length) return <EmptyState icon="📋" title="No incoming donations" description="Donations will appear here when donors accept your requests." />

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
          <tr>
            {['Donor','Blood','Status','Blood Bag ID','Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {donations.map((d) => (
            <tr key={d._id} className="hover:bg-slate-900/50 transition-colors">
              <td className="px-4 py-3">
                <p className="text-slate-200 font-medium">{d.donor?.name}</p>
                <p className="text-xs text-slate-500 font-mono">{d.donor?.walletAddress?.slice(0,10)}...</p>
              </td>
              <td className="px-4 py-3"><BloodBadge group={d.request?.bloodGroup} /></td>
              <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
              <td className="px-4 py-3">
                {d.receiverConfirmed ? (
                  <span className="text-xs font-mono text-slate-400">{d.bloodBagId}</span>
                ) : (
                  <input className="input text-xs py-1.5 w-40" placeholder="BAG-TN-001"
                    value={bagIds[d._id] || ''}
                    onChange={e => setBagIds(p => ({ ...p, [d._id]: e.target.value }))} />
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2 flex-wrap">
                  {!d.receiverConfirmed && (
                    <button onClick={() => handleConfirmReceipt(d._id)}
                      className="btn-primary text-xs py-1 px-2">
                      Confirm Receipt
                    </button>
                  )}
                  {d.readyForBlockchain && d.status !== 'COMPLETED' && (
                    <button onClick={() => navigate(`/donations/${d._id}`)}
                      className="bg-purple-700 hover:bg-purple-600 text-white text-xs py-1 px-2 rounded-lg">
                      ⛓ Record
                    </button>
                  )}
                  {d.txHash && <TxHashBadge hash={d.txHash} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── HospitalDashboard ─────────────────────────────────────────────────────────
export default function HospitalDashboard() {
  const { user } = useAuthStore()
  const [stats, setStats]     = useState(null)
  const [showModal, setModal] = useState(false)
  const [tab, setTab]         = useState('donations')

  const loadStats = async () => {
    try {
      const res = await getHospitalStats()
      setStats(res.data)
    } catch {}
  }

  useEffect(() => { loadStats() }, [])

  const TABS = [
    { id: 'donations',  label: '📋 Incoming Donations' },
    { id: 'inventory',  label: '🩸 Blood Inventory' },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Requests"    value={stats?.requests?.open}      color="text-blood-400" />
        <StatCard label="Active Donations" value={(stats?.donations?.pending || 0) + (stats?.donations?.donorConfirmed || 0)} color="text-blue-400" />
        <StatCard label="Completed"        value={stats?.donations?.completed} color="text-green-400" />
        <StatCard label="BDC Issued"       value={stats?.totalBDCIssued}       color="text-yellow-400" />
      </div>

      {/* Tab bar + Post Request button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === id ? 'bg-blood-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'donations' && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Post Blood Request
          </button>
        )}
      </div>

      {/* Tab content */}
      {tab === 'donations' && <IncomingDonationsTable onRefresh={loadStats} />}
      {tab === 'inventory' && <HospitalInventoryPage hospitalId={user?._id || user?.id} />}

      {showModal && (
        <CreateRequestModal
          onClose={() => setModal(false)}
          onSuccess={loadStats}
        />
      )}
    </div>
  )
}