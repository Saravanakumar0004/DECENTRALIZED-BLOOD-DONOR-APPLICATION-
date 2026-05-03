import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useRequestStore } from '../store/requestStore'
import { getMyDonations, donorConfirm, uploadProof } from '../api/donations'
import { BloodBadge, UrgencyChip, StatusBadge, StatusStep, BDCCounter, EmptyState, CardSkeleton, ConfirmDialog, TxHashBadge } from '../components/ui/index'
import { formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Clock, Droplets } from 'lucide-react'
import DonorMap from '../components/donor/DonorMap'
import PublicInventoryPage from './PublicInventoryPage'

const BLOOD_GROUPS = ['A+','A-','B+','B-','O+','O-','AB+','AB-']

// ── RequestCard ───────────────────────────────────────────────────────────────
function RequestCard({ req, onAccept }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    setLoading(true)
    try { await onAccept(req._id) }
    finally { setLoading(false); setConfirming(false) }
  }

  return (
    <>
      <div className="card hover:border-slate-700 transition-all animate-fade-in">
        <div className="flex items-start justify-between mb-3">
          <BloodBadge group={req.bloodGroup} />
          <UrgencyChip level={req.urgencyLevel} />
        </div>
        <h3 className="font-medium text-slate-100 mb-1 truncate">
          {req.hospital?.hospitalName || req.hospital?.name}
        </h3>
        <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
          <MapPin size={12} /> {req.location?.city}
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-4">
          <Droplets size={12} /> {req.unitsRequired} unit{req.unitsRequired > 1 ? 's' : ''} needed
        </div>
        {req.notes && <p className="text-xs text-slate-500 mb-4 line-clamp-2">{req.notes}</p>}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">
            <Clock size={10} className="inline mr-1" />
            {formatDate(req.createdAt)}
          </span>
          <button onClick={() => setConfirming(true)}
            className="btn-primary text-xs px-3 py-1.5">
            Accept Request
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Accept Blood Request?"
        message={`You are committing to donate ${req.bloodGroup} blood to ${req.hospital?.hospitalName || 'this hospital'}. Please only accept if you are eligible and available.`}
        onConfirm={handleAccept}
        onCancel={() => setConfirming(false)}
        danger
      />
    </>
  )
}

// ── MyDonationsTable ──────────────────────────────────────────────────────────
function MyDonationsTable() {
  const [donations, setDonations] = useState([])
  const [loading, setLoading]     = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const res = await getMyDonations()
      setDonations(res.data.data)
    } catch { toast.error('Failed to load donations') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleConfirm = async (id) => {
    try {
      await donorConfirm(id)
      toast.success('Donation confirmed!')
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const handleUpload = async (id, file) => {
    try {
      await uploadProof(id, file)
      toast.success('Proof uploaded!')
      load()
    } catch { toast.error('Upload failed') }
  }

  if (loading) return <div className="grid gap-3">{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>
  if (!donations.length) return <EmptyState title="No donations yet" description="Accept a blood request to start your donation journey." />

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
          <tr>
            {['Hospital','Blood','Date','Progress','Status','Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {donations.map((d) => (
            <tr key={d._id} className="hover:bg-slate-900/50 transition-colors">
              <td className="px-4 py-3 text-slate-200 font-medium">{d.hospital?.hospitalName || d.hospital?.name}</td>
              <td className="px-4 py-3"><BloodBadge group={d.request?.bloodGroup} /></td>
              <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(d.createdAt)}</td>
              <td className="px-4 py-3"><StatusStep status={d.status} /></td>
              <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
              <td className="px-4 py-3">
                <div className="flex gap-2 flex-wrap">
                  {d.status === 'PENDING' && (
                    <button onClick={() => handleConfirm(d._id)} className="btn-primary text-xs py-1 px-2">
                      Confirm Donation
                    </button>
                  )}
                  {!d.proofImageUrl && d.status !== 'COMPLETED' && (
                    <label className="btn-secondary text-xs py-1 px-2 cursor-pointer">
                      Upload Proof
                      <input type="file" accept="image/*,.pdf" hidden
                        onChange={(e) => e.target.files[0] && handleUpload(d._id, e.target.files[0])} />
                    </label>
                  )}
                  {d.readyForBlockchain && d.status !== 'COMPLETED' && (
                    <button onClick={() => navigate(`/donations/${d._id}`)}
                      className="bg-purple-700 hover:bg-purple-600 text-white text-xs py-1 px-2 rounded-lg transition-all">
                      ⛓ Record On-Chain
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

// ── DonorDashboard ────────────────────────────────────────────────────────────
export default function DonorDashboard() {
  const { user } = useAuthStore()
  const { requests, loading, fetchRequests } = useRequestStore()
  const [tab, setTab]         = useState('requests')
  const [bgFilter, setBg]     = useState('')
  const [urgFilter, setUrg]   = useState('')

  useEffect(() => { fetchRequests({ status: 'OPEN' }) }, [])

  const handleAccept = async (id) => {
    const { acceptRequest } = await import('../api/requests')
    try {
      const res = await acceptRequest(id)
      toast.success('Request accepted! Proceed to donate.')
      fetchRequests({ status: 'OPEN' })
      return res
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not accept request')
    }
  }

  const filtered = requests.filter((r) => {
    if (bgFilter  && r.bloodGroup    !== bgFilter)  return false
    if (urgFilter && r.urgencyLevel  !== urgFilter) return false
    return true
  })

  const TABS = [
    { id: 'requests',   label: `Available (${requests.filter(r=>r.status==='OPEN').length})` },
    { id: 'donations',  label: 'My Donations' },
    { id: 'inventory',  label: '🩸 Blood Availability' },
    { id: 'map',        label: 'Map View' },
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display text-slate-100">
            WELCOME, {user?.name?.split(' ')[0]?.toUpperCase()}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Blood Group: <span className="text-slate-300 font-medium">{user?.bloodGroup}</span></p>
        </div>
        <BDCCounter balance={user?.bdcBalance || 0} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 rounded-xl p-1 mb-6 w-fit border border-slate-800 flex-wrap">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === id ? 'bg-blood-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Available Requests */}
      {tab === 'requests' && (
        <>
          <div className="flex flex-wrap gap-3 mb-5">
            <select className="input w-auto text-sm" value={bgFilter} onChange={(e) => setBg(e.target.value)}>
              <option value="">All Blood Groups</option>
              {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => <option key={g}>{g}</option>)}
            </select>
            <select className="input w-auto text-sm" value={urgFilter} onChange={(e) => setUrg(e.target.value)}>
              <option value="">All Urgency</option>
              {['Critical','High','Medium'].map(u => <option key={u}>{u}</option>)}
            </select>
            {(bgFilter || urgFilter) && (
              <button className="btn-ghost text-xs" onClick={() => { setBg(''); setUrg('') }}>Clear filters</button>
            )}
          </div>
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <CardSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="🩸" title="No open requests" description="No blood requests match your filters right now." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((r) => <RequestCard key={r._id} req={r} onAccept={handleAccept} />)}
            </div>
          )}
        </>
      )}

      {tab === 'donations'  && <MyDonationsTable />}
      {tab === 'inventory'  && <PublicInventoryPage />}
      {tab === 'map'        && <DonorMap />}
    </div>
  )
}