// ── HospitalDonationsPage.jsx ─────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { getHospitalDonations } from '../api/admin'
import { receiverConfirm } from '../api/donations'
import { BloodBadge, StatusBadge, TxHashBadge, LoadingSpinner, EmptyState } from '../components/ui/index'
import { formatDate } from '../utils/formatters'
import { fileUrl, isPdf } from '../utils/fileUrl'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  X, BadgeCheck, User, HeartPulse, ShieldCheck,
  FileText, ImageIcon, ChevronRight,
} from 'lucide-react'

// ── Helpers (mirrored from AdminUsersPage) ────────────────────────────────────
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
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-800/70 last:border-0">
      <span className="text-xs text-slate-500 shrink-0 w-40">{label}</span>
      <div className="text-xs text-slate-200 text-right break-words max-w-[55%]">
        {children ?? (value != null && value !== ''
          ? value
          : <span className="text-slate-700 italic">—</span>
        )}
      </div>
    </div>
  )
}

function SectionHead({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-2">
      <Icon size={13} className="text-blood-400 shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</span>
    </div>
  )
}

function DocPreview({ path, label }) {
  const [err, setErr] = useState(false)
  const url = fileUrl(path)
  if (!url) return <span className="text-slate-700 italic text-xs">Not uploaded</span>
  if (isPdf(path)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-blood-400 hover:text-blood-300 underline underline-offset-2">
        <FileText size={11} /> View PDF
      </a>
    )
  }
  if (!err) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={label} onError={() => setErr(true)}
          className="h-14 w-20 object-cover rounded-lg border border-slate-700 hover:border-blood-600 transition-colors" />
      </a>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-blood-400 hover:text-blood-300 underline underline-offset-2">
      <ImageIcon size={11} /> View Image
    </a>
  )
}

// ── DonorDrawer ───────────────────────────────────────────────────────────────
// Shows the full donor profile pulled from the donation's `donor` field.
// The hospital can quickly check eligibility without leaving the page.
function DonorDrawer({ donor: d, onClose }) {
  const [imgErr, setImgErr] = useState(false)
  if (!d) return null

  const initials  = d.name ? d.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'
  const photoUrl  = fileUrl(d.profilePhoto)

  const fitColor = d.fitForDonation === true
    ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800'
    : d.fitForDonation === false
      ? 'bg-red-900/40 text-red-400 border-red-800'
      : 'bg-slate-800 text-slate-500 border-slate-700'

  const fitLabel = d.fitForDonation === true  ? '✓ Fit to Donate'
                 : d.fitForDonation === false ? '✗ Not Fit'
                 : '—'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-slate-950 border-l border-slate-800 z-50
                      overflow-y-auto flex flex-col shadow-2xl animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
          <span className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Donor Profile</span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-1 pb-10">

          {/* ── Identity hero ── */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-14 h-14 rounded-xl bg-blood-900/50 border border-blood-800 flex items-center justify-center shrink-0 overflow-hidden">
              {photoUrl && !imgErr
                ? <img src={photoUrl} alt="photo" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
                : <span className="text-blood-300 font-display text-lg">{initials}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-100 truncate">{d.name}</p>
              <p className="text-xs text-slate-500 truncate">{d.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {d.bloodGroup && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blood-900/50 border border-blood-800 text-blood-300 font-mono">
                    {d.bloodGroup}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border ${fitColor}`}>
                  {fitLabel}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${d.isVerified
                  ? 'bg-green-900/40 text-green-400 border border-green-800'
                  : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                  {d.isVerified ? '✓ Verified' : 'Unverified'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Personal Details ── */}
          <SectionHead icon={User} title="Personal Details" />
          <InfoRow label="Gender"             value={d.gender} />
          <InfoRow label="Date of Birth"      value={d.dateOfBirth ? new Date(d.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
          <InfoRow label="Age"                value={d.age ? `${d.age} yrs` : null} />
          <InfoRow label="Weight"             value={d.weight ? `${d.weight} kg` : null} />
          <InfoRow label="Mobile"             value={d.mobileNumber} />
          <InfoRow label="Emergency Contact"  value={d.emergencyContactNumber} />
          <InfoRow label="Address"            value={d.address} />
          <InfoRow label="City / State"       value={[d.city, d.state].filter(Boolean).join(', ') || null} />
          <InfoRow label="Pincode"            value={d.pincode} />

          {/* ── Medical ── */}
          <SectionHead icon={HeartPulse} title="Medical Info" />
          <InfoRow label="Hemoglobin"         value={d.hemoglobinLevel ? `${d.hemoglobinLevel} g/dL` : null} />
          <InfoRow label="Last Donation"      value={d.lastDonationDate ? formatDate(d.lastDonationDate) : 'First time'} />
          <InfoRow label="Smoking"            value={d.smokingStatus} />
          <InfoRow label="Alcohol"            value={d.alcoholStatus} />
          <InfoRow label="COVID Vaccination"  value={d.covidVaccinationStatus} />
          <InfoRow label="Health Conditions"><TagList items={d.healthConditions} /></InfoRow>
          <InfoRow label="Current Medications"><TagList items={d.currentMedications} /></InfoRow>
          <InfoRow label="Allergies"><TagList items={d.allergies} /></InfoRow>
          <InfoRow label="Surgery History"><TagList items={d.surgeryHistory} /></InfoRow>

          {/* ── Eligibility & Documents ── */}
          <SectionHead icon={ShieldCheck} title="Eligibility & Documents" />
          <InfoRow label="Fit for Donation">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${fitColor}`}>{fitLabel}</span>
          </InfoRow>
          <InfoRow label="Govt. ID"           value={d.governmentIdNumber} />
          <InfoRow label="Profile Photo">
            <DocPreview path={d.profilePhoto} label="Profile Photo" />
          </InfoRow>
          <InfoRow label="Medical Report">
            <DocPreview path={d.medicalReportCertificate} label="Medical Report" />
          </InfoRow>
        </div>
      </div>
    </>
  )
}

// ── HospitalDonationsPage ─────────────────────────────────────────────────────
export function HospitalDonationsPage() {
  const [donations,    setDonations]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [bagIds,       setBagIds]       = useState({})
  const [selectedDonor, setSelectedDonor] = useState(null) // donor shown in drawer
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const r = await getHospitalDonations()
      setDonations(r.data.data)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleConfirm = async (id) => {
    const bid = bagIds[id]?.trim()
    if (!bid) return toast.error('Enter Blood Bag ID first')
    try {
      await receiverConfirm(id, bid)
      toast.success('Receipt confirmed!')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    }
  }

  if (loading) return <LoadingSpinner className="py-20" />
  if (!donations.length) return (
    <EmptyState
      title="No donations"
      description="Donations appear here when donors accept your requests."
    />
  )

  return (
    <div className="animate-fade-in overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
          <tr>
            {['Donor', 'Blood', 'Status', 'Blood Bag ID', 'Date', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {donations.map(d => (
            <tr key={d._id} className="hover:bg-slate-900/50 group">

              {/* ── Donor cell — click opens profile drawer ── */}
              <td
                className="px-4 py-3 cursor-pointer"
                onClick={() => setSelectedDonor(d.donor)}
                title="View donor profile"
              >
                <div className="flex items-center gap-1.5">
                  <div>
                    <p className="text-slate-200 font-medium group-hover:text-blood-300 transition-colors">
                      {d.donor?.name}
                    </p>
                    <p className="text-xs text-slate-500">{d.donor?.email}</p>
                  </div>
                  <ChevronRight
                    size={12}
                    className="text-slate-700 group-hover:text-blood-400 transition-colors ml-1 shrink-0"
                  />
                </div>
              </td>

              <td className="px-4 py-3">
                <BloodBadge group={d.request?.bloodGroup} />
              </td>

              <td className="px-4 py-3">
                <StatusBadge status={d.status} />
              </td>

              <td className="px-4 py-3">
                {d.receiverConfirmed ? (
                  <span className="text-xs font-mono text-slate-400">{d.bloodBagId}</span>
                ) : (
                  <input
                    className="input text-xs py-1.5 w-36"
                    placeholder="BAG-001"
                    value={bagIds[d._id] || ''}
                    onChange={e => setBagIds(p => ({ ...p, [d._id]: e.target.value }))}
                  />
                )}
              </td>

              <td className="px-4 py-3 text-slate-500 text-xs">
                {formatDate(d.createdAt)}
              </td>

              <td className="px-4 py-3">
                <div className="flex gap-2 flex-wrap">
                  {!d.receiverConfirmed && (
                    <button
                      onClick={() => handleConfirm(d._id)}
                      className="btn-primary text-xs py-1 px-2"
                    >
                      Confirm
                    </button>
                  )}
                  {d.readyForBlockchain && d.status !== 'COMPLETED' && (
                    <button
                      onClick={() => navigate(`/donations/${d._id}`)}
                      className="bg-purple-700 hover:bg-purple-600 text-white text-xs py-1 px-2 rounded-lg"
                    >
                      ⛓
                    </button>
                  )}
                  {d.txHash && <TxHashBadge hash={d.txHash} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Donor profile drawer ── */}
      <DonorDrawer
        donor={selectedDonor}
        onClose={() => setSelectedDonor(null)}
      />
    </div>
  )
}

export default HospitalDonationsPage