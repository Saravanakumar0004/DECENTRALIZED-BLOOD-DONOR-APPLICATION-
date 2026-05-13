import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useRequestStore } from '../store/requestStore'
import { getMyDonations, donorConfirm, uploadProof } from '../api/donations'
import {
  BloodBadge, UrgencyChip, StatusBadge, StatusStep,
  BDCCounter, EmptyState, CardSkeleton, ConfirmDialog, TxHashBadge,
} from '../components/ui/index'
import { formatDate } from '../utils/formatters'
import { fileUrl, isPdf } from '../utils/fileUrl'   // ← new helper
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Clock, Droplets, User, HeartPulse,
  ShieldCheck, BadgeCheck, FileText, ImageIcon, RefreshCw,
} from 'lucide-react'
import DonorMap from '../components/donor/DonorMap'
import PublicInventoryPage from './PublicInventoryPage'

// ── RequestCard ───────────────────────────────────────────────────────────────
function RequestCard({ req, onAccept }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading]       = useState(false)

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
          <button onClick={() => setConfirming(true)} className="btn-primary text-xs px-3 py-1.5">
            Accept Request
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Accept Blood Request?"
        message={`You are committing to donate ${req.bloodGroup} blood to ${
          req.hospital?.hospitalName || 'this hospital'
        }. Please only accept if you are eligible and available.`}
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
    try { await donorConfirm(id); toast.success('Donation confirmed!'); load() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const handleUpload = async (id, file) => {
    try { await uploadProof(id, file); toast.success('Proof uploaded!'); load() }
    catch { toast.error('Upload failed') }
  }

  if (loading) return <div className="grid gap-3">{[1,2,3].map(i => <CardSkeleton key={i} />)}</div>
  if (!donations.length) return (
    <EmptyState title="No donations yet" description="Accept a blood request to start your donation journey." />
  )

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
              <td className="px-4 py-3 text-slate-200 font-medium">
                {d.hospital?.hospitalName || d.hospital?.name}
              </td>
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function TagList({ items }) {
  if (!items || items.length === 0)
    return <span className="text-slate-600 text-xs italic">None</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-300">
          {t}
        </span>
      ))}
    </div>
  )
}

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

// ── DocPreview ─────────────────────────────────────────────────────────────────
// Resolves the stored path → full URL, then shows:
//   • image  → thumbnail (clicks open full size)
//   • pdf    → "View PDF" link
//   • null   → "Not uploaded"
function DocPreview({ path, label }) {
  const [imgError, setImgError] = useState(false)
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

  // Image — thumbnail + fallback link if load fails
  if (!imgError) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" title={`Open ${label}`}>
        <img
          src={url}
          alt={label}
          onError={() => setImgError(true)}
          className="h-16 w-24 object-cover rounded-lg border border-slate-700 hover:border-blood-600 transition-colors cursor-pointer"
        />
      </a>
    )
  }

  // Image failed to load — show a plain link instead
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-blood-400 hover:text-blood-300 underline underline-offset-2">
      <ImageIcon size={12} /> View Image
    </a>
  )
}

// ── DonorProfile ──────────────────────────────────────────────────────────────
function DonorProfile({ user, onRefresh, refreshing }) {
  const photoUrl = fileUrl(user?.profilePhoto)
  const [avatarError, setAvatarError] = useState(false)

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const fitColor = user?.fitForDonation === true
    ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800'
    : user?.fitForDonation === false
      ? 'bg-red-900/40 text-red-400 border-red-800'
      : 'bg-slate-800 text-slate-400 border-slate-700'

  const fitLabel = user?.fitForDonation === true
    ? '✓ Fit to Donate'
    : user?.fitForDonation === false
      ? '✗ Not Fit to Donate'
      : 'Eligibility Unknown'

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

      {/* Hero */}
      <div className="card border-slate-800">
        <div className="flex items-start gap-4 mb-5">

          {/* Avatar — profile photo if available, else initials */}
          <div className="w-16 h-16 rounded-2xl bg-blood-900/50 border border-blood-800 flex items-center justify-center shrink-0 overflow-hidden">
            {photoUrl && !avatarError ? (
              <img
                src={photoUrl}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span className="text-blood-300 font-display text-xl">{initials}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-display text-slate-100 truncate">{user?.name || '—'}</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{user?.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center justify-center w-10 h-8 rounded-lg bg-blood-900/60 border border-blood-700 text-blood-300 text-xs font-bold font-mono">
                {user?.bloodGroup || '—'}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full border ${fitColor}`}>
                {fitLabel}
              </span>
              {user?.isVerified && (
                <span className="text-xs px-2.5 py-1 rounded-full border bg-blue-900/30 text-blue-400 border-blue-800 flex items-center gap-1">
                  <BadgeCheck size={11} /> Verified
                </span>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500">BDC Balance</p>
            <p className="text-2xl font-display text-blood-400">{user?.bdcBalance ?? 0}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Age',           value: user?.age             ? `${user.age} yrs`              : '—' },
            { label: 'Weight',        value: user?.weight          ? `${user.weight} kg`             : '—' },
            { label: 'Hemoglobin',    value: user?.hemoglobinLevel ? `${user.hemoglobinLevel} g/dL`  : '—' },
            { label: 'Last Donation', value: user?.lastDonationDate ? formatDate(user.lastDonationDate) : 'First time' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
              <p className="text-sm font-semibold text-slate-100">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Personal */}
      <SectionCard icon={User} title="Personal Details">
        <InfoRow label="Gender"            value={user?.gender} />
        <InfoRow label="Date of Birth"     value={user?.dateOfBirth
          ? new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
          : null} />
        <InfoRow label="Mobile"            value={user?.mobileNumber} />
        <InfoRow label="Emergency Contact" value={user?.emergencyContactNumber} />
        <InfoRow label="Govt. ID Number"   value={user?.governmentIdNumber} />
        <InfoRow label="Address"           value={user?.address} />
        <InfoRow label="City / State"      value={[user?.city, user?.state].filter(Boolean).join(', ') || null} />
        <InfoRow label="Pincode"           value={user?.pincode} />
        <InfoRow label="Coordinates"       value={(user?.lat && user?.lng) ? `${user.lat}, ${user.lng}` : null} />
      </SectionCard>

      {/* Medical */}
      <SectionCard icon={HeartPulse} title="Medical Information">
        <InfoRow label="Smoking Status"      value={user?.smokingStatus} />
        <InfoRow label="Alcohol Status"      value={user?.alcoholStatus} />
        <InfoRow label="COVID / Vaccination" value={user?.covidVaccinationStatus} />
        <InfoRow label="Health Conditions"><TagList items={user?.healthConditions} /></InfoRow>
        <InfoRow label="Current Medications"><TagList items={user?.currentMedications} /></InfoRow>
        <InfoRow label="Allergies"><TagList items={user?.allergies} /></InfoRow>
        <InfoRow label="Surgery History"><TagList items={user?.surgeryHistory} /></InfoRow>
      </SectionCard>

      {/* Eligibility & Documents — file fields use DocPreview */}
      <SectionCard icon={ShieldCheck} title="Eligibility & Documents">
        <InfoRow label="Fit for Donation">
          <span className={`text-xs px-2.5 py-1 rounded-full border ${fitColor}`}>{fitLabel}</span>
        </InfoRow>
        <InfoRow label="Profile Photo">
          <DocPreview path={user?.profilePhoto} label="Profile Photo" />
        </InfoRow>
        <InfoRow label="Medical Report">
          <DocPreview path={user?.medicalReportCertificate} label="Medical Report" />
        </InfoRow>
      </SectionCard>

      {/* Account */}
      <SectionCard icon={BadgeCheck} title="Account">
        <InfoRow label="Role"           value={user?.role} />
        <InfoRow label="Verified"       value={user?.isVerified ? 'Yes' : 'No'} />
        <InfoRow label="Member Since"   value={user?.createdAt
          ? new Date(user.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
          : null} />
        <InfoRow label="Wallet Address" value={user?.walletAddress} />
      </SectionCard>

    </div>
  )
}

// ── DonorDashboard ────────────────────────────────────────────────────────────
export default function DonorDashboard() {
  const { user, refreshUser }                = useAuthStore()
  const { requests, loading, fetchRequests } = useRequestStore()
  const [tab, setTab]                        = useState('requests')
  const [bgFilter, setBg]                    = useState('')
  const [urgFilter, setUrg]                  = useState('')
  const [refreshing, setRefreshing]          = useState(false)

  useEffect(() => { fetchRequests({ status: 'OPEN' }) }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshUser()
    setRefreshing(false)
    toast.success('Profile refreshed')
  }

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
    if (bgFilter  && r.bloodGroup   !== bgFilter)  return false
    if (urgFilter && r.urgencyLevel !== urgFilter) return false
    return true
  })

  const TABS = [
    { id: 'requests',  label: `Available (${requests.filter(r => r.status === 'OPEN').length})` },
    { id: 'donations', label: 'My Donations' },
    { id: 'profile',   label: '👤 My Profile' },
    { id: 'inventory', label: '🩸 Blood Availability' },
    { id: 'map',       label: 'Map View' },
  ]

  return (
    <div className="animate-fade-in">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display text-slate-100">
            WELCOME, {user?.name?.split(' ')[0]?.toUpperCase()}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Blood Group: <span className="text-slate-300 font-medium">{user?.bloodGroup}</span>
          </p>
        </div>
        <BDCCounter balance={user?.bdcBalance || 0} />
      </div>

      <div className="flex gap-1 bg-slate-900 rounded-xl p-1 mb-6 w-fit border border-slate-800 flex-wrap">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === id ? 'bg-blood-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

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

      {tab === 'donations' && <MyDonationsTable />}
      {tab === 'profile'   && <DonorProfile user={user} onRefresh={handleRefresh} refreshing={refreshing} />}
      {tab === 'inventory' && <PublicInventoryPage />}
      {tab === 'map'       && <DonorMap />}

    </div>
  )
}