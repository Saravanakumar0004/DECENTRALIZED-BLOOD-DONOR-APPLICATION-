import { useState, useEffect } from 'react'
import { getHospitalStats, getHospitalDonations } from '../api/admin'
import { createRequest } from '../api/requests'
import { receiverConfirm, uploadReceipt } from '../api/donations'
import {
  BloodBadge, UrgencyChip, StatusBadge, TxHashBadge,
  EmptyState, LoadingSpinner, ConfirmDialog,
} from '../components/ui/index'
import { formatDate } from '../utils/formatters'
import { fileUrl, isPdf } from '../utils/fileUrl'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import {
  Plus, X, Building2, Phone, MapPin, ShieldCheck,
  HeartPulse, BadgeCheck, FileText, ImageIcon, RefreshCw,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import HospitalInventoryPage from './HospitalInventoryPage'

const BLOOD_GROUPS = ['A+','A-','B+','B-','O+','O-','AB+','AB-']
const URGENCY      = ['Critical','High','Medium']

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = 'text-slate-100' }) {
  return (
    <div className="card text-center">
      <p className={`font-display text-4xl ${color} mb-1`}>{value ?? '—'}</p>
      <p className="text-slate-500 text-xs uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ── CreateRequestModal ────────────────────────────────────────────────────────
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
      await createRequest({
        ...form,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        unitsRequired: parseInt(form.unitsRequired),
      })
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
              <input type="number" step="any" className="input" value={form.lat}
                onChange={e => set('lat', e.target.value)} />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input type="number" step="any" className="input" value={form.lng}
                onChange={e => set('lng', e.target.value)} />
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
  if (!donations.length) return (
    <EmptyState icon="📋" title="No incoming donations"
      description="Donations will appear here when donors accept your requests." />
  )

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

// ── Shared tiny helpers ───────────────────────────────────────────────────────
function InfoRow({ label, value, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 shrink-0 w-44">{label}</span>
      <div className="text-sm text-slate-200 text-right">
        {children ?? (value != null && value !== ''
          ? value
          : <span className="text-slate-600 italic text-xs">—</span>
        )}
      </div>
    </div>
  )
}

function TagList({ items }) {
  if (!items || items.length === 0)
    return <span className="text-slate-600 text-xs italic">None</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t}
          className="px-2 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-300">
          {t}
        </span>
      ))}
    </div>
  )
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="card border-slate-800">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className="text-blood-400" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</span>
      </div>
      {children}
    </div>
  )
}

// ── DocPreview ────────────────────────────────────────────────────────────────
function DocPreview({ path, label }) {
  const [imgErr, setImgErr] = useState(false)
  const url = fileUrl(path)

  if (!url) return <span className="text-slate-600 italic text-xs">Not uploaded</span>

  if (isPdf(path)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-blood-400 hover:text-blood-300 underline underline-offset-2">
        <FileText size={12} /> View PDF
      </a>
    )
  }

  if (!imgErr) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" title={`Open ${label}`}>
        <img src={url} alt={label} onError={() => setImgErr(true)}
          className="h-16 w-24 object-cover rounded-lg border border-slate-700 hover:border-blood-600 transition-colors cursor-pointer" />
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-blood-400 hover:text-blood-300 underline underline-offset-2">
      <ImageIcon size={12} /> View Image
    </a>
  )
}

// ── HospitalProfile ───────────────────────────────────────────────────────────
function HospitalProfile({ user, onRefresh, refreshing }) {
  const [logoErr, setLogoErr] = useState(false)
  const photoUrl = fileUrl(user?.hospitalPhoto)

  const initials = user?.hospitalName
    ? user.hospitalName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <div className="space-y-4">

      {/* Refresh */}
      <div className="flex justify-end">
        <button onClick={onRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh profile'}
        </button>
      </div>

      {/* ── Hero card ── */}
      <div className="card border-slate-800">
        <div className="flex items-start gap-4 mb-5">

          {/* Hospital photo / initials */}
          <div className="w-16 h-16 rounded-2xl bg-blue-900/30 border border-blue-800/50 flex items-center justify-center shrink-0 overflow-hidden">
            {photoUrl && !logoErr ? (
              <img src={photoUrl} alt="Hospital" className="w-full h-full object-cover"
                onError={() => setLogoErr(true)} />
            ) : (
              <span className="text-blue-300 font-display text-xl">{initials}</span>
            )}
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-display text-slate-100 truncate">
              {user?.hospitalName || user?.name || '—'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{user?.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {user?.hospitalType && (
                <span className="text-xs px-2.5 py-1 rounded-full border bg-blue-900/30 text-blue-400 border-blue-800">
                  {user.hospitalType}
                </span>
              )}
              {user?.isVerified ? (
                <span className="text-xs px-2.5 py-1 rounded-full border bg-emerald-900/40 text-emerald-400 border-emerald-800 flex items-center gap-1">
                  <BadgeCheck size={11} /> Verified
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full border bg-slate-800 text-slate-400 border-slate-700">
                  Pending Verification
                </span>
              )}
              {user?.bloodBankAvailable && (
                <span className="text-xs px-2.5 py-1 rounded-full border bg-blood-900/40 text-blood-400 border-blood-800">
                  🩸 Blood Bank
                </span>
              )}
            </div>
          </div>

          {/* BDC */}
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500">BDC Balance</p>
            <p className="text-2xl font-display text-blood-400">{user?.bdcBalance ?? 0}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Type',         value: user?.hospitalType      || '—' },
            { label: 'Established',  value: user?.establishedYear   || '—' },
            { label: 'Storage Cap.', value: user?.bloodStorageCapacity ? `${user.bloodStorageCapacity} units` : '—' },
            { label: '24×7 Service', value: user?.is24x7Service === true ? 'Yes' : user?.is24x7Service === false ? 'No' : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
              <p className="text-sm font-semibold text-slate-100">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Hospital Info ── */}
      <SectionCard icon={Building2} title="Hospital Information">
        <InfoRow label="Hospital Name"     value={user?.hospitalName} />
        <InfoRow label="Hospital Type"     value={user?.hospitalType} />
        <InfoRow label="License Number"    value={user?.licenseNumber} />
        <InfoRow label="Reg. Number"       value={user?.registrationNumber} />
        <InfoRow label="Established Year"  value={user?.establishedYear} />
        <InfoRow label="GST Number"        value={user?.gstNumber} />
      </SectionCard>

      {/* ── Contact & Address ── */}
      <SectionCard icon={Phone} title="Contact & Address">
        <InfoRow label="Contact Person"    value={user?.contactPersonName} />
        <InfoRow label="Mobile"            value={user?.hospitalMobile || user?.mobileNumber} />
        <InfoRow label="Telephone"         value={user?.hospitalTelephone} />
        <InfoRow label="Email"             value={user?.email} />
        <InfoRow label="Website"           value={user?.hospitalWebsite} />
        <InfoRow label="Address"           value={user?.hospitalAddress || user?.address} />
        <InfoRow label="City / State"      value={[user?.city, user?.hospitalState || user?.state].filter(Boolean).join(', ') || null} />
        <InfoRow label="Pincode"           value={user?.hospitalPincode || user?.pincode} />
        <InfoRow label="Landmark"          value={user?.hospitalLandmark} />
        <InfoRow label="Coordinates"       value={(user?.lat && user?.lng) ? `${user.lat}, ${user.lng}` : null} />
      </SectionCard>

      {/* ── Blood Bank ── */}
      <SectionCard icon={HeartPulse} title="Blood Bank Details">
        <InfoRow label="Blood Bank Available"
          value={user?.bloodBankAvailable === true ? 'Yes' : user?.bloodBankAvailable === false ? 'No' : null} />
        <InfoRow label="Storage Capacity"
          value={user?.bloodStorageCapacity ? `${user.bloodStorageCapacity} units` : null} />
        <InfoRow label="Emergency Service"
          value={user?.emergencyServiceAvailable === true ? 'Yes' : user?.emergencyServiceAvailable === false ? 'No' : null} />
        <InfoRow label="24×7 Service"
          value={user?.is24x7Service === true ? 'Yes' : user?.is24x7Service === false ? 'No' : null} />
        <InfoRow label="Available Blood Groups">
          <TagList items={user?.availableBloodGroups} />
        </InfoRow>
      </SectionCard>

      {/* ── Documents ── */}
      <SectionCard icon={ShieldCheck} title="Verification Documents">
        <InfoRow label="Hospital Photo">
          <DocPreview path={user?.hospitalPhoto} label="Hospital Photo" />
        </InfoRow>
        <InfoRow label="License Certificate">
          <DocPreview path={user?.hospitalLicenseCertificate} label="License Certificate" />
        </InfoRow>
        <InfoRow label="Govt. Approval">
          <DocPreview path={user?.governmentApprovalDocument} label="Govt. Approval Document" />
        </InfoRow>
        <InfoRow label="Admin ID Proof">
          <DocPreview path={user?.adminIdProof} label="Admin ID Proof" />
        </InfoRow>
      </SectionCard>

      {/* ── Account ── */}
      <SectionCard icon={BadgeCheck} title="Account">
        <InfoRow label="Role"         value={user?.role} />
        <InfoRow label="Verified"     value={user?.isVerified ? 'Yes' : 'No'} />
        <InfoRow label="Member Since" value={user?.createdAt
          ? new Date(user.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
          : null} />
        <InfoRow label="Wallet Address" value={user?.walletAddress} />
      </SectionCard>

    </div>
  )
}

// ── HospitalDashboard ─────────────────────────────────────────────────────────
export default function HospitalDashboard() {
  const { user, refreshUser }     = useAuthStore()
  const [stats, setStats]         = useState(null)
  const [showModal, setModal]     = useState(false)
  const [tab, setTab]             = useState('donations')
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = async () => {
    try {
      const res = await getHospitalStats()
      setStats(res.data)
    } catch {}
  }

  useEffect(() => { loadStats() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshUser()
    setRefreshing(false)
    toast.success('Profile refreshed')
  }

  const TABS = [
    { id: 'donations',  label: '📋 Incoming Donations' },
    { id: 'inventory',  label: '🩸 Blood Inventory'    },
    { id: 'profile',    label: '🏥 My Profile'         },
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
        <div className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800 flex-wrap">
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
      {tab === 'profile'   && <HospitalProfile user={user} onRefresh={handleRefresh} refreshing={refreshing} />}

      {showModal && (
        <CreateRequestModal onClose={() => setModal(false)} onSuccess={loadStats} />
      )}
    </div>
  )
}